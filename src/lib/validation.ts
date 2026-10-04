import { z } from "zod";
import {
  ACCENTS,
  EDUCATION,
  HOBBIES,
  MOODS,
  REACTIONS,
  REPORT_REASONS,
  RESERVED,
  charCount,
  STATUS_LIMIT,
} from "./config";
export const text = (max: number) =>
  z
    .string()
    .trim()
    .refine(
      (v) => charCount(v) > 0 && charCount(v) <= max,
      `১–${max} অক্ষরের মধ্যে লিখো।`,
    );
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9_]{3,20}$/,
    "Username: 3–20 Latin letters, numbers or underscore.",
  )
  .refine((v) => !RESERVED.includes(v), "এই username-টা সংরক্ষিত।");
export const phoneSchema = z
  .string()
  .transform((v) =>
    v
      .replace(/[\s()-]/g, "")
      .replace(/^01/, "+8801")
      .replace(/^880/, "+880"),
  )
  .pipe(
    z.string().regex(/^\+8801[3-9]\d{8}$/, "সঠিক বাংলাদেশি মোবাইল নম্বর দাও।"),
  );
const short = (n: number) =>
  z.string().refine((v) => charCount(v) <= n, `সর্বোচ্চ ${n} অক্ষর।`);
export const normalizeDigits = (value: string) =>
  value.replace(/[০-৯]/g, (digit) => String("০১২৩৪৫৬৭৮৯".indexOf(digit)));
export const batchSchema = z
  .string()
  .trim()
  .transform(normalizeDigits)
  .pipe(
    z.string().regex(/^([12][0-9]{3})?$/, "চার সংখ্যার সাল দাও, যেমন ২০২৫।"),
  );
export const profileSchema = z.object({
  username: usernameSchema,
  display_name: text(40),
  bio: short(100),
  education: z.union([z.literal(""), z.enum(EDUCATION)]),
  institution: short(100),
  institution_visible: z.boolean(),
  class_year: short(40),
  ssc_batch: batchSchema,
  hsc_batch: batchSchema,
  hobbies: z
    .array(z.enum(HOBBIES))
    .max(5)
    .refine((v) => new Set(v).size === v.length),
  status: z.string().trim().pipe(short(STATUS_LIMIT)),
  accent: z.enum(ACCENTS),
  discoverable: z.boolean(),
  onboarding: z.boolean().optional(),
});
const id = z.string().uuid();
export const commandSchemas = {
  post: z.object({
    body: text(240),
    mood: z.union([z.literal(""), z.enum(MOODS)]),
  }),
  delete_post: z.object({ id }),
  comment: z.object({ id, body: text(180) }),
  delete_comment: z.object({ id }),
  react: z.object({ id, kind: z.enum(REACTIONS.map((r) => r.key)) }),
  follow: z.object({ id, enabled: z.boolean() }),
  block: z.object({ id, enabled: z.boolean() }),
  mute: z.object({ id, enabled: z.boolean() }),
  report: z.object({
    id,
    target_type: z.enum(["post", "comment", "user"]),
    reason: z.enum(REPORT_REASONS),
    notes: short(500),
  }),
  profile: profileSchema,
  phone: z.object({ phone: phoneSchema }),
  read: z.object({ id: id.optional(), ids: z.array(id).max(100).optional() }),
  delete_account: z.object({ confirmation: z.literal("DELETE") }),
  moderate: z.object({
    id,
    decision: z.enum(["dismiss", "hide", "remove", "suspend"]),
    note: short(500),
  }),
  unsuspend: z.object({ id }),
  role: z.object({ id, role: z.enum(["user", "moderator"]) }),
} as const;
export const credentialsSchema = z.object({
  email: z.email({ error: "সঠিক ইমেইল ঠিকানা দাও।" }).max(254),
  password: z.string().min(10, "অন্তত ১০ অক্ষরের password দাও।").max(128),
});
export const registrationSchema = credentialsSchema.extend({
  username: usernameSchema,
  display_name: text(40),
  phone: phoneSchema,
});
