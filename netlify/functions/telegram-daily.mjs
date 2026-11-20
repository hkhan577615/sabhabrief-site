/* Sabha Brief: posts one message a day to the Telegram channel.
   Runs on a Netlify schedule at 7.30 am Sri Lanka time (02:00 UTC), after the ~10 pm nightly update
   has deployed. It reads the live site's JSON, so the message always matches what readers will see.
   Needs two environment variables in Netlify (Site configuration > Environment variables):
     TELEGRAM_BOT_TOKEN  the bot's token from @BotFather (the bot must be an admin of the channel)
     TELEGRAM_CHAT_ID    the channel, e.g. @sabhabrief or its numeric id (-100...)
   Set TELEGRAM_DRY_RUN=1 to log the message instead of sending it. */
import { buildMessage, sendMessage, todayIn } from "../lib/telegram.mjs";

export const config = { schedule: "0 2 * * *" };

export default async () => {
  const site = (process.env.URL || "https://sabhabrief.lk").replace(/\/$/, "");
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const dry = /^(1|true|yes)$/i.test(process.env.TELEGRAM_DRY_RUN || "");

  const get = async (name) => {
    try { const r = await fetch(`${site}/${name}`, { headers: { "Cache-Control": "no-cache" } }); return r.ok ? await r.json() : {}; }
    catch (e) { console.error(`telegram: could not load ${name}`, e); return {}; }
  };
  const [daily, library, statutes] = await Promise.all([get("daily.json"), get("library.json"), get("statutes.json")]);

  const message = buildMessage({ daily, library, statutes }, { site, today: todayIn() });
  if (!message) { console.log("telegram: nothing to send today"); return new Response("nothing to send"); }

  if (dry || !token || !chatId) {
    console.log(`telegram: ${dry ? "dry run" : "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set"}; message (${message.kind}):\n${message.text}`);
    return new Response("not sent");
  }
  try {
    const sent = await sendMessage({ token, chatId, message });
    console.log(`telegram: sent ${message.kind} message ${sent.message_id}`);
    return new Response("sent");
  } catch (e) {
    console.error("telegram: send failed", e);
    return new Response("send failed", { status: 502 });
  }
};
