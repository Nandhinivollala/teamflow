import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/modules/auth/session";
import {
  addProjectMemberAction,
  updateProjectMemberRoleAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const membership = user.memberships.find(({ project }) => project.key === "ENG");
  if (!membership && user.systemRole !== "ADMIN") notFound();
  const project = await prisma.project.findUnique({
    where: { key: "ENG" },
    include: {
      memberships: {
        include: { user: true },
        orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
      },
    },
  });
  if (!project) notFound();

  const canManage = user.systemRole === "ADMIN" || membership?.role === "PROJECT_MANAGER";

  return (
    <main className="settings-page">
      <div className="settings-header">
        <Link href="/">← Dashboard</Link>
        <p className="eyebrow">PROJECT ADMINISTRATION</p>
        <h1>{project.name}</h1>
        <p>{project.description}</p>
      </div>

      <div className="settings-grid">
        <section className="panel settings-members">
          <div className="settings-title"><div><h2>Members</h2><p>{project.memberships.length} people have project access.</p></div></div>
          {project.memberships.map((item) => (
            <article key={item.userId}>
              <span className="avatar">{item.user.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</span>
              <div><b>{item.user.name}</b><small>{item.user.email}</small></div>
              {canManage ? (
                <form action={updateProjectMemberRoleAction}>
                  <input type="hidden" name="projectId" value={project.id} />
                  <input type="hidden" name="userId" value={item.userId} />
                  <select name="role" defaultValue={item.role}>
                    <option value="PROJECT_MANAGER">Project Manager</option>
                    <option value="MEMBER">Member</option>
                  </select>
                  <button className="secondary">Save</button>
                </form>
              ) : <span>{item.role.replace("_", " ")}</span>}
            </article>
          ))}
        </section>

        <aside>
          {canManage && (
            <section className="panel settings-card">
              <h2>Add existing user</h2>
              <p>The user must already have a TeamFlow account.</p>
              <form action={addProjectMemberAction}>
                <input type="hidden" name="projectId" value={project.id} />
                <label>Email<input name="email" type="email" required placeholder="member@teamflow.local" /></label>
                <label>Role<select name="role"><option value="MEMBER">Member</option><option value="PROJECT_MANAGER">Project Manager</option></select></label>
                <button className="create">Add member</button>
              </form>
            </section>
          )}
          <section className="panel settings-card">
            <h2>Notifications</h2>
            <p>TeamFlow delivers task assignments, mentions, and RCA review requests through the in-app notification inbox.</p>
            <Link className="secondary" href="/notifications">Open notifications</Link>
          </section>
        </aside>
      </div>
    </main>
  );
}
