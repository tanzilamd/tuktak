import { redirect } from "next/navigation";
import { requireViewer, adminAccounts } from "@/lib/data";
import { Mutation } from "@/components/forms";
export const metadata = { title: "দল পরিচালনা", robots: { index: false } };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const v = await requireViewer();
  if (v.role !== "admin") redirect("/");
  const p = await searchParams;
  const users = await adminAccounts(p.q ?? "");
  return (
    <section className="card content-card">
      <h1>দল পরিচালনা</h1>
      <p className="muted">
        শুধু admin-ই moderator-এর দায়িত্ব দিতে বা তুলে নিতে পারে। সব পরিবর্তন
        audit-এ থাকে।
      </p>
      <form className="search-form">
        <label className="sr-only" htmlFor="admin-search">
          Username খুঁজি
        </label>
        <input
          id="admin-search"
          name="q"
          defaultValue={p.q}
          placeholder="Username খুঁজি"
        />
        <button className="button button-small">খুঁজি</button>
      </form>
      <h2 className="sr-only">দলের অ্যাকাউন্ট</h2>
      {users.map((p) => (
        <div className="safety-row" key={p.id}>
          <span>
            {p.display_name}
            <small>
              @{p.username} ·{" "}
              {p.role === "admin"
                ? "অ্যাডমিন"
                : p.role === "moderator"
                  ? "মডারেটর"
                  : "ব্যবহারকারী"}
              {p.suspended ? " · স্থগিত" : ""}
            </small>
          </span>
          {p.id !== v.id && p.role !== "admin" && (
            <Mutation action="role" values={{ id: p.id }} label="দায়িত্ব রাখি">
              <label className="sr-only" htmlFor={`role-${p.id}`}>
                দায়িত্ব
              </label>
              <select id={`role-${p.id}`} name="role" defaultValue={p.role}>
                <option value="user">User</option>
                <option value="moderator">Moderator</option>
              </select>
            </Mutation>
          )}
        </div>
      ))}
      {!users.length && <p className="muted">এই নামে কাউকে পাওয়া যায়নি।</p>}
    </section>
  );
}
