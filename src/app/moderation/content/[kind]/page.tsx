import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/staff";
import { communityList } from "@/lib/community-data";
import {
  COMMUNITY_KINDS,
  COMMUNITY_LABELS,
  dhakaInput,
  type CommunityKind,
} from "@/lib/community";
import { CommunityEditor } from "@/components/community-editor";
import { Mutation } from "@/components/forms";
import { StaffNext } from "@/components/staff-console";
import { exactTime } from "@/lib/time";
import { bn } from "@/lib/config";
export const metadata = { title: "আড্ডার কনটেন্ট", robots: { index: false } };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<{
    q?: string;
    status?: string;
    cursor?: string;
    edit?: string;
    add?: string;
  }>;
}) {
  await requireStaff(true);
  const { kind: rawKind } = await params;
  if (!(COMMUNITY_KINDS as readonly string[]).includes(rawKind)) notFound();
  const kind = rawKind as CommunityKind;
  const filters = await searchParams;
  const list = await communityList(kind, filters);
  const selected =
    typeof filters.edit === "string"
      ? list.rows.find((row) => row.id === filters.edit)
      : undefined;
  const editing = filters.add === "1" || !!selected;
  const query = new URLSearchParams();
  for (const name of ["q", "status", "cursor"] as const)
    if (typeof filters[name] === "string") query.set(name, filters[name]);
  const editHref = (id: string) => {
    const p = new URLSearchParams(query);
    p.set("edit", id);
    return `?${p}`;
  };
  return (
    <>
      <nav className="staff-nav" aria-label="কনটেন্টের ধরন">
        {COMMUNITY_KINDS.map((k) => (
          <Link
            key={k}
            href={`/moderation/content/${k}`}
            aria-current={k === kind ? "page" : undefined}
          >
            {COMMUNITY_LABELS[k]}
          </Link>
        ))}
      </nav>
      <div className="page-top">
        <h1>{COMMUNITY_LABELS[kind]}</h1>
        <Link className="button button-small" href="?add=1">
          যোগ করি
        </Link>
      </div>
      {kind === "questions" && (
        <p className="small muted">
          বাংলাদেশের দিনের হিসাবে একই প্রশ্ন থাকে। আজকের বাছাই মধ্যরাত পর্যন্ত।
        </p>
      )}
      {kind === "questions" && list.override && (
        <Mutation action="community_release" label="আবার স্বয়ংক্রিয় বাছাই" />
      )}
      {editing && (
        <section className="card content-card">
          <div className="page-top">
            <h2>{selected ? "সম্পাদনা" : "নতুন যোগ করি"}</h2>
            <Link href={`?${query}`}>বন্ধ করি</Link>
          </div>
          <CommunityEditor
            key={selected?.id ?? `${kind}-new`}
            kind={kind}
            entry={selected}
            start={dhakaInput(new Date().toISOString())}
          />
        </section>
      )}
      <form className="staff-filters">
        <label className="field">
          <span>খুঁজি</span>
          <input
            name="q"
            maxLength={60}
            defaultValue={typeof filters.q === "string" ? filters.q : ""}
          />
        </label>
        <label className="field">
          <span>অবস্থা</span>
          <select name="status" defaultValue={filters.status ?? "all"}>
            <option value="all">সব</option>
            <option value="active">সক্রিয়</option>
            <option value="inactive">বন্ধ</option>
          </select>
        </label>
        <button className="button button-small">দেখি</button>
      </form>
      <h2 className="sr-only">কনটেন্ট তালিকা</h2>
      {list.rows.map((row) => (
        <article className="card content-card community-row" key={row.id}>
          {row.title && <strong>{row.title}</strong>}
          <p className="community-text">
            {row.body ?? row.value ?? `#${row.tag}`}
          </p>
          <p className="small muted">
            {row.active ? "সক্রিয়" : "বন্ধ"}
            {kind !== "announcements" && <> · ক্রম {bn(row.position)}</>}
            {kind === "questions" &&
              list.override === row.id &&
              " · আজকের বাছাই"}
          </p>
          {kind === "announcements" && (
            <p className="small muted">
              {row.priority === 3
                ? "জরুরি"
                : row.priority === 2
                  ? "গুরুত্বপূর্ণ"
                  : "সাধারণ"}{" "}
              · শুরু{" "}
              <time dateTime={row.starts_at!}>{exactTime(row.starts_at!)}</time>
              {row.ends_at && (
                <>
                  {" "}
                  · শেষ{" "}
                  <time dateTime={row.ends_at}>{exactTime(row.ends_at)}</time>
                </>
              )}
            </p>
          )}
          {row.expires_at && (
            <p className="small muted">
              শেষ{" "}
              <time dateTime={row.expires_at}>{exactTime(row.expires_at)}</time>
            </p>
          )}
          <div className="moderation-controls">
            <Link
              className="button button-small"
              href={editHref(row.id)}
              prefetch={false}
            >
              সম্পাদনা
            </Link>
            <Mutation
              action="community_toggle"
              values={{ kind, id: row.id, active: !row.active }}
              label={row.active ? "বন্ধ রাখি" : "সক্রিয় করি"}
            />
            {kind === "questions" && row.active && list.override !== row.id && (
              <Mutation
                action="community_pin"
                values={{ id: row.id }}
                label="আজকের প্রশ্ন করি"
              />
            )}
            <Mutation
              action="community_delete"
              values={{ kind, id: row.id }}
              label="মুছে দিই"
              confirm={
                kind === "moods"
                  ? "তালিকা থেকে এই মুড সরাবে? পুরোনো পোস্টের মুড বদলাবে না।"
                  : "তালিকা থেকে এটি সরাবে?"
              }
            />
          </div>
        </article>
      ))}
      {!list.rows.length && (
        <p className="card content-card muted">এই খোঁজে কিছু নেই।</p>
      )}
      <StaffNext
        next={list.next}
        filters={{ q: filters.q, status: filters.status }}
      />
    </>
  );
}
