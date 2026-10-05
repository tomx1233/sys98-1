import nodemailer, { type Transporter } from "nodemailer";

const FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || "support@system98.org";
const FROM_NAME = process.env.EMAIL_FROM_NAME || "system98";

const g = globalThis as unknown as { s98Mail?: Transporter };

/** Mail is optional. Without SMTP_HOST the site works, visitors just rely on their ticket link. */
export function emailEnabled(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

function transport(): Transporter {
  if (!g.s98Mail) {
    g.s98Mail = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return g.s98Mail;
}

export async function sendEmail(input: { to: string; subject: string; html: string; text: string }) {
  if (!emailEnabled()) {
    console.log(`[email:skipped, no SMTP_HOST] "${input.subject}" → ${input.to}`);
    return { ok: false as const, skipped: true as const };
  }
  try {
    await transport().sendMail({
      from: `"${FROM_NAME}" <${FROM_ADDRESS}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    return { ok: true as const, skipped: false as const };
  } catch (err) {
    console.error("[email] send failed:", err);
    return { ok: false as const, skipped: false as const };
  }
}

/** Health check for the status page: can we log in to the SMTP server? */
export async function verifyEmail(): Promise<void> {
  await transport().verify();
}
