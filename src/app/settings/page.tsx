import Link from "next/link";
import { requireViewer, privateSettings } from "@/lib/data";
import { PrivatePhoneForm, Mutation } from "@/components/forms";
import { ThemePicker } from "@/components/theme";
import { logout } from "@/app/actions";
export const metadata = { title: "সেটিংস", robots: { index: false } };
export default async function Page() {
  await requireViewer(true);
  const priv = await privateSettings();
  return (
    <>
      <div className="page-top">
        <h1>আমার মতো করে ⚙️</h1>
      </div>
      <section className="card content-card">
        <h2>নিজের কথা</h2>
        <p className="muted">নাম, bio, শখ আর প্রতিষ্ঠান দেখানোর সিদ্ধান্ত।</p>
        <Link className="button" href="/settings/profile">
          প্রোফাইল বদলাই ↗
        </Link>
      </section>
      <section className="card content-card">
        <h2>শুধু তোমার</h2>
        <p className="muted small">
          মোবাইল নম্বর শুধু এই ব্যক্তিগত পাতায় দেখা যায়।
        </p>
        <PrivatePhoneForm phone={priv.phone} />
        <Link href="/forgot-password" className="settings-link">
          Password / নিরাপত্তা ↗
        </Link>
      </section>
      <section className="card content-card">
        <h2>আলো-অন্ধকার</h2>
        <p className="muted">তোমার চোখের আরাম, তোমার সিদ্ধান্ত।</p>
        <ThemePicker />
      </section>
      <section className="card content-card">
        <h2>নিজের শান্তি</h2>
        <Link className="settings-link" href="/settings/blocked">
          ব্লক করা অ্যাকাউন্ট →
        </Link>
        <Link className="settings-link" href="/settings/muted">
          চুপ রাখা অ্যাকাউন্ট →
        </Link>
      </section>
      <p className="small muted footer-links">
        <Link href="/community">আড্ডার নিয়ম</Link>
        <Link href="/privacy#support">গোপনীয়তা ও সহায়তা</Link>
        <Link href="/terms">ব্যবহারের শর্ত</Link>
      </p>
      <section className="card content-card">
        <h2>বিদায়, আপাতত?</h2>
        <form action={logout}>
          <button className="button" type="submit">
            লগআউট
          </button>
        </form>
        <details className="delete-account">
          <summary>অ্যাকাউন্ট মুছে ফেলতে চাই</summary>
          <p>
            প্রোফাইল, ব্যক্তিগত তথ্য, পোস্ট, উত্তর আর প্রতিক্রিয়া স্থায়ীভাবে
            মুছে যাবে। নিরাপত্তার জন্য রিপোর্ট ও সিদ্ধান্তের ইতিহাস থেকে যেতে
            পারে; সেখানে থাকা লেখা পুরোপুরি মুছে না-ও যেতে পারে। ফিরিয়ে আনা যাবে
            না।
          </p>
          <Mutation
            action="delete_account"
            label="স্থায়ীভাবে মুছে দিই"
            confirm="অ্যাকাউন্ট ও সব পোস্ট স্থায়ীভাবে মুছে যাবে। নিশ্চিত?"
          >
            <label className="field">
              <span>নিশ্চিত করতে DELETE লিখো</span>
              <input
                name="confirmation"
                required
                pattern="DELETE"
                autoComplete="off"
              />
            </label>
          </Mutation>
        </details>
      </section>
    </>
  );
}
