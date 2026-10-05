"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/supabase";
import { executeCommand } from "@/lib/commands";
import { credentialsSchema, registrationSchema } from "@/lib/validation";
import { validationFailure } from "@/lib/form-errors";
import { unreadNotificationCount } from "@/lib/data";
import { safeNext } from "@/lib/config";
import type { ActionState } from "@/lib/types";
import type { Notification } from "@/lib/notifications";
const fail = (message: string): ActionState => ({ ok: false, message });
const unavailable = () =>
  fail("এই মুহূর্তে আড্ডায় যোগ দেওয়া যাচ্ছে না। একটু পরে চেষ্টা করো।");
export async function mutate(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const result = await executeCommand(form);
  if (!result.ok) return result;
  const action = String(form.get("action"));
  if (action === "delete_account") {
    const client = (await db())!;
    await client.auth.signOut();
    redirect("/?deleted=1");
  }
  revalidatePath("/", "layout");
  if (action === "post" && form.get("redirect") === "true")
    redirect(`/post/${result.id}`);
  if (action === "profile" && form.get("onboarding") === "true") redirect("/");
  return result;
}
export async function authenticate(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const client = await db();
  if (!client) return unavailable();
  const action = String(form.get("action"));
  const captchaToken =
    String(form.get("cf-turnstile-response") ?? "") || undefined;
  if (
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY &&
    action !== "update_password" &&
    !captchaToken
  )
    return fail("নিরাপত্তা যাচাইটি শেষ করো।");
  if (action === "signup") {
    const parsed = registrationSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return validationFailure(parsed.error);
    const { email, password, ...metadata } = parsed.data;
    // Usernames are public identifiers. Email existence stays deliberately undisclosed.
    const { data: existing } = await client
      .from("profiles")
      .select("username")
      .eq("username", metadata.username)
      .maybeSingle();
    if (existing)
      return {
        ...fail("Username-টা কেউ নিয়ে ফেলেছে। অন্য একটা দাও।"),
        fieldErrors: {
          username: "Username-টা কেউ নিয়ে ফেলেছে। অন্য একটা দাও।",
        },
      };

    const { error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: `${siteUrl()}/auth/callback?next=/onboarding`,
        captchaToken,
      },
    });
    if (error)
      return fail(
        "অ্যাকাউন্ট তৈরি করা যায়নি। Username, তথ্য ও সংযোগ দেখে আবার চেষ্টা করো।",
      );
    redirect("/verify-email");
  }
  if (action === "login") {
    const parsed = credentialsSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return validationFailure(parsed.error);
    const { error } = await client.auth.signInWithPassword({
      ...parsed.data,
      options: { captchaToken },
    });
    if (error)
      return fail("ইমেইল বা password ঠিক হয়নি, অথবা ইমেইল যাচাই হয়নি।");
    redirect(safeNext(form.get("next")));
  }
  if (action === "forgot") {
    const email = z.email().safeParse(form.get("email"));
    if (!email.success)
      return {
        ...fail("সঠিক ইমেইল দাও।"),
        fieldErrors: { email: "সঠিক ইমেইল ঠিকানা দাও।" },
      };
    const { error } = await client.auth.resetPasswordForEmail(email.data, {
      redirectTo: `${siteUrl()}/auth/callback?next=/reset-password`,
      captchaToken,
    });
    if (error) return fail("মেইল পাঠানো গেল না। একটু পরে চেষ্টা করো।");
    return {
      ok: true,
      message: "অ্যাকাউন্ট থাকলে ইমেইলে password বদলানোর লিংক যাবে।",
    };
  }
  if (action === "update_password") {
    const password = credentialsSchema.shape.password.safeParse(
      form.get("password"),
    );
    if (!password.success)
      return {
        ...fail("Password ১০–১২৮ অক্ষরের মধ্যে দাও।"),
        fieldErrors: { password: "Password ১০–১২৮ অক্ষরের মধ্যে দাও।" },
      };
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return fail("ইমেইলের লিংক থেকে আবার এসো।");
    const { error } = await client.auth.updateUser({ password: password.data });
    if (error) return fail("Password বদলানো যায়নি। নতুন লিংক নিয়ে চেষ্টা করো।");
    await client.auth.signOut({ scope: "global" });
    redirect("/login?reset=1");
  }
  return fail("অনুরোধটি সঠিক নয়।");
}
function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}
export async function logout() {
  const client = await db();
  if (client) await client.auth.signOut();
  redirect("/");
}

export async function markNotificationsRead(
  ids?: string[],
): Promise<ActionState> {
  const form = new FormData();
  form.set("action", "read");
  if (ids) form.set("ids", JSON.stringify(ids));
  const result = await executeCommand(form);
  if (!result.ok) return result;
  const unreadCount = await unreadNotificationCount();
  revalidatePath("/", "layout");
  return { ...result, unreadCount };
}
export async function openInbox(): Promise<
  ActionState & { entries?: Notification[]; entryUnreadIds?: string[] }
> {
  const form = new FormData();
  form.set("action", "inbox_open");
  // No revalidatePath: entry highlighting lives for the visit, not the DB read state.
  return executeCommand(form);
}
