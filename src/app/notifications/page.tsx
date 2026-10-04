import { inbox, unreadNotificationCount } from "@/lib/data";
import { NotificationList } from "@/components/notification-list";
export const metadata = { title: "খবর", robots: { index: false } };
export default async function Page() {
  const [entries, unreadCount] = await Promise.all([
    inbox(),
    unreadNotificationCount(),
  ]);
  return <NotificationList entries={entries} unreadCount={unreadCount} />;
}
