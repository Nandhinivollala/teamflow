import "server-only";

import type { EmailMessage, EmailProvider } from "./email";

export class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly apiKey = process.env.RESEND_API_KEY,
    private readonly from = process.env.EMAIL_FROM,
  ) {
    if (!apiKey || !from) {
      throw new Error("RESEND_API_KEY and EMAIL_FROM must be configured.");
    }
  }

  async send(message: EmailMessage) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...(message.idempotencyKey ? { "Idempotency-Key": message.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    });
    const result = await response.json() as { id?: string; message?: string };
    if (!response.ok || !result.id) {
      throw new Error(result.message ?? `Resend returned HTTP ${response.status}.`);
    }
    return { providerMessageId: result.id };
  }
}
