import { AccountsService } from './accounts.service';
import { InstitutionsService } from '@/modules/institutions/institutions.service';

describe('AccountsService institution selection', () => {
  const userId = '507f1f77bcf86cd799439011';
  const institutionId = '507f191e810c19729de860ea';

  it('uses the canonical name for a registered institution', async () => {
    const save = jest.fn().mockResolvedValue({ name: 'My card' });
    const accountModel = jest.fn().mockImplementation((value) => ({
      ...value,
      save,
    }));
    const institutions = {
      findAvailableOne: jest.fn().mockResolvedValue({ name: 'Banreservas' }),
    };
    const service = new AccountsService(
      accountModel as any,
      institutions as unknown as InstitutionsService,
    );

    await service.create(userId, {
      name: 'My card',
      institutionId,
      type: 'credit_card',
    });

    expect(institutions.findAvailableOne).toHaveBeenCalledWith(institutionId);
    expect(accountModel).toHaveBeenCalledWith(
      expect.objectContaining({
        institution: 'Banreservas',
        institutionId: expect.anything(),
      }),
    );
  });

  it('allows an account with an unregistered institution name', async () => {
    const accountModel = jest.fn().mockImplementation((value) => ({
      ...value,
      save: jest.fn().mockResolvedValue(value),
    }));
    const service = new AccountsService(
      accountModel as any,
      {} as InstitutionsService,
    );

    await service.create(userId, {
      name: 'Local savings',
      institution: '  Community Bank  ',
      type: 'savings',
    });

    expect(accountModel).toHaveBeenCalledWith(
      expect.objectContaining({ institution: 'Community Bank' }),
    );
  });

  it('removes the catalog reference when changing to a custom bank', async () => {
    const exec = jest.fn().mockResolvedValue({ name: 'Local savings' });
    const accountModel = {
      findOneAndUpdate: jest.fn().mockReturnValue({ exec }),
    };
    const service = new AccountsService(
      accountModel as any,
      {} as InstitutionsService,
    );

    await service.update('507f1f77bcf86cd799439012', userId, {
      institutionId: null,
      institution: 'Community Bank',
    });

    expect(accountModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      {
        $set: { institution: 'Community Bank' },
        $unset: { institutionId: 1 },
      },
      { new: true },
    );
  });

  it('marks only the user owned account ids as synced', async () => {
    const exec = jest.fn().mockResolvedValue({ modifiedCount: 2 });
    const accountModel = {
      updateMany: jest.fn().mockReturnValue({ exec }),
    };
    const service = new AccountsService(
      accountModel as any,
      {} as InstitutionsService,
    );
    const syncedAt = new Date('2026-07-15T12:00:00.000Z');

    await expect(
      service.markSynced(
        userId,
        [
          '507f1f77bcf86cd799439012',
          '507f1f77bcf86cd799439013',
          '507f1f77bcf86cd799439012',
        ],
        syncedAt,
      ),
    ).resolves.toBe(2);
    expect(accountModel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: { $in: [expect.anything(), expect.anything()] },
        userId: expect.anything(),
        isDeleted: { $ne: true },
      }),
      { $set: { lastSynced: syncedAt } },
    );
  });
});
