import { model, Types } from 'mongoose';
import { coverageTestConnection } from '../../../test/coverage-test-support';
import { BudgetsService } from './budgets.service';
import { dopPlanningContext } from './currency-policy';
import { BudgetItemSchema } from './schemas/budget-item.schema';
import { BudgetSchema } from './schemas/budget.schema';

const Budget = model('SyntheticNextBudget', BudgetSchema);
const Item = model('SyntheticNextBudgetItem', BudgetItemSchema);

describe('BE6 next budget with controlled persistence', () => {
  const owner = new Types.ObjectId();
  const sourceId = new Types.ObjectId();
  const draftId = new Types.ObjectId();
  const itemId = new Types.ObjectId();
  const request = {
    name: 'Synthetic next',
    periodType: 'monthly',
    startDate: '2025-02-02T04:00:00Z',
    timezone: 'America/Santo_Domingo',
  };
  const cutoff = new Date('2025-02-03T04:00:00Z');
  const closedAt = new Date('2025-02-05T04:00:00Z');
  const prior = {
    _id: sourceId,
    userId: owner,
    status: 'closed',
    startDate: new Date('2025-01-01T04:00:00Z'),
    plannedEndDate: new Date(request.startDate),
    actualCutoffDate: cutoff,
    closedAt,
    timezone: request.timezone,
    coverageVersion: 1,
    currencyContext: dopPlanningContext(),
  };
  const configuration = {
    name: 'Synthetic groceries',
    description: 'Synthetic description',
    type: 'expense',
    plannedAmount: 100.125,
    icon: 'cart',
    color: '#112233',
    alertEnabled: false,
    matchingRules: [
      {
        id: 'one',
        field: 'merchant',
        operator: 'equals',
        value: 'Super Market',
        source: 'user',
      },
      {
        id: 'two',
        field: 'description',
        operator: 'contains',
        value: 'Neighborhood Store',
        source: 'learned',
      },
      {
        id: 'three',
        field: 'merchant',
        operator: 'contains',
        value: 'Groceries',
        source: 'suggested',
      },
    ],
  };
  const query = <T>(value: T) => ({
    exec: () => Promise.resolve(value),
    lean: () => query(value),
    limit: () => query(value),
    session: () => query(value),
  });

  function fixture() {
    const current = new Budget({
      ...request,
      _id: draftId,
      userId: owner,
      coverageVersion: 1,
      currencyContext: dopPlanningContext(),
      status: 'draft',
    });
    const connection = coverageTestConnection();
    const report = jest.fn(() =>
      query<{ _id: Types.ObjectId } | null>({ _id: new Types.ObjectId() }),
    );
    const state = {
      source: { ...prior },
      retained: [{ ...prior }],
      sourceItems: [{ _id: itemId, ...configuration }],
    };
    const insert = jest.fn<
      Promise<InstanceType<typeof Item>[]>,
      [object[], unknown]
    >((rows) =>
      Promise.all(
        rows.map(async (row) => {
          const item = new Item(row);
          await item.validate();
          return item;
        }),
      ),
    );
    const save = jest.fn<
      Promise<InstanceType<typeof Budget>>,
      [InstanceType<typeof Budget>, unknown]
    >((budget) => Promise.resolve(budget));
    const loadBudget = (filter: { _id: Types.ObjectId }) =>
      query(
        filter._id.equals(draftId)
          ? current
          : filter._id.equals(sourceId)
            ? state.source
            : null,
      );
    const findOne = jest.fn<
      ReturnType<typeof loadBudget>,
      [{ _id: Types.ObjectId }, unknown, unknown]
    >(loadBudget);
    const loadItems = () => query(state.sourceItems);
    const findItems = jest.fn<
      ReturnType<typeof loadItems>,
      [unknown, unknown, unknown]
    >(loadItems);
    const update = jest.fn((_filter: unknown, mutation: { $set: object }) => {
      current.set(mutation.$set);
      return query({ matchedCount: 1 });
    });
    class Budgets {
      static db = { ...connection, model: () => ({ exists: report }) };
      static findOne = findOne;
      static find = () => query(state.retained);
      static updateOne = update;

      constructor(data: object) {
        const row = new Budget(data);
        return { save: (options: unknown) => save(row, options) };
      }
    }
    const transactions = { find: jest.fn(() => query([])) };
    const service = new BudgetsService(
      Budgets as never,
      { find: findItems, insertMany: insert } as never,
      transactions as never,
    );
    jest.spyOn(service, 'findOne').mockResolvedValue({} as never);
    return {
      service,
      state,
      connection,
      report,
      save,
      insert,
      findOne,
      findItems,
      update,
      current,
      transactions,
    };
  }

  it.each(['active', 'closed'])(
    'TC1–TC3 copies only scoped live configuration from a %s source',
    async (status) => {
      const f = fixture();
      f.state.source.status = status;
      await f.service.copyDraft(String(sourceId), String(owner), request);
      expect(f.findOne).toHaveBeenCalledWith(
        { _id: sourceId, userId: owner, isDeleted: false, deletedAt: null },
        null,
        { session: f.connection.session },
      );
      expect(f.findItems).toHaveBeenCalledWith(
        {
          budgetId: sourceId,
          userId: owner,
          isDeleted: false,
          deletedAt: null,
        },
        expect.any(Object),
        { session: f.connection.session },
      );
      const [draft, options] = f.save.mock.calls[0];
      expect(options).toEqual({ session: f.connection.session });
      expect(draft).toMatchObject({ userId: owner, status: 'draft' });
      expect(draft._id.equals(sourceId)).toBe(false);
      expect(f.insert).toHaveBeenCalledWith(
        [{ ...configuration, budgetId: draft._id, userId: owner }],
        { session: f.connection.session },
      );
      const items = await (f.insert.mock.results[0].value as Promise<
        InstanceType<typeof Item>[]
      >);
      expect(items[0]._id.equals(itemId)).toBe(false);
      expect(items[0].toObject<typeof configuration>().matchingRules).toEqual(
        configuration.matchingRules,
      );
      expect(f.update).not.toHaveBeenCalled();
      expect(f.transactions.find).not.toHaveBeenCalled();
    },
  );

  it('TC2 rejects corrupt raw rules before any budget or item write', async () => {
    const f = fixture();
    f.state.sourceItems[0] = {
      _id: itemId,
      ...configuration,
      matchingRules: [{ ...configuration.matchingRules[0], operator: 'regex' }],
    };
    await expect(
      f.service.copyDraft(String(sourceId), String(owner), request),
    ).rejects.toMatchObject({
      response: { code: 'invalid_source_item', itemId: String(itemId) },
    });
    expect(f.save).not.toHaveBeenCalled();
    expect(f.insert).not.toHaveBeenCalled();
  });

  it('TC3/TC4 reject malformed and unresolved sources and allow an empty alternative', async () => {
    const f = fixture();
    await expect(
      f.service.copyDraft('malformed', String(owner), request),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      f.service.copyDraft(String(new Types.ObjectId()), String(owner), request),
    ).rejects.toMatchObject({ status: 404 });
    Object.assign(f.state.source, { currencyContext: undefined });
    await expect(
      f.service.copyDraft(String(sourceId), String(owner), request),
    ).rejects.toThrow('currency explicitly as DOP');
    expect(f.save).not.toHaveBeenCalled();
    await f.service.create(String(owner), { ...request, status: 'draft' });
    expect(f.save).toHaveBeenCalledTimes(1);
    expect(f.insert).not.toHaveBeenCalled();
  });

  it('TC5/TC9 block activation before close, default to the confirmed cutoff, and retry without a write', async () => {
    const f = fixture();
    f.state.retained[0].status = 'active';
    await expect(
      f.service.activate(String(draftId), String(owner), {}),
    ).rejects.toMatchObject({ status: 409 });
    expect(f.update).not.toHaveBeenCalled();
    f.state.retained[0].status = 'closed';
    await expect(
      f.service.activate(String(draftId), String(owner), {
        startDate: request.startDate,
      }),
    ).rejects.toThrow('overlaps');
    await f.service.activate(String(draftId), String(owner), {});
    expect(f.report).toHaveBeenCalledWith({
      userId: owner,
      budgetId: sourceId,
      snapshotVersion: 1,
      actualCutoffDate: cutoff,
      closedAt,
      startDate: prior.startDate,
      timezone: prior.timezone,
    });
    expect(f.current).toMatchObject({
      status: 'active',
      startDate: cutoff,
      timezone: request.timezone,
    });
    await f.service.activate(String(draftId), String(owner), {});
    await f.service.activate(String(draftId), String(owner), {
      startDate: '2025-02-03T00:00:00-04:00',
    });
    await expect(
      f.service.activate(String(draftId), String(owner), {
        startDate: request.startDate,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(f.update).toHaveBeenCalledTimes(1);
  });

  it('TC9 replays an omitted start after a competing explicit same-draft activation', async () => {
    const f = fixture();
    const winningStart = new Date('2025-02-04T04:00:00Z');
    const aborted = new Error('controlled transaction abort');
    f.update.mockImplementationOnce(() => ({
      ...query({ matchedCount: 0 }),
      exec: () => Promise.reject(aborted),
    }));
    f.connection.session.withTransaction.mockImplementationOnce(
      async (work) => {
        await expect(work()).rejects.toBe(aborted);
        await f.service.activate(String(draftId), String(owner), {
          startDate: winningStart.toISOString(),
        });
        return work();
      },
    );

    const dto = Object.freeze({});
    await f.service.activate(String(draftId), String(owner), dto);
    expect(f.current.startDate).toEqual(winningStart);
    expect(f.update).toHaveBeenCalledTimes(2);
    await f.service.activate(String(draftId), String(owner), dto);
    expect(f.update).toHaveBeenCalledTimes(2);
  });

  it.each([undefined, '2025-02-04T01:00:00-04:00'])(
    'TC5/TC9 rechecks the confirmed cutoff on replay with requested start %s',
    async (startDate) => {
      const f = fixture();
      const laterCutoff = new Date('2025-02-04T04:00:00Z');
      const aborted = new Error('controlled transaction abort');
      f.update.mockImplementationOnce(() => ({
        ...query({ matchedCount: 0 }),
        exec: () => Promise.reject(aborted),
      }));
      f.connection.session.withTransaction.mockImplementationOnce(
        async (work) => {
          await expect(work()).rejects.toBe(aborted);
          f.state.retained[0].actualCutoffDate = laterCutoff;
          return work();
        },
      );

      await f.service.activate(String(draftId), String(owner), { startDate });
      expect(f.report).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ actualCutoffDate: cutoff }),
      );
      expect(f.report).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ actualCutoffDate: laterCutoff }),
      );
      expect(f.update).toHaveBeenCalledTimes(2);
      expect(f.current.startDate).toEqual(
        startDate ? new Date(startDate) : laterCutoff,
      );
    },
  );

  it('TC5 blocks absent confirmation and invalid retained lifecycle on create and status PATCH', async () => {
    const f = fixture();
    f.report.mockReturnValueOnce(query(null));
    await expect(
      f.service.create(String(owner), {
        ...request,
        startDate: cutoff.toISOString(),
        status: 'active',
      }),
    ).rejects.toThrow('confirmed final report');
    Object.assign(f.state.retained[0], { actualCutoffDate: undefined });
    await expect(
      f.service.update(String(draftId), String(owner), { status: 'active' }),
    ).rejects.toThrow('invalid retained coverage');
    expect(f.save).not.toHaveBeenCalled();
    expect(f.update).not.toHaveBeenCalled();
  });
});
