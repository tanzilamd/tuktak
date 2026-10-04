export const BRAND = {
  name: "টুকটাক",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "",
  tagline: "কথা জমাইও না।",
  description:
    "বাংলাদেশের শিক্ষার্থীদের জন্য ২৪০ অক্ষরের বাংলা social network।",
};
export const MOODS = [
  "😄 জমে গেছে",
  "😂 হাসি পাচ্ছে",
  "😭 আর পারি না",
  "😵‍💫 মাথা শেষ",
  "😌 শান্তি",
  "😤 বিরক্ত",
  "🥹 ইমোশনাল",
  "🤔 ভাবছি",
  "🔥 উত্তেজিত",
  "🎲 র‍্যান্ডম",
] as const;
export const REACTIONS = [
  { key: "love", emoji: "❤️", label: "ভালো লাগলো" },
  { key: "haha", emoji: "😂", label: "সেই" },
  { key: "relate", emoji: "😭", label: "বুঝি ভাই" },
  { key: "fire", emoji: "🔥", label: "ব্যাপার" },
] as const;
export const EDUCATION = [
  "স্কুলে পড়ি",
  "কলেজে পড়ি",
  "মাদ্রাসায় পড়ি",
  "বিশ্ববিদ্যালয়ে পড়ি",
  "ভর্তি প্রস্তুতি নিচ্ছি",
  "গ্যাপ ইয়ার",
  "পড়াশোনায় বিরতিতে",
  "পড়াশোনা শেষ",
  "বর্তমানে পড়াশোনা করছি না",
  "অন্যান্য",
] as const;
export const HOBBIES = [
  "গেমিং",
  "ফুটবল",
  "ক্রিকেট",
  "সিনেমা",
  "সিরিজ",
  "বই",
  "গান",
  "আঁকাআঁকি",
  "ফটোগ্রাফি",
  "প্রযুক্তি",
  "প্রোগ্রামিং",
  "বিতর্ক",
  "ভ্রমণ",
  "রান্না",
  "ফিটনেস",
  "অ্যানিমে",
  "লেখালেখি",
  "মিম",
  "অন্যান্য",
] as const;
export const ACCENTS = ["mango", "mint", "berry", "sky"] as const;
export const ACCENT_LABELS: Record<(typeof ACCENTS)[number], string> = {
  mango: "কমলা",
  mint: "সবুজ",
  berry: "বেগুনি",
  sky: "নীল",
};
export const STATUS_LIMIT = 40;
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://tuktakbd.vercel.app";
export const REPORT_REASONS = [
  "হয়রানি",
  "অপমান বা bullying",
  "স্প্যাম",
  "ভুয়া পরিচয়",
  "অনুপযুক্ত কনটেন্ট",
  "ব্যক্তিগত তথ্য প্রকাশ",
  "অন্যান্য",
] as const;
export const QUESTIONS = [
  "এই সপ্তাহে সবচেয়ে বেশি কোন কথাটা বলেছ?",
  "আজকের মুড এক ইমোজিতে বললে কী হবে?",
  "কোন খাবারটা দেখলে মন ভালো হয়ে যায়?",
  "ছোটবেলায় কোন অদ্ভুত জিনিসকে ভয় পেতে?",
  "একদিনের জন্য একটা নতুন দক্ষতা পেলে কী নিতে?",
  "আজকের ছোট্ট ভালো লাগাটা কী?",
  "তোমার জীবনের পেছনে একটা গান বাজলে কোনটা বাজত?",
  "সবাই পছন্দ করে, কিন্তু তোমার ভালো লাগে না—এমন কী আছে?",
  "বৃষ্টির দিনে খিচুড়ি না নুডলস?",
  "বন্ধুর কোন অভ্যাসটা তোমার ভালো লাগে?",
  "বন্ধুদের সঙ্গে শেষ কবে হাসতে হাসতে পেট ব্যথা হয়েছে?",
  "ক্যান্টিনের কোন খাবারটা সবচেয়ে মনে পড়ে?",
  "ছুটি পেলে ঘুম, ঘোরাঘুরি না বন্ধুদের আড্ডা?",
  "কোন মিমটা দেখে এখনো হাসি পায়?",
  "তোমার পছন্দের চায়ের সঙ্গে কী লাগে?",
  "হঠাৎ পুরোনো বন্ধুর সঙ্গে দেখা হলে প্রথমে কী বলবে?",
  "কোন ছোট্ট জিনিসটা তোমার দিন ভালো করে দেয়?",
  "কোন গানটা শুনলে সঙ্গে সঙ্গে গলা মেলাও?",
  "ফোনের কোন অ্যাপটা একদিন বাদ দিতে পারবে?",
  "ছোটবেলার কোন খেলাটা আবার খেলতে ইচ্ছা করে?",
  "তোমার ব্যাগে সবচেয়ে অদ্ভুত কী থাকে?",
  "আজ কাউকে একটা ধন্যবাদ দিতে হলে কাকে দেবে?",
  "কোন সিনেমা বা সিরিজটা বন্ধুকে দেখতে বলবে?",
  "তোমাদের আড্ডার সবচেয়ে মজার কথাটা কী?",
  "একটা দিনের কাজ বন্ধুকে দিতে পারলে কোনটা দিতে?",
  "যেতে ইচ্ছা করে, কিন্তু এখনো যাওয়া হয়নি—কোথায়?",
  "তোমার নিজের কোন অভ্যাসটা দেখে হাসি পায়?",
  "কোন খাবারটা ভাগ করে খেতে মন চায় না?",
  "আজকের দিনটার একটা নাম দিলে কী হবে?",
  "কোন পুরোনো ছবিটা দেখলে গল্প মনে পড়ে?",
  "তোমার শহরের কোন জায়গাটা সবচেয়ে ভালো লাগে?",
];
export const RESERVED = [
  "admin",
  "api",
  "login",
  "signup",
  "settings",
  "support",
  "moderator",
  "system",
  "discover",
  "notifications",
  "onboarding",
  "auth",
  "post",
  "tag",
  "u",
  "help",
  "tuktak",
  "www",
];
export const bn = (n: number) => new Intl.NumberFormat("bn-BD").format(n);
export const charCount = (s: string) => Array.from(s).length;
export function questionOfDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (name: string) =>
    Number(parts.find((p) => p.type === name)?.value);
  const day = Math.floor(
    Date.UTC(part("year"), part("month") - 1, part("day")) / 86400000,
  );
  return QUESTIONS[
    ((day % QUESTIONS.length) + QUESTIONS.length) % QUESTIONS.length
  ];
}
export function safeNext(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length > 2000 ||
    !value.startsWith("/") ||
    value.includes("\\") ||
    Array.from(value).some(
      (c) => c.charCodeAt(0) <= 32 || c.charCodeAt(0) === 127,
    )
  )
    return "/";
  try {
    const url = new URL(value, "https://tuktak.invalid");
    return url.origin === "https://tuktak.invalid" ? value : "/";
  } catch {
    return "/";
  }
}
