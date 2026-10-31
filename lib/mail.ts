import "server-only"

import nodemailer, { type Transporter } from "nodemailer"

type Mail = {
  to: string
  subject: string
  /** Plain-text body. Links on their own line become buttons in the HTML version. */
  text: string
  /** Optional call-to-action shown as a button. */
  action?: { label: string; url: string }
}

/**
 * SMTP settings (.env): SMTP_HOST, SMTP_PORT, SMTP_SECURE ("true" for port 465),
 * SMTP_USER, SMTP_PASSWORD, MAIL_FROM ("Klyron Studio <crm@klyronstudio.com>").
 * Gmail/Google Workspace: smtp.gmail.com, 465, secure, with an App Password.
 * Zoho: smtp.zoho.com, 465, secure.
 */
const globalForMail = globalThis as unknown as { mailer?: Transporter | null }

function transporter(): Transporter | null {
  if (globalForMail.mailer !== undefined) return globalForMail.mailer
  const host = process.env.SMTP_HOST
  if (!host) return (globalForMail.mailer = null)
  const port = Number(process.env.SMTP_PORT) || 587
  globalForMail.mailer = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  })
  return globalForMail.mailer
}

export function isMailConfigured() {
  return Boolean(process.env.SMTP_HOST)
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)
}

/** Minimal branded HTML: white card, crimson button. Inline styles are required for email clients. */
function renderHtml(mail: Mail) {
  const paragraphs = mail.text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.55">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("")
  const button = mail.action
    ? `<p style="margin:22px 0 6px"><a href="${escapeHtml(mail.action.url)}" style="display:inline-block;background:#DC143C;color:#ffffff;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:8px">${escapeHtml(mail.action.label)}</a></p>`
    : ""
  return `<!doctype html><html><body style="margin:0;background:#FAFAFA;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#0A0A0A">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #E5E5E5;border-radius:12px">
<tr><td style="padding:28px 28px 8px;font-weight:700;font-size:15px">Klyron <span style="font-weight:400;color:#737373">Studio</span></td></tr>
<tr><td style="padding:8px 28px 24px;font-size:14px">${paragraphs}${button}</td></tr>
</table>
<p style="font-size:12px;color:#737373;margin:16px 0 0">Sent by the Klyron Studio CRM.</p>
</td></tr></table></body></html>`
}

export async function sendMail(mail: Mail) {
  const transport = transporter()
  const text = mail.action ? `${mail.text}\n\n${mail.action.label}: ${mail.action.url}` : mail.text
  if (!transport) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`\n[mail] To: ${mail.to}\n[mail] Subject: ${mail.subject}\n${text}\n`)
    } else {
      console.warn(`[mail] SMTP is not configured; dropped "${mail.subject}" to ${mail.to}`)
    }
    return false
  }
  try {
    await transport.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: mail.to,
      subject: mail.subject,
      text,
      html: renderHtml(mail),
    })
    return true
  } catch (error) {
    console.error(`[mail] Failed to send "${mail.subject}" to ${mail.to}:`, error instanceof Error ? error.message : error)
    return false
  }
}
