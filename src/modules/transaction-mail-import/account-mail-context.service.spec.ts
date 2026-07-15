import { AccountMailContextService } from './account-mail-context.service';
import { AccountsService } from '@/modules/accounts/accounts.service';
import { InstitutionsService } from '@/modules/institutions/institutions.service';
import { UnsupportedMailAccountReason } from './contracts';

describe('AccountMailContextService', () => {
  it('classifies accounts and returns only relevant deduplicated rules', async () => {
    const accountsService = {
      findAll: jest.fn().mockResolvedValue([
        {
          _id: 'account-1',
          name: 'Primary Banreservas Card',
          institution: 'Banreservas',
          institutionId: 'institution-1',
          type: 'credit_card',
          status: 'active',
          last4Digits: '4134',
        },
        {
          _id: 'account-2',
          name: 'Second Banreservas Card',
          institution: 'Banreservas',
          institutionId: 'institution-1',
          type: 'credit_card',
          status: 'active',
          last4Digits: '5678',
        },
        {
          _id: 'account-3',
          name: 'Custom Savings',
          institution: 'Community Bank',
          type: 'savings',
          status: 'active',
        },
        {
          _id: 'account-4',
          name: 'Pending Popular Card',
          institution: 'Banco Popular',
          institutionId: 'institution-2',
          type: 'credit_card',
          status: 'pending',
        },
      ]),
    };
    const institutionsService = {
      findByIds: jest.fn().mockResolvedValue([
        {
          _id: 'institution-1',
          name: 'Banreservas',
          emailRules: [
            {
              senderAddresses: ['alerts@banreservas.test'],
              subjectKeywords: ['Consumo'],
              parserKey: 'banreservas.credit-card',
              parserVersion: 1,
              accountType: 'credit_card',
              enabled: true,
            },
            {
              senderAddresses: ['accounts@banreservas.test'],
              subjectKeywords: ['Balance'],
              parserKey: 'banreservas.savings',
              parserVersion: 1,
              accountType: 'savings',
              enabled: true,
            },
          ],
        },
      ]),
    };
    const service = new AccountMailContextService(
      accountsService as unknown as AccountsService,
      institutionsService as unknown as InstitutionsService,
    );

    const result = await service.getContextForUser('user-1');

    expect(institutionsService.findByIds).toHaveBeenCalledWith([
      'institution-1',
      'institution-2',
    ]);
    expect(
      result.supportedAccounts.map((account) => account.accountId),
    ).toEqual(['account-1', 'account-2']);
    expect(result.rules).toEqual([
      expect.objectContaining({
        institutionId: 'institution-1',
        parserKey: 'banreservas.credit-card',
        accountType: 'credit_card',
      }),
    ]);
    expect(result.unsupportedAccounts).toEqual([
      expect.objectContaining({
        account: expect.objectContaining({ accountId: 'account-3' }),
        reason: UnsupportedMailAccountReason.CUSTOM_INSTITUTION,
      }),
      expect.objectContaining({
        account: expect.objectContaining({ accountId: 'account-4' }),
        reason: UnsupportedMailAccountReason.ACCOUNT_NOT_ACTIVE,
      }),
    ]);
  });

  it('marks registered accounts unsupported when no enabled institution is found', async () => {
    const service = new AccountMailContextService(
      {
        findAll: jest.fn().mockResolvedValue([
          {
            _id: 'account-1',
            name: 'Unknown card',
            institution: 'Disabled Bank',
            institutionId: 'institution-disabled',
            type: 'credit_card',
            status: 'active',
          },
        ]),
      } as unknown as AccountsService,
      {
        findByIds: jest.fn().mockResolvedValue([]),
      } as unknown as InstitutionsService,
    );

    const result = await service.getContextForUser('user-1');

    expect(result.supportedAccounts).toEqual([]);
    expect(result.rules).toEqual([]);
    expect(result.unsupportedAccounts[0].reason).toBe(
      UnsupportedMailAccountReason.INSTITUTION_DISABLED,
    );
  });
});
