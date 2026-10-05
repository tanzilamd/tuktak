import { publicMetadata } from "@/lib/metadata";
import Link from "next/link";
import { ArrowUpRight, MessageCircle, Smile } from "lucide-react";
import { feed, viewer, socialRevision } from "@/lib/data";
import { configured } from "@/lib/supabase";
import { BRAND } from "@/lib/config";
import { communityPublic } from "@/lib/community-data";
import { CommunityAnnouncement } from "@/components/community-announcement";
import { MobileTopics } from "@/components/mobile-topics";
import { HomeFeed } from "@/components/home-feed";
import type { FeedMode } from "@/lib/types";
export const metadata = publicMetadata("/", "আড্ডা");
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ feed?: string; before?: string }>;
}) {
  const params = await searchParams;
  const v = await viewer();
  const mode = ["following", "institution"].includes(params.feed ?? "")
    ? params.feed
    : "all";
  const [posts, community] = await Promise.all([
    feed({ mode, before: params.before }),
    communityPublic(),
  ]);
  const question = community.question;
  return (
    <>
      <div className="page-top">
        <div>
          <span className="eyebrow">যা বলছেন, ঠিকই বলছেন।</span>
          <h1>
            আড্ডা{" "}
            <span className="heading-spark" aria-hidden="true">
              <MessageCircle size={24} />
            </span>
          </h1>
        </div>
        <span className="today">
          {new Intl.DateTimeFormat("bn-BD", {
            weekday: "long",
            month: "long",
            day: "numeric",
            timeZone: "Asia/Dhaka",
          }).format(new Date())}
        </span>
      </div>
      {community.announcement && (
        <CommunityAnnouncement
          key={`${community.announcement.id}:${community.announcement.updated_at}`}
          announcement={community.announcement}
        />
      )}
      {!v && (
        <section className="welcome-card">
          <span className="eyebrow">
            <Smile size={14} /> এখানে তোমার মতোই সবাই
          </span>
          <h2>
            বড় কথা না হোক,
            <br />
            <span>ছোট্ট কিছু বলে ফেলো।</span>
          </h2>
          <p>
            {BRAND.description}
            <br />
            {BRAND.tagline}
          </p>
          <div className="welcome-bottom">
            <Link className="button button-primary" href="/signup">
              আড্ডায় যোগ দিই
              <ArrowUpRight size={17} />
            </Link>
            <span className="welcome-avatars" aria-hidden="true">
              <i>রা</i>
              <i>মি</i>
              <i>অ</i>
              <span>তোমার জন্যও জায়গা আছে</span>
            </span>
          </div>
          <span className="hero-doodle" aria-hidden="true">
            <MessageCircle size={130} strokeWidth={1} />
          </span>
        </section>
      )}
      {question && (
        <section className="daily-question">
          <div className="question-icon">
            <MessageCircle size={22} />
          </div>
          <div>
            <span className="eyebrow">
              আজকের প্রশ্ন <span>· একটু ভাবি?</span>
            </span>
            <h2>{question}</h2>
          </div>
          <Link
            href={`/compose?prompt=${encodeURIComponent(question + "\n")}`}
            aria-label="আজকের প্রশ্নের উত্তর দিই"
          >
            উত্তর দিই <ArrowUpRight size={15} />
          </Link>
        </section>
      )}
      <HomeFeed
        moods={community.moods}
        placeholder={community.prompt ?? ""}
        key={socialRevision([v, mode, params.before, posts])}
        mobileTopics={<MobileTopics />}
        initialPosts={posts}
        initialMode={mode as FeedMode}
        initialBefore={params.before}
        viewer={v}
        configured={configured()}
      />
    </>
  );
}
