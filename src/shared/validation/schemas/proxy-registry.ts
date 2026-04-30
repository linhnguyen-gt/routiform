import { z } from "zod";

export const proxyConfigSchema = z
  .object({
    type: z
      .preprocess(
        (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
        z.enum(["http", "https", "socks5"])
      )
      .optional(),
    host: z.string().trim().min(1).optional(),
    port: z.coerce.number().int().min(1).max(65535).optional(),
    username: z.string().optional(),
    password: z.string().optional(),
  })
  .strict();

export const updateProxyConfigSchema = z
  .object({
    proxy: proxyConfigSchema.nullable().optional(),
    global: proxyConfigSchema.nullable().optional(),
    providers: z.record(z.string().trim().min(1), proxyConfigSchema.nullable()).optional(),
    combos: z.record(z.string().trim().min(1), proxyConfigSchema.nullable()).optional(),
    keys: z.record(z.string().trim().min(1), proxyConfigSchema.nullable()).optional(),
    level: z.enum(["global", "provider", "combo", "key"]).optional(),
    id: z.string().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasPayload =
      value.proxy !== undefined ||
      value.global !== undefined ||
      value.providers !== undefined ||
      value.combos !== undefined ||
      value.keys !== undefined ||
      value.level !== undefined;

    if (!hasPayload) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "No valid fields to update",
        path: [],
      });
    }

    if (value.level !== undefined && value.proxy === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "proxy is required when level is provided",
        path: ["proxy"],
      });
    }

    if (value.level && value.level !== "global" && !value.id?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "id is required for provider/combo/key level updates",
        path: ["id"],
      });
    }
  });

export const testProxySchema = z.object({
  proxy: z.object({
    type: z.string().optional(),
    host: z.string().trim().min(1, "proxy.host is required"),
    port: z.union([z.string(), z.number()]),
    username: z.string().optional(),
    password: z.string().optional(),
  }),
});

export const createProxyRegistrySchema = z
  .object({
    name: z.string().trim().min(1, "name is required").max(120),
    type: z
      .preprocess(
        (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
        z.enum(["http", "https", "socks5"])
      )
      .optional()
      .default("http"),
    host: z.string().trim().min(1, "host is required").max(255),
    port: z.coerce.number().int().min(1).max(65535),
    username: z.string().optional(),
    password: z.string().optional(),
    region: z.string().trim().max(64).nullable().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
    status: z.enum(["active", "inactive"]).optional().default("active"),
  })
  .strict();

export const updateProxyRegistrySchema = createProxyRegistrySchema.partial().extend({
  id: z.string().trim().min(1, "id is required"),
});

export const proxyAssignmentSchema = z
  .object({
    scope: z.enum(["global", "provider", "account", "combo", "key"]),
    scopeId: z.string().trim().nullable().optional(),
    proxyId: z.string().trim().nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.scope !== "global" && !value.scopeId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "scopeId is required for provider/account/combo/key scope",
        path: ["scopeId"],
      });
    }
  });

export const bulkProxyAssignmentSchema = z
  .object({
    scope: z.enum(["global", "provider", "account", "combo", "key"]),
    scopeIds: z.array(z.string().trim().min(1)).optional().default([]),
    proxyId: z.string().trim().nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.scope !== "global" &&
      (!Array.isArray(value.scopeIds) || value.scopeIds.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "scopeIds is required for provider/account/combo/key scope",
        path: ["scopeIds"],
      });
    }
  });
