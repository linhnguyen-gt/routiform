import { z } from "zod";

export const updateAutoDisableAccountsSchema = z
  .object({
    enabled: z.boolean(),
    threshold: z.number().int().min(1).max(10).optional(),
  })
  .strict();

export const versionManagerToolSchema = z.object({
  tool: z.string().trim().min(1),
});

export const versionManagerInstallSchema = versionManagerToolSchema.extend({
  version: z.string().trim().optional(),
});
