import { z } from "zod";

const modelIdSchema = z.string().trim().min(1, "Model is required").max(200);

export const setBudgetSchema = z.object({
  apiKeyId: z.string().trim().min(1, "apiKeyId is required"),
  dailyLimitUsd: z.coerce.number().positive("dailyLimitUsd must be greater than zero"),
  monthlyLimitUsd: z.coerce
    .number()
    .positive("monthlyLimitUsd must be greater than zero")
    .optional(),
  warningThreshold: z.coerce.number().min(0).max(1).optional(),
});

export const policyActionSchema = z
  .object({
    action: z.enum(["unlock"]),
    identifier: z.string().trim().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action === "unlock" && !value.identifier) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "identifier is required for unlock action",
        path: ["identifier"],
      });
    }
  });

const fallbackChainEntrySchema = z
  .object({
    provider: z.string().trim().min(1, "provider is required"),
    priority: z.number().int().min(1).max(100).optional(),
    enabled: z.boolean().optional(),
  })
  .catchall(z.unknown());

export const registerFallbackSchema = z.object({
  model: modelIdSchema,
  chain: z.array(fallbackChainEntrySchema).min(1, "chain must contain at least one provider"),
});

export const removeFallbackSchema = z.object({
  model: modelIdSchema,
});

export const updateModelAliasSchema = z.object({
  model: modelIdSchema,
  alias: z.string().trim().min(1, "Alias is required").max(200),
});

export const clearModelAvailabilitySchema = z.object({
  provider: z.string().trim().min(1, "provider is required").max(120),
  model: modelIdSchema,
});
