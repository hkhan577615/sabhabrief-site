# Sabha Brief: site package

Static site. No build step. Upload this folder as it is.

## Files
- index.html (This week), bills.html, gazette.html, about.html: the site
- index.html shows one sitting week at a time: the headline and key decisions, then every item by day,
  each opening to its figures, next step, what a bill changes and its sources. Older weeks are linked
  at the bottom. Links to the retired record.html are redirected here by netlify.toml.
- gazette.html: the Gazette feed (daily.json gzfeed), notices from last week on; 404.html
- Government jobs are a separate site, closingdate.lk, in its own repository (hkhan577615/closingdate.lk).
  Sabha Brief's old /jobs.html, /job/* and /apply.html addresses redirect there (netlify.toml).
- sitemap.xml: Sabha Brief's four pages; job pages are in closingdate.lk's sitemap
- post.html: unlisted page showing the day's draft X and WhatsApp channel posts (daily.json posts) with Copy buttons; X and WhatsApp are not posted automatically (Telegram is, see below)
- daily.json, library.json: the data, replaced every night
- site.css, site.js, favicon.svg, robots.txt
- netlify.toml: tells Netlify to serve the JSON files fresh

## Nightly update
The nightly task replaces daily.json (and library.json when it changes) in the GitHub repo.
Netlify redeploys automatically on each commit. Never edit the HTML by hand on GitHub
unless you also want the change kept; the nightly task only touches the two JSON files.


## Document checker (MCP server)
netlify/functions/mcp.mjs serves an MCP server at /mcp. Readers add https://<this site>/mcp to Claude
as a custom connector, upload a notice or contract in a Claude chat, and Claude checks it against the
official text of the Acts it cites. The server never sees the document: it only looks up Acts in
statutes.json and library.json and reads Act text from parliament.lk, gov.lk or supremecourt.lk.
package.json holds its one dependency (unpdf, to read PDFs); Netlify installs it on deploy.

## Acts index
statutes.json is the reference index of Acts and Ordinances (with summaries of key business Acts).
It is built from official listings by a separate task and is not touched by the nightly update.


## Telegram channel (daily message)
netlify/functions/telegram-daily.mjs is a Netlify scheduled function. Every day at 7.30 am Sri Lanka time
(02:00 UTC, set in its `config.schedule`) it reads the live daily.json, library.json and statutes.json and
posts one message to the Telegram channel. The message is built in netlify/lib/telegram.mjs:
- Last night's update is fresh (posts.date is today or yesterday): that update, from posts.tg if the nightly
  task writes one, otherwise posts.wa, otherwise brief.day. Same format: a title line, "- " bullets, "Next:".
- Sunday: the week in review (brief.week), with a nudge to forward it.
- Parliament sits today but the update is not in: today's agenda (days) and what is coming up (keyDates).
- Otherwise a rotating feature: a bill explained (library.json, watched bills first), the week's Gazette
  notices (gzfeed), a key Act in plain words (statutes.json) with the document checker, or a term in plain words.
Each message has buttons back to the right page, tagged utm_source=telegram&utm_content=<kind>.

Setup, once:
1. In Telegram, create a bot with @BotFather and copy its token. Add the bot to the channel as an admin
   allowed to post messages.
2. In Netlify, Site configuration > Environment variables, add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID
   (the channel's @username, or its numeric id starting -100 for a private channel). Redeploy.
3. Optional: TELEGRAM_DRY_RUN=1 logs the message in the function log instead of sending it.

Preview locally: `node scripts/telegram.mjs` (today), `--date 2026-11-22`, `--all 14` (two weeks of rotation).
Send one now: `TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... node scripts/telegram.mjs --send`.
