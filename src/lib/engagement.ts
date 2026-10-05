import { charCount } from "./config";
import type { Poll } from "./types";

export const MENTION_LIMIT = 5;
export const POLL_OPTION_LIMIT = 60;
export const POLL_DURATIONS = [3600, 21600, 86400, 259200, 604800] as const;
export const POLL_DURATION_LABELS = [
  "১ ঘণ্টা",
  "৬ ঘণ্টা",
  "১ দিন",
  "৩ দিন",
  "৭ দিন",
];
export const EDIT_WINDOW = 15 * 60 * 1000;
export const mentionPattern = () =>
  /(?:^|[\s([{])@([a-z0-9_]{3,20})(?![a-z0-9_])/gi;
export function mentionNames(text: string) {
  return [
    ...new Set(
      [
        ...text.replace(/https?:\/\/[^\s<>]+/gi, "").matchAll(mentionPattern()),
      ].map((m) => m[1].toLowerCase()),
    ),
  ].sort();
}
export function pollOptionKey(text: string) {
  return text
    .trim()
    .replace(/\s+/gu, " ")
    .normalize("NFKC")
    .replace(/[A-Z]/g, (c) => c.toLowerCase());
}
export function validPollOptions(options: string[]) {
  return (
    options.length >= 2 &&
    options.length <= 4 &&
    options.every(
      (o) => o.trim() && charCount(o.trim()) <= POLL_OPTION_LIMIT,
    ) &&
    new Set(options.map(pollOptionKey)).size === options.length
  );
}
export function voteOptimistically(poll: Poll, optionId: string): Poll {
  if (poll.selected_option === optionId) return poll;
  return {
    ...poll,
    selected_option: optionId,
    options: poll.options.map((o) => ({
      ...o,
      votes: Math.max(
        0,
        o.votes +
          (o.id === optionId ? 1 : 0) -
          (o.id === poll.selected_option ? 1 : 0),
      ),
    })),
  };
}
export function pollRemaining(expires: string, now = Date.now()) {
  const minutes = Math.ceil((Date.parse(expires) - now) / 60000);
  if (minutes <= 0) return { closed: true, value: 0, unit: "" };
  if (minutes < 60) return { closed: false, value: minutes, unit: "মিনিট" };
  if (minutes < 1440)
    return { closed: false, value: Math.ceil(minutes / 60), unit: "ঘণ্টা" };
  return { closed: false, value: Math.ceil(minutes / 1440), unit: "দিন" };
}
