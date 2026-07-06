import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/modules/auth/session";
import { getProjectContext } from "@/modules/projects/active-project";
import { ScrollToTop } from "@/components/scroll-to-top";
import { addProjectMemberAction, updateProjectMemberRoleAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const user = await requireUser();
  const { project: activeProject, membership } = await getProjectContext(user);
  if (!activeProject) notFound();
  const project = await prisma.project.findUnique({
    where: { id: activeProject.id },
    include: {
      memberships: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              _count: {
                select: {
                  tasksAssigned: {
                    where: {
                      projects: { some: { projectId: activeProject.id } },
                      status: { notIn: ["DONE", "CANCELLED"] },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
      },
    },
  });
  if (!project) notFound();
  const canManage = user.systemRole === "ADMIN" || membership?.role === "PROJECT_MANAGER";

  return (
    <main className="settings-page people-page">
      <ScrollToTop />
      <div className="settings-header">
        <Link href="/">← Dashboard</Link>
        <p className="eyebrow">TEAM DIRECTORY</p>
        <h1>People</h1>
        <p>Manage who can work in {project.name}, their role, and their current workload.</p>
      </div>

      <div className="settings-grid">
        <section className="panel settings-members">
          <div className="settings-title"><div><h2>Project members</h2><p>{project.memberships.length} people have access.</p></div></div>
          {project.memberships.map((item) => {
            const openTasks = item.user._count.tasksAssigned;
            return (
              <article key={item.userId}>
                <span className="avatar">{item.user.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</span>
                <div><b>{item.user.name}</b><small>{item.user.email}</small><small>{openTasks} open tasks</small></div>
                {canManage ? (
                  <form action={updateProjectMemberRoleAction}>
                    <input type="hidden" name="projectId" value={project.id} />
                    <input type="hidden" name="userId" value={item.userId} />
                    <select name="role" defaultValue={item.role}>
                      <option value="PROJECT_MANAGER">Project Manager</option>
                      <option value="MEMBER">Member</option>
                    </select>
                    <button className="secondary">Save role</button>
                  </form>
                ) : <span>{item.role.replace("_", " ")}</span>}
              </article>
            );
          })}
        </section>

        <aside>
          {canManage && (
            <section className="panel settings-card">
              <h2>Add member</h2>
              <p>A new email automatically receives a local TeamFlow account.</p>
              <form action={addProjectMemberAction}>
                <input type="hidden" name="projectId" value={project.id} />
                <label>Name (new accounts)<input name="name" type="text" maxLength={100} placeholder="Member name" /></label>
                <label>Email<input name="email" type="email" required placeholder="member@teamflow.local" /></label>
                <label>Role<select name="role"><option value="MEMBER">Member</option><option value="PROJECT_MANAGER">Project Manager</option></select></label>
                <button className="create">Add member</button>
              </form>
            </section>
          )}
          <section className="panel settings-card">
            <h2>Project configuration</h2>
            <p>Workflow and project-wide policies are managed separately.</p>
            <Link className="secondary" href="/settings">Open project settings</Link>
          </section>
        </aside>
      </div>
    </main>
  );
}
