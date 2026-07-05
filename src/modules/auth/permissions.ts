export type SystemRole = "ADMIN" | "USER";
export type ProjectRole = "PROJECT_MANAGER" | "MEMBER";

export type AccessContext = {
  systemRole: SystemRole;
  projectRole?: ProjectRole;
  hasReviewAssignment?: boolean;
};

export function canManageSystem(context: AccessContext) {
  return context.systemRole === "ADMIN";
}

export function canManageProject(context: AccessContext) {
  return canManageSystem(context) || context.projectRole === "PROJECT_MANAGER";
}

export function canContributeToProject(context: AccessContext) {
  return canManageProject(context) || context.projectRole === "MEMBER";
}

export function canReviewRca(context: AccessContext) {
  return canManageSystem(context) || context.hasReviewAssignment === true;
}

// Workflow-specific authorization belongs in the relevant domain module once
// the frozen task and RCA transition rules are supplied.
