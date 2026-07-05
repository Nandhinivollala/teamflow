"use client";

import Link from "next/link";
import { switchProjectAction } from "@/app/projects/actions";

export function ProjectSwitcher({
  projects,
  activeProject,
  redirectTo,
}: {
  projects: { key: string; name: string }[];
  activeProject: { key: string; name: string };
  redirectTo: string;
}) {
  return (
    <div className="project-switcher">
      <span className="project-logo">{activeProject.name.slice(0, 1).toUpperCase()}</span>
      <form action={switchProjectAction}>
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <label>
          <small>Current project</small>
          <select
            name="projectKey"
            aria-label="Switch current project"
            defaultValue={activeProject.key}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
          >
            {projects.map((project) => <option value={project.key} key={project.key}>{project.name}</option>)}
          </select>
        </label>
      </form>
      <Link href="/projects" className="project-add" aria-label="Create or manage projects">＋</Link>
    </div>
  );
}
