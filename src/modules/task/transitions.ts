export const taskStatuses = [
  "TO DO",
  "IN PROGRESS",
  "IN REVIEW",
  "BLOCKED",
  "DONE",
  "CANCELLED",
] as const;

export type TaskStatus = (typeof taskStatuses)[number];

const transitions: Record<TaskStatus, readonly TaskStatus[]> = {
  "TO DO": ["IN PROGRESS", "CANCELLED"],
  "IN PROGRESS": ["TO DO", "IN REVIEW", "BLOCKED", "CANCELLED"],
  "IN REVIEW": ["IN PROGRESS", "BLOCKED", "DONE", "CANCELLED"],
  "BLOCKED": ["TO DO", "IN PROGRESS", "CANCELLED"],
  "DONE": ["IN PROGRESS"],
  "CANCELLED": ["TO DO"],
};

export function isTaskStatus(value: string): value is TaskStatus {
  return taskStatuses.includes(value as TaskStatus);
}

export function canTransitionTask(from: TaskStatus, to: TaskStatus) {
  return from === to || transitions[from].includes(to);
}

export function allowedTaskTransitions(from: TaskStatus) {
  return transitions[from];
}
