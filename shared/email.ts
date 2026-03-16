// ABOUTME: Sends HTML emails via the Resend API.
// ABOUTME: Used to deliver the weekly bookmark newsletter. Shared by CLI and web.

import { Resend } from "resend";

export function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1] : from.trim();
}

export async function sendEmail(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const resend = new Resend(apiKey);

  const fromEmail = extractEmail(from);
  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
    headers: {
      "List-Unsubscribe": `<mailto:${fromEmail}?subject=unsubscribe>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });

  if (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }
}
