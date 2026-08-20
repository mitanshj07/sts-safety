// apps/web/src/lib/auth/schemas.ts
import { z } from "zod";

import { userRoleSchema } from "./roles";

export const magicLinkSchema = z.object({
  email: z.email(),
});

export const loginTabSchema = z.enum(["magic", "tourist", "officer"]);

export type LoginTab = z.infer<typeof loginTabSchema>;

export const profileRowSchema = z.object({
  id: z.string().uuid(),
  role: userRoleSchema,
  display_name: z.string(),
  phone_e164: z.string().nullable(),
  locale: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const callbackSearchSchema = z.object({
  code: z.string().min(1).optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
  next: z.string().optional(),
});

export const healthResponseSchema = z.object({
  ok: z.boolean(),
  db: z.number().int().nullable(),
  chain: z.number().int().nullable(),
  ai: z.boolean(),
  version: z.string(),
  modes: z
    .object({
      db: z.string(),
      chain: z.string(),
      ai: z.string(),
      map: z.string(),
      digilocker: z.string().optional(),
    })
    .optional(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
