import { NotFoundException } from '@nestjs/common';
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
      source: { ...prior, isDeleted: false },
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
    type BudgetFilter =
      | { _id: Types.ObjectId; userId?: Types.ObjectId }
      | { userId: Types.ObjectId; draftOperationKey: string };
    const loadBudget = (filter: BudgetFilter) =>
      query<typeof state.source | InstanceType<typeof Budget> | null>(
        !('_id' in filter)
          ? null
          : filter._id.equals(draftId)
            ? current
            : filter._id.equals(sourceId)
              ? state.source
              : null,
      );
    const findOne = jest.fn<
      ReturnType<typeof loadBudget>,
      [BudgetFilter, unknown, unknown]
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
    const saveItem = jest.fn((item: InstanceType<typeof Item>) =>
      item.validate(),
    );
    class Items {
      static find = findItems;
      static insertMany = insert;

      constructor(data: object) {
        return { save: () => saveItem(new Item(data)) };
      }
    }
    const service = new BudgetsService(
      Budgets as never,
      Items as never,
      transactions as never,
    );
    const readBudget = jest
      .spyOn(service, 'findOne')
      .mockResolvedValue({} as never);
    return {
      service,
      state,
      connection,
      report,
      save,
      insert,
      saveItem,
      findOne,
      findItems,
      update,
      current,
      transactions,
      readBudget,
    };
  }

  // Serialize transaction callbacks as the owner lock would and discard staged
  // writes on abort. Mongo isolation and index enforcement need a real service.
  function draftPersistence() {
    const f = fixture();
    let budgets: InstanceType<typeof Budget>[] = [];
    let items: InstanceType<typeof Item>[] = [];
    let pending = Promise.resolve();
    let abort = false;
    f.connection.session.withTransaction.mockImplementation((work) => {
      const transaction = pending.then(async () => {
        const previousBudgets = budgets.slice();
        const previousItems = items.slice();
        try {
          const result = await work();
          if (abort) {
            abort = false;
            throw new Error('Controlled abort after staged writes');
          }
          return result;
        } catch (error) {
          budgets = previousBudgets;
          items = previousItems;
          throw error;
        }
      });
      pending = transaction.then(
        () => undefined,
        () => undefined,
      );
      return transaction;
    });
    f.findOne.mockImplementation((filter) => {
      if ('_id' in filter)
        return query(
          filter._id.equals(sourceId) &&
            owner.equals(filter.userId) &&
            !f.state.source.isDeleted
            ? f.state.source
            : null,
        );
      return query(
        budgets.find(
          (budget) =>
            budget.userId.equals(filter.userId) &&
            budget.draftOperationKey === filter.draftOperationKey,
        ) ?? null,
      );
    });
    f.save.mockImplementation((budget) => {
      budgets.push(budget);
      return Promise.resolve(budget);
    });
    f.insert.mockImplementation((rows) => {
      const copied = rows.map((row) => new Item(row));
      items.push(...copied);
      return Promise.resolve(copied);
    });
    f.readBudget.mockImplementation((id, user) => {
      const budget = budgets.find(
        (row) =>
          row._id.equals(id) && row.userId.equals(user) && !row.isDeleted,
      );
      if (!budget) return Promise.reject(new NotFoundException());
      const actuals = { actualsComplete: true, currencyIssues: [] };
      return Promise.resolve({
        ...budget.toObject(),
        ...actuals,
        actualsCurrency: 'DOP',
        currencyContextResolved: true,
        items: items
          .filter((item) => item.budgetId.equals(id))
          .map((item) => ({
            ...item.toObject(),
            ...actuals,
            spent: 0,
            spentCurrency: 'DOP',
          })),
      });
    });
    return {
      ...f,
      abortNext: () => {
        abort = true;
      },
      rows: () => ({ budgets, items }),
    };
  }

  const keyedPlan = { ...request, operationKey: 'synthetic-key_01' };
  const emptyDraft = { ...keyedPlan, status: 'draft' };

  it.each(['copy', 'empty'])(
    'FE5 TC12 recovers one %s draft from overlapping calls and a failed response read',
    async (route) => {
      const f = draftPersistence();
      f.readBudget.mockRejectedValueOnce(new Error('Read failed after commit'));
      const create = () =>
        route === 'copy'
          ? f.service.copyDraft(String(sourceId), String(owner), keyedPlan)
          : f.service.create(String(owner), { ...emptyDraft, items: [] });
      const [lost, recovered] = await Promise.allSettled([create(), create()]);
      expect(lost).toMatchObject({
        status: 'rejected',
        reason: new Error('Read failed after commit'),
      });
      expect(recovered.status).toBe('fulfilled');
      if (recovered.status !== 'fulfilled') throw new Error('Replay failed');
      expect(f.rows().budgets).toHaveLength(1);
      expect(f.rows().items).toHaveLength(route === 'copy' ? 1 : 0);

      f.rows().budgets[0].name = 'Later edit';
      f.state.source.isDeleted = true;
      const replay = await create();
      expect(replay._id).toEqual(recovered.value._id);
      expect(replay.items.map((item) => item._id)).toEqual(
        recovered.value.items.map((item) => item._id),
      );
      expect(replay.name).toBe('Later edit');
      expect(f.save).toHaveBeenCalledTimes(1);

      f.rows().budgets[0].isDeleted = true;
      await expect(create()).rejects.toMatchObject({ status: 404 });
      expect(f.save).toHaveBeenCalledTimes(1);
    },
  );

  it('FE5 TC12 binds keys to owner, source, route and normalized validated plan', async () => {
    const f = draftPersistence();
    const user = String(owner);
    const source = String(sourceId);
    const plan = { ...keyedPlan, endDate: '2025-03-01' };
    const saved = await f.service.copyDraft(source, user, plan);
    const equivalent = await f.service.copyDraft(source.toUpperCase(), user, {
      ...keyedPlan,
      startDate: '2025-02-02T00:00:00-04:00',
      plannedEndDate: '2025-03-01T00:00:00Z',
      currency: 'DOP',
    });
    expect(equivalent._id).toEqual(saved._id);
    const conflicts = [
      f.service.copyDraft(source, user, { ...plan, name: 'Changed plan' }),
      f.service.copyDraft(String(new Types.ObjectId()), user, plan),
      f.service.create(user, emptyDraft),
    ];
    await Promise.all(
      conflicts.map((conflict) =>
        expect(conflict).rejects.toMatchObject({
          status: 409,
          response: { code: 'draft_operation_conflict' },
        }),
      ),
    );
    const other = String(new Types.ObjectId());
    await expect(
      f.service.copyDraft(source, other, plan),
    ).rejects.toMatchObject({ status: 404 });
    const separateOwner = await f.service.create(other, emptyDraft);
    const sameOwnerNewAttempt = await f.service.create(user, {
      ...emptyDraft,
      operationKey: 'separate-key',
    });
    expect(separateOwner._id).not.toEqual(saved._id);
    expect(sameOwnerNewAttempt._id).not.toEqual(saved._id);
    expect(f.rows().budgets).toHaveLength(3);
  });

  it.each(['copy', 'empty'])(
    'FE5 TC12 retries %s after an uncommitted write',
    async (route) => {
      const f = draftPersistence();
      const create = () =>
        route === 'copy'
          ? f.service.copyDraft(String(sourceId), String(owner), keyedPlan)
          : f.service.create(String(owner), emptyDraft);
      f.abortNext();
      await expect(create()).rejects.toMatchObject({ status: 503 });
      expect(f.rows()).toEqual({ budgets: [], items: [] });
      expect(f.readBudget).not.toHaveBeenCalled();
      const saved = await create();
      expect((await create())._id).toEqual(saved._id);
      expect(f.rows().budgets).toHaveLength(1);
      expect(f.rows().items).toHaveLength(route === 'copy' ? 1 : 0);
    },
  );

  it('FE5 TC12 rejects keyed nonempty and active POST while preserving no-key creation', async () => {
    const f = draftPersistence();
    const user = String(owner);
    const items = [{ name: 'Groceries', type: 'expense', plannedAmount: 25 }];
    await expect(
      f.service.create(user, { ...emptyDraft, items }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      f.service.create(user, { ...emptyDraft, status: 'active' }),
    ).rejects.toMatchObject({ status: 400 });
    const first = await f.service.create(user, {
      ...request,
      status: 'draft',
      items,
    });
    const second = await f.service.create(user, {
      ...request,
      status: 'draft',
    });
    expect(first._id).not.toEqual(second._id);
    expect(f.rows().items).toHaveLength(1);
  });

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

  it('TC5/TC9 rejects repeated mixed status PATCH and preserves ordinary edits', async () => {
    const f = fixture();
    const id = String(draftId);
    const user = String(owner);
    const items = [
      { name: 'Synthetic groceries', type: 'expense', plannedAmount: 100 },
    ];
    const mixed = { status: 'active', items };

    for (let attempt = 0; attempt < 2; attempt++) {
      await expect(f.service.update(id, user, mixed)).rejects.toThrow(
        'Save budget and item changes in a separate PATCH',
      );
    }
    expect(f.current.status).toBe('draft');
    expect(f.update).not.toHaveBeenCalled();
    expect(f.saveItem).not.toHaveBeenCalled();

    await f.service.update(id, user, {
      name: 'Edited synthetic draft',
      items,
    });
    expect(f.current.name).toBe('Edited synthetic draft');
    expect(f.saveItem).toHaveBeenCalledTimes(1);
    await f.service.update(id, user, { status: 'active' });
    await expect(f.service.update(id, user, mixed)).rejects.toMatchObject({
      status: 400,
    });
    await f.service.update(id, user, {
      name: 'Edited synthetic active budget',
    });
    expect(f.current.name).toBe('Edited synthetic active budget');
    expect(f.saveItem).toHaveBeenCalledTimes(1);
    expect(f.update).toHaveBeenCalledTimes(3);
  });

  it('TC5/TC9 keeps the first same-draft start across both activation routes', async () => {
    const f = fixture();
    const id = String(draftId);
    const user = String(owner);
    await f.service.update(id, user, {
      status: 'active',
      startDate: cutoff.toISOString(),
    });
    await f.service.update(id, user, {
      status: 'active',
      startDate: '2025-02-03T00:00:00-04:00',
    });
    await f.service.activate(id, user, {});
    await expect(
      f.service.update(id, user, {
        status: 'active',
        startDate: '2025-02-04T04:00:00Z',
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(f.current.startDate).toEqual(cutoff);
    expect(f.update).toHaveBeenCalledTimes(1);
  });

  it.each(['POST', 'PATCH'])(
    'TC9 replays an omitted %s start after a competing explicit same-draft activation',
    async (method) => {
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

      const retry = () =>
        method === 'PATCH'
          ? f.service.update(String(draftId), String(owner), {
              status: 'active',
            })
          : f.service.activate(
              String(draftId),
              String(owner),
              Object.freeze({}),
            );
      await retry();
      expect(f.current.startDate).toEqual(winningStart);
      expect(f.update).toHaveBeenCalledTimes(2);
      await retry();
      expect(f.update).toHaveBeenCalledTimes(2);
    },
  );

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
