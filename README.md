# Sabha Brief: site package

Static site. No build step. Upload this folder as it is.

## Files
- index.html (This week), bills.html, gazette.html, about.html: the site
- index.html shows one sitting week at a time: the headline and key decisions, then every item by day,
  each opening to its figures, next step, what a bill changes and its sources. Older weeks are linked
  at the bottom. Links to the retired record.html are redirected here by netlify.toml.
- gazette.html: the Gazette feed (daily.json gzfeed), notices from last week on; 404.html
- jobs.html, jobs.css: government vacancies (jobs.json) from the Gazette and employers' careers pages (jobs-sources.json): open posts by closing date, a "What can I apply for?" match, and closed recruitments still being followed
- apply.html, forms.json: the printable application form for a post, copied from the specimen in its official notice and laid out on A4 as the notice requires (forms.json is keyed by job id; see the block types in apply.html)
- job/: one page per vacancy, and sitemap.xml, both written by scripts/build_jobs.py from jobs.json (run by the twice-weekly jobs task; never edit by hand)
- post.html: unlisted page showing the day's draft X and WhatsApp channel posts (daily.json posts) with Copy buttons; nothing is posted automatically
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
