import { z } from "zod";

const resilienceProfileSchema = z.object({
  transientCooldown: z.number().min(0),
  rateLimitCooldown: z.number().min(0),
  maxBackoffLevel: z.number().int().min(0),
  circuitBreakerThreshold: z.number().int().min(0),
  circuitBreakerReset: z.number().min(0),
});

const resilienceDefaultsSchema = z
  .object({
    requestsPerMinute: z.number().int().min(1).optional(),
    minTimeBetweenRequests: z.number().int().min(1).optional(),
    concurrentRequests: z.number().int().min(1).optional(),
  })
  .strict();

export const updateResilienceSchema = z
  .object({
    profiles: z
      .object({
        oauth: resilienceProfileSchema.optional(),
        apikey: resilienceProfileSchema.optional(),
      })
      .strict()
      .optional(),
    defaults: resilienceDefaultsSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.profiles && !value.defaults) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Must provide profiles or defaults",
        path: [],
      });
    }
  });

export const jsonObjectSchema = z.record(z.string(), z.unknown());

export const resetStatsActionSchema = z.object({
  action: z.literal("reset-stats"),
});

const pricingSyncSourceSchema = z.enum(["litellm"]);

export const pricingSyncRequestSchema = z
  .object({
    sources: z.array(pricingSyncSourceSchema).min(1).optional(),
    dryRun: z.boolean().optional(),
  })
  .strict();
