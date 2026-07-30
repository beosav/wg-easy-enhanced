import { createHmac, timingSafeEqual } from 'node:crypto';

export type TrialState = 'active' | 'expired' | 'disabled';

export function assertTrialAvailable() {
  if (!WG_TRIAL_ENV.ENABLED) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Trial registration is disabled',
    });
  }

  if (!WG_TRIAL_ENV.SECRET || WG_TRIAL_ENV.SECRET.length < 32) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Trial registration is not configured',
    });
  }

  return WG_TRIAL_ENV.SECRET;
}

export function hashTrialValue(secret: string, value: string) {
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function getBearerToken(authorization?: string) {
  if (!authorization) return null;

  const [scheme, token, extra] = authorization.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== 'bearer' || !token || extra) return null;

  return token;
}

export function isInstallationToken(value: string) {
  return /^[A-Za-z0-9_-]{43,128}$/.test(value);
}

export function safeHashEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function getTrialState(
  expiresAt: string,
  clientEnabled: boolean,
  now = new Date()
): TrialState {
  if (now >= new Date(expiresAt)) return 'expired';
  if (!clientEnabled) return 'disabled';
  return 'active';
}

export function trialResponse(
  expiresAt: string,
  clientEnabled: boolean,
  now = new Date()
) {
  return {
    state: getTrialState(expiresAt, clientEnabled, now),
    expiresAt,
    serverTime: now.toISOString(),
  };
}
