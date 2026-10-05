import Link from "next/link";
import { Sparkles, ArrowUpRight, Leaf } from "lucide-react";
import { topics } from "@/lib/data";
import { Avatar } from "./avatar";
import { AdminBadge } from "./admin-badge";
import type { Viewer } from "@/lib/types";
import { bn } from "@/lib/config";
export async function RightRail({ viewer }: { viewer: Viewer | null }) {
  const tags = await topics();
  return (
    <aside className="right-rail" aria-label="আড্ডার পাশে">
      {viewer && (
        <Link
          className="mini-profile rail-profile"
          href={`/u/${viewer.profile.username}`}
        >
          <Avatar profile={viewer.profile} />
          <span>
            <b>
              {viewer.profile.display_name}
              <AdminBadge admin={viewer.profile.is_admin} />
            </b>
            <small>@{viewer.profile.username}</small>
          </span>
          <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      )}
      <div className="rail-card">
        <div className="rail-heading">
          <h3>
            <Sparkles size={17} /> আলোচনায়
          </h3>
          <Link href="/discover" aria-label="সব বিষয় দেখি">
            <ArrowUpRight size={17} />
          </Link>
        </div>
        {tags.length ? (
          tags.map((t, i) => (
            <Link
              className="topic"
              key={t.tag}
              href={`/tag/${encodeURIComponent(t.tag)}`}
            >
              <span className="topic-number">{bn(i + 1).padStart(2, "০")}</span>
              <span>
                <b>#{t.tag}</b>
                <small>{bn(t.count)} জনের সাম্প্রতিক কথা</small>
              </span>
              <ArrowUpRight size={15} />
            </Link>
          ))
        ) : (
          <p className="muted small">আড্ডা জমলে বিষয়ও জমবে।</p>
        )}
      </div>
      <div className="rail-note">
        <Leaf size={23} />
        <p>
          নিজের মতো থাকো।
          <br />
          <b>সবাইকে নিজের মতো থাকতে দাও।</b>
        </p>
        <Link href="/community">আমাদের আড্ডার নিয়ম ↗</Link>
      </div>
    </aside>
  );
}
