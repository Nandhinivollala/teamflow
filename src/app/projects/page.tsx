import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/modules/auth/session";
import { getProjectContext } from "@/modules/projects/active-project";
import { createProjectAction } from "./actions";
import { logoutAction } from "@/app/login/actions";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await requireUser();
  const { project: activeProject, projects } = await getProjectContext(user);
  const projectDetails = await prisma.project.findMany({
    where: user.systemRole === "ADMIN" ? {} : { memberships: { some: { userId: user.id } } },
    include: { _count: { select: { memberships: true, tasks: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <main className="settings-page projects-page">
      <div className="settings-header project-management-header">
        <div>
          <Link href="/">← Dashboard</Link>
          <p className="eyebrow">PROJECT PORTFOLIO</p>
          <h1>Projects</h1>
          <p>Create separate workspaces and switch which project TeamFlow displays.</p>
        </div>
        <form action={logoutAction}><button className="secondary">Log out</button></form>
      </div>
      <div className="project-management-grid">
        <section className="panel project-list-card">
          <div className="settings-title"><div><h2>Your projects</h2><p>{projectDetails.length} accessible project{projectDetails.length === 1 ? "" : "s"}.</p></div></div>
          {projectDetails.map((project) => (
            <article key={project.id}>
              <span className="project-logo">{project.name.slice(0, 1).toUpperCase()}</span>
              <div><b>{project.name}</b><small>{project.key} · {project.description || "No description"}</small><small>{project._count.memberships} members · {project._count.tasks} tasks</small></div>
              {activeProject?.id === project.id && <strong>ACTIVE</strong>}
            </article>
          ))}
        </section>
        <section className="panel settings-card create-project-card">
          <h2>Create project</h2>
          <p>You become the project manager and can add members afterward.</p>
          <form action={createProjectAction}>
            <label>Project name<input name="name" required minLength={2} maxLength={80} placeholder="Mobile Platform" /></label>
            <label>Project key<input name="key" required minLength={2} maxLength={10} pattern="[A-Za-z][A-Za-z0-9]{1,9}" placeholder="MOB" /></label>
            <label>Description<textarea name="description" maxLength={500} placeholder="What this project is responsible for." /></label>
            <button className="create">Create and open project</button>
          </form>
          {projects.length > 1 && <small>Use the project selector in the sidebar to move between projects.</small>}
        </section>
      </div>
    </main>
  );
}
