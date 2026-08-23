export interface RuntimeConfig {
  nodeEnv: string;
  isProduction: boolean;
  port: number;
  appUrl: string;
  allowedOrigins: string[];
  allowDemoMode: boolean;
  jsonBodyLimit: string;
  encryptionKey?: string;
  moonpayEnvironment: 'sandbox' | 'production';
  moonpayBaseCurrencyCode: string;
  moonpayCurrencyCode: string;
  moonpayMonthlyAmount: string;
  moonpayYearlyAmount: string;
  googlePlacesApiKey?: string;
}

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true';
}

export function getRuntimeConfig(env: NodeJS.ProcessEnv): RuntimeConfig {
  const nodeEnv = env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const portValue = env.PORT || '3000';
  const port = Number.parseInt(portValue, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  const appUrl = env.APP_URL || `http://localhost:${port}`;
  let parsedAppUrl: URL;
  try {
    parsedAppUrl = new URL(appUrl);
  } catch {
    throw new Error('APP_URL must be a valid absolute URL.');
  }
  if (isProduction && parsedAppUrl.protocol !== 'https:') {
    throw new Error('APP_URL must use HTTPS in production.');
  }

  const configuredOrigins = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins = Array.from(new Set([appUrl, ...configuredOrigins]));

  const moonpayEnvironment = env.MOONPAY_ENVIRONMENT || (isProduction ? 'production' : 'sandbox');
  if (moonpayEnvironment !== 'sandbox' && moonpayEnvironment !== 'production') {
    throw new Error('MOONPAY_ENVIRONMENT must be sandbox or production.');
  }
  if (isProduction && moonpayEnvironment !== 'production') {
    throw new Error('MOONPAY_ENVIRONMENT must be production in production.');
  }

  const encryptionKey = env.ENCRYPTION_KEY?.trim() || undefined;
  if (isProduction && !encryptionKey) {
    throw new Error('ENCRYPTION_KEY is required in production.');
  }
  if (encryptionKey && Buffer.byteLength(encryptionKey, 'utf8') < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 UTF-8 bytes.');
  }

  return {
    nodeEnv,
    isProduction,
    port,
    appUrl,
    allowedOrigins,
    allowDemoMode: !isProduction && readBoolean(env.ALLOW_DEMO_MODE, true),
    jsonBodyLimit: env.JSON_BODY_LIMIT || '256kb',
    encryptionKey,
    moonpayEnvironment,
    moonpayBaseCurrencyCode: (env.MOONPAY_BASE_CURRENCY_CODE || 'usd').toLowerCase(),
    moonpayCurrencyCode: (env.MOONPAY_CURRENCY_CODE || 'usdc').toLowerCase(),
    moonpayMonthlyAmount: env.MOONPAY_MONTHLY_AMOUNT || '7',
    moonpayYearlyAmount: env.MOONPAY_YEARLY_AMOUNT || '64',
    googlePlacesApiKey: env.GOOGLE_PLACES_API_KEY?.trim() || undefined,
  };
}
