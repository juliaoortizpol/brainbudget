import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BetaAccessService } from './beta-access.service';

describe('BetaAccessService', () => {
  it('allows configured beta users case-insensitively', () => {
    const config = {
      get: jest.fn((key: string) =>
        key === 'APP_ENV'
          ? 'beta'
          : 'julioortizpol@gmail.com,gabrielasilvestre847@gmail.com',
      ),
    } as unknown as ConfigService;
    const service = new BetaAccessService(config);

    expect(() =>
      service.assertAllowed(' JulioOrtizPol@gmail.com '),
    ).not.toThrow();
    expect(() =>
      service.assertAllowed('gabrielasilvestre847@gmail.com'),
    ).not.toThrow();
  });

  it('rejects users who are not invited', () => {
    const config = {
      get: jest.fn((key: string) =>
        key === 'APP_ENV' ? 'beta' : 'julioortizpol@gmail.com',
      ),
    } as unknown as ConfigService;
    const service = new BetaAccessService(config);

    expect(() => service.assertAllowed('someone@example.com')).toThrow(
      ForbiddenException,
    );
  });

  it('does not apply the beta allowlist outside the beta environment', () => {
    const config = {
      get: jest.fn((key: string) =>
        key === 'APP_ENV' ? 'development' : undefined,
      ),
    } as unknown as ConfigService;
    const service = new BetaAccessService(config);

    expect(() => service.assertAllowed('developer@example.com')).not.toThrow();
  });

  it('fails closed when beta mode has no configured emails', () => {
    const config = {
      get: jest.fn((key: string) => (key === 'APP_ENV' ? 'beta' : undefined)),
    } as unknown as ConfigService;
    const service = new BetaAccessService(config);

    expect(() => service.assertAllowed('anyone@example.com')).toThrow(
      ForbiddenException,
    );
  });
});
