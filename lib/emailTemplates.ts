import { escapeHtml } from "@/lib/utils";

type Lang = "en" | "de";
const pick = (lang: string): Lang => (lang === "de" ? "de" : "en");

function layout(body: string) {
  return `<!doctype html><html><body style="margin:0;padding:24px 12px;background:#e9ebec;font-family:'Fira Sans','Segoe UI',Arial,sans-serif;color:#1d2124;">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #cdd2d5;border-radius:9px;overflow:hidden;">
  <div style="padding:10px 16px;border-bottom:1px solid #cdd2d5;font-family:'Fira Mono',Consolas,monospace;font-size:12.5px;color:#5f686d;">system98 — support</div>
  <div style="padding:24px 22px 22px;font-size:15px;line-height:1.55;">${body}</div>
</div>
<p style="text-align:center;font-size:12px;color:#5f686d;margin:14px 0 0;">system98</p>
</body></html>`;
}

function button(label: string, url: string) {
  return `<p style="margin:20px 0 4px;"><a href="${url}" style="display:inline-block;background:#1d8f9e;color:#08272b;font-weight:700;text-decoration:none;padding:10px 18px;border-radius:6px;">${escapeHtml(label)}</a></p>`;
}

export function ticketCreatedEmail(p: { name: string; code: string; url: string; subject: string; lang: string }) {
  const l = pick(p.lang);
  const t = {
    en: {
      subject: `Got it — ticket ${p.code}`,
      hi: `Hi ${p.name},`,
      body: `your message “${p.subject}” landed in the queue. Someone from the team will reply — usually within a day.`,
      keep: "Keep this link, it's the only way back into the conversation (besides your ticket number and this email address):",
      btn: "Open ticket",
      num: "Ticket number",
    },
    de: {
      subject: `Angekommen — Ticket ${p.code}`,
      hi: `Hallo ${p.name},`,
      body: `deine Nachricht „${p.subject}“ ist in der Warteschlange gelandet. Jemand aus dem Team antwortet dir — meistens innerhalb eines Tages.`,
      keep: "Heb dir diesen Link auf, er führt dich zurück ins Gespräch (alternativ: Ticketnummer + diese E-Mail-Adresse):",
      btn: "Ticket öffnen",
      num: "Ticketnummer",
    },
  }[l];
  const html = layout(
    `<p style="margin:0 0 12px;">${escapeHtml(t.hi)}</p><p style="margin:0 0 12px;">${escapeHtml(t.body)}</p>
     <p style="margin:0 0 4px;color:#5f686d;">${t.num}: <span style="font-family:'Fira Mono',Consolas,monospace;color:#1d2124;">${p.code}</span></p>
     <p style="margin:12px 0 0;color:#5f686d;">${escapeHtml(t.keep)}</p>${button(t.btn, p.url)}`
  );
  return { subject: t.subject, html, text: `${t.hi}\n\n${t.body}\n\n${t.num}: ${p.code}\n${t.keep}\n${p.url}\n` };
}

export function ticketReplyEmail(p: {
  name: string;
  code: string;
  url: string;
  subject: string;
  staffName: string;
  body: string;
  lang: string;
}) {
  const l = pick(p.lang);
  const t = {
    en: {
      subject: `Re: ${p.subject} [${p.code}]`,
      hi: `Hi ${p.name},`,
      intro: `${p.staffName} replied to your ticket:`,
      reply: "You can answer right on the ticket page:",
      btn: "Open ticket",
    },
    de: {
      subject: `Re: ${p.subject} [${p.code}]`,
      hi: `Hallo ${p.name},`,
      intro: `${p.staffName} hat auf dein Ticket geantwortet:`,
      reply: "Antworten kannst du direkt auf der Ticket-Seite:",
      btn: "Ticket öffnen",
    },
  }[l];
  const html = layout(
    `<p style="margin:0 0 12px;">${escapeHtml(t.hi)}</p><p style="margin:0 0 10px;">${escapeHtml(t.intro)}</p>
     <div style="border-left:3px solid #1d8f9e;background:#f2f4f5;padding:10px 14px;margin:0 0 14px;white-space:pre-wrap;">${escapeHtml(p.body)}</div>
     <p style="margin:0;color:#5f686d;">${escapeHtml(t.reply)}</p>${button(t.btn, p.url)}`
  );
  return { subject: t.subject, html, text: `${t.hi}\n\n${t.intro}\n\n${p.body}\n\n${t.reply}\n${p.url}\n` };
}

/** Internal ping to SUPPORT_NOTIFY_EMAIL. English only, it's for the team. */
export function staffNotifyEmail(p: { code: string; subject: string; name: string; body: string; adminUrl: string; isReply: boolean }) {
  const subject = `${p.isReply ? "New reply" : "New ticket"} ${p.code}: ${p.subject}`;
  const html = layout(
    `<p style="margin:0 0 10px;"><b>${escapeHtml(p.name)}</b> ${p.isReply ? "wrote back on" : "opened"} <span style="font-family:'Fira Mono',Consolas,monospace;">${p.code}</span> — ${escapeHtml(p.subject)}</p>
     <div style="border-left:3px solid #1d8f9e;background:#f2f4f5;padding:10px 14px;margin:0 0 6px;white-space:pre-wrap;">${escapeHtml(p.body.slice(0, 1200))}</div>${button("Open in dashboard", p.adminUrl)}`
  );
  return { subject, html, text: `${p.name} ${p.isReply ? "wrote back on" : "opened"} ${p.code}: ${p.subject}\n\n${p.body.slice(0, 1200)}\n\n${p.adminUrl}\n` };
}
