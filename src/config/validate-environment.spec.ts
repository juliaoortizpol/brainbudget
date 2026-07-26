import { validateEnvironment } from './validate-environment';

const validBetaEnvironment = {
  APP_ENV: 'beta',
  MONGODB_URI: 'mongodb://localhost/brainbudget',
  JWT_SECRET: 'j'.repeat(32),
  FRONTEND_URL: 'https://beta.example.com',
  GOOGLE_CLIENT_ID: 'client-id',
  GOOGLE_CLIENT_SECRET: 'client-secret',
  GOOGLE_CALLBACK_URL: 'https://api.example.com/auth/google/callback',
  GMAIL_READER_REDIRECT_URI:
    'https://api.example.com/gmail-reader/oauth/callback',
  GMAIL_READER_STATE_SECRET: 's'.repeat(32),
  BETA_ALLOWED_EMAILS: 'tester@example.com',
};

describe('validateEnvironment', () => {
  it('accepts a complete beta environment', () => {
    expect(validateEnvironment(validBetaEnvironment)).toBe(
      validBetaEnvironment,
    );
  });

  it('fails closed when the beta allowlist is missing', () => {
    const environment = { ...validBetaEnvironment };
    delete (environment as Partial<typeof validBetaEnvironment>)
      .BETA_ALLOWED_EMAILS;
    expect(() => validateEnvironment(environment)).toThrow(
      'BETA_ALLOWED_EMAILS',
    );
  });

  it('requires HTTPS for deployed callback URLs', () => {
    expect(() =>
      validateEnvironment({
        ...validBetaEnvironment,
        FRONTEND_URL: 'http://beta.example.com',
      }),
    ).toThrow('FRONTEND_URL must be a valid HTTPS URL');
  });

  it('keeps development requirements minimal', () => {
    expect(() =>
      validateEnvironment({
        APP_ENV: 'development',
        MONGODB_URI: 'mongodb://localhost/brainbudget',
      }),
    ).not.toThrow();
  });
});
