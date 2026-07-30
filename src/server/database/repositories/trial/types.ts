import { z } from 'zod';

export const TrialStartSchema = z.object({
  installationToken: z
    .string()
    .min(43)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/),
  campaign: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9._-]+$/)
    .optional(),
});

export type TrialStartType = z.infer<typeof TrialStartSchema>;
