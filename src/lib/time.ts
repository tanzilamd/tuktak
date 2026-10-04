import { bn } from "./config";
const compact = new Intl.DateTimeFormat("bn-BD", {
  day: "numeric",
  month: "long",
  timeZone: "Asia/Dhaka",
});
const exact = new Intl.DateTimeFormat("bn-BD", {
  dateStyle: "full",
  timeStyle: "short",
  timeZone: "Asia/Dhaka",
});
export function relativeTime(value: string, now = new Date()) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const seconds = Math.max(0, (now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "এইমাত্র";
  if (seconds < 3600) return `${bn(Math.floor(seconds / 60))} মিনিট`;
  if (seconds < 86400) return `${bn(Math.floor(seconds / 3600))} ঘণ্টা`;
  return compact.format(date);
}
export function exactTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? exact.format(date) : "";
}
