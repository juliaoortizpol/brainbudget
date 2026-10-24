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

  it('requires matchingStatus on creation', async () => {
    const withoutStatus: Partial<typeof transaction> = { ...transaction };
    delete withoutStatus.matchingStatus;
    await expect(
      pipe.transform(withoutStatus, {
        type: 'body',
        metatype: CreateTransactionDto,
      }),
    ).rejects.toThrow();
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
