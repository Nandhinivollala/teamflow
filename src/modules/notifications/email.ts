export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  idempotencyKey?: string;
};

export interface EmailProvider {
  send(message: EmailMessage): Promise<{ providerMessageId: string }>;
}
