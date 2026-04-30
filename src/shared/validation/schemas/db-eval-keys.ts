import { z } from "zod";

export const dbBackupRestoreSchema = z.object({
  backupId: z.string().trim().min(1, "backupId is required"),
});

export const evalRunSuiteSchema = z.object({
  suiteId: z.string().trim().min(1, "suiteId is required"),
  outputs: z.record(z.string(), z.string()),
});

const accessScheduleSchema = z.object({
  enabled: z.boolean(),
  from: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
  until: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
  days: z.array(z.number().int().min(0).max(6)).min(1, "At least one day is required").max(7),
  tz: z.string().min(1).max(100),
});

export const updateKeyPermissionsSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    allowedModels: z.array(z.string().trim().min(1)).max(1000).optional(),
    allowedConnections: z.array(z.string().uuid()).max(100).optional(),
    noLog: z.boolean().optional(),
    autoResolve: z.boolean().optional(),
    isActive: z.boolean().optional(),
    maxSessions: z.number().int().min(0).max(10000).optional(),
    accessSchedule: z.union([accessScheduleSchema, z.null()]).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.name === undefined &&
      value.allowedModels === undefined &&
      value.allowedConnections === undefined &&
      value.noLog === undefined &&
      value.autoResolve === undefined &&
      value.isActive === undefined &&
      value.maxSessions === undefined &&
      value.accessSchedule === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "No valid fields to update",
        path: [],
      });
    }
  });
