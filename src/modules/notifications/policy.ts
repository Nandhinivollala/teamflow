export type NotificationEventType =
  | "TASK_ASSIGNED"
  | "TASK_STATUS_CHANGED"
  | "RCA_SUBMITTED"
  | "RCA_REVIEW_DECIDED"
  | "COMMENT_MENTIONED";

export type NotificationChannel = "IN_APP" | "EMAIL";

export function notificationDeduplicationKey(input: {
  eventId: string;
  recipientId: string;
  type: NotificationEventType;
}) {
  return `${input.eventId}:${input.recipientId}:${input.type}`;
}

export function deliveryChannels(emailNotificationsEnabled: boolean): NotificationChannel[] {
  return emailNotificationsEnabled ? ["IN_APP", "EMAIL"] : ["IN_APP"];
}

/**
 * The confirmed v1 behavior surfaces email failures directly. It does not
 * retry silently in the background.
 */
export function shouldRetryDelivery() {
  return false;
}
