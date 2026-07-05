ALTER TABLE "RootCauseAnalysis"
  ADD COLUMN "taskId" TEXT;

CREATE UNIQUE INDEX "RootCauseAnalysis_taskId_key"
  ON "RootCauseAnalysis"("taskId");

ALTER TABLE "RootCauseAnalysis"
  ADD CONSTRAINT "RootCauseAnalysis_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL;
