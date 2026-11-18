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
import { TransactionsController } from '../transactions/transactions.controller';
import { TransactionsService } from '../transactions/transactions.service';
import { AuthenticatedRequest } from '../../common/types/authenticated-request';

describe('coverage route injection (real pipe, controlled transport/auth/services)', () => {
  let app: INestApplication;
  const owner = String(new Types.ObjectId());
  const id = String(new Types.ObjectId());
  const update = jest.fn().mockResolvedValue({ status: 'closed' });
  const updateTransaction = jest.fn().mockResolvedValue({});
  const findAll = jest.fn().mockResolvedValue({ data: [], meta: { total: 0 } });
  const confirm = jest.fn().mockResolvedValue({ reportId: id });
  const reportExceptions = jest
    .fn()
    .mockResolvedValue({ data: [], page: 1, limit: 20, total: 0 });
  const transactionExceptions = jest
    .fn()
    .mockResolvedValue({ data: [], page: 1, limit: 20, total: 0 });
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
        { provide: BudgetsService, useValue: { update } },
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
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    update.mockClear();
    updateTransaction.mockClear();
    findAll.mockClear();
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
});
