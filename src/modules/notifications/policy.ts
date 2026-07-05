export type NotificationEventType =
  | "TASK_ASSIGNED"
  | "TASK_STATUS_CHANGED"
  | "RCA_SUBMITTED"
  | "RCA_REVIEW_DECIDED"
  | "COMMENT_MENTIONED";

export function notificationDeduplicationKey(input: {
  eventId: string;
  recipientId: string;
  type: NotificationEventType;
}) {
  return `${input.eventId}:${input.recipientId}:${input.type}`;
}
