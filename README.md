# Sabha Brief: site package

Static site. No build step. Upload this folder as it is.

## Files
- index.html (This week), bills.html, gazette.html, laws.html, about.html: the site
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
