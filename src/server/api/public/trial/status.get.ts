export default defineEventHandler(async (event) => {
  const trial = await findTrialByBearer(event);
  const client = await Database.clients.get(trial.clientId);

  if (!client) {
    throw createError({
      statusCode: 410,
      statusMessage: 'Trial profile no longer exists',
    });
  }

  return trialResponse(trial.expiresAt, client.enabled);
});
