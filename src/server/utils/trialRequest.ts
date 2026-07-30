import type { H3Event } from 'h3';

const RATE_LIMIT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export function getTrialRequestIp(event: H3Event) {
  return (
    getRequestIP(event, {
      xForwardedFor: WG_TRIAL_ENV.TRUST_PROXY,
    }) ?? 'unknown'
  );
}

export async function findTrialByBearer(event: H3Event) {
  const secret = assertTrialAvailable();
  const token = getBearerToken(getHeader(event, 'authorization'));

  if (!token || !isInstallationToken(token)) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Bearer token required',
    });
  }

  const tokenHash = hashTrialValue(secret, token);
  const trial = await Database.trials.findByTokenHash(tokenHash);
  if (!trial || !safeHashEquals(trial.tokenHash, tokenHash)) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid bearer token',
    });
  }

  await Database.trials.touch(trial.id, new Date().toISOString());
  return trial;
}

export function getTrialRateLimitStart(now = new Date()) {
  return new Date(now.getTime() - RATE_LIMIT_WINDOW_MS).toISOString();
}
