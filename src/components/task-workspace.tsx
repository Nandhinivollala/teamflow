"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { exportFilteredTasksCsv } from "@/modules/reporting/csv";
import { logoutAction } from "@/app/login/actions";
import { addTaskCommentAction, createTaskAction, updateTaskAction, uploadTaskPhotoAction } from "@/app/tasks/actions";

type View = "board" | "list" | "calendar";
export type TaskWorkspaceItem = {
  id: string;
  key: string;
  title: string;
  status: "TO DO" | "IN PROGRESS" | "IN REVIEW" | "BLOCKED" | "DONE" | "CANCELLED";
  priority: "High" | "Medium" | "Low";
  assigneeId: string;
  assignee: string;
  due: string;
  dueIso: string;
  dueDay: number;
  projectIds: string[];
  blockingTaskIds: string[];
  comments: { id: string; author: string; body: string; createdAt: string }[];
  attachments: { id: string; fileName: string; sizeLabel: string }[];
  rcaId: string | null;
  warning?: string;
};

type Task = TaskWorkspaceItem;

const statuses: Task["status"][] = ["TO DO", "IN PROGRESS", "IN REVIEW", "BLOCKED", "DONE", "CANCELLED"];

function MiniIcon({ children }: { children: React.ReactNode }) {
  return <span className="mini-icon" aria-hidden="true">{children}</span>;
}

export function TaskWorkspace({
  tasks,
  projectName,
  viewer,
  members,
  initialCreate = false,
  initialEditingTaskId,
}: {
  tasks: TaskWorkspaceItem[];
  projectName: string;
  viewer: { name: string; initials: string; role: string };
  members: { id: string; name: string }[];
  initialCreate?: boolean;
  initialEditingTaskId?: string;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>("board");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Task["status"] | "ALL">("ALL");
  const [showCreate, setShowCreate] = useState(initialCreate);
  const [editingTask, setEditingTask] = useState<Task | null>(
    tasks.find((task) => task.id === initialEditingTaskId) ?? null,
  );

  function closeTaskModal() {
    setShowCreate(false);
    setEditingTask(null);
    if (initialCreate || initialEditingTaskId) router.replace("/tasks", { scroll: false });
  }

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
        <div className="project-switcher" aria-label={`Current project: ${projectName}`}>
          <span className="project-logo">{projectName.slice(0, 1).toUpperCase()}</span>
          <span><small>Current project</small>{projectName}</span>
        </div>
        <nav aria-label="Primary navigation">
          <Link href="/"><MiniIcon>▦</MiniIcon>Dashboard</Link>
          <Link className="active" href="/tasks"><MiniIcon>✓</MiniIcon>Tasks<span className="nav-count">{tasks.length}</span></Link>
          <Link href="/rcas"><MiniIcon>△</MiniIcon>Root cause analyses<span className="nav-count">1</span></Link>
          <Link href="/reports"><MiniIcon>⌁</MiniIcon>Reports</Link>
        </nav>
        <div className="sidebar-bottom">
          <Link href="/people"><MiniIcon>♙</MiniIcon>People</Link>
          <Link href="/settings"><MiniIcon>⚙</MiniIcon>Project settings</Link>
          <div className="user-card"><span className="avatar">{viewer.initials}</span><span><b>{viewer.name}</b><small>{viewer.role}</small></span><form action={logoutAction}><button type="submit" aria-label="Sign out">↪</button></form></div>
        </div>
      </aside>

      <main className="main">
        <header>
          <Link className="search task-global-search" href="/tasks">⌕ <span>Search TeamFlow</span><kbd>Ctrl K</kbd></Link>
          <ThemeToggle />
          <Link className="icon-button notification-button notification-link" href="/notifications" aria-label="Notifications">♢</Link>
          <button className="create" onClick={() => setShowCreate(true)}>＋ Create task</button>
        </header>

        <div className="task-content">
          <div className="task-heading">
            <div><p className="eyebrow">{projectName.toUpperCase()} / TASKS</p><h1>Tasks</h1><p>Plan, prioritize, and follow work from one shared source.</p></div>
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

          <div className="workflow-note"><b>Confirmed workflow.</b> Work moves through To do → In progress → In review → Done, with Blocked, Cancelled, reopen, and restore paths.</div>

          {view === "board" && <Board tasks={filtered} onEdit={setEditingTask} />}
          {view === "list" && <List tasks={filtered} />}
          {view === "calendar" && <Calendar tasks={filtered} />}
        </div>
      </main>
      {(showCreate || editingTask) && (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeTaskModal}>
          <section className="create-modal" role="dialog" aria-modal="true" aria-labelledby="create-task-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading"><div><p className="eyebrow">{editingTask?.key ?? "ENGINEERING"}</p><h2 id="create-task-title">{editingTask ? "Edit task" : "Create task"}</h2></div><button onClick={closeTaskModal} aria-label="Close">×</button></div>
            <form action={editingTask ? updateTaskAction : createTaskAction}>
              {editingTask && <input type="hidden" name="taskId" value={editingTask.id} />}
              <label>Task title<input name="title" required minLength={3} maxLength={160} autoFocus placeholder="What needs to be done?" defaultValue={editingTask?.title} /></label>
              <div className="modal-fields">
                <label>Priority<select name="priority" defaultValue={editingTask?.priority ?? "Medium"}><option>High</option><option>Medium</option><option>Low</option></select></label>
                <label>Due date<input name="dueAt" type="date" defaultValue={editingTask?.dueIso ?? ""} /></label>
              </div>
              <div className="modal-fields">
                {editingTask && <label>Status<select name="status" defaultValue={editingTask.status}>{statuses.map((item) => <option key={item}>{item}</option>)}</select></label>}
                <label>Assignee
                  <select name="assigneeId" defaultValue={editingTask?.assigneeId ?? ""}>
                    <option value="">{editingTask ? "Unassigned" : `Assign to me (${viewer.name})`}</option>
                    {members.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}
                  </select>
                </label>
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
              <div className="modal-note">{editingTask ? "Only valid workflow transitions are accepted. Dependencies remain advisory warnings." : "The selected person will receive an in-app assignment notification. The task starts in To do."}</div>
              <div className="modal-actions"><button type="button" className="secondary" onClick={closeTaskModal}>Cancel</button><button type="submit" className="create">{editingTask ? "Save changes" : "Create task"}</button></div>
            </form>
            {editingTask && (
              <section className="task-comments task-attachments">
                <h3>Photos <span>{editingTask.attachments.length}</span></h3>
                {editingTask.attachments.map((attachment) => <p key={attachment.id}><a href={`/api/attachments/${attachment.id}`} target="_blank" rel="noreferrer">{attachment.fileName}</a><small>{attachment.sizeLabel}</small></p>)}
                <form action={uploadTaskPhotoAction} className="comment-form">
                  <input type="hidden" name="taskId" value={editingTask.id} />
                  <input type="file" name="photo" accept="image/jpeg,image/png,image/webp,image/gif" required />
                  <button className="create">Upload photo</button>
                </form>
                <small>JPEG, PNG, WebP, or GIF; maximum 1 MiB.</small>
              </section>
            )}
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
          <div className="column-title"><span className={`status-dot status-${status.replaceAll(" ", "-").toLowerCase()}`} /><b>{status}</b><span>{tasks.filter((task) => task.status === status).length}</span></div>
          <div className="kanban-cards">
            {tasks.filter((task) => task.status === status).map((task) => <TaskCard task={task} onEdit={onEdit} key={task.key} />)}
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
      {task.status === "IN REVIEW" && (
        <Link className="task-rca-link" href={task.rcaId ? `/rcas#rca-${task.rcaId}` : `/rcas?task=${task.id}`}>
          {task.rcaId ? "View RCA" : "＋ Add RCA"}
        </Link>
      )}
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
  const [month, setMonth] = useState(() => new Date(Date.UTC(2026, 6, 1)));
  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();
  const firstWeekday = (new Date(Date.UTC(year, monthIndex, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const cells = Array.from({ length: 42 }, (_, index) => index - firstWeekday + 1);
  const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(month);

  return (
    <div className="calendar panel">
      <div className="calendar-title">
        <button onClick={() => setMonth(new Date(Date.UTC(year, monthIndex - 1, 1)))} aria-label="Previous month">‹</button>
        <h2>{monthLabel}</h2>
        <button onClick={() => setMonth(new Date(Date.UTC(year, monthIndex + 1, 1)))} aria-label="Next month">›</button>
        <button className="calendar-today" onClick={() => setMonth(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)))}>Today</button>
      </div>
      <div className="calendar-grid">
        {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day) => <b className="calendar-day-name" key={day}>{day}</b>)}
        {cells.map((day, index) => {
          const validDay = day > 0 && day <= daysInMonth;
          const dateKey = validDay
            ? `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
            : "";
          const dayTasks = tasks.filter((task) => task.dueIso === dateKey);
          const today = dateKey === new Date().toISOString().slice(0, 10);
          return <div className={`calendar-day ${today ? "today" : ""}`} key={index}><span>{validDay ? day : ""}</span>{dayTasks.map((task) => <small key={task.key}>{task.key} · {task.title}</small>)}</div>;
        })}
      </div>
    </div>
  );
}
