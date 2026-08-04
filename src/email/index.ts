import { config } from '../config.js';
import { mdToHtml } from '../web/markdown.js';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface Transport {
  readonly name: string;
  send(msg: EmailMessage): Promise<void>;
}

/**
 * Dev transport: prints the message (and any links) to stdout so the app runs
 * with zero email setup. Confirmation / unsubscribe links are visible here.
 */
class ConsoleTransport implements Transport {
  readonly name = 'console';
  async send(msg: EmailMessage): Promise<void> {
    console.log(
      [
        '',
        '──────────── EMAIL (console transport) ────────────',
        `To:      ${msg.to}`,
        `From:    ${config.EMAIL_FROM}`,
        `Subject: ${msg.subject}`,
        '',
        msg.text,
        '───────────────────────────────────────────────────',
        '',
      ].join('\n'),
    );
  }
}

/**
 * Production transport: Resend. Used when RESEND_API_KEY is set. The `resend`
 * package is imported lazily so the app runs without it on the console path.
 */
class ResendTransport implements Transport {
  readonly name = 'resend';
  constructor(private readonly apiKey: string) {}
  async send(msg: EmailMessage): Promise<void> {
    const { Resend } = await import('resend');
    const resend = new Resend(this.apiKey);
    const { error } = await resend.emails.send({
      from: config.EMAIL_FROM,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    });
    if (error) throw new Error(`Resend error: ${error.message ?? String(error)}`);
  }
}

let transport: Transport | null = null;

/**
 * Select the email transport from config: Resend when RESEND_API_KEY is set,
 * otherwise the console transport (zero setup). Overridable for tests.
 */
export function getTransport(): Transport {
  if (transport) return transport;
  transport = config.RESEND_API_KEY
    ? new ResendTransport(config.RESEND_API_KEY)
    : new ConsoleTransport();
  return transport;
}

export function setTransport(t: Transport): void {
  transport = t;
}

// ── Message builders ─────────────────────────────────────────────────────────

export function confirmUrl(token: string): string {
  return `${config.BASE_URL}/confirm?token=${encodeURIComponent(token)}`;
}

export function unsubscribeUrl(token: string): string {
  return `${config.BASE_URL}/unsubscribe?token=${encodeURIComponent(token)}`;
}

/** Double opt-in confirmation email. Carries both a confirm and unsubscribe link. */
export function buildConfirmationEmail(to: string, token: string): EmailMessage {
  const confirm = confirmUrl(token);
  const unsub = unsubscribeUrl(token);
  const text = `Thanks for subscribing to ${config.SITE_NAME}.

Confirm your subscription by opening this link:
${confirm}

If you didn't request this, ignore this email — you won't hear from us.
Unsubscribe at any time: ${unsub}`;
  const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6;color:#1a1a2e">
    <p>Thanks for subscribing to <strong>${escapeHtml(config.SITE_NAME)}</strong>.</p>
    <p><a href="${confirm}" style="display:inline-block;background:#0f3460;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Confirm subscription</a></p>
    <p style="color:#5c6470;font-size:13px">Or paste this into your browser:<br>${confirm}</p>
    <hr style="border:none;border-top:1px solid #e2e6ea;margin:20px 0">
    <p style="color:#5c6470;font-size:12px">Didn't request this? Ignore this email.<br>
    <a href="${unsub}" style="color:#5c6470">Unsubscribe</a></p>
  </body></html>`;
  return { to, subject: `Confirm your subscription to ${config.SITE_NAME}`, html, text };
}

export interface RoundupInput {
  to: string;
  token: string;
  subject: string;
  roundupMd: string;
  postUrl: string;
}

/**
 * Weekly arc roundup email: the arc's findings (markdown) plus a button linking
 * to the full piece on our site, and a per-recipient unsubscribe link.
 */
export function buildRoundupEmail(input: RoundupInput): EmailMessage {
  const unsub = unsubscribeUrl(input.token);
  const text = `${input.roundupMd}

Read the full piece: ${input.postUrl}

—
${config.SITE_NAME}
Unsubscribe: ${unsub}`;
  const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.65;color:#1a1a2e;max-width:640px;margin:0 auto;padding:8px">
    <div style="font-size:16px">${mdToHtml(input.roundupMd)}</div>
    <p style="margin:24px 0"><a href="${input.postUrl}" style="display:inline-block;background:#0f3460;color:#fff;padding:11px 20px;border-radius:6px;text-decoration:none;font-weight:600">Read the full piece →</a></p>
    <hr style="border:none;border-top:1px solid #e2e6ea;margin:24px 0">
    <p style="color:#5c6470;font-size:12px">${escapeHtml(config.SITE_NAME)} — ${escapeHtml(config.SITE_TAGLINE)}<br>
    <a href="${unsub}" style="color:#5c6470">Unsubscribe</a></p>
  </body></html>`;
  return { to: input.to, subject: input.subject, html, text };
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
