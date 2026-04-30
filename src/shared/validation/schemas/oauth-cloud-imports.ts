import { z } from "zod";

export const oauthExchangeSchema = z.object({
  code: z.string().trim().min(1),
  redirectUri: z.string().trim().min(1),
  codeVerifier: z.union([z.string(), z.null()]).optional(),
  state: z.union([z.string(), z.null()]).optional(),
});

export const oauthPollSchema = z.object({
  deviceCode: z.string().trim().min(1),
  codeVerifier: z.string().optional(),
  extraData: z.unknown().optional(),
});

export const cursorImportSchema = z.object({
  accessToken: z.string().trim().min(1, "Access token is required"),
  machineId: z.string().trim().min(1, "Machine ID is required"),
});

export const kiroImportSchema = z.object({
  refreshToken: z.string().trim().min(1, "Refresh token is required"),
});

export const kiroSocialExchangeSchema = z.object({
  code: z.string().trim().min(1, "Code is required"),
  codeVerifier: z.string().trim().min(1, "Code verifier is required"),
  provider: z.enum(["google", "github"]),
});

export const cloudCredentialUpdateSchema = z.object({
  provider: z.string().trim().min(1, "Provider is required"),
  credentials: z
    .object({
      accessToken: z.string().optional(),
      refreshToken: z.string().optional(),
      expiresIn: z.coerce.number().positive().optional(),
    })
    .strict()
    .superRefine((value, ctx) => {
      if (
        value.accessToken === undefined &&
        value.refreshToken === undefined &&
        value.expiresIn === undefined
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one credential field must be provided",
          path: [],
        });
      }
    }),
});

export const cloudResolveAliasSchema = z.object({
  alias: z.string().trim().min(1, "Missing alias"),
});

export const cloudModelAliasUpdateSchema = z.object({
  model: z.string().trim().min(1, "Model and alias required"),
  alias: z.string().trim().min(1, "Model and alias required"),
});

export const cloudSyncActionSchema = z.object({
  action: z.enum(["enable", "sync", "disable"]),
});
