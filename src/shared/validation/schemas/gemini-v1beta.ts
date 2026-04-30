import { z } from "zod";

const geminiPartSchema = z
  .object({
    text: z.string().optional(),
  })
  .catchall(z.unknown());

const geminiContentSchema = z
  .object({
    role: z.string().optional(),
    parts: z.array(geminiPartSchema).optional(),
  })
  .catchall(z.unknown());

export const v1betaGeminiGenerateSchema = z
  .object({
    contents: z.array(geminiContentSchema).optional(),
    systemInstruction: z
      .object({
        parts: z.array(geminiPartSchema).optional(),
      })
      .catchall(z.unknown())
      .optional(),
    generationConfig: z
      .object({
        stream: z.boolean().optional(),
        maxOutputTokens: z.coerce.number().int().min(1).optional(),
        temperature: z.coerce.number().optional(),
        topP: z.coerce.number().optional(),
      })
      .catchall(z.unknown())
      .optional(),
  })
  .catchall(z.unknown())
  .superRefine((value, ctx) => {
    if (!value.contents && !value.systemInstruction) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "contents or systemInstruction is required",
        path: [],
      });
    }
  });
