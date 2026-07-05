"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { exportFilteredTasksCsv } from "@/modules/reporting/csv";
import { logoutAction } from "@/app/login/actions";
import { addTaskCommentAction, createTaskAction, updateTaskAction } from "@/app/tasks/actions";

type View = "board" | "list" | "calendar";
export type TaskWorkspaceItem = {
  id: string;
  key: string;
  title: string;
  status: "TO DO" | "IN PROGRESS" | "IN REVIEW" | "DONE";
  priority: "High" | "Medium" | "Low";
  assigneeId: string;
  assignee: string;
  due: string;
  dueIso: string;
  dueDay: number;
  projectIds: string[];
  blockingTaskIds: string[];
  comments: { id: string; author: string; body: string; createdAt: string }[];
  warning?: string;
};

type Task = TaskWorkspaceItem;

const statuses: Task["status"][] = ["TO DO", "IN PROGRESS", "IN REVIEW", "DONE"];

function MiniIcon({ children }: { children: React.ReactNode }) {
  return <span className="mini-icon" aria-hidden="true">{children}</span>;
}

export function TaskWorkspace({
  tasks,
  viewer,
}: {
  tasks: TaskWorkspaceItem[];
  viewer: { name: string; initials: string; role: string };
}) {
  const [view, setView] = useState<View>("board");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Task["status"] | "ALL">("ALL");
  const [showCreate, setShowCreate] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (status !== "ALL" && task.status !== status) return false;
      return !query || `${task.key} ${task.title}`.toLowerCase().includes(query);
    });
  }, [search, status, tasks]);

  function downloadCsv() {
    const csv = exportFilteredTasksCsv(tasks, {
      projectId: "ENG",
      status: status === "ALL" ? undefined : status,
      search,
    });
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "teamflow-tasks.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="app-shell task-app">
      <aside className="sidebar">
        <Link className="brand" href="/"><span className="brand-mark">T</span><span>TeamFlow</span></Link>
        <div className="project-switcher"><span className="project-logo">E</span><span><small>Workspace</small>Engineering</span><b>⌄</b></div>
        <nav aria-label="Primary navigation">
          <Link href="/"><MiniIcon>▦</MiniIcon>Dashboard</Link>
          <Link className="active" href="/tasks"><MiniIcon>✓</MiniIcon>Tasks<span className="nav-count">{tasks.length}</span></Link>
          <Link href="/rcas"><MiniIcon>△</MiniIcon>Root cause analyses<span className="nav-count">1</span></Link>
          <Link href="/reports"><MiniIcon>⌁</MiniIcon>Reports</Link>
        </nav>
        <div className="sidebar-bottom">
          <a href="#"><MiniIcon>♙</MiniIcon>People</a>
          <Link href="/settings"><MiniIcon>⚙</MiniIcon>Project settings</Link>
          <div className="user-card"><span className="avatar">{viewer.initials}</span><span><b>{viewer.name}</b><small>{viewer.role}</small></span><form action={logoutAction}><button type="submit" aria-label="Sign out">↪</button></form></div>
        </div>
      </aside>

      <main className="main">
        <header>
          <div className="search task-global-search">⌕ <span>Search TeamFlow</span><kbd>⌘ K</kbd></div>
          <ThemeToggle />
          <button className="icon-button notification-button" aria-label="Notifications">♢<span className="dot" /></button>
          <button className="create" onClick={() => setShowCreate(true)}>＋ Create task</button>
        </header>

        <div className="task-content">
          <div className="task-heading">
            <div><p className="eyebrow">ENGINEERING / TASKS</p><h1>Tasks</h1><p>Plan, prioritize, and follow work from one shared source.</p></div>
            <div className="heading-actions"><button className="secondary" onClick={downloadCsv}>⇩ Export CSV</button><button className="create" onClick={() => setShowCreate(true)}>＋ Create task</button></div>
          </div>

          <div className="task-toolbar">
            <div className="view-tabs" aria-label="Task view">
              {(["board", "list", "calendar"] as View[]).map((item) => (
                <button key={item} className={view === item ? "selected" : ""} onClick={() => setView(item)}>
                  {item === "board" ? "▦" : item === "list" ? "☷" : "□"} {item[0].toUpperCase() + item.slice(1)}
                </button>
              ))}
            </div>
            <label className="task-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks" /></label>
            <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} aria-label="Filter by status">
              <option value="ALL">All statuses</option>
              {statuses.map((item) => <option value={item} key={item}>{item}</option>)}
            </select>
            <span className="result-count">{filtered.length} results</span>
          </div>

          <div className="workflow-note"><b>Flexible workflow preview.</b> These view labels are demonstration data; domain transitions remain configurable until the final status policy is confirmed.</div>

          {view === "board" && <Board tasks={filtered} onEdit={setEditingTask} />}
          {view === "list" && <List tasks={filtered} />}
          {view === "calendar" && <Calendar tasks={filtered} />}
        </div>
      </main>
      {(showCreate || editingTask) && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => { setShowCreate(false); setEditingTask(null); }}>
          <section className="create-modal" role="dialog" aria-modal="true" aria-labelledby="create-task-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading"><div><p className="eyebrow">{editingTask?.key ?? "ENGINEERING"}</p><h2 id="create-task-title">{editingTask ? "Edit task" : "Create task"}</h2></div><button onClick={() => { setShowCreate(false); setEditingTask(null); }} aria-label="Close">×</button></div>
            <form action={editingTask ? updateTaskAction : createTaskAction}>
              {editingTask && <input type="hidden" name="taskId" value={editingTask.id} />}
              <label>Task title<input name="title" required minLength={3} maxLength={160} autoFocus placeholder="What needs to be done?" defaultValue={editingTask?.title} /></label>
              <div className="modal-fields">
                <label>Priority<select name="priority" defaultValue={editingTask?.priority ?? "Medium"}><option>High</option><option>Medium</option><option>Low</option></select></label>
                <label>Due date<input name="dueAt" type="date" defaultValue={editingTask?.dueIso ?? ""} /></label>
              </div>
              {editingTask && (
                <label className="dependency-field">Blocked by
                  <select name="blockingTaskIds" multiple size={Math.min(4, Math.max(2, tasks.length - 1))} defaultValue={editingTask.blockingTaskIds}>
                    {tasks.filter((task) => task.id !== editingTask.id).map((task) => (
                      <option value={task.id} key={task.id}>{task.key} · {task.title}</option>
                    ))}
                  </select>
                  <small>Use Ctrl-click to select or remove multiple blockers. Conflicts produce warnings without preventing the save.</small>
                </label>
              )}
              <div className="modal-note">{editingTask ? "Workflow status is unchanged by this edit." : "The task will be assigned to you. Initial workflow status is configured by the server."}</div>
              <div className="modal-actions"><button type="button" className="secondary" onClick={() => { setShowCreate(false); setEditingTask(null); }}>Cancel</button><button type="submit" className="create">{editingTask ? "Save changes" : "Create task"}</button></div>
            </form>
            {editingTask && (
              <section className="task-comments">
                <h3>Comments <span>{editingTask.comments.length}</span></h3>
                <div className="comment-history">
                  {editingTask.comments.map((comment) => <article key={comment.id}><b>{comment.author}</b><time>{comment.createdAt}</time><p>{comment.body}</p></article>)}
                  {editingTask.comments.length === 0 && <p className="no-comments">No comments yet.</p>}
                </div>
                <form action={addTaskCommentAction} className="comment-form">
                  <input type="hidden" name="taskId" value={editingTask.id} />
                  <textarea name="body" required maxLength={4000} placeholder="Add context or mention @reviewer..." />
                  <button className="create">Add comment</button>
                </form>
              </section>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Priority({ value }: { value: Task["priority"] }) {
  return <span className={`priority priority-${value.toLowerCase()}`}>{value}</span>;
}

function Board({ tasks, onEdit }: { tasks: Task[]; onEdit: (task: Task) => void }) {
  return (
    <div className="kanban">
      {statuses.map((status) => (
        <section className="kanban-column" key={status}>
          <div className="column-title"><span className={`status-dot status-${status.replaceAll(" ", "-").toLowerCase()}`} /><b>{status}</b><span>{tasks.filter((task) => task.status === status).length}</span><button aria-label={`${status} options`}>•••</button></div>
          <div className="kanban-cards">
            {tasks.filter((task) => task.status === status).map((task) => <TaskCard task={task} onEdit={onEdit} key={task.key} />)}
            <button className="add-task">＋ Add task</button>
          </div>
        </section>
      ))}
    </div>
  );
}

function TaskCard({ task, onEdit }: { task: Task; onEdit: (task: Task) => void }) {
  return (
    <article className="kanban-card">
      <div className="card-top"><span>{task.key}</span><button onClick={() => onEdit(task)} aria-label={`Edit ${task.key}`}>✎</button></div>
      <h2>{task.title}</h2>
      {task.warning && <p className="task-warning">⚠ {task.warning}</p>}
      <div className="card-bottom"><Priority value={task.priority} /><span className="due-date">◷ {task.due}</span><span className="avatar">{task.assignee}</span></div>
    </article>
  );
}

function List({ tasks }: { tasks: Task[] }) {
  return (
    <div className="task-table panel">
      <div className="task-table-row task-table-head"><span>Task</span><span>Status</span><span>Priority</span><span>Due</span><span>Assignee</span></div>
      {tasks.map((task) => (
        <article className="task-table-row" key={task.key}>
          <span><small>{task.key}</small><b>{task.title}</b>{task.warning && <em>⚠ {task.warning}</em>}</span>
          <span className="table-status">{task.status}</span><span><Priority value={task.priority} /></span><span>{task.due}</span><span className="avatar">{task.assignee}</span>
        </article>
      ))}
      {tasks.length === 0 && <div className="empty-state">No tasks match this filter.</div>}
    </div>
  );
}

function Calendar({ tasks }: { tasks: Task[] }) {
  return (
    <div className="calendar panel">
      <div className="calendar-title"><button>‹</button><h2>July 2026</h2><button>›</button><span>Today</span></div>
      <div className="calendar-grid">
        {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day) => <b className="calendar-day-name" key={day}>{day}</b>)}
        {Array.from({ length: 35 }, (_, index) => {
          const day = index - 1;
          const dayTasks = tasks.filter((task) => task.dueDay === day);
          return <div className={`calendar-day ${day === 5 ? "today" : ""}`} key={index}><span>{day > 0 && day <= 31 ? day : ""}</span>{dayTasks.map((task) => <small key={task.key}>{task.key} · {task.title}</small>)}</div>;
        })}
      </div>
    </div>
  );
}
