import { prisma } from "../src/lib/prisma";
import { ResendEmailProvider } from "../src/modules/notifications/resend-email";

async function main() {
  const provider = new ResendEmailProvider();
  const deliveries = await prisma.notificationDelivery.findMany({
    where: { channel: "EMAIL", status: "PENDING" },
    include: { notification: { include: { recipient: true } } },
    orderBy: { notification: { createdAt: "asc" } },
    take: 25,
  });

  for (const delivery of deliveries) {
    try {
      const result = await provider.send({
        to: delivery.notification.recipient.email,
        subject: delivery.notification.title,
        text: delivery.notification.body,
        idempotencyKey: `teamflow-delivery-${delivery.id}`,
      });
      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "DELIVERED",
          attemptedAt: new Date(),
          deliveredAt: new Date(),
          providerMessageId: result.providerMessageId,
          error: null,
        },
      });
      console.log(`Delivered ${delivery.id} to ${delivery.notification.recipient.email}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown email provider error.";
      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: { status: "FAILED", attemptedAt: new Date(), error: message.slice(0, 1000) },
      });
      console.error(`Failed ${delivery.id}: ${message}`);
    }
  }
  console.log(`Processed ${deliveries.length} pending email deliveries.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
