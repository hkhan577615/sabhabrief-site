/* Preview (or send) the daily Telegram message from the JSON files in this folder.
     node scripts/telegram.mjs                      preview today's message
     node scripts/telegram.mjs --date 2026-11-22    preview the message for another day
     node scripts/telegram.mjs --all 14             preview the next 14 days, to check the rotation
     TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... node scripts/telegram.mjs --send
   Not published: netlify.toml returns 404 for /scripts/*. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildMessage, sendMessage, todayIn } from "../netlify/lib/telegram.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const load = (n) => { try { return JSON.parse(readFileSync(root + n, "utf8")); } catch { return {}; } };
const data = { daily: load("daily.json"), library: load("library.json"), statutes: load("statutes.json") };

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const site = "https://sabhabrief.lk";
const start = opt("--date") || todayIn();
const n = Number(opt("--all") || 1);

const show = (m, date) => {
  console.log(`\n===== ${date} · ${m ? m.kind : "nothing"} =====`);
  if (!m) return;
  console.log(m.text);
  for (const row of m.buttons || []) console.log(row.map((b) => `[${b.text}] ${b.url}`).join("\n"));
};

for (let i = 0; i < n; i++) {
  const d = new Date(start + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + i);
  const date = d.toISOString().slice(0, 10);
  show(buildMessage(data, { site, today: date }), date);
}

if (args.includes("--send")) {
  const token = process.env.TELEGRAM_BOT_TOKEN, chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) { console.error("Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to send."); process.exit(1); }
  const m = buildMessage(data, { site, today: start });
  if (!m) { console.error("Nothing to send."); process.exit(1); }
  const r = await sendMessage({ token, chatId, message: m });
  console.log(`\nSent message ${r.message_id}.`);
}
