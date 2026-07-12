import { ConflictException } from '@nestjs/common';
import { InstitutionsService } from './institutions.service';

describe('InstitutionsService', () => {
  it('normalizes routing data when creating an institution', async () => {
    const save = jest.fn().mockResolvedValue({ slug: 'banreservas' });
    const institutionModel = jest.fn().mockImplementation((value) => ({
      ...value,
      save,
    }));
    const service = new InstitutionsService(institutionModel as any);

    await service.create({
      name: 'Banreservas',
      slug: 'BANRESERVAS',
      aliases: [' Banco de Reservas '],
      supportedAccountTypes: ['credit_card'],
      enabled: true,
      emailRules: [
        {
          senderAddresses: [' Alerts@Banreservas.com '],
          subjectKeywords: [' Consumo '],
          parserKey: 'banreservas.credit-card',
          parserVersion: 1,
          accountType: 'credit_card',
          enabled: true,
        },
      ],
    });

    expect(institutionModel).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'banreservas',
        aliases: ['Banco de Reservas'],
        emailRules: [
          expect.objectContaining({
            senderAddresses: ['alerts@banreservas.com'],
            subjectKeywords: ['Consumo'],
          }),
        ],
      }),
    );
    expect(save).toHaveBeenCalled();
  });

  it('translates duplicate slugs into a conflict error', async () => {
    const institutionModel = jest.fn().mockImplementation(() => ({
      save: jest.fn().mockRejectedValue({ code: 11000 }),
    }));
    const service = new InstitutionsService(institutionModel as any);

    await expect(
      service.create({
        name: 'Banreservas',
        slug: 'banreservas',
        aliases: [],
        supportedAccountTypes: ['credit_card'],
        emailRules: [],
        enabled: true,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
