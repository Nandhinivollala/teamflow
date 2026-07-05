export type ExportableTask = {
  key: string;
  title: string;
  status: string;
  assigneeId?: string;
  projectIds: readonly string[];
};

export type TaskExportFilter = {
  projectId?: string;
  status?: string;
  assigneeId?: string;
  search?: string;
};

function csvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function exportFilteredTasksCsv(
  tasks: readonly ExportableTask[],
  filter: TaskExportFilter,
) {
  const search = filter.search?.trim().toLocaleLowerCase();
  const filtered = tasks.filter((task) => {
    if (filter.projectId && !task.projectIds.includes(filter.projectId)) return false;
    if (filter.status && task.status !== filter.status) return false;
    if (filter.assigneeId && task.assigneeId !== filter.assigneeId) return false;
    if (search && !`${task.key} ${task.title}`.toLocaleLowerCase().includes(search)) return false;
    return true;
  });

  const lines = [
    ["Key", "Title", "Status", "Assignee", "Projects"],
    ...filtered.map((task) => [
      task.key,
      task.title,
      task.status,
      task.assigneeId ?? "",
      task.projectIds.join(";"),
    ]),
  ];

  return lines.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
