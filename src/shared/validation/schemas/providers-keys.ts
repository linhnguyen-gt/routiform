import { z } from "zod";
import { validateProviderSpecificData } from "@/shared/validation/schemas/provider-specific-data";

export const createProviderSchema = z
  .object({
    provider: z.string().min(1).max(100),
    apiKey: z.string().min(1).max(10000).optional(),
    accessToken: z.string().min(1).max(10000).optional(),
    authType: z.enum(["apikey", "oauth"]).optional(),
    name: z.string().min(1).max(200),
    priority: z.number().int().min(1).max(100).optional(),
    globalPriority: z.number().int().min(1).max(100).nullable().optional(),
    defaultModel: z.string().max(200).nullable().optional(),
    testStatus: z.string().max(50).optional(),
    providerSpecificData: z
      .record(z.string(), z.unknown())
      .optional()
      .superRefine((data, ctx) => {
        validateProviderSpecificData(data, ctx);
      }),
  })
  .refine((data) => data.apiKey || data.accessToken, {
    message: "Either apiKey or accessToken must be provided",
    path: ["apiKey"],
  });

export const createKeySchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
});

export const createSyncTokenSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
});
