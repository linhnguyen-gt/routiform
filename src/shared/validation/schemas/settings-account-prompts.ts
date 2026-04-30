import { z } from "zod";

export const updateRequireLoginSchema = z
  .object({
    requireLogin: z.boolean().optional(),
    password: z.string().min(4, "Password must be at least 4 characters").optional(),
  })
  .superRefine((value, ctx) => {
    if (value.requireLogin === undefined && !value.password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "No valid fields to update",
        path: [],
      });
    }
  });

export const updateSystemPromptSchema = z
  .object({
    prompt: z.string().max(50000).optional(),
    enabled: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.prompt === undefined && value.enabled === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "No valid fields to update",
        path: [],
      });
    }
  });

export const updateThinkingBudgetSchema = z
  .object({
    mode: z.enum(["passthrough", "auto", "custom", "adaptive"]).optional(),
    customBudget: z.coerce.number().int().min(0).max(131072).optional(),
    effortLevel: z.enum(["none", "low", "medium", "high"]).optional(),
    baseBudget: z.coerce.number().int().min(0).max(131072).optional(),
    complexityMultiplier: z.coerce.number().min(0).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.mode === undefined &&
      value.customBudget === undefined &&
      value.effortLevel === undefined &&
      value.baseBudget === undefined &&
      value.complexityMultiplier === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "No valid fields to update",
        path: [],
      });
    }
  });

export const updateCodexServiceTierSchema = z
  .object({
    enabled: z.boolean(),
  })
  .strict();
