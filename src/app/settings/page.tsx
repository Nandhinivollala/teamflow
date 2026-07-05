import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/modules/auth/session";
import { taskStatuses } from "@/modules/task/transitions";
import { ScrollToTop } from "@/components/scroll-to-top";
import { updateProjectSettingsAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const membership = user.memberships.find(({ project }) => project.key === "ENG");
  if (!membership && user.systemRole !== "ADMIN") notFound();
  const project = await prisma.project.findUnique({ where: { key: "ENG" } });
  if (!project) notFound();
  const canManage = user.systemRole === "ADMIN" || membership?.role === "PROJECT_MANAGER";

  return (
    <main className="settings-page">
      <ScrollToTop />
      <div className="settings-header">
        <Link href="/">← Dashboard</Link>
        <p className="eyebrow">PROJECT CONFIGURATION</p>
        <h1>Project settings</h1>
        <p>Configure the Engineering workspace and review its active policies.</p>
      </div>

      <div className="settings-grid">
        <section className="panel settings-card project-settings-card">
          <h2>Project details</h2>
          <p>These values identify the workspace throughout TeamFlow.</p>
          <form action={updateProjectSettingsAction}>
            <input type="hidden" name="projectId" value={project.id} />
            <label>Project name<input name="name" required minLength={2} maxLength={80} defaultValue={project.name} disabled={!canManage} /></label>
            <label>Project key<input value={project.key} disabled /></label>
            <label>Description<textarea name="description" maxLength={500} defaultValue={project.description ?? ""} disabled={!canManage} /></label>
            {canManage && <button className="create">Save project settings</button>}
          </form>
        </section>

        <aside>
          <section className="panel settings-card">
            <h2>Task workflow</h2>
            <p>Configured statuses:</p>
            <div className="settings-tags">{taskStatuses.map((status) => <span key={status}>{status}</span>)}</div>
            <small>Dependencies and capacity conflicts display warnings without blocking saves.</small>
          </section>
          <section className="panel settings-card">
            <h2>Attachment policy</h2>
            <p>Task attachments accept JPEG, PNG, WebP, and GIF images up to 1 MiB.</p>
          </section>
          <section className="panel settings-card">
            <h2>Notification policy</h2>
            <p>Assignments, mentions, and RCA review requests appear in the in-app inbox.</p>
          </section>
          <section className="panel settings-card">
            <h2>Team access</h2>
            <p>Member accounts and project roles are managed on the People page.</p>
            <Link className="secondary" href="/people">Open People</Link>
          </section>
        </aside>
      </div>
    </main>
  );
}
