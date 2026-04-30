import { z } from "zod";

export const loginSchema = z.object({
  password: z.string().min(1, "Password is required").max(200),
});
