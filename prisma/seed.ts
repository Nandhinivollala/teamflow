import { PrismaClient, ProjectRole, SystemRole } from "@prisma/client";
import { hashPassword } from "../src/modules/auth/password";

const prisma = new PrismaClient();

async function main() {
  const demoPasswordHash = await hashPassword("Demo1234!");
  const admin = await prisma.user.upsert({
    where: { email: "admin@teamflow.local" },
    update: { passwordHash: demoPasswordHash },
    create: { name: "Avery Admin", email: "admin@teamflow.local", systemRole: SystemRole.ADMIN, passwordHash: demoPasswordHash },
  });
  const manager = await prisma.user.upsert({
    where: { email: "manager@teamflow.local" },
    update: { passwordHash: demoPasswordHash },
    create: { name: "Sahil Anand", email: "manager@teamflow.local", passwordHash: demoPasswordHash },
  });
  const member = await prisma.user.upsert({
    where: { email: "member@teamflow.local" },
    update: { passwordHash: demoPasswordHash },
    create: { name: "Nina Kapoor", email: "member@teamflow.local", passwordHash: demoPasswordHash },
  });
  const reviewer = await prisma.user.upsert({
    where: { email: "reviewer@teamflow.local" },
    update: { passwordHash: demoPasswordHash },
    create: { name: "Maya Patel", email: "reviewer@teamflow.local", passwordHash: demoPasswordHash },
  });

  const project = await prisma.project.upsert({
    where: { key: "ENG" },
    update: {},
    create: { key: "ENG", name: "Engineering", description: "TeamFlow demonstration project" },
  });

  await Promise.all([
    prisma.projectMembership.upsert({
      where: { projectId_userId: { projectId: project.id, userId: manager.id } },
      update: { role: ProjectRole.PROJECT_MANAGER },
      create: { projectId: project.id, userId: manager.id, role: ProjectRole.PROJECT_MANAGER },
    }),
    prisma.projectMembership.upsert({
      where: { projectId_userId: { projectId: project.id, userId: member.id } },
      update: { role: ProjectRole.MEMBER },
      create: { projectId: project.id, userId: member.id, role: ProjectRole.MEMBER },
    }),
    prisma.projectMembership.upsert({
      where: { projectId_userId: { projectId: project.id, userId: reviewer.id } },
      update: { role: ProjectRole.MEMBER },
      create: { projectId: project.id, userId: reviewer.id, role: ProjectRole.MEMBER },
    }),
  ]);

  const taskSeeds = [
    { id: "demo-task-139", title: "Finalize token revocation contract", status: "IN PROGRESS", priority: "High", assigneeId: member.id, dueAt: new Date("2026-07-05T12:00:00Z") },
    { id: "demo-task-142", title: "Harden refresh-token rotation", status: "IN REVIEW", priority: "High", assigneeId: member.id, dueAt: new Date("2026-07-05T12:00:00Z") },
    { id: "demo-task-138", title: "Add RCA review audit trail", status: "IN PROGRESS", priority: "High", assigneeId: reviewer.id, dueAt: new Date("2026-07-07T12:00:00Z") },
    { id: "demo-task-135", title: "Object-storage adapter contract", status: "TO DO", priority: "Medium", assigneeId: manager.id, dueAt: new Date("2026-07-08T12:00:00Z") },
    { id: "demo-task-131", title: "Notification deduplication key", status: "DONE", priority: "Medium", assigneeId: reviewer.id, dueAt: new Date("2026-07-03T12:00:00Z") },
    { id: "demo-task-127", title: "Surface dependency warnings", status: "IN PROGRESS", priority: "Medium", assigneeId: manager.id, dueAt: new Date("2026-07-10T12:00:00Z") },
    { id: "demo-task-119", title: "Filtered task CSV export", status: "DONE", priority: "Low", assigneeId: reviewer.id, dueAt: new Date("2026-07-02T12:00:00Z") },
  ];

  for (const taskSeed of taskSeeds) {
    await prisma.task.upsert({
      where: { id: taskSeed.id },
      update: taskSeed,
      create: { ...taskSeed, creatorId: manager.id },
    });
    await prisma.taskProject.upsert({
      where: { taskId_projectId: { taskId: taskSeed.id, projectId: project.id } },
      update: {},
      create: { taskId: taskSeed.id, projectId: project.id },
    });
  }

  await prisma.taskDependency.upsert({
    where: {
      blockedTaskId_blockingTaskId: {
        blockedTaskId: "demo-task-142",
        blockingTaskId: "demo-task-139",
      },
    },
    update: {},
    create: {
      blockedTaskId: "demo-task-142",
      blockingTaskId: "demo-task-139",
    },
  });

  const rca = await prisma.rootCauseAnalysis.upsert({
    where: { id: "demo-rca-auth-outage" },
    update: {},
    create: {
      id: "demo-rca-auth-outage",
      projectId: project.id,
      title: "Authentication service outage",
      summary: "Token validation failures caused intermittent sign-in errors for 23 minutes.",
      severity: "HIGH",
      state: "IN REVIEW",
      createdById: manager.id,
    },
  });
  for (const section of [
    { kind: "TIMELINE", title: "Timeline", content: "10:04 alert fired; 10:11 rollback started; 10:27 service recovered.", position: 1 },
    { kind: "CONTRIBUTING_FACTORS", title: "Contributing factors", content: "A cache-key change was deployed without a backwards-compatible read path.", position: 2 },
    { kind: "CORRECTIVE_ACTIONS", title: "Corrective actions", content: "Add dual-read rollout and token-validation canary checks.", position: 3 },
  ]) {
    await prisma.rcaSection.upsert({
      where: { rcaId_kind: { rcaId: rca.id, kind: section.kind } },
      update: section,
      create: { ...section, rcaId: rca.id },
    });
  }
  for (const reviewerId of [manager.id, reviewer.id]) {
    await prisma.reviewAssignment.upsert({
      where: { rcaId_reviewerId: { rcaId: rca.id, reviewerId } },
      update: {},
      create: { rcaId: rca.id, reviewerId },
    });
  }
  await prisma.notification.upsert({
    where: { deduplicationKey: "seed:manager:rca-submitted" },
    update: {},
    create: { recipientId: manager.id, type: "RCA_SUBMITTED", title: "RCA ready for review", body: "Authentication service outage is waiting for your decision.", deduplicationKey: "seed:manager:rca-submitted", status: "DELIVERED", deliveredAt: new Date() },
  });

  console.log(`Seeded TeamFlow foundation as ${admin.email}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
