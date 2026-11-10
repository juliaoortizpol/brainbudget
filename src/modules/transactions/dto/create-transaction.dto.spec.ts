import { ValidationPipe } from '@nestjs/common';
import { CreateTransactionDto } from './create-transaction.dto';
import { UpdateTransactionDto } from './update-transaction.dto';

describe('Transaction matching metadata', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const transaction = {
    name: 'Groceries',
    amount: 20,
    type: 'expense',
    date: '2026-10-07T12:00:00.000Z',
    matchingStatus: 'matched',
    matchingSource: 'rule',
    matchingConfidence: 0.9,
    rawDescription: 'MARKET PURCHASE',
    normalizedMerchant: 'Market',
  };

  it('accepts all matching metadata on creation', async () => {
    await expect(
      pipe.transform(transaction, {
        type: 'body',
        metatype: CreateTransactionDto,
      }),
    ).resolves.toEqual(transaction);
  });

  it('accepts the frontend create payload without matching metadata', async () => {
    const withoutStatus = {
      name: transaction.name,
      amount: transaction.amount,
      type: transaction.type,
      date: transaction.date,
    };
    await expect(
      pipe.transform(withoutStatus, {
        type: 'body',
        metatype: CreateTransactionDto,
      }),
    ).resolves.toEqual(withoutStatus);
  });

  it('allows partial updates without matchingStatus', async () => {
    await expect(
      pipe.transform(
        { normalizedMerchant: 'Market' },
        {
          type: 'body',
          metatype: UpdateTransactionDto,
        },
      ),
    ).resolves.toEqual({ normalizedMerchant: 'Market' });
  });

  it.each(['2023-02-29T12:00:00Z', '2024-04-31', null])(
    'rejects impossible or null purchase dates: %s',
    async (date) => {
      for (const metatype of [CreateTransactionDto, UpdateTransactionDto]) {
        await expect(
          pipe.transform({ ...transaction, date }, { type: 'body', metatype }),
        ).rejects.toThrow();
      }
    },
  );

  it('accepts leap-day purchase dates and explicit assignment clearing', async () => {
    await expect(
      pipe.transform(
        { date: '2024-02-29T12:34:56Z', budgetItemId: null },
        { type: 'body', metatype: UpdateTransactionDto },
      ),
    ).resolves.toMatchObject({
      date: '2024-02-29T12:34:56Z',
      budgetItemId: null,
    });
  });

  it.each([
    { matchingStatus: 'unknown' },
    { matchingSource: 'learned' },
    { matchingConfidence: 'high' },
    { rawDescription: 123 },
    { normalizedMerchant: 123 },
  ])('rejects invalid matching metadata: %j', async (metadata) => {
    await expect(
      pipe.transform(metadata, {
        type: 'body',
        metatype: UpdateTransactionDto,
      }),
    ).rejects.toThrow();
  });
});
