import type { Profile } from "@/lib/types";
export function Avatar({
  profile,
  large = false,
}: {
  profile: Pick<Profile, "display_name" | "accent">;
  large?: boolean;
}) {
  const segments = [
    ...new Intl.Segmenter("bn", { granularity: "grapheme" }).segment(
      profile.display_name.trim(),
    ),
  ];
  return (
    <span
      aria-hidden="true"
      className={`avatar accent-${profile.accent} ${large ? "avatar-large" : ""}`}
    >
      {segments
        .slice(0, 2)
        .map((s) => s.segment)
        .join("")}
    </span>
  );
}
