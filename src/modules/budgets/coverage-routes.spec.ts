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
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [BudgetsController, TransactionsController],
      providers: [
        { provide: BudgetsService, useValue: { update } },
        {
          provide: TransactionsService,
          useValue: { findAll, update: updateTransaction },
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
