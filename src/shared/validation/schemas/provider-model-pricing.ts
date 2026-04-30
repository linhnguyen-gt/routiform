import { z } from "zod";
import { isForbiddenUpstreamHeaderName } from "@/shared/constants/upstreamHeaders";

const upstreamHeaderNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .refine((s) => !/[\r\n\0]/.test(s), { message: "header name cannot contain control characters" })
  .refine((s) => !/\s/.test(s), { message: "header name cannot contain whitespace" })
  .refine((s) => !s.includes(":"), { message: "header name cannot contain ':'" })
  .refine((s) => !isForbiddenUpstreamHeaderName(s), { message: "header name is not allowed" });

const upstreamHeaderValueSchema = z
  .string()
  .max(4096)
  .refine((s) => !/[\r\n]/.test(s), { message: "header value cannot contain line breaks" });

const upstreamHeadersRecordSchema = z
  .record(upstreamHeaderNameSchema, upstreamHeaderValueSchema)
  .refine((rec) => Object.keys(rec).length <= 16, { message: "at most 16 custom headers" })
  .refine((rec) => !Object.keys(rec).some((k) => isForbiddenUpstreamHeaderName(k)), {
    message: "forbidden header name in record",
  });

const modelCompatPerProtocolSchema = z
  .object({
    normalizeToolCallId: z.boolean().optional(),
    preserveOpenAIDeveloperRole: z.boolean().optional(),
    upstreamHeaders: upstreamHeadersRecordSchema.optional(),
  })
  .strict();

export const providerModelMutationSchema = z.object({
  provider: z.string().trim().min(1, "provider is required").max(120),
  modelId: z.string().trim().min(1, "modelId is required").max(240),
  modelName: z.string().trim().max(240).optional(),
  source: z.string().trim().max(80).optional(),
  apiFormat: z.enum(["chat-completions", "responses"]).default("chat-completions"),
  supportedEndpoints: z.array(z.enum(["chat", "embeddings", "images", "audio"])).default(["chat"]),
  normalizeToolCallId: z.boolean().optional(),
  preserveOpenAIDeveloperRole: z.boolean().nullable().optional(),
  upstreamHeaders: upstreamHeadersRecordSchema.nullable().optional(),
  compatByProtocol: z
    .partialRecord(z.enum(["openai", "openai-responses", "claude"]), modelCompatPerProtocolSchema)
    .optional(),
});

const pricingFieldsSchema = z
  .object({
    input: z.number().min(0).optional(),
    output: z.number().min(0).optional(),
    cached: z.number().min(0).optional(),
    reasoning: z.number().min(0).optional(),
    cache_creation: z.number().min(0).optional(),
  })
  .strict();

export const updatePricingSchema = z.record(
  z.string().trim().min(1),
  z.record(z.string().trim().min(1), pricingFieldsSchema)
);

export const toggleRateLimitSchema = z.object({
  connectionId: z.string().trim().min(1, "connectionId is required"),
  enabled: z.boolean(),
});
