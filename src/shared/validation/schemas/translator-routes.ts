import { z } from "zod";

const jsonRecordSchema = z.record(z.string(), z.unknown());
const nonEmptyJsonRecordSchema = jsonRecordSchema.refine(
  (value) => Object.keys(value).length > 0,
  "Body must be a non-empty object"
);

const translatorLogFileSchema = z.enum([
  "1_req_client.json",
  "3_req_openai.json",
  "4_req_target.json",
  "5_res_provider.txt",
]);

export const translatorDetectSchema = z.object({
  body: nonEmptyJsonRecordSchema,
});

export const translatorSaveSchema = z.object({
  file: translatorLogFileSchema,
  content: z.string().min(1, "Content is required").max(1_000_000, "Content is too large"),
});

export const translatorSendSchema = z.object({
  provider: z.string().trim().min(1, "Provider is required"),
  body: nonEmptyJsonRecordSchema,
});

export const translatorTranslateSchema = z
  .object({
    step: z.union([z.number().int().min(1).max(4), z.literal("direct")]),
    provider: z.string().trim().min(1).optional(),
    body: nonEmptyJsonRecordSchema,
    sourceFormat: z.string().optional(),
    targetFormat: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.step !== "direct" && !value.provider) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Step and provider are required",
        path: ["provider"],
      });
    }
  });
