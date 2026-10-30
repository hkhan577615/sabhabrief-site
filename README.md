# Sabha Brief: site package

Static site. No build step. Upload this folder as it is.

## Files
- index.html (This week), bills.html, checker.html (contract checker, coming soon), gazette.html, about.html: the site
- index.html shows one sitting week at a time: the headline and key decisions, then every item by day,
  each opening to its figures, next step, what a bill changes and its sources. Older weeks are linked
  at the bottom. Links to the retired record.html are redirected here by netlify.toml.
- alerts.html: sign-up form (Netlify Forms, form name "alerts"); thanks.html after sign-up; 404.html
- daily.json, library.json: the data, replaced every night
- site.css, site.js, favicon.svg, robots.txt
- netlify.toml: tells Netlify to serve the JSON files fresh

## Nightly update
The nightly task replaces daily.json (and library.json when it changes) in the GitHub repo.
Netlify redeploys automatically on each commit. Never edit the HTML by hand on GitHub
unless you also want the change kept; the nightly task only touches the two JSON files.

## Sign-ups
Netlify dashboard > your site > Forms > alerts. Export as CSV from there.
Turn on email notifications under Forms > Form notifications.

## Document checker (MCP server)
netlify/functions/mcp.mjs serves an MCP server at /mcp. Readers add https://<this site>/mcp to Claude
as a custom connector, upload a notice or contract in a Claude chat, and Claude checks it against the
official text of the Acts it cites. The server never sees the document: it only looks up Acts in
statutes.json and library.json and reads Act text from parliament.lk, gov.lk or supremecourt.lk.
package.json holds its one dependency (unpdf, to read PDFs); Netlify installs it on deploy.

## Acts index
statutes.json is the reference index of Acts and Ordinances (with summaries of key business Acts).
It is built from official listings by a separate task and is not touched by the nightly update.
