export const BRAND = {
  name: "টুকটাক",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "",
  tagline: "মাথায় যা, ২৪০-এর মাঝে তা।",
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
  "আজকে mood এক emoji-তে বললে কী হবে?",
  "কোন খাবারটা নিয়ে তুমি unnecessary emotional?",
  "ছোটবেলার সবচেয়ে random ভয় কী ছিল?",
  "একদিনের জন্য কোনো skill পেলে কোনটা নিতে?",
  "আজকের ছোট্ট ভালো লাগাটা কী?",
  "তোমার জীবনের background music কোন গান?",
  "একটা unpopular opinion বলে ফেলো!",
  "বৃষ্টির দিনে খিচুড়ি না নুডলস?",
  "বন্ধুর কোন অভ্যাসটা secretly ভালো লাগে?",
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
  const day = Math.floor((date.getTime() + 6 * 3600000) / 86400000);
  return QUESTIONS[day % QUESTIONS.length];
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
