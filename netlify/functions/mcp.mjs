/* Sabha Brief MCP server: lets a reader's own Claude look up Sri Lankan Acts in the official text,
   so it can sense-check a notice, contract or letter that cites them.
   Stateless Streamable HTTP: every POST carries one JSON-RPC message (or a batch) and gets a JSON reply.
   It never receives the reader's document, only the Acts and sections to look up.
   Data comes from the site's own statutes.json and library.json; Act text only from official hosts. */
import { extractText, getDocumentProxy } from "unpdf";

export const config = { path: "/mcp" };

const VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const OFFICIAL = /(^|\.)parliament\.lk$|(^|\.)gov\.lk$|(^|\.)supremecourt\.lk$/;
const MAX_PDF = 20 * 1024 * 1024;
const MAX_TEXT = 12000;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Mcp-Session-Id, Mcp-Protocol-Version", "Access-Control-Allow-Methods": "POST, OPTIONS" };

const INSTRUCTIONS = `Sabha Brief looks up Sri Lankan Acts and Ordinances in official government sources (parliament.lk, gov.lk sites, supremecourt.lk).
To sense-check a document that cites the law:
1. List every Act, section, rate, penalty and deadline the document relies on.
2. For each Act, call search_acts, then get_act to see whether it is in force, repealed or amended.
3. Call read_act_text for each cited section and compare its wording with what the document claims.
4. Report what matches, what does not (a section that does not exist, a penalty above the maximum, a repealed or amended provision, a wrong Act number or year), and what is unclear.
Quote the official text you relied on and link it. Say plainly that this is a sense check against the official text, not legal advice. If an Act is not in Sabha Brief's index, say so rather than guessing.`;

const TOOLS = [
  {
    name: "search_acts",
    title: "Find an Act",
    description: "Search Sri Lankan Acts and Ordinances by name, number, year or topic (e.g. \"Inland Revenue\", \"No. 24 of 2017\", \"gratuity\"). Returns ids for get_act and read_act_text.",
    inputSchema: { type: "object", properties: { query: { type: "string", description: "Words to look for" }, limit: { type: "integer", minimum: 1, maximum: 25, default: 8 } }, required: ["query"] },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_act",
    title: "Act details",
    description: "Status (in force or repealed), amendments, plain-English summary, key figures, who it applies to and the official text link for one Act.",
    inputSchema: { type: "object", properties: { id: { type: "string", description: "Id from search_acts, e.g. 2017-24" } }, required: ["id"] },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "read_act_text",
    title: "Read the official text",
    description: "Read an Act's official text. Give a section number to get that section, or words to find the passages that use them. Without either, returns the text from the start; use offset to read on.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Id from search_acts" },
        url: { type: "string", description: "Instead of id: an official PDF link (parliament.lk, gov.lk or supremecourt.lk), e.g. an amending Act" },
        section: { type: "string", description: "Section number, e.g. 163 or 24A" },
        find: { type: "string", description: "Words to find in the text" },
        offset: { type: "integer", minimum: 0, default: 0 },
      },
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  /* search and fetch use the names and shapes ChatGPT's connectors, deep research included, expect. */
  {
    name: "search",
    title: "Search Acts",
    description: "Search Sri Lankan Acts and Ordinances by name, number, year or topic. Returns JSON {results:[{id,title,url}]}; pass an id to fetch. Same index as search_acts.",
    inputSchema: { type: "object", properties: { query: { type: "string", description: "Words to look for, e.g. \"VAT\", \"No. 24 of 2017\", \"gratuity\"" } }, required: ["query"] },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "fetch",
    title: "Fetch an Act",
    description: "Fetch one Act by id from search: its status, amendments and summary followed by the official text. Use \"<id>:<section>\" (e.g. \"2026-14:3\") for one section. Returns JSON {id,title,text,url,metadata}.",
    inputSchema: { type: "object", properties: { id: { type: "string", description: "Id from search, optionally with :section" } }, required: ["id"] },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
];

/* ---------- data ---------- */
let dataCache = { at: 0, acts: null };
async function loadActs(origin) {
  if (dataCache.acts && Date.now() - dataCache.at < 10 * 60 * 1000) return dataCache.acts;
  const get = async (name) => { try { const r = await fetch(new URL(name, origin)); return r.ok ? await r.json() : {}; } catch { return {}; } };
  const [st, lib] = await Promise.all([get("/statutes.json"), get("/library.json")]);
  const by = new Map();
  for (const s of st.acts || []) by.set(s.id, { ...s });
  const bills = new Map((lib.bills || []).map((b) => [b.id, b]));
  for (const x of lib.acts || []) {
    const b = bills.get(x.id) || {};
    const yr = +(x.d || "").slice(0, 4);
    const con = x.kind === "constitution";
    const id = con ? "con-" + x.tag : `${yr}-${x.tag}`;
    const off = [...((b.impl || {}).src || []), ...(b.src || [])].find((s) => official(s.u));
    const e = { id, t: b.t || x.short, kind: con ? "Constitution" : "Act", no: x.pending ? "" : x.tag, yr, a: b.a || "", status: "in force", u: off && off.u, sum: (b.impl || {}).sum || b.about, impl: b.impl, certified: x.d, bill: b.id ? x.id : undefined };
    const old = by.get(id);
    by.set(id, old ? { ...e, ...old, impl: old.key ? old.impl : e.impl || old.impl, certified: x.d, bill: e.bill } : e);
  }
  dataCache = { at: Date.now(), acts: [...by.values()] };
  return dataCache.acts;
}
const official = (u) => { try { const x = new URL(u); return x.protocol === "https:" && OFFICIAL.test(x.hostname); } catch { return false; } };
const label = (e) => e.kind === "Constitution" ? `Amendment to the Constitution${e.no ? " (" + e.no + ")" : ""}` : e.kind === "Ordinance" ? `Ordinance${e.no ? " No. " + e.no : ""}${e.yr ? " of " + e.yr : ""}` : `${e.kind === "Law" ? "Law" : "Act"} ${e.no ? "No. " + e.no + " " : ""}of ${e.yr}`;

function search(acts, query, limit) {
  const q = String(query || "").toLowerCase();
  const m = q.match(/no\.?\s*(\d+[a-z]?)\s*(?:of\s*)?(\d{4})/);
  const words = q.replace(/no\.?\s*\d+[a-z]?\s*(of\s*)?\d{4}/, " ").split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !["act", "the", "of", "and", "ordinance", "law", "no"].includes(w));
  return acts.map((e) => {
    const t = (e.t || "").toLowerCase();
    const hay = [e.t, e.a, e.sum, label(e), ...(e.amd || []), ...((e.impl || {}).who || [])].join(" ").toLowerCase();
    let s = 0;
    if (m && String(e.no).toLowerCase() === m[1] && String(e.yr) === m[2]) s += 100;
    for (const w of words) { if (t.includes(w)) s += 10; else if (hay.includes(w)) s += 3; else if (/^\d{4}$/.test(w) && String(e.yr) === w) s += 5; }
    if (words.length && words.every((w) => hay.includes(w) || String(e.yr) === w)) s += 5;
    if (s && e.key) s += 2;
    if (s && e.status === "repealed") s -= 1;
    return { e, s };
  }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.e);
}

function describe(e) {
  const im = e.impl || {};
  const lines = [`${e.t} — ${label(e)}`, `id: ${e.id}`, `Status: ${e.status || "unknown"}${e.rep ? " (" + e.rep + ")" : ""}`];
  if (e.a) lines.push(`Area: ${e.a}`);
  if ((e.amd || []).length) lines.push(`Amended by: ${e.amd.join(", ")}`);
  if (e.certified) lines.push(`Certified: ${e.certified}`);
  if (im.sum || e.sum) lines.push(`Summary: ${im.sum || e.sum}`);
  if ((im.figs || []).length) lines.push("Key figures:", ...im.figs.map((f) => `- ${f.v}: ${f.l}`));
  if ((im.changes || []).length) lines.push("What it requires or changes:", ...im.changes.map((c) => `- ${c}`));
  if ((im.who || []).length) lines.push(`Applies to: ${im.who.join("; ")}`);
  if (im.when) lines.push(`In force: ${im.when}`);
  if (im.note) lines.push(`Note: ${im.note}`);
  if (e.u) lines.push(`Official text: ${e.u}`);
  for (const s of [...(im.src || [])].filter((s) => official(s.u))) lines.push(`Source: ${s.t} ${s.u}`);
  lines.push("The summary is Sabha Brief's plain-English reading; the official text is the law. Use read_act_text to check exact wording.");
  return lines.join("\n");
}

/* ---------- official text ---------- */
const textCache = new Map();
async function actText(url) {
  const hit = textCache.get(url);
  if (hit && Date.now() - hit.at < 6 * 60 * 60 * 1000) return hit.text;
  const r = await fetch(url, { redirect: "follow", headers: { "User-Agent": "SabhaBrief-MCP/1.0" } });
  if (!r.ok) throw new Error(`The official site returned ${r.status} for ${url}`);
  if (!official(r.url || url)) throw new Error("The link redirected away from an official site");
  const len = +(r.headers.get("content-length") || 0);
  if (len > MAX_PDF) throw new Error("The document is too large to read here; open it directly: " + url);
  const buf = new Uint8Array(await r.arrayBuffer());
  let text;
  if ((r.headers.get("content-type") || "").includes("pdf") || /\.pdf($|\?)/i.test(url) || String.fromCharCode(...buf.slice(0, 4)) === "%PDF") {
    const pdf = await getDocumentProxy(buf);
    const { text: pages } = await extractText(pdf, { mergePages: false });
    text = stripPageFurniture(pages);
  } else {
    text = new TextDecoder().decode(buf).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
  }
  text = text.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  if (textCache.size > 30) textCache.delete(textCache.keys().next().value);
  textCache.set(url, { at: Date.now(), text });
  return text;
}

/* Government Printer PDFs repeat a running header (the Act's title and number), a page number and a
   printer's footer such as "PL 15780 - 868 (05/2026)" on every page. Drop them so sections read cleanly. */
const FOOTER = /^PL\s*\d+\s*[-–]\s*\d+\s*\(\d{2}\/\d{4}\)$/;
const norm = (l) => l.replace(/^\d+\s*/, "").replace(/\s*\d+$/, "").replace(/\s+/g, " ").trim().toLowerCase();
function stripPageFurniture(pages) {
  const split = pages.map((p) => String(p).split(/\n/).map((l) => l.trim()).filter(Boolean));
  const edge = new Map();
  for (const lines of split) {
    const seen = new Set([...lines.slice(0, 4), ...lines.slice(-3)].map(norm).filter((n) => n && n.length < 90));
    for (const n of seen) edge.set(n, (edge.get(n) || 0) + 1);
  }
  const repeated = (l) => split.length > 2 && (edge.get(norm(l)) || 0) >= Math.max(2, Math.floor(split.length / 2));
  const furniture = (l) => FOOTER.test(l) || /^\d{1,3}$/.test(l) || repeated(l);
  return split.map((lines) => {
    let a = 0, b = lines.length;
    while (a < b && a < 4 && furniture(lines[a])) a++;
    while (b > a && lines.length - b < 3 && furniture(lines[b - 1])) b--;
    return lines.slice(a, b).filter((l) => !FOOTER.test(l)).join("\n");
  }).join("\n");
}

/* A section starts at a line such as "163. (1) ..." and runs to the next section number. */
function findSection(text, sec) {
  const n = String(sec).trim().replace(/^s(ection)?\.?\s*/i, "");
  const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const starts = [...text.matchAll(new RegExp(`(^|\\n|\\s{2,})(${esc})\\s*\\.\\s*(?=[(A-Z“"'])`, "g"))];
  if (!starts.length) return null;
  const base = parseInt(n, 10);
  const pick = starts[0].index + starts[0][1].length;
  const rest = text.slice(pick + n.length + 1);
  const next = rest.search(new RegExp(`(^|\\n|\\s{2,})(${base + 1}|${base}[A-Z])\\s*\\.\\s*(?=[(A-Z“"'])`));
  return text.slice(pick, next < 0 ? pick + MAX_TEXT : pick + n.length + 1 + next).trim();
}
function findPhrase(text, phrase) {
  const lc = text.toLowerCase(), p = phrase.toLowerCase().trim();
  const out = [];
  let i = lc.indexOf(p);
  while (i >= 0 && out.length < 8) {
    // Widen to whole lines so a passage never starts or ends mid-word.
    let a = Math.max(0, i - 400), b = Math.min(text.length, i + p.length + 400);
    const s = text.lastIndexOf("\n", a), e = text.indexOf("\n", b);
    a = s < 0 ? 0 : s + 1; b = e < 0 ? text.length : e;
    out.push((a > 0 ? "…" : "") + text.slice(a, b).trim() + (b < text.length ? "…" : ""));
    i = lc.indexOf(p, b);
  }
  return out;
}

/* ---------- tools ---------- */
async function callTool(name, args, origin) {
  const acts = await loadActs(origin);
  if (name === "search_acts") {
    const hits = search(acts, args.query, Math.min(25, Math.max(1, args.limit || 8)));
    if (!hits.length) return `No Act in Sabha Brief's index matches "${args.query}". The index covers ${acts.length} Acts; this does not mean no such Act exists. Try other words, the Act's number and year, or check https://www.lawnet.gov.lk .`;
    return hits.map((e) => `${e.id} | ${e.t} — ${label(e)} | ${e.status || "unknown"}${(e.amd || []).length ? " | amended " + e.amd.length + "x" : ""}${e.sum ? " | " + e.sum : ""}`).join("\n");
  }
  if (name === "get_act") {
    const e = acts.find((x) => x.id === args.id);
    if (!e) throw new Error(`No Act with id ${args.id}. Use search_acts to find the id.`);
    return describe(e);
  }
  if (name === "read_act_text") {
    let url = args.url, e;
    if (args.id) { e = acts.find((x) => x.id === args.id); if (!e) throw new Error(`No Act with id ${args.id}. Use search_acts first.`); url = e.u; }
    if (!url) throw new Error("No official text link is held for this Act. Give an official PDF link as url.");
    if (!official(url)) throw new Error("Only official texts can be read: https links on parliament.lk, gov.lk sites or supremecourt.lk.");
    const text = await actText(url);
    const head = `${e ? e.t + " — " + label(e) : "Document"}\nOfficial text: ${url}\n`;
    if (!text || text.length < 200) return head + "The official file has no readable text (it may be a scan). Open it directly at the link above.";
    if (args.section) {
      const s = findSection(text, args.section);
      return head + (s ? `Section ${args.section}, as extracted from the official PDF (check layout against the original):\n\n${s.slice(0, MAX_TEXT)}` : `Section ${args.section} was not found in the text. It may not exist in this Act, or the text layout hides it; try find with words from the section${(e && (e.amd || []).length) ? ", or the amending Acts: " + e.amd.join(", ") : ""}.`);
    }
    if (args.find) {
      const hits = findPhrase(text, args.find);
      return head + (hits.length ? `Passages containing "${args.find}":\n\n${hits.join("\n\n")}` : `"${args.find}" does not appear in this text.`);
    }
    const off = Math.max(0, args.offset || 0);
    const part = text.slice(off, off + MAX_TEXT);
    return head + `Characters ${off}–${off + part.length} of ${text.length}${off + part.length < text.length ? ` (read on with offset ${off + part.length})` : ""}:\n\n${part}`;
  }
  if (name === "search") {
    const hits = search(acts, args.query, 10);
    return JSON.stringify({ results: hits.map((e) => ({ id: e.id, title: `${e.t} — ${label(e)}${e.status === "repealed" ? " (repealed)" : ""}`, url: e.u || `${origin}/acts.html#a${e.bill || e.id}` })) });
  }
  if (name === "fetch") {
    const [aid, sec] = String(args.id || "").split(":");
    const e = acts.find((x) => x.id === aid);
    if (!e) throw new Error(`No Act with id ${aid}. Use search to find the id.`);
    let body = describe(e), note = "";
    if (e.u && official(e.u)) {
      try {
        const text = await actText(e.u);
        if (sec) { const s = findSection(text, sec); body += s ? `\n\nSection ${sec} (official text):\n${s.slice(0, MAX_TEXT)}` : `\n\nSection ${sec} was not found in the official text.`; }
        else body += `\n\nOfficial text${text.length > 40000 ? " (first 40,000 characters; fetch \"" + aid + ":<section>\" for a later section)" : ""}:\n${text.slice(0, 40000)}`;
      } catch (err) { note = err.message; body += `\n\nThe official text could not be read just now (${err.message}). It is at ${e.u}`; }
    }
    return JSON.stringify({ id: args.id, title: `${e.t} — ${label(e)}${sec ? ", section " + sec : ""}`, text: body, url: e.u || `${origin}/acts.html#a${e.bill || e.id}`, metadata: { status: e.status || "unknown", year: e.yr, number: e.no || "", amended_by: e.amd || [], ...(note ? { note } : {}) } });
  }
  throw Object.assign(new Error(`Unknown tool ${name}`), { code: -32602 });
}

async function handle(msg, origin) {
  const { id, method, params = {} } = msg || {};
  const ok = (result) => ({ jsonrpc: "2.0", id, result });
  const err = (code, message) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
  if (!msg || msg.jsonrpc !== "2.0" || typeof method !== "string") return err(-32600, "Invalid request");
  if (id === undefined) return null; // notifications need no reply
  switch (method) {
    case "initialize":
      return ok({
        protocolVersion: VERSIONS.includes(params.protocolVersion) ? params.protocolVersion : VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "sabha-brief", title: "Sabha Brief: Sri Lankan Acts", version: "1.1.0" },
        instructions: INSTRUCTIONS,
      });
    case "ping": return ok({});
    case "tools/list": return ok({ tools: TOOLS });
    case "tools/call":
      try { return ok({ content: [{ type: "text", text: await callTool(params.name, params.arguments || {}, origin) }] }); }
      catch (e) { return e.code ? err(e.code, e.message) : ok({ content: [{ type: "text", text: e.message || String(e) }], isError: true }); }
    default: return err(-32601, `Method not found: ${method}`);
  }
}

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return new Response("Sabha Brief MCP server. Add this address to Claude as a custom connector.", { status: 405, headers: { ...CORS, Allow: "POST, OPTIONS" } });
  let body;
  try { body = await req.json(); } catch { return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400, headers: CORS }); }
  const origin = new URL(req.url).origin;
  const out = Array.isArray(body) ? (await Promise.all(body.map((m) => handle(m, origin)))).filter(Boolean) : await handle(body, origin);
  if (!out || (Array.isArray(out) && !out.length)) return new Response(null, { status: 202, headers: CORS });
  return Response.json(out, { headers: CORS });
};
