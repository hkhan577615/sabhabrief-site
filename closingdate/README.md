# Closing Date: closingdate.lk

Every open government job in Sri Lanka, sorted by closing date. Static site, no build step.
It used to be the Jobs section of Sabha Brief and is now its own site, deployed from this folder.

## Files
- index.html, jobs.css: open vacancies (jobs.json) by closing date, the "What can I apply for?" match,
  closed recruitments still being followed, and the employers we check (jobs-sources.json)
- apply.html, forms.json: printable application forms copied from the official notices (keyed by job id)
- job/ and sitemap.xml: one page per vacancy, written by scripts/build_jobs.py from jobs.json. Never edit by hand.
- site.css, site.js: copies of Sabha Brief's shared styles and helpers
- 404.html, favicon.svg, robots.txt, netlify.toml

## Netlify set-up (once)
1. Add new site, import from Git, choose this same repository.
2. Base directory: `closingdate`. Build command: leave empty. Publish directory: `closingdate`.
3. Domain management: add `closingdate.lk` and `www.closingdate.lk`, then set the DNS records Netlify shows
   at the registrar where you bought the domain. Netlify issues the HTTPS certificate itself.
4. Sabha Brief's netlify.toml already redirects its old job addresses here.

netlify.toml skips a redeploy when a commit changes nothing in this folder, so Sabha Brief's nightly
commits do not rebuild this site, and Sabha Brief skips commits that only touch this folder.

## Updating the jobs (run on a computer in Sri Lanka)
Many gov.lk sites refuse connections from cloud servers abroad, so the checks run locally. From this folder:

    python3 scripts/check_sources.py --save pages   # check all 360 employer pages, save those that load
    # read the saved pages and the new Friday Gazette, then add or update posts in jobs.json
    python3 scripts/build_jobs.py                    # rebuild job/ and sitemap.xml
    git add -A . && git commit -m "Jobs update YYYY-MM-DD" && git push

check_sources.py marks a page that loads for the first time as "to review": open it and set its status to
"ok" (it lists vacancies) or "no careers page found". Keep the pages/ folder out of git.
