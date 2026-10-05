import { requireViewer } from "@/lib/data";
import { NotificationList } from "@/components/notification-list";
export const metadata = { title: "খবর", robots: { index: false } };
export default async function Page() {
  const v = await requireViewer();
  return <NotificationList key={v.id} />;
}
