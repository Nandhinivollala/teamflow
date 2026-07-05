"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProjectSwitcher } from "@/components/project-switcher";
import { TaskSearchBar } from "@/components/task-search-bar";
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
  projectId,
  projectKey,
  projectName,
  projects,
  rcaCount,
  viewer,
  members,
  initialCreate = false,
  initialEditingTaskId,
  initialSearch = "",
}: {
  tasks: TaskWorkspaceItem[];
  projectId: string;
  projectKey: string;
  projectName: string;
  projects: { key: string; name: string }[];
  rcaCount: number;
  viewer: { name: string; initials: string; role: string };
  members: { id: string; name: string }[];
  initialCreate?: boolean;
  initialEditingTaskId?: string;
  initialSearch?: string;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>("board");
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState<Task["status"] | "ALL">("ALL");
  const [showCreate, setShowCreate] = useState(initialCreate);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const isSubmittingTaskRef = useRef(false);
  const createRequestIdRef = useRef<string | null>(null);
  const [taskFormError, setTaskFormError] = useState("");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoUploadMessage, setPhotoUploadMessage] = useState("");
  const [photoUploadError, setPhotoUploadError] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(initialEditingTaskId ?? null);
  const editingTask = tasks.find((task) => task.id === editingTaskId) ?? null;

  function closeTaskModal() {
    setShowCreate(false);
    setEditingTaskId(null);
    createRequestIdRef.current = null;
    setTaskFormError("");
    setPhotoUploadMessage("");
    setPhotoUploadError("");
    if (initialCreate || initialEditingTaskId) router.replace("/tasks", { scroll: false });
  }

  function openCreateTask() {
    setTaskFormError("");
    setShowCreate(true);
  }

  function openTask(task: Task) {
    setTaskFormError("");
    setPhotoUploadMessage("");
    setPhotoUploadError("");
    setEditingTaskId(task.id);
  }

  async function saveTask(formData: FormData) {
    if (isSubmittingTaskRef.current) return;
    isSubmittingTaskRef.current = true;
    setIsSavingTask(true);
    setTaskFormError("");
    try {
      if (editingTask) {
        await updateTaskAction(formData);
      } else {
        createRequestIdRef.current ??= crypto.randomUUID();
        formData.set("createRequestId", createRequestIdRef.current);
        await createTaskAction(formData);
      }
      closeTaskModal();
      router.refresh();
    } catch (error) {
      setTaskFormError(error instanceof Error ? error.message : "The task could not be saved.");
    } finally {
      isSubmittingTaskRef.current = false;
      setIsSavingTask(false);
    }
  }

  async function uploadPhoto(formData: FormData) {
    setIsUploadingPhoto(true);
    setPhotoUploadMessage("");
    setPhotoUploadError("");
    try {
      await uploadTaskPhotoAction(formData);
      setPhotoUploadMessage("Photo uploaded successfully. It is stored locally and shown below.");
      router.refresh();
    } catch (error) {
      setPhotoUploadError(error instanceof Error ? error.message : "The photo could not be uploaded.");
    } finally {
      setIsUploadingPhoto(false);
    }
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
      projectId: projectKey,
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
        <ProjectSwitcher projects={projects} activeProject={{ key: projectKey, name: projectName }} redirectTo="/tasks" />
        <nav aria-label="Primary navigation">
          <Link href="/"><MiniIcon>▦</MiniIcon>Dashboard</Link>
          <Link className="active" href="/tasks"><MiniIcon>✓</MiniIcon>Tasks<span className="nav-count">{tasks.length}</span></Link>
          <Link href="/rcas"><MiniIcon>△</MiniIcon>Root cause analyses<span className="nav-count">{rcaCount}</span></Link>
          <Link href="/reports"><MiniIcon>⌁</MiniIcon>Reports</Link>
        </nav>
        <div className="sidebar-bottom">
          <Link href="/people"><MiniIcon>♙</MiniIcon>People</Link>
          <Link href="/settings"><MiniIcon>⚙</MiniIcon>Project settings</Link>
          <div className="user-card"><span className="avatar">{viewer.initials}</span><span><b>{viewer.name}</b><small>{viewer.role}</small></span><form action={logoutAction}><button type="submit">Log out</button></form></div>
        </div>
      </aside>

      <main className="main">
        <header>
          <TaskSearchBar projectName={projectName} defaultValue={search} className="task-global-search" />
          <ThemeToggle />
          <Link className="icon-button notification-button notification-link" href="/notifications" aria-label="Notifications">♢</Link>
          <button className="create" onClick={openCreateTask}>＋ Create task</button>
        </header>

        <div className="task-content">
          <div className="task-heading">
            <div><p className="eyebrow">{projectName.toUpperCase()} / TASKS</p><h1>Tasks</h1><p>Plan, prioritize, and follow work from one shared source.</p></div>
            <div className="heading-actions"><button className="secondary" onClick={downloadCsv}>⇩ Export CSV</button><button className="create" onClick={openCreateTask}>＋ Create task</button></div>
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

          {view === "board" && <Board tasks={filtered} onEdit={openTask} />}
          {view === "list" && <List tasks={filtered} onEdit={openTask} />}
          {view === "calendar" && <Calendar tasks={filtered} onEdit={openTask} />}
        </div>
      </main>
      {(showCreate || editingTask) && (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeTaskModal}>
          <section className="create-modal" role="dialog" aria-modal="true" aria-labelledby="create-task-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading"><div><p className="eyebrow">{editingTask?.key ?? projectName.toUpperCase()}</p><h2 id="create-task-title">{editingTask ? "Edit task" : "Create task"}</h2></div><button onClick={closeTaskModal} aria-label="Close">×</button></div>
            <form action={saveTask}>
              <input type="hidden" name="projectId" value={projectId} />
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
              {taskFormError && <p className="task-form-error" role="alert">{taskFormError}</p>}
              <div className="modal-actions"><button type="button" className="secondary" onClick={closeTaskModal} disabled={isSavingTask}>Cancel</button><button type="submit" className="create" disabled={isSavingTask}>{isSavingTask ? "Saving…" : editingTask ? "Save changes" : "Create task"}</button></div>
            </form>
            {editingTask && (
              <section className="task-comments task-attachments">
                <h3>Photos <span>{editingTask.attachments.length}</span></h3>
                {editingTask.attachments.length > 0 ? (
                  <div className="photo-grid">
                    {editingTask.attachments.map((attachment) => (
                      <figure key={attachment.id}>
                        <a href={`/api/attachments/${attachment.id}`} target="_blank" rel="noreferrer">
                          <Image src={`/api/attachments/${attachment.id}`} alt={attachment.fileName} width={320} height={180} unoptimized />
                        </a>
                        <figcaption><b>{attachment.fileName}</b><span>{attachment.sizeLabel}</span><a href={`/api/attachments/${attachment.id}`} target="_blank" rel="noreferrer">Open full image</a></figcaption>
                      </figure>
                    ))}
                  </div>
                ) : <p className="no-photos">No photos uploaded yet.</p>}
                <form action={uploadPhoto} className="comment-form">
                  <input type="hidden" name="taskId" value={editingTask.id} />
                  <input type="file" name="photo" accept="image/jpeg,image/png,image/webp,image/gif" required disabled={isUploadingPhoto} />
                  <button className="create" disabled={isUploadingPhoto}>{isUploadingPhoto ? "Uploading…" : "Upload photo"}</button>
                </form>
                {photoUploadMessage && <p className="upload-success" role="status">{photoUploadMessage}</p>}
                {photoUploadError && <p className="task-form-error" role="alert">{photoUploadError}</p>}
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
    <article
      className="kanban-card"
      role="button"
      tabIndex={0}
      aria-label={`Open ${task.key}: ${task.title}`}
      onClick={() => onEdit(task)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onEdit(task);
        }
      }}
    >
      <div className="card-top"><span>{task.key}</span><span>Open task</span></div>
      <h2>{task.title}</h2>
      {task.warning && <p className="task-warning">⚠ {task.warning}</p>}
      {task.status === "IN REVIEW" && (
        <Link className="task-rca-link" onClick={(event) => event.stopPropagation()} href={task.rcaId ? `/rcas#rca-${task.rcaId}` : `/rcas?task=${task.id}`}>
          {task.rcaId ? "View RCA" : "＋ Add RCA"}
        </Link>
      )}
      <div className="card-bottom"><Priority value={task.priority} /><span className="due-date">◷ {task.due}</span><span className="avatar">{task.assignee}</span></div>
    </article>
  );
}

function List({ tasks, onEdit }: { tasks: Task[]; onEdit: (task: Task) => void }) {
  return (
    <div className="task-table panel">
      <div className="task-table-row task-table-head"><span>Task</span><span>Status</span><span>Priority</span><span>Due</span><span>Assignee</span></div>
      {tasks.map((task) => (
        <article
          className="task-table-row task-table-item"
          role="button"
          tabIndex={0}
          aria-label={`Open ${task.key}: ${task.title}`}
          onClick={() => onEdit(task)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onEdit(task);
            }
          }}
          key={task.key}
        >
          <span><small>{task.key}</small><b>{task.title}</b>{task.warning && <em>⚠ {task.warning}</em>}</span>
          <span className="table-status">{task.status}</span><span><Priority value={task.priority} /></span><span>{task.due}</span><span className="avatar">{task.assignee}</span>
        </article>
      ))}
      {tasks.length === 0 && <div className="empty-state">No tasks match this filter.</div>}
    </div>
  );
}

function Calendar({ tasks, onEdit }: { tasks: Task[]; onEdit: (task: Task) => void }) {
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
          return <div className={`calendar-day ${today ? "today" : ""}`} key={index}><span>{validDay ? day : ""}</span>{dayTasks.map((task) => <button className="calendar-task" onClick={() => onEdit(task)} key={task.key}>{task.key} · {task.title}</button>)}</div>;
        })}
      </div>
    </div>
  );
}
