import type { ZodError } from "zod";
import type { ActionState } from "./types";
const messages: Record<string, string> = {
  display_name: "ডাকনাম ১–৪০ অক্ষরের মধ্যে লিখো।",
  username: "Username-এ ৩–২০টি ইংরেজি অক্ষর, সংখ্যা বা _ দাও।",
  email: "সঠিক ইমেইল ঠিকানা দাও।",
  password: "Password ১০–১২৮ অক্ষরের মধ্যে দাও।",
  phone: "সঠিক বাংলাদেশি মোবাইল নম্বর দাও।",
  bio: "নিজের কথা সর্বোচ্চ ১০০ অক্ষরে লিখো।",
  institution: "প্রতিষ্ঠানের নাম সর্বোচ্চ ১০০ অক্ষরে লিখো।",
  class_year: "ক্লাস বা বর্ষ সর্বোচ্চ ৪০ অক্ষরে লিখো।",
  ssc_batch: "SSC batch-এর সাল ১০০০–২৯৯৯-এর মধ্যে দাও, যেমন ২০২৫।",
  hsc_batch: "HSC batch-এর সাল ১০০০–২৯৯৯-এর মধ্যে দাও, যেমন ২০২৫।",
  hobbies: "সর্বোচ্চ ৫টি আলাদা শখ বেছে নাও।",
  status: "স্ট্যাটাস সর্বোচ্চ ৪০ অক্ষরে লিখো।",
  accent: "তালিকা থেকে তোমার রঙ বেছে নাও।",
};
export function validationFailure(
  error: ZodError,
  customMessages: Record<string, string> = {},
): ActionState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "");
    if (field in customMessages && !fieldErrors[field])
      fieldErrors[field] =
        issue.code === "invalid_type" ? customMessages[field] : issue.message;
    else if (field in messages && !fieldErrors[field])
      fieldErrors[field] =
        field === "username" && issue.code !== "invalid_type"
          ? issue.message
          : messages[field];
  }
  return {
    ok: false,
    message: Object.keys(fieldErrors).length
      ? "চিহ্ন দেওয়া ঘরগুলো একটু দেখে নাও।"
      : "তথ্যগুলো দেখে আবার চেষ্টা করো।",
    fieldErrors,
  };
}
export function profileInput(form: FormData) {
  return {
    ...Object.fromEntries(form),
    hobbies: form.getAll("hobbies"),
    ...Object.fromEntries(
      ["institution_visible", "discoverable", "onboarding"].map((name) => [
        name,
        ["true", "on"].includes(String(form.get(name))),
      ]),
    ),
  };
}
