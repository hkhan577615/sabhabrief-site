/* Sabha Brief: the daily Telegram channel message.
   buildMessage() turns the site's own data (daily.json, library.json, statutes.json) into one message.
   When last night's update is fresh, the message is that update. When it is not (no sitting, or the
   nightly task did not run), the message is something else worth reading: today's agenda, the week in
   review on Sundays, or a rotating feature (a bill explained, a key Act, the Gazette, a term in plain words).
   Every message ends with buttons back to the right page on the site, tagged so visits can be counted. */

export const TZ = "Asia/Colombo";
const OFFICIAL = /(^|\.)parliament\.lk$|(^|\.)gov\.lk$|(^|\.)supremecourt\.lk$/;
const MAX = 4000; // Telegram allows 4096 characters per message.

/* Same terms as about.html, "Parliament's terms, in plain words". */
const TERMS = [
  ["Order Paper", "The agenda for a sitting day."],
  ["Hansard", "The word-for-word record of a sitting, published later."],
  ["Gazette", "The government's official publication, issued every Friday."],
  ["Gazette Extraordinary", "An issue published between the weekly editions, on any day."],
  ["Regulation", "A rule a Minister makes under an Act. It takes effect in the Gazette and goes to Parliament for approval."],
  ["First reading", "A bill is presented. No debate yet."],
  ["Supreme Court petition", "A citizen's challenge to a bill, filed within 14 days of it reaching the Order Paper."],
  ["Second reading", "The main debate and vote on a bill's principles."],
  ["Committee stage", "Clause-by-clause changes; for the Budget, ministry by ministry."],
  ["Division", "A recorded vote. Without one, there is no vote count."],
  ["Speaker's certificate", "The Speaker signs a passed bill and it becomes an Act."],
  ["Supplementary estimate", "Extra spending approved on top of the Budget."],
];
const STAGES = ["Published", "First reading", "Court or committee", "Passed", "Law"];

/* ---------- small helpers ---------- */
export const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const official = (u) => { try { const x = new URL(u); return x.protocol === "https:" && OFFICIAL.test(x.hostname); } catch { return false; } };
export const todayIn = (now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
const D = (iso) => new Date(iso + "T00:00:00Z");
const F = (iso, o) => new Intl.DateTimeFormat("en-GB", Object.assign({ timeZone: "UTC" }, o)).format(D(iso));
const dm = (iso) => F(iso, { day: "numeric", month: "long" });
const wdm = (iso) => F(iso, { weekday: "long", day: "numeric", month: "long" });
const diff = (a, b) => Math.round((D(b) - D(a)) / 864e5);
const addDays = (iso, n) => { const d = D(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const ordinal = (iso) => Math.floor(D(iso) / 864e5); // one number per day, for rotating features
const rel = (today, iso) => { const n = diff(today, iso); return n > 1 ? `in ${n} days` : n === 1 ? "tomorrow" : n === 0 ? "today" : "under way"; };
const pick = (arr, n) => arr.length ? arr[((n % arr.length) + arr.length) % arr.length] : null;
const mondayOf = (iso) => { const d = D(iso); const w = (d.getUTCDay() + 6) % 7; return addDays(iso, -w); };

/* Links back to the site carry UTM tags: utm_content says which kind of message brought the visit. */
const link = (site, path, kind) => {
  const [p, hash] = path.split("#");
  const u = new URL(p || "/", site);
  u.searchParams.set("utm_source", "telegram");
  u.searchParams.set("utm_medium", "channel");
  u.searchParams.set("utm_campaign", "daily");
  u.searchParams.set("utm_content", kind);
  return u.toString() + (hash ? "#" + hash : "");
};

/* posts.tg (if the nightly task writes one) or posts.wa: a title line, "- " bullets and a "Next:" line. */
const fromChannelText = (text) => {
  const lines = String(text).trim().split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.map((l, i) => {
    if (/^[-•*]\s+/.test(l)) return "• " + esc(l.replace(/^[-•*]\s+/, ""));
    const m = l.match(/^(Next|Today|Coming up):\s*(.*)$/i);
    if (m) return `\n<b>${esc(m[1])}:</b> ${esc(m[2])}`;
    return i === 0 ? `<b>${esc(l)}</b>\n` : esc(l);
  }).join("\n");
};

const storyLines = (stories) => (stories || []).slice(0, 5).map((s) => {
  const fig = s.v && s.l ? ` <i>(${esc(s.v)} ${esc(s.l)})</i>` : "";
  return `• <b>${esc(s.title)}</b>${fig}${s.line ? `\n  ${esc(s.line)}` : ""}`;
}).join("\n");

const upcoming = (data, today, days = 14, limit = 3) =>
  (data.keyDates || [])
    .filter((k) => k.date > today && k.date <= addDays(today, days))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, limit);

const comingUp = (data, today, limit = 3) => {
  const up = upcoming(data, today, 14, limit);
  if (!up.length) return "";
  return "\n\n<b>Coming up</b>\n" + up.map((k) => `• ${esc(F(k.date, { weekday: "short", day: "numeric", month: "short" }))}: ${esc(k.label)} <i>(${rel(today, k.date)})</i>`).join("\n");
};

const agendaFor = (data, iso) => (data.days || []).find((d) => d.date === iso && d.status === "agenda" && (d.items || []).length);

/* ---------- message kinds ---------- */

/* 1. Last night's update. */
function daily(ctx) {
  const { data, today, site } = ctx;
  const p = data.posts || {};
  const day = (data.brief || {}).day || {};
  const date = p.date || day.date;
  const src = p.tg || p.wa;
  let body;
  if (src && String(src).trim()) body = fromChannelText(src);
  else if ((day.stories || []).length) body = `<b>${esc(day.headline || "In Parliament")}</b>\n\n${storyLines(day.stories)}`;
  else return null;
  const head = `🏛 <b>Sabha Brief · ${esc(wdm(date))}</b>\n\n`;
  const ag = agendaFor(data, today);
  const todayLine = ag && !/\n<b>(Next|Today):/.test(body) ? `\n\n<b>Today:</b> ${esc(ag.headline)}${ag.summary ? ". " + esc(ag.summary) : ""}` : "";
  return {
    kind: "daily",
    text: head + body + todayLine,
    buttons: [[
      { text: "Read the full day", url: link(site, `/#d${date}`, "daily") },
      { text: "Track the bills", url: link(site, "/bills.html", "daily") },
    ]],
  };
}

/* 2. Sunday: the week in review, from brief.week. */
function weekly(ctx) {
  const { data, today, site } = ctx;
  const w = (data.brief || {}).week;
  if (!w || !(w.stories || []).length || !w.to || diff(w.to, today) > 7) return null;
  const range = w.from && w.from !== w.to ? `${dm(w.from)} to ${dm(w.to)}` : dm(w.to);
  return {
    kind: "weekly",
    text: `🗓 <b>The week in Parliament</b>\n<i>${esc(range)}</i>\n\n<b>${esc(w.headline || "")}</b>\n\n${storyLines(w.stories)}${comingUp(data, today)}\n\n<i>Know someone who follows Parliament? Forward this to them.</i>`,
    buttons: [[{ text: "See the whole week", url: link(site, `/#w${mondayOf(w.from || w.to)}`, "weekly") }]],
  };
}

/* 3. Parliament sits today but last night's update is not in: say what is on. */
function agenda(ctx) {
  const { data, today, site } = ctx;
  const ag = agendaFor(data, today);
  if (!ag) return null;
  const items = ag.items.slice(0, 4).map((i) => `• <b>${esc(i.title)}</b>${i.what ? `\n  ${esc(i.what)}` : ""}`).join("\n");
  return {
    kind: "agenda",
    text: `🏛 <b>Today in Parliament · ${esc(wdm(today))}</b>\n\n<b>${esc(ag.headline)}</b>\n\n${items}${comingUp(data, today)}`,
    buttons: [[{ text: "What is on today", url: link(site, `/#d${today}`, "agenda") }]],
  };
}

/* 4a. A bill explained: bills on the watch list first, then the rest of the library. */
function bill(ctx) {
  const { data, lib, today, site, n } = ctx;
  const stage = new Map((data.pipeline || []).map((p) => [p.id, p]));
  const all = (lib.bills || []).filter((b) => b.impl && b.impl.sum);
  // Mostly bills on the watch list; otherwise bills still before Parliament; laws already passed last.
  const watched = all.filter((b) => (stage.get(b.id) || {}).watch);
  const live = all.filter((b) => { const p = stage.get(b.id); return p && (p.st | 0) < 4; });
  const pool = [watched, live, all].find((x, i) => x.length && (i > 0 || n % 3 !== 2)) || all;
  const b = pick(pool, n % 3 === 2 ? Math.floor(n / 3) : n - Math.floor(n / 3));
  if (!b) return null;
  const p = stage.get(b.id);
  const figs = (b.impl.figs || []).slice(0, 3).map((f) => `• <b>${esc(f.v)}</b> ${esc(f.l)}`).join("\n");
  const where = p ? `\n\n<b>Where it stands:</b> ${esc(p.label || STAGES[p.st] || "")}${p.dt ? `\n<i>${esc(p.dt)}</i>` : ""}` : "";
  const who = (b.impl.who || []).length ? `\n\n<b>Who it affects:</b> ${esc(b.impl.who.slice(0, 4).join(", "))}` : "";
  return {
    kind: "bill",
    text: `📜 <b>Bill explained</b>\n\n<b>${esc(b.t)}</b>\n${esc(b.impl.sum)}${figs ? "\n\n" + figs : ""}${who}${where}${comingUp(data, today, 2)}`,
    buttons: [[{ text: "Read the bill explained", url: link(site, `/bills.html#b${b.id}`, "bill") }]],
  };
}

/* 4b. A key Act in plain words, with the official text. */
function act(ctx) {
  const { data, st, today, site, n } = ctx;
  const acts = (st.acts || []).filter((a) => a.key && a.impl && a.impl.sum && a.status !== "repealed");
  const a = pick(acts, n);
  if (!a) return null;
  const num = a.no && a.yr ? `, No. ${a.no} of ${a.yr}` : a.no ? ` (No. ${a.no})` : a.yr ? ` ${a.yr}` : "";
  const name = `${a.t} ${a.kind || "Act"}${num}`;
  const figs = (a.impl.figs || []).slice(0, 3).map((f) => `• <b>${esc(f.v)}</b> ${esc(f.l)}`).join("\n");
  const ch = (a.impl.changes || []).slice(0, 2).map((c) => `• ${esc(c)}`).join("\n");
  const off = official(a.u) ? `\n\n<a href="${esc(a.u)}">Official text</a>` : "";
  return {
    kind: "act",
    text: `⚖️ <b>Know the law</b>\n\n<b>${esc(name)}</b>\n${esc(a.impl.sum)}${figs ? "\n\n" + figs : ""}${ch ? "\n\n" + ch : ""}${off}\n\n<i>Got a notice, letter or contract that cites an Act? Add <code>sabhabrief.lk/mcp</code> to Claude or ChatGPT as a connector and check it against the official text.</i>${comingUp(data, today, 2)}`,
    buttons: [[
      { text: "This week in Parliament", url: link(site, "/", "act") },
      { text: "Bills before Parliament", url: link(site, "/bills.html", "act") },
    ]],
  };
}

/* 4c. The Gazette: notices from the last week. */
function gazette(ctx) {
  const { data, today, site } = ctx;
  const items = ((data.gzfeed || {}).items || []).filter((g) => g.d && diff(g.d, today) <= 7).sort((a, b) => (a.d < b.d ? 1 : -1));
  if (!items.length) return null;
  const list = items.slice(0, 5).map((g) => `• ${esc(F(g.d, { day: "numeric", month: "short" }))}: ${esc(g.t)}${g.no ? ` <i>(${esc(g.no)})</i>` : ""}`).join("\n");
  const more = items.length > 5 ? `\n…and ${items.length - 5} more.` : "";
  return {
    kind: "gazette",
    text: `📰 <b>In the Gazette this week</b>\n<i>${items.length} notice${items.length === 1 ? "" : "s"} from the official Gazette, in plain words.</i>\n\n${list}${more}${comingUp(data, today, 2)}`,
    buttons: [[{ text: "Read the Gazette feed", url: link(site, "/gazette.html", "gazette") }]],
  };
}

/* 4d. A term in plain words: always available, so there is never a blank day. */
function term(ctx) {
  const { data, today, site, n } = ctx;
  const [t, d] = pick(TERMS, n);
  return {
    kind: "term",
    text: `💡 <b>Parliament in plain words</b>\n\n<b>${esc(t)}</b>: ${esc(d)}${comingUp(data, today)}`,
    buttons: [[
      { text: "How a bill becomes law", url: link(site, "/about.html", "term") },
      { text: "This week", url: link(site, "/", "term") },
    ]],
  };
}

const FEATURES = [bill, gazette, act, bill, term];

/* ---------- choose today's message ---------- */
export function buildMessage({ daily: data = {}, library: lib = {}, statutes: st = {} }, { site = "https://sabhabrief.lk", today = todayIn() } = {}) {
  const ctx = { data, lib, st, today, site, n: ordinal(today) };
  const p = data.posts || {};
  const updDate = p.date || ((data.brief || {}).day || {}).date;
  const fresh = updDate && diff(updDate, today) <= 1 && diff(updDate, today) >= 0;
  const sunday = D(today).getUTCDay() === 0;

  const order = [];
  if (fresh) order.push([daily]);
  if (sunday) order.push([weekly]);
  order.push([agenda]);
  // Rotate through the features, starting at a different one each day.
  // Each feature also keeps its own count (ctx.n), so it steps through its list one item per showing.
  const L = FEATURES.length, day = ordinal(today), cycle = Math.floor(day / L), start = day % L;
  const count = (fn, upto) => FEATURES.slice(0, upto).filter((f) => f === fn).length;
  const nth = new Map();
  // Today's feature first; if it has nothing to show, the evergreen term, then the others.
  for (let i = 0; i < L; i++) {
    const pos = (start + i) % L, fn = FEATURES[pos];
    if (nth.has(fn)) continue;
    nth.set(fn, cycle * count(fn, L) + count(fn, pos));
    order.push([fn, nth.get(fn)]);
    if (i === 0 && fn !== term) order.push([term, day * 7]);
  }

  for (const [fn, n = ctx.n] of order) {
    let m = null;
    try { m = fn({ ...ctx, n }); } catch (e) { console.error(`telegram: ${fn.name} failed`, e); }
    if (m && m.text) {
      if (m.text.length > MAX) m.text = m.text.slice(0, MAX - 1).replace(/<[^>]*$/, "") + "…";
      return m;
    }
  }
  return null;
}

/* ---------- send ---------- */
export async function sendMessage({ token, chatId, message }) {
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message.text,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: message.buttons && message.buttons.length ? { inline_keyboard: message.buttons } : undefined,
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(`Telegram ${r.status}: ${j.description || "send failed"}`);
  return j.result;
}
