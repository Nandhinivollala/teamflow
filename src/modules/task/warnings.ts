export type TaskWarning =
  | { code: "UNRESOLVED_DEPENDENCIES"; blockerIds: string[] }
  | { code: "ASSIGNEE_OVERLOAD"; openTaskCount: number; capacity: number };

export type TaskWarningContext = {
  unresolvedBlockerIds: readonly string[];
  assigneeOpenTaskCount?: number;
  assigneeCapacity?: number;
};

/**
 * These findings are advisory by requirement: callers save the task and
 * return the warnings alongside the successful result.
 */
export function evaluateTaskWarnings(context: TaskWarningContext): TaskWarning[] {
  const warnings: TaskWarning[] = [];
  const blockerIds = [...new Set(context.unresolvedBlockerIds)];

  if (blockerIds.length > 0) {
    warnings.push({ code: "UNRESOLVED_DEPENDENCIES", blockerIds });
  }

  if (
    context.assigneeOpenTaskCount !== undefined &&
    context.assigneeCapacity !== undefined &&
    context.assigneeCapacity >= 0 &&
    context.assigneeOpenTaskCount >= context.assigneeCapacity
  ) {
    warnings.push({
      code: "ASSIGNEE_OVERLOAD",
      openTaskCount: context.assigneeOpenTaskCount,
      capacity: context.assigneeCapacity,
    });
  }

  return warnings;
}
