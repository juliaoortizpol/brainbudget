const DEPLOYED_ENVIRONMENTS = new Set(['beta', 'production']);

const DEPLOYED_REQUIRED_VARIABLES = [
  'MONGODB_URI',
  'JWT_SECRET',
  'FRONTEND_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_CALLBACK_URL',
  'GMAIL_READER_REDIRECT_URI',
  'GMAIL_READER_STATE_SECRET',
];

function valueOf(config: Record<string, unknown>, key: string): string {
  return typeof config[key] === 'string' ? config[key].trim() : '';
}

function assertUrl(
  config: Record<string, unknown>,
  key: string,
  requireHttps: boolean,
): void {
  const value = valueOf(config, key);
  try {
    const url = new URL(value);
    if (requireHttps && url.protocol !== 'https:') {
      throw new Error('HTTPS is required');
    }
  } catch {
    throw new Error(`${key} must be a valid${requireHttps ? ' HTTPS' : ''} URL`);
  }
}

export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const appEnvironment = valueOf(config, 'APP_ENV') || 'development';
  if (!['development', 'beta', 'production', 'test'].includes(appEnvironment)) {
    throw new Error(
      'APP_ENV must be one of: development, beta, production, test',
    );
  }

  if (!valueOf(config, 'MONGODB_URI')) {
    throw new Error('Missing required environment variable: MONGODB_URI');
  }

  if (!DEPLOYED_ENVIRONMENTS.has(appEnvironment)) return config;

  const missing = DEPLOYED_REQUIRED_VARIABLES.filter(
    (key) => !valueOf(config, key),
  );
  if (appEnvironment === 'beta' && !valueOf(config, 'BETA_ALLOWED_EMAILS')) {
    missing.push('BETA_ALLOWED_EMAILS');
  }
  if (missing.length) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }

  if (valueOf(config, 'JWT_SECRET').length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters');
  }
  if (valueOf(config, 'GMAIL_READER_STATE_SECRET').length < 32) {
    throw new Error(
      'GMAIL_READER_STATE_SECRET must contain at least 32 characters',
    );
  }

  assertUrl(config, 'FRONTEND_URL', true);
  assertUrl(config, 'GOOGLE_CALLBACK_URL', true);
  assertUrl(config, 'GMAIL_READER_REDIRECT_URI', true);

  return config;
}
