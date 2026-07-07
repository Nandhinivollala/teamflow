import Link from "next/link";
import { requireUser } from "@/modules/auth/session";
import { getCachedNotifications } from "@/modules/workspace-cache";
import { markAllNotificationsRead, markNotificationRead } from "./actions";

export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await getCachedNotifications(user.id);

  return (
    <main className="notification-page">
      <div className="notification-head">
        <div>
          <Link href="/">← Dashboard</Link>
          <p className="eyebrow">YOUR INBOX</p>
          <h1>Notifications</h1>
        </div>
        <form action={markAllNotificationsRead}>
          <button className="secondary">Mark all read</button>
        </form>
      </div>

      <section className="notification-list panel">
        {notifications.map((item) => (
          <article className={item.readAt ? "" : "unread"} key={item.id}>
            <span className="notification-symbol">♢</span>
            <div>
              <small>{item.type.replaceAll("_", " ")}</small>
              <h2>{item.title}</h2>
              <p>{item.body}</p>
              <time>{item.createdAt.toLocaleString("en-IN")}</time>
            </div>
            {!item.readAt && (
              <form action={markNotificationRead}>
                <input type="hidden" name="id" value={item.id} />
                <button>Mark read</button>
              </form>
            )}
          </article>
        ))}
        {notifications.length === 0 && <div className="empty-state">You are all caught up.</div>}
      </section>
    </main>
  );
}
