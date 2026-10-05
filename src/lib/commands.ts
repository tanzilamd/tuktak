import "server-only";
import { redirect } from "next/navigation";
import { db } from "./supabase";
import { commandSchemas } from "./validation";
import { validationFailure } from "./form-errors";
import type { ActionState } from "./types";
import type { Notification } from "./notifications";
const fail = (message: string): ActionState => ({ ok: false, message });
export async function executeCommand(form: FormData): Promise<
  ActionState & {
    id?: string;
    entries?: Notification[];
    entryUnreadIds?: string[];
  }
> {
  const action = String(form.get("action"));
  const schema = commandSchemas[action as keyof typeof commandSchemas];
  if (!schema) return fail("অনুরোধটি সঠিক নয়।");
  const raw: Record<string, unknown> = Object.fromEntries(form.entries());
  for (const name of [
    "enabled",
    "institution_visible",
    "discoverable",
    "onboarding",
  ]) {
    if (form.has(name))
      raw[name] = form.get(name) === "true" || form.get(name) === "on";
    else if (action === "profile") raw[name] = false;
  }
  if (action === "profile") raw.hobbies = form.getAll("hobbies");
  if (action === "read" && !raw.id) delete raw.id;
  if (action === "read" && raw.ids) {
    try {
      raw.ids = JSON.parse(String(raw.ids));
    } catch {
      return fail("অনুরোধটি সঠিক নয়।");
    }
  }
  if (raw.poll_options) {
    try {
      raw.poll_options = JSON.parse(String(raw.poll_options));
    } catch {
      return fail("পোলের উত্তরগুলো দেখে আবার চেষ্টা করো।");
    }
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return validationFailure(parsed.error);
  const client = await db();
  if (!client)
    return fail("এই মুহূর্তে আড্ডায় যোগ দেওয়া যাচ্ছে না। একটু পরে চেষ্টা করো।");
  const { error, data } = await client.rpc("command", {
    action,
    payload: parsed.data,
  });
  if (error) {
    if (error.message.includes("edit_expired"))
      return fail("পোস্ট দেওয়ার ১৫ মিনিট পরে আর সম্পাদনা করা যায় না।");
    if (error.message.includes("poll_closed"))
      return fail("ভোটগ্রহণ শেষ হয়েছে।");
    if (error.message.includes("mention_limit"))
      return fail("সর্বোচ্চ ৫ জনকে উল্লেখ করো।");
    if (error.message.includes("invalid_parent"))
      return fail("এই উত্তরটি আর পাওয়া যাচ্ছে না।");
    if (
      error.message.includes("invalid_poll") ||
      (action === "post" && error.code === "23505")
    )
      return fail("পোলের ২–৪টি আলাদা উত্তর ও সময় দেখে নাও।");
    if (action === "profile" && error.message.includes("onboarding_complete"))
      redirect("/settings/profile");
    if (error.message.includes("rate_limit"))
      return fail("একটু বিরতি নিই? ১০ মিনিট পরে আবার চেষ্টা করো।");
    if (error.message.includes("duplicate_content"))
      return fail("এই কথাটা একটু আগেই বলেছ। নতুন কিছু বলি?");
    if (action === "profile" && error.code === "23505")
      return {
        ...fail("Username-টা কেউ নিয়ে ফেলেছে। অন্য একটা দাও।"),
        fieldErrors: {
          username: "Username-টা কেউ নিয়ে ফেলেছে। অন্য একটা দাও।",
        },
      };
    if (error.message.includes("account_suspended"))
      return fail("তোমার অ্যাকাউন্ট আপাতত স্থগিত আছে।");
    if (error.message.includes("authentication_required"))
      return fail("আগে লগইন করো।");
    return fail("কাজটা করা গেল না। অনুমতি ও তথ্য দেখে আবার চেষ্টা করো।");
  }
  return {
    ok: true,
    message:
      action === "report"
        ? "রিপোর্ট পেয়েছি। অন্য ব্যবহারকারীরা তোমার পরিচয় দেখবে না।"
        : "হয়ে গেছে ✨",
    ...(typeof data?.id === "string" ? { id: data.id } : {}),
    ...(action === "inbox_open" &&
    Array.isArray(data?.entries) &&
    Array.isArray(data?.entryUnreadIds)
      ? {
          entries: data.entries as Notification[],
          entryUnreadIds: data.entryUnreadIds as string[],
          unreadCount: Math.min(
            100,
            Math.max(0, Number(data.unreadCount) || 0),
          ),
        }
      : {}),
  };
}
