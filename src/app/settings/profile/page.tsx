import { requireViewer, privateSettings } from "@/lib/data";
import { ProfileForm } from "@/components/forms";
export const metadata = { title: "প্রোফাইল বদলাই", robots: { index: false } };
export default async function Page() {
  const v = await requireViewer();
  const p = await privateSettings();
  return (
    <section className="card content-card">
      <h1>এটাই আমি 🌱</h1>
      <p className="muted">সব ঘর পূরণ করার দরকার নেই। নিজের মতো করে বলো।</p>
      <ProfileForm
        profile={v.profile}
        privateData={{
          institution: p.institution,
          institution_visible: p.institution_visible,
        }}
      />
    </section>
  );
}
