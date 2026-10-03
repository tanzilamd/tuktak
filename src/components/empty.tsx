import Link from "next/link";
export function Empty({
  emoji = "🍃",
  title = "এত চুপচাপ কেন?",
  text = "কিছু একটা বলে ফেলো 👀",
  href,
  label,
}: {
  emoji?: string;
  title?: string;
  text?: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="empty card">
      <span className="empty-emoji">{emoji}</span>
      <h2>{title}</h2>
      <p>{text}</p>
      {href && (
        <Link className="button" href={href}>
          {label || "চলো যাই"}
        </Link>
      )}
    </div>
  );
}
