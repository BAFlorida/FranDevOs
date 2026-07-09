import { logger } from "./logger";

// ---------------------------------------------------------------------------
// Transactional email
//
// Sends via Resend's HTTP API (https://resend.com) when RESEND_API_KEY is set —
// no SDK/dependency needed, just fetch. When email is NOT configured, sends are
// skipped and the caller falls back to surfacing/logging the link by hand, so
// the app works with zero email setup (the pre-migration behaviour).
//
// Required env to enable automated email:
//   RESEND_API_KEY   API key from resend.com
//   MAIL_FROM        verified sender, e.g. "Franchise Dev OS <noreply@yourdomain.com>"
//   APP_URL          public base URL of the app, e.g. https://frandevos.onrender.com
//                    (used to build absolute links inside emails)
// ---------------------------------------------------------------------------

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const MAIL_FROM =
  process.env.MAIL_FROM ?? "Franchise Dev OS <onboarding@resend.dev>";

export function emailEnabled(): boolean {
  return Boolean(RESEND_API_KEY);
}

/**
 * Build an absolute URL to a path inside the web app, honouring BASE_PATH.
 * `pathAfterBase` is relative to the app root, e.g. "invite/<token>".
 * Falls back to a root-relative URL when APP_URL is unset.
 */
export function absoluteUrl(pathAfterBase: string): string {
  const appUrl = (process.env.APP_URL ?? "").replace(/\/+$/, "");
  const basePath = (process.env.BASE_PATH ?? "/").replace(/\/+$/, "");
  const clean = pathAfterBase.replace(/^\/+/, "");
  return `${appUrl}${basePath}/${clean}`;
}

export function inviteUrl(token: string): string {
  return absoluteUrl(`invite/${token}`);
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Best-effort send. Never throws — returns { sent } so callers can decide
 * whether to also surface the link another way. A failed send is logged, not
 * fatal: onboarding must not break because email is misconfigured.
 */
export async function sendEmail(
  input: SendEmailInput,
): Promise<{ sent: boolean }> {
  if (!RESEND_API_KEY) {
    logger.warn(
      { to: input.to, subject: input.subject },
      "Email not configured (RESEND_API_KEY unset) — skipping send; link must be shared manually",
    );
    return { sent: false };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: MAIL_FROM,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error(
        { status: res.status, body, to: input.to },
        "Email send failed",
      );
      return { sent: false };
    }
    logger.info({ to: input.to, subject: input.subject }, "Email sent");
    return { sent: true };
  } catch (err) {
    logger.error({ err, to: input.to }, "Email send threw");
    return { sent: false };
  }
}

// ---------------------------------------------------------------------------
// Templates — deliberately simple, inline-styled HTML that renders everywhere.
// ---------------------------------------------------------------------------

function layout(bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f5f4f0;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
    <div style="font-weight:700;font-size:18px;margin-bottom:8px;">Franchise Development OS</div>
    ${bodyHtml}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
    <div style="font-size:12px;color:#64748b;">If you weren't expecting this email, you can safely ignore it.</div>
  </div>
</body></html>`;
}

function button(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block;background:#f59e0b;color:#111827;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px;">${label}</a>`;
}

export function renderInviteEmail(opts: {
  url: string;
  roleLabel: string;
  inviterName?: string | null;
}): { subject: string; html: string; text: string } {
  const who = opts.inviterName ? `${opts.inviterName} invited you` : "You've been invited";
  const subject = "You're invited to Franchise Development OS";
  const html = layout(
    `<p style="font-size:15px;line-height:1.5;">${who} to join <strong>Franchise Development OS</strong> as <strong>${opts.roleLabel}</strong>.</p>
     <p style="font-size:15px;line-height:1.5;">Click below to set your password and get started. This link is one-time and expires.</p>
     <p style="margin:24px 0;">${button(opts.url, "Set up my account")}</p>
     <p style="font-size:13px;color:#64748b;">Or paste this link into your browser:<br><span style="word-break:break-all;">${opts.url}</span></p>`,
  );
  const text = `${who} to join Franchise Development OS as ${opts.roleLabel}.\n\nSet your password here (one-time link):\n${opts.url}\n`;
  return { subject, html, text };
}

export function renderSuperAdminSetupEmail(opts: {
  url: string;
}): { subject: string; html: string; text: string } {
  const subject = "Set up your Franchise Development OS owner account";
  const html = layout(
    `<p style="font-size:15px;line-height:1.5;">Your <strong>Franchise Development OS</strong> owner (Super Admin) account is ready.</p>
     <p style="font-size:15px;line-height:1.5;">Click below to set your password. Keep this link private — it grants full access.</p>
     <p style="margin:24px 0;">${button(opts.url, "Set my password")}</p>
     <p style="font-size:13px;color:#64748b;">Or paste this link into your browser:<br><span style="word-break:break-all;">${opts.url}</span></p>`,
  );
  const text = `Your Franchise Development OS owner account is ready.\n\nSet your password here (one-time link):\n${opts.url}\n`;
  return { subject, html, text };
}
