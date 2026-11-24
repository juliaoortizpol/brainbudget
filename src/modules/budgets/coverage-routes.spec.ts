import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { request } from '../../../test/inject-http-routes';
import { Server } from 'node:http';
import { Types } from 'mongoose';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BudgetReportsController } from '../reports/budget-reports.controller';
import { BudgetReportsService } from '../reports/budget-reports.service';
import { ClosedPeriodHistoryService } from '../reports/closed-period-history.service';
import { BudgetsController } from './budgets.controller';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { TransactionsController } from '../transactions/transactions.controller';
import { TransactionsService } from '../transactions/transactions.service';
import { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { coverageTestConnection } from '../../../test/coverage-test-support';

describe('coverage route injection (real pipe, controlled transport/auth/services)', () => {
  let app: INestApplication;
  const owner = String(new Types.ObjectId());
  const id = String(new Types.ObjectId());
  const create = jest
    .fn<Promise<unknown>, unknown[]>()
    .mockResolvedValue({ status: 'draft' });
  const update = jest
    .fn<Promise<unknown>, unknown[]>()
    .mockResolvedValue({ status: 'closed' });
  const copyDraft = jest
    .fn<Promise<unknown>, unknown[]>()
    .mockResolvedValue({ status: 'draft' });
  const activate = jest
    .fn<Promise<unknown>, unknown[]>()
    .mockResolvedValue({ status: 'active' });
  const updateTransaction = jest
    .fn<Promise<unknown>, Parameters<TransactionsService['update']>>()
    .mockResolvedValue({});
  const findAll = jest.fn().mockResolvedValue({ data: [], meta: { total: 0 } });
  const confirm = jest.fn().mockResolvedValue({ reportId: id });
  const reportExceptions = jest
    .fn()
    .mockResolvedValue({ data: [], page: 1, limit: 20, total: 0 });
  const transactionExceptions = jest
    .fn()
    .mockResolvedValue({ data: [], page: 1, limit: 20, total: 0 });
  const pipe = new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  });
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        BudgetsController,
        TransactionsController,
        BudgetReportsController,
      ],
      providers: [
        { provide: BudgetReportsService, useValue: { confirm } },
        {
          provide: ClosedPeriodHistoryService,
          useValue: { listForReport: reportExceptions },
        },
        {
          provide: BudgetsService,
          useValue: { create, update, copyDraft, activate },
        },
        {
          provide: TransactionsService,
          useValue: {
            findAll,
            update: updateTransaction,
            exceptions: transactionExceptions,
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          context.switchToHttp().getRequest<AuthenticatedRequest>().user = {
            userId: owner,
          } as AuthenticatedRequest['user'];
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(pipe);
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    create.mockClear();
    update.mockClear();
    updateTransaction.mockClear();
    findAll.mockClear();
    copyDraft.mockClear();
    activate.mockClear();
  });
  it('TC5 enforces zoned start timestamps on all budget routes and preserves date-only input', async () => {
    const client = request(app.getHttpServer() as Server);
    const plan = {
      name: 'Synthetic next',
      periodType: 'monthly',
      timezone: 'America/La_Paz',
    };
    await expect(
      pipe.transform(
        { ...plan, status: 'draft', startDate: '2025-02-03T04:00:00' },
        { type: 'body', metatype: CreateBudgetDto },
      ),
    ).rejects.toMatchObject({
      response: {
        message: [
          'startDate must be YYYY-MM-DD or an ISO timestamp with Z or a numeric UTC offset (for example -04:00)',
        ],
      },
    });
    const routes = [
      {
        send: () => client.post('/budgets'),
        fields: { ...plan, status: 'draft' },
        handler: create,
        status: 201,
      },
      {
        send: () => client.post(`/budgets/${id}/drafts`),
        fields: plan,
        handler: copyDraft,
        status: 201,
      },
      {
        send: () => client.patch(`/budgets/${id}`),
        fields: {},
        handler: update,
        status: 200,
      },
      {
        send: () => client.patch(`/budgets/${id}`),
        fields: { status: 'active' },
        handler: update,
        status: 200,
      },
      {
        send: () => client.post(`/budgets/${id}/activate`),
        fields: {},
        handler: activate,
        status: 200,
      },
    ];
    for (const { send, fields, handler, status } of routes) {
      handler.mockClear();
      for (const startDate of [
        '2025-02-03T04:00:00',
        '2025-02-03T04:00',
        '2025-02-03 04:00:00',
      ]) {
        await send()
          .send({ ...fields, startDate })
          .expect(400);
      }
      expect(handler).not.toHaveBeenCalled();
      for (const startDate of [
        '2025-02-03',
        '2025-02-03T04:00:00Z',
        '2025-02-03T00:00:00-04:00',
        '2025-02-03T09:30:00+0530',
      ]) {
        const body = { ...fields, startDate };
        await send().send(body).expect(status);
        expect(handler.mock.lastCall?.at(-1)).toEqual(body);
      }
    }
  });
  it('BE6 TC1/TC5 use the authenticated owner and reject extra lifecycle fields', async () => {
    const client = request(app.getHttpServer() as Server);
    const draft = {
      name: 'Synthetic next',
      periodType: 'monthly',
      timezone: 'America/La_Paz',
      startDate: '2025-01-04T04:00:00Z',
    };
    await client
      .post(`/budgets/${id}/drafts`)
      .send({ ...draft, items: [] })
      .expect(400);
    await client
      .post(`/budgets/${id}/drafts`)
      .send({ ...draft, status: 'active' })
      .expect(400);
    expect(copyDraft).not.toHaveBeenCalled();
    await client.post(`/budgets/${id}/drafts`).send(draft).expect(201);
    expect(copyDraft).toHaveBeenCalledWith(
      id,
      owner,
      expect.objectContaining(draft),
    );
    await client
      .post(`/budgets/${id}/activate`)
      .send({ startDate: null })
      .expect(400);
    await client
      .post(`/budgets/${id}/activate`)
      .send({ actualCutoffDate: draft.startDate })
      .expect(400);
    expect(activate).not.toHaveBeenCalled();
    await client.post(`/budgets/${id}/activate`).send({}).expect(200);
    expect(activate).toHaveBeenCalledWith(id, owner, {});
  });
  it('FE5 TC12 validates operationKey on both creation routes and rejects it on edits', async () => {
    const client = request(app.getHttpServer() as Server);
    const plan = {
      name: 'Synthetic next',
      periodType: 'monthly',
      timezone: 'America/La_Paz',
      startDate: '2025-01-04',
    };
    for (const [url, body] of [
      ['/budgets', { ...plan, status: 'draft' }],
      [`/budgets/${id}/drafts`, plan],
    ] as const) {
      for (const operationKey of [
        null,
        '',
        123,
        'white space',
        'x'.repeat(129),
      ]) {
        await client
          .post(url)
          .send({ ...body, operationKey })
          .expect(400);
      }
    }
    expect(create).not.toHaveBeenCalled();
    expect(copyDraft).not.toHaveBeenCalled();

    const keyedPlan = { ...plan, operationKey: 'synthetic-key_01' };
    const empty = { ...keyedPlan, status: 'draft' };
    await client.post('/budgets').send(empty).expect(201);
    expect(create).toHaveBeenCalledWith(owner, empty);
    await client.post(`/budgets/${id}/drafts`).send(keyedPlan).expect(201);
    expect(copyDraft).toHaveBeenCalledWith(id, owner, keyedPlan);
    await client
      .patch(`/budgets/${id}`)
      .send({ operationKey: keyedPlan.operationKey })
      .expect(400);
    await client
      .post(`/budgets/${id}/activate`)
      .send({ operationKey: keyedPlan.operationKey })
      .expect(400);
    expect(update).not.toHaveBeenCalled();
    expect(activate).not.toHaveBeenCalled();
  });

  it('TC3 routes only explicit confirmation with a valid preview token and ISO instant', async () => {
    const url = '/budgets/' + id + '/close';
    const payload = {
      actualCutoffDate: '2024-12-02T13:34:56-04:00',
      previewToken: 'a'.repeat(64),
    };
    await request(app.getHttpServer() as Server)
      .post(url)
      .send(payload)
      .expect(400);
    await request(app.getHttpServer() as Server)
      .post(url)
      .send({ ...payload, confirmed: false })
      .expect(400);
    expect(confirm).not.toHaveBeenCalled();
    await request(app.getHttpServer() as Server)
      .post(url)
      .send({ ...payload, confirmed: true })
      .expect(200);
    expect(confirm).toHaveBeenCalledWith(id, owner, {
      ...payload,
      confirmed: true,
    });
  });

  it('TC8/TC9 scopes exception routes to the authenticated owner and validates pagination', async () => {
    const report = '/budget-reports/' + id + '/exceptions';
    const transaction = '/transactions/' + id + '/closed-period-exceptions';
    await request(app.getHttpServer() as Server)
      .get(report)
      .expect(200);
    await request(app.getHttpServer() as Server)
      .get(transaction + '?page=2&limit=5')
      .expect(200);
    await request(app.getHttpServer() as Server)
      .get(report + '?limit=101')
      .expect(400);
    await request(app.getHttpServer() as Server)
      .get(transaction + '?page=0')
      .expect(400);
    expect(reportExceptions).toHaveBeenCalledTimes(1);
    expect(reportExceptions).toHaveBeenCalledWith(owner, id, 1, 20);
    expect(transactionExceptions).toHaveBeenCalledTimes(1);
    expect(transactionExceptions).toHaveBeenCalledWith(id, owner, 2, 5);
  });

  it('routes instant closure and budget coverage review with authenticated ownership', async () => {
    await request(app.getHttpServer() as Server)
      .patch(`/budgets/${id}`)
      .send({ status: 'closed', actualCutoffDate: '2024-12-02T17:34:56Z' })
      .expect(200);
    expect(update).toHaveBeenCalledWith(
      id,
      owner,
      expect.objectContaining({
        status: 'closed',
        actualCutoffDate: '2024-12-02T17:34:56Z',
      }),
    );
    await request(app.getHttpServer() as Server)
      .get(`/transactions?budgetId=${id}&matchingStatus=needs_review&page=2`)
      .expect(200);
    expect(findAll).toHaveBeenCalledWith(
      owner,
      expect.objectContaining({
        budgetId: id,
        page: 2,
        matchingStatus: 'needs_review',
      }),
    );
  });
  it('rejects null closure fields and invalid budget period IDs before invoking services', async () => {
    await request(app.getHttpServer() as Server)
      .patch(`/budgets/${id}`)
      .send({ status: 'closed', actualCutoffDate: null })
      .expect(400);
    await request(app.getHttpServer() as Server)
      .get('/transactions?budgetId=invalid')
      .expect(400);
    expect(update).not.toHaveBeenCalled();
    expect(findAll).not.toHaveBeenCalled();
  });
  it.each(['2023-02-29T12:00:00Z', '2024-02-30T00:00:00Z', '2024-04-31'])(
    'rejects impossible calendar date %s before service normalization',
    async (date) => {
      for (const field of [
        'startDate',
        'endDate',
        'plannedEndDate',
        'actualCutoffDate',
      ]) {
        await request(app.getHttpServer() as Server)
          .patch(`/budgets/${id}`)
          .send({ [field]: date })
          .expect(400);
      }
      await request(app.getHttpServer() as Server)
        .get(`/transactions?startDate=${encodeURIComponent(date)}`)
        .expect(400);
      await request(app.getHttpServer() as Server)
        .patch(`/transactions/${id}`)
        .send({ date })
        .expect(400);
      expect(update).not.toHaveBeenCalled();
      expect(updateTransaction).not.toHaveBeenCalled();
      expect(findAll).not.toHaveBeenCalled();
    },
  );
  it('rejects a null purchase date but preserves valid leap-day and clear-assignment payloads', async () => {
    await request(app.getHttpServer() as Server)
      .patch(`/transactions/${id}`)
      .send({ date: null })
      .expect(400);
    expect(updateTransaction).not.toHaveBeenCalled();
    await request(app.getHttpServer() as Server)
      .patch(`/transactions/${id}`)
      .send({ date: '2024-02-29T12:34:56Z', budgetItemId: null })
      .expect(200);
    expect(updateTransaction).toHaveBeenCalledWith(
      id,
      owner,
      expect.objectContaining({
        date: '2024-02-29T12:34:56Z',
        budgetItemId: null,
      }),
    );
  });

  it.each([
    { currency: 'USD', origin: 'mail-parser', status: 409 },
    { currency: 'DOP', origin: 'mail-parser', status: 200 },
    { currency: undefined, origin: undefined, status: 200 },
  ])(
    'TC2/TC6 PATCH submits DOP with an item for a $currency purchase',
    async ({ currency, origin, status }) => {
      const itemId = new Types.ObjectId();
      const budgetId = new Types.ObjectId();
      const row = {
        _id: new Types.ObjectId(id),
        userId: new Types.ObjectId(owner),
        type: 'expense',
        date: new Date('2024-12-02T00:00:00Z'),
        amount: 20,
        currency,
        currencyOrigin: origin,
        currencyContextVersion: origin ? 1 : undefined,
      };
      const query = (value: unknown) => ({
        exec: () => Promise.resolve(value),
      });
      const write = jest.fn((_filter: unknown, update: { $set: object }) =>
        query({ ...row, ...update.$set }),
      );
      const service = new TransactionsService(
        {
          db: coverageTestConnection(),
          findOne: () => query(row),
          findOneAndUpdate: write,
          hydrate: (updated: unknown) => updated,
        } as never,
        {
          findOne: () =>
            query({
              status: 'active',
              startDate: new Date('2024-11-01T00:00:00Z'),
              coverageVersion: 1,
              timezone: 'America/Santo_Domingo',
              currencyContext: {
                version: 1,
                currency: 'DOP',
                origin: 'dop-v1-planning',
              },
            }),
        } as never,
        {
          findOne: () => query({ _id: itemId, budgetId, type: 'expense' }),
        } as never,
        {
          links: () => Promise.resolve([]),
          isCovered: () => false,
          record: () => Promise.resolve(),
        } as never,
      );
      updateTransaction.mockImplementationOnce((...args) =>
        service.update(...args),
      );
      await request(app.getHttpServer() as Server)
        .patch(`/transactions/${id}`)
        .send({ currency: 'DOP', budgetItemId: String(itemId) })
        .expect(status);
      if (status === 409) {
        expect(write).not.toHaveBeenCalled();
      } else {
        expect(write).toHaveBeenCalledTimes(1);
        const update = write.mock.calls[0][1].$set;
        expect(update).toMatchObject({ budgetItemId: itemId });
        if (origin) {
          expect(update).not.toHaveProperty('currencyOrigin');
          expect(update).not.toHaveProperty('currencyContextVersion');
          expect(update).not.toHaveProperty('currency');
        } else {
          expect(update).toMatchObject({
            currency: 'DOP',
            currencyOrigin: 'explicit-resolution',
            currencyContextVersion: 1,
          });
        }
      }
    },
  );
});
