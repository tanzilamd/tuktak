"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/supabase";
import {
  commandSchemas,
  credentialsSchema,
  registrationSchema,
} from "@/lib/validation";
import { safeNext } from "@/lib/config";
import type { ActionState } from "@/lib/types";
const fail = (message: string): ActionState => ({ ok: false, message });
const unavailable = () =>
  fail("এই মুহূর্তে আড্ডায় যোগ দেওয়া যাচ্ছে না। একটু পরে চেষ্টা করো।");
export async function mutate(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const action = String(form.get("action"));
  const schema = commandSchemas[action as keyof typeof commandSchemas];
  if (!schema) return fail("অনুরোধটি সঠিক নয়।");
  const raw: Record<string, unknown> = Object.fromEntries(form.entries());
  for (const name of ["enabled", "institution_visible", "discoverable"]) {
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
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const client = await db();
  if (!client) return unavailable();
  const { error, data } = await client.rpc("command", {
    action,
    payload: parsed.data,
  });
  if (error) {
    if (error.message.includes("rate_limit"))
      return fail("একটু বিরতি নিই? ১০ মিনিট পরে আবার চেষ্টা করো।");
    if (error.message.includes("duplicate_content"))
      return fail("এই কথাটা একটু আগেই বলেছ। নতুন কিছু বলি?");
    if (error.code === "23505")
      return fail("Username-টা কেউ নিয়ে ফেলেছে। অন্য একটা দাও।");
    if (error.message.includes("account_suspended"))
      return fail("তোমার অ্যাকাউন্ট আপাতত স্থগিত আছে।");
    if (error.message.includes("authentication_required"))
      return fail("আগে লগইন করো।");
    return fail("কাজটা করা গেল না। অনুমতি ও তথ্য দেখে আবার চেষ্টা করো।");
  }
  if (action === "delete_account") {
    await client.auth.signOut();
    redirect("/?deleted=1");
  }
  revalidatePath("/", "layout");
  if (action === "post" && form.get("redirect") === "true")
    redirect(`/post/${data.id}`);
  if (action === "profile" && form.get("onboarding") === "true") redirect("/");
  return {
    ok: true,
    message:
      action === "report"
        ? "রিপোর্ট পেয়েছি। তোমার পরিচয় গোপন থাকবে।"
        : "হয়ে গেছে ✨",
  };
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
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const { email, password, ...metadata } = parsed.data;
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
    if (!parsed.success) return fail(parsed.error.issues[0].message);
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
    if (!email.success) return fail("সঠিক ইমেইল দাও।");
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
    if (!password.success) return fail(password.error.issues[0].message);
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
