CREATE TYPE "ViewMode" AS ENUM ('KANBAN', 'CALENDAR', 'LIST');
CREATE TYPE "RcaSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "ReviewDecision" AS ENUM ('APPROVED', 'REJECTED');
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL');
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED');

ALTER TABLE "User"
  ADD COLUMN "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Task"
  ADD COLUMN "parentTaskId" TEXT,
  ADD CONSTRAINT "Task_parentTaskId_fkey"
    FOREIGN KEY ("parentTaskId") REFERENCES "Task"("id") ON DELETE SET NULL,
  ADD CONSTRAINT "Task_no_self_parent" CHECK ("parentTaskId" IS NULL OR "parentTaskId" <> "id");
CREATE INDEX "Task_parentTaskId_idx" ON "Task"("parentTaskId");

ALTER TABLE "RootCauseAnalysis"
  ADD COLUMN "severity" "RcaSeverity" NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "RootCauseAnalysis"
  ALTER COLUMN "severity" DROP DEFAULT;

ALTER TABLE "ReviewAssignment" RENAME COLUMN "notes" TO "comment";
ALTER TABLE "ReviewAssignment"
  ALTER COLUMN "decision" TYPE "ReviewDecision"
  USING ("decision"::"ReviewDecision");
ALTER TABLE "ReviewAssignment"
  ADD CONSTRAINT "ReviewAssignment_completed_has_decision_and_comment"
  CHECK (
    "status" <> 'COMPLETED'
    OR (
      "decision" IS NOT NULL
      AND "comment" IS NOT NULL
      AND length(trim("comment")) > 0
      AND "completedAt" IS NOT NULL
    )
  );

CREATE TABLE "UserProjectPreference" (
  "userId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "viewMode" "ViewMode" NOT NULL DEFAULT 'KANBAN',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserProjectPreference_pkey" PRIMARY KEY ("userId", "projectId"),
  CONSTRAINT "UserProjectPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "UserProjectPreference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE
);

CREATE TABLE "RcaSection" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "rcaId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "RcaSection_rcaId_fkey" FOREIGN KEY ("rcaId") REFERENCES "RootCauseAnalysis"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "RcaSection_rcaId_kind_key" ON "RcaSection"("rcaId", "kind");
CREATE UNIQUE INDEX "RcaSection_rcaId_position_key" ON "RcaSection"("rcaId", "position");

CREATE TABLE "NotificationDelivery" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "notificationId" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "providerMessageId" TEXT,
  "error" TEXT,
  "attemptedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "NotificationDelivery_notificationId_channel_key" ON "NotificationDelivery"("notificationId", "channel");
CREATE INDEX "NotificationDelivery_status_attemptedAt_idx" ON "NotificationDelivery"("status", "attemptedAt");

CREATE TABLE "Attachment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "taskId" TEXT,
  "rcaId" TEXT,
  "storageKey" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Attachment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE,
  CONSTRAINT "Attachment_rcaId_fkey" FOREIGN KEY ("rcaId") REFERENCES "RootCauseAnalysis"("id") ON DELETE CASCADE,
  CONSTRAINT "Attachment_exactly_one_parent" CHECK (num_nonnulls("taskId", "rcaId") = 1),
  CONSTRAINT "Attachment_positive_size" CHECK ("sizeBytes" > 0)
);
CREATE UNIQUE INDEX "Attachment_storageKey_key" ON "Attachment"("storageKey");
CREATE INDEX "Attachment_taskId_idx" ON "Attachment"("taskId");
CREATE INDEX "Attachment_rcaId_idx" ON "Attachment"("rcaId");

CREATE TABLE "Comment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "taskId" TEXT,
  "rcaId" TEXT,
  "authorId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Comment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE,
  CONSTRAINT "Comment_rcaId_fkey" FOREIGN KEY ("rcaId") REFERENCES "RootCauseAnalysis"("id") ON DELETE CASCADE,
  CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id"),
  CONSTRAINT "Comment_exactly_one_parent" CHECK (num_nonnulls("taskId", "rcaId") = 1),
  CONSTRAINT "Comment_non_empty_body" CHECK (length(trim("body")) > 0)
);
CREATE INDEX "Comment_taskId_createdAt_idx" ON "Comment"("taskId", "createdAt");
CREATE INDEX "Comment_rcaId_createdAt_idx" ON "Comment"("rcaId", "createdAt");

CREATE TABLE "CommentMention" (
  "commentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "CommentMention_pkey" PRIMARY KEY ("commentId", "userId"),
  CONSTRAINT "CommentMention_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE,
  CONSTRAINT "CommentMention_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX "CommentMention_userId_idx" ON "CommentMention"("userId");
