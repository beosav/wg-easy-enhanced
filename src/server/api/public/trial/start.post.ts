import { TrialStartSchema } from '#db/repositories/trial/types';

export default defineEventHandler(async (event) => {
  const secret = assertTrialAvailable();
  const { installationToken, campaign } = await readValidatedBody(
    event,
    validateZod(TrialStartSchema, event)
  );
  const now = new Date();
  const tokenHash = hashTrialValue(secret, installationToken);
  const existingTrial = await Database.trials.findByTokenHash(tokenHash);

  if (existingTrial) {
    const existingClient = await Database.clients.get(existingTrial.clientId);
    if (!existingClient) {
      throw createError({
        statusCode: 410,
        statusMessage: 'Trial profile no longer exists',
      });
    }

    await Database.trials.touch(existingTrial.id, now.toISOString());
    const status = trialResponse(
      existingTrial.expiresAt,
      existingClient.enabled,
      now
    );

    return {
      ...status,
      profile:
        status.state === 'active'
          ? await WireGuard.getClientConfiguration({
              clientId: existingTrial.clientId,
            })
          : null,
    };
  }

  const requestIpHash = hashTrialValue(secret, getTrialRequestIp(event));
  const recentTrials = await Database.trials.countRecentForIp(
    requestIpHash,
    getTrialRateLimitStart(now)
  );
  if (recentTrials >= WG_TRIAL_ENV.MAX_PER_IP) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Trial registration limit reached',
    });
  }

  const startedAt = now.toISOString();
  const expiresAt = new Date(
    now.getTime() + WG_TRIAL_ENV.DURATION_HOURS * 60 * 60 * 1000
  ).toISOString();
  const createdClients = await Database.clients.create({
    name: `trial-${tokenHash.slice(0, 10)}`,
    expiresAt,
  });
  const clientId = createdClients[0]!.clientId;

  try {
    await Database.trials.create({
      tokenHash,
      requestIpHash,
      clientId,
      campaign,
      startedAt,
      expiresAt,
    });
    await WireGuard.saveConfig();
  } catch (error) {
    await Database.clients.delete(clientId);
    throw error;
  }

  return {
    ...trialResponse(expiresAt, true, now),
    profile: await WireGuard.getClientConfiguration({ clientId }),
  };
});
