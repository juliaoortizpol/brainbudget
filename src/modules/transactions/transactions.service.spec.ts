import { Types } from 'mongoose';
import { TransactionsService } from './transactions.service';

describe('TransactionsService', () => {
  it('stores account and budget item references as ObjectIds when updating', async () => {
    const exec = jest.fn().mockResolvedValue({ _id: 'transaction-id' });
    const transactionModel = {
      findOneAndUpdate: jest.fn().mockReturnValue({ exec }),
    };
    const service = new TransactionsService(
      transactionModel as unknown as ConstructorParameters<
        typeof TransactionsService
      >[0],
    );
    const transactionId = '6a5b9091831aa8b3f83d6279';
    const userId = '69e7e32d72be00b046f1b706';
    const accountId = '6a57d746bd32c6b8ecd974fc';
    const budgetItemId = '6a5b91334af841141d1cdaf8';

    await service.update(transactionId, userId, {
      accountId,
      budgetItemId,
    });

    expect(transactionModel.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: new Types.ObjectId(transactionId),
        userId: new Types.ObjectId(userId),
      },
      {
        $set: {
          accountId: new Types.ObjectId(accountId),
          budgetItemId: new Types.ObjectId(budgetItemId),
        },
      },
      { new: true, runValidators: true },
    );
  });
});
