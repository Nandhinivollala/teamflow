"use client";

import { useEffect, useRef, useState } from "react";
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
  const [open, setOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeMenu(event: MouseEvent) {
      if (!switcherRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, []);

  return (
    <div className="project-switcher" ref={switcherRef}>
      <button
        className="project-trigger"
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="project-logo">{activeProject.name.slice(0, 1).toUpperCase()}</span>
        <span className="project-current">
          <small>Current project</small>
          <strong>{activeProject.name}</strong>
        </span>
        <span className={`project-chevron${open ? " open" : ""}`} aria-hidden="true">⌄</span>
      </button>

      {open && (
        <div className="project-menu" role="menu" aria-label="Switch current project">
          <div className="project-menu-heading">
            <span>Switch project</span>
            <small>{projects.length} available</small>
          </div>
          <div className="project-options">
            {projects.map((project) => {
              const active = project.key === activeProject.key;
              return (
                <form action={switchProjectAction} key={project.key}>
                  <input type="hidden" name="redirectTo" value={redirectTo} />
                  <input type="hidden" name="projectKey" value={project.key} />
                  <button
                    className={active ? "active" : ""}
                    type="submit"
                    role="menuitem"
                  >
                    <span className="project-option-logo">{project.name.slice(0, 1).toUpperCase()}</span>
                    <span>
                      <strong>{project.name}</strong>
                      <small>{project.key}</small>
                    </span>
                    {active && <span className="project-selected" aria-label="Selected">✓</span>}
                  </button>
                </form>
              );
            })}
          </div>
          <Link className="project-manage-link" href="/projects">
            <span>＋</span> Create or manage projects
          </Link>
        </div>
      )}
    </div>
  );
}
