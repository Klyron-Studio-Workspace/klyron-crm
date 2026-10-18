"use strict"

const { simpleParser } = require("mailparser")
const path = require("path")

// Load .env.local for DATABASE_URL
try { require("node:process").loadEnvFile(path.join(__dirname, "../../.env.local")) } catch {}
try { require("node:process").loadEnvFile(path.join(__dirname, "../../.env")) } catch {}

// Lazy-load the deliver function so Haraka boots before Prisma connects
let deliverFn = null
async function getDeliver() {
  if (!deliverFn) {
    const mod = await import("../../lib/mail-server/deliver.ts")
    deliverFn = mod.deliver
  }
  return deliverFn
}

exports.hook_data_post = async function (next, connection) {
  try {
    const raw = await streamToBuffer(connection.transaction.message_stream)
    const parsed = await simpleParser(raw)

    const mail = {
      messageId: parsed.messageId ?? `<generated.${Date.now()}@klyronstudio.com>`,
      inReplyTo: parsed.inReplyTo ?? null,
      references: Array.isArray(parsed.references) ? parsed.references : [],
      subject: parsed.subject ?? "(no subject)",
      fromAddress: parsed.from?.value?.[0]?.address ?? "",
      fromName: parsed.from?.value?.[0]?.name ?? null,
      toAddresses: (parsed.to?.value ?? []).map((a) => a.address),
      ccAddresses: (parsed.cc?.value ?? []).map((a) => a.address),
      bodyHtml: parsed.html || null,
      bodyText: parsed.text || null,
      receivedAt: parsed.date ?? new Date(),
      attachments: [],
    }

    const recipients = connection.transaction.rcpt_to
    const deliver = await getDeliver()
    for (const rcpt of recipients) {
      await deliver(rcpt.address(), mail)
    }
  } catch (err) {
    connection.logerror(exports, `klyron_deliver error: ${err.message}`)
  }
  next()
}

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = []
    stream.on("data", (chunk) => chunks.push(chunk))
    stream.on("end", () => resolve(Buffer.concat(chunks)))
    stream.on("error", reject)
  })
}
