import { z } from "zod";
import { charCount, safeNext, SITE_URL } from "./config";
export const COMMUNITY_KINDS = [
  "questions",
  "prompts",
  "moods",
  "topics",
  "announcements",
] as const;
export type CommunityKind = (typeof COMMUNITY_KINDS)[number];
export const COMMUNITY_LABELS: Record<CommunityKind, string> = {
  questions: "আজকের প্রশ্ন",
  prompts: "পোস্ট প্রম্পট",
  moods: "মুড",
  topics: "আলোচনায়",
  announcements: "ঘোষণা",
};
export type Announcement = {
  id: string;
  title: string;
  body: string;
  priority: number;
  dismissible: boolean;
  link: string;
  ends_at: string | null;
  updated_at: string;
};
export type CommunitySnapshot = {
  question: string | null;
  prompt: string | null;
  moods: string[];
  topics: { tag: string; count: number }[];
  announcement: Announcement | null;
  manualQuestion: boolean;
};
export type CommunityEntry = {
  id: string;
  active: boolean;
  position: number;
  updated_at: string;
  body?: string;
  label?: string;
  emoji?: string;
  value?: string;
  tag?: string;
  title?: string;
  priority?: number;
  dismissible?: boolean;
  starts_at?: string;
  ends_at?: string | null;
  expires_at?: string | null;
  link?: string;
};
const bounded = (max: number, required = false) =>
  z
    .string()
    .trim()
    .refine(
      (v) => charCount(v) <= max && (!required || !!v),
      required ? `১–${max} অক্ষরের মধ্যে লিখো।` : `সর্বোচ্চ ${max} অক্ষর।`,
    );
export function dhakaInput(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Date(date.getTime() + 6 * 3600000).toISOString().slice(0, 16)
    : "";
}
const dateInput = (required = false) =>
  z
    .string()
    .trim()
    .refine((v) => {
      if (!v) return !required;
      return (
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) &&
        dhakaInput(`${v}+06:00`) === v
      );
    }, "বাংলাদেশ সময় অনুযায়ী সঠিক দিন ও সময় দাও।")
    .transform((v) => (v ? new Date(`${v}+06:00`).toISOString() : null));
export function safeCommunityLink(value: string) {
  if (!value) return true;
  if (/\s|\\/.test(value) || charCount(value) > 1000) return false;
  if (value.startsWith("/")) return safeNext(value) === value;
  if (!/^https:\/\/[a-zA-Z0-9.-]+(:[0-9]{1,5})?([/?#]|$)/.test(value))
    return false;
  try {
    const url = new URL(value, SITE_URL);
    return (
      value.startsWith("https://") &&
      url.protocol === "https:" &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
const common = {
  id: z.uuid().optional(),
  active: z.boolean(),
  position: z.coerce
    .number()
    .int()
    .min(0, "ক্রম ০–৯৯৯৯-এর মধ্যে দাও।")
    .max(9999, "ক্রম ০–৯৯৯৯-এর মধ্যে দাও।")
    .default(0),
};
export const communitySaveSchema = z.discriminatedUnion("kind", [
  z.object({
    ...common,
    kind: z.literal("questions"),
    body: bounded(160, true),
  }),
  z.object({ ...common, kind: z.literal("prompts"), body: bounded(120, true) }),
  z.object({
    ...common,
    kind: z.literal("moods"),
    label: bounded(40, true),
    emoji: bounded(12),
  }),
  z.object({
    ...common,
    kind: z.literal("topics"),
    tag: z
      .string()
      .trim()
      .transform((v) => v.replace(/^#/, "").toLowerCase())
      .pipe(
        z.string().regex(
          // Individual Bengali codepoints (including vowel marks) match the SQL tag index alphabet.
          // eslint-disable-next-line no-misleading-character-class
          /^[a-z0-9_\u0980-\u0983\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bc-\u09c4\u09c7\u09c8\u09cb-\u09ce\u09d7\u09dc\u09dd\u09df-\u09e3\u09e6-\u09ef\u09f0\u09f1\u09f4-\u09f9\u09fc\u09fe]{1,40}$/,
          "বাংলা বা ইংরেজি অক্ষর, সংখ্যা ও _ দিয়ে ১–৪০ অক্ষরের বিষয় দাও।",
        ),
      ),
    expires_at: dateInput(),
  }),
  z
    .object({
      ...common,
      kind: z.literal("announcements"),
      title: bounded(60),
      body: bounded(240, true),
      priority: z.coerce
        .number()
        .refine((v) => [1, 2, 3].includes(v), "ঘোষণার ধরন বেছে নাও।"),
      dismissible: z.boolean(),
      starts_at: dateInput(true),
      ends_at: dateInput(),
      link: z
        .string()
        .trim()
        .refine(
          safeCommunityLink,
          "https:// লিংক বা টুকটাকের পাতার ঠিকানা দাও।",
        ),
    })
    .refine((v) => !v.ends_at || (v.starts_at && v.ends_at > v.starts_at), {
      path: ["ends_at"],
      message: "শেষের সময় শুরুর সময়ের পরে দাও।",
    }),
]);
export const communityCommandSchemas = {
  community_save: communitySaveSchema,
  community_delete: z.object({ kind: z.enum(COMMUNITY_KINDS), id: z.uuid() }),
  community_toggle: z.object({
    kind: z.enum(COMMUNITY_KINDS),
    id: z.uuid(),
    active: z.boolean(),
  }),
  community_pin: z.object({ id: z.uuid() }),
  community_release: z.object({}),
};
export function communityInput(form: FormData) {
  return {
    ...Object.fromEntries(form),
    active: ["true", "on"].includes(String(form.get("active"))),
    dismissible: ["true", "on"].includes(String(form.get("dismissible"))),
  };
}
export const COMMUNITY_FIELD_MESSAGES: Record<string, string> = {
  body: "লেখাটা দেখে আবার দাও।",
  label: "মুডের নাম ১–৪০ অক্ষরে দাও।",
  emoji: "ইমোজি সর্বোচ্চ ১২ অক্ষরের হতে পারে।",
  position: "ক্রম ০–৯৯৯৯-এর মধ্যে দাও।",
  tag: "সঠিক বিষয় দাও।",
  title: "শিরোনাম সর্বোচ্চ ৬০ অক্ষর।",
  priority: "ঘোষণার ধরন বেছে নাও।",
  starts_at: "শুরুর দিন ও সময় দাও।",
  ends_at: "শেষের দিন ও সময় দেখে নাও।",
  expires_at: "শেষের দিন ও সময় দেখে নাও।",
  link: "https:// লিংক বা টুকটাকের পাতার ঠিকানা দাও।",
};
