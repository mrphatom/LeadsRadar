import crypto from 'node:crypto';

const DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300;
const MOONPAY_ORDER_ID_PATTERN = /^moonpay_[0-9a-f-]{36}$/;

export function extractMoonPayOrderId(transactionData: Record<string, unknown>): string | null {
  const value = transactionData.externalTransactionId;
  return typeof value === 'string' && MOONPAY_ORDER_ID_PATTERN.test(value) ? value : null;
}

export interface MoonPayWidgetUrlOptions {
  environment: 'sandbox' | 'production';
  publishableKey: string;
  baseCurrencyCode: string;
  currencyCode: string;
  baseCurrencyAmount: string;
  walletAddress: string;
  externalTransactionId: string;
  redirectUrl: string;
}

export function buildMoonPayWidgetUrl(options: MoonPayWidgetUrlOptions): URL {
  const widgetUrl = new URL(options.environment === 'sandbox'
    ? 'https://buy-sandbox.moonpay.com/'
    : 'https://buy.moonpay.com/');
  widgetUrl.searchParams.set('apiKey', options.publishableKey);
  widgetUrl.searchParams.set('baseCurrencyCode', options.baseCurrencyCode);
  widgetUrl.searchParams.set('baseCurrencyAmount', options.baseCurrencyAmount);
  widgetUrl.searchParams.set('currencyCode', options.currencyCode);
  widgetUrl.searchParams.set('walletAddress', options.walletAddress);
  widgetUrl.searchParams.set('lockAmount', 'true');
  widgetUrl.searchParams.set('externalTransactionId', options.externalTransactionId);
  widgetUrl.searchParams.set('redirectURL', options.redirectUrl);
  return widgetUrl;
}

export function signMoonPayUrl(input: URL, secretKey: string): URL {
  if (!secretKey) throw new Error('MoonPay secret key is required.');
  if (!input.search) throw new Error('MoonPay URL must contain query parameters.');

  const signedUrl = new URL(input.toString());
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(signedUrl.search)
    .digest('base64');
  signedUrl.searchParams.set('signature', signature);
  return signedUrl;
}

export function verifyMoonPayWebhookSignature(
  rawBody: string | Buffer,
  header: string | string[] | undefined,
  secretKey: string | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = DEFAULT_WEBHOOK_TOLERANCE_SECONDS,
): boolean {
  if (!secretKey || typeof header !== 'string') return false;
  const parts = new Map(
    header.split(',').map((part) => {
      const separator = part.indexOf('=');
      return separator > 0
        ? [part.slice(0, separator).trim(), part.slice(separator + 1).trim()]
        : ['', ''];
    }),
  );
  const timestamp = Number(parts.get('t'));
  const signature = parts.get('s');
  if (!Number.isInteger(timestamp) || !signature || !Number.isFinite(nowSeconds)) return false;
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;

  const expected = crypto
    .createHmac('sha256', secretKey)
    .update(`${timestamp}.${rawBody.toString()}`)
    .digest('hex');
  const receivedBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return receivedBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}
