#!/usr/bin/env python3
"""Build one page per vacancy (job/<slug>.html) and sitemap.xml from jobs.json.

Run from the site folder (closingdate/) after jobs.json changes:  python3 scripts/build_jobs.py
It gives every job a stable slug (field "s"), rewrites the job/ folder and sitemap.xml,
and touches nothing else. Standard library only.
"""
import datetime, html, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://closingdate.lk"
PART = {"I (IIA)": "Part I, Section II(A)", "IV(A)": "Part IV(A), provincial councils",
        "IV(B)": "Part IV(B), local government", "Extraordinary": "Gazette Extraordinary"}
EDU = {"ol": "G.C.E. O/L", "al": "G.C.E. A/L", "dip": "Diploma or NVQ", "deg": "A degree",
       "prof": "A specific professional qualification"}
esc = lambda s: html.escape(str(s or ""), quote=True)


def dmy(iso):
    d = datetime.date.fromisoformat(iso)
    return f"{d.day} {d.strftime('%B %Y')}"


def slug(j):
    base = re.sub(r"[^a-z0-9]+", "-", (j["t"] + " " + j["org"]).lower()).strip("-")[:70].strip("-")
    return f"{base}-{j['id'].lower()}"


def notice_link(j):
    if j["part"] == "Employer":
        return f'<a href="{esc(j["u"])}" target="_blank" rel="noopener">{esc(j["org"])} website</a>'
    return (f'<a href="{esc(j["u"])}#page={j["p"]}" target="_blank" rel="noopener">Gazette of {dmy(j["g"])}, '
            f'{esc(PART.get(j["part"], j["part"]))}, page {j["p"]} ({esc(j.get("lang", "Sinhala"))})</a>')


def timeline(j, today):
    steps = [(j["g"], "Advertised" if j["part"] != "Employer" else "Posted by the employer")]
    steps += [(e["d"], e["l"]) for e in j.get("ev", [])]
    steps.append((j["close"], "Applications close" if j["close"] >= today else "Applications closed"))
    steps.sort(key=lambda x: x[0])
    out = [f'<li class="{"done" if d <= today else "todo"}"><time datetime="{d}">{dmy(d)}</time><span>{esc(l)}</span></li>'
           for d, l in steps]
    nxt = j.get("next") or ("No exam date, result or interview list published yet" if j["close"] < today else "")
    if nxt:
        out.append(f'<li class="todo"><time>Next</time><span>{esc(nxt)}</span></li>')
    return '<ol class="tl">' + "".join(out) + "</ol>"


def job_ld(j):
    desc = ". ".join(x for x in [
        f"{j['t']} at {j['org']}", f"{j['n']} posts" if j.get("n") else "", j.get("who", ""),
        f"Salary: {j['pay']}" if j.get("pay") else "", f"Age limit: {j['age']}" if j.get("age") else "",
        f"How to apply: {j['how']}", "Check the official notice before applying"] if x)
    ld = {"@context": "https://schema.org", "@type": "JobPosting", "title": j["t"], "description": desc,
          "datePosted": j["g"], "validThrough": j["close"] + "T23:59:59+05:30", "directApply": False,
          "hiringOrganization": {"@type": "Organization", "name": j["org"]},
          "jobLocation": {"@type": "Place", "address": {"@type": "PostalAddress", "addressCountry": "LK",
                          **({"addressRegion": j["prov"] + " Province"} if j.get("prov") else {})}}}
    basis = j.get("basis", "")
    ld["employmentType"] = "CONTRACTOR" if basis == "Contract" else "TEMPORARY" if basis in ("Temporary", "Daily paid") else "FULL_TIME"
    m = re.match(r"Rs\. ([\d,]+) to Rs\. ([\d,]+) a month", j.get("pay", ""))
    if m:
        ld["baseSalary"] = {"@type": "MonetaryAmount", "currency": "LKR", "value": {
            "@type": "QuantitativeValue", "minValue": int(m[1].replace(",", "")),
            "maxValue": int(m[2].replace(",", "")), "unitText": "MONTH"}}
    return json.dumps(ld, ensure_ascii=False).replace("</", "<\\/")


def page(j, today, head_links, nav, foot, forms):
    is_open = j["close"] >= today
    rows = [("Employer", j["org"]), ("Posts", j.get("n")), ("Salary", j.get("pay")), ("Age limit", j.get("age")),
            ("Minimum education", EDU.get(j.get("edu", ""))), ("Where", j.get("where")),
            ("Who can apply", j.get("who")), ("How to apply", j["how"]), ("Basis", j.get("basis"))]
    dl = "".join(f"<dt>{esc(k)}</dt><dd>{esc(v)}</dd>" for k, v in rows if v)
    state = f"Closes {dmy(j['close'])}" if is_open else f"Closed {dmy(j['close'])}"
    title = f"{j['t']}, {j['org']}: {state[0].lower() + state[1:]}"
    desc = f"{j['t']} at {j['org']}. {state}." + (f" {j['n']} posts." if j.get("n") else "") + (f" {j['pay']}." if j.get("pay") else "") + " Salary, age limit, how to apply and the official notice."
    ld = f'<script type="application/ld+json">{job_ld(j)}</script>' if is_open else ""
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{esc(title)} · Closing Date</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{SITE}/job/{j['s']}.html">
<meta property="og:site_name" content="Closing Date">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:type" content="article">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#F4F6F5">
{head_links}
<link rel="stylesheet" href="/jobs.css">
{ld}
</head>
<body>
{nav}
<main class="wrap" data-page="jobs">
  <header class="ph">
    <p class="kicker"><a href="/">Government jobs</a> · {esc(j['cat'])}</p>
    <h1 class="jp-h">{esc(j['t'])}</h1>
    {f'<p class="js" lang="si">{esc(j["si"])}</p>' if j.get("si") else ""}
    <p class="dek">{esc(j['org'])}. <b class="{'jp-open' if is_open else 'jp-closed'}">{esc(state)}</b>.</p>
  </header>
  <section class="jp">
    <div>
      <h2 class="blk-h">The post</h2>
      <dl class="jp-dl">{dl}</dl>
      {f'<p><a class="arrow" href="/apply.html?j={j["id"]}">Print the application form</a></p>' if is_open and j["id"] in forms else ""}
      <p class="src">Official notice: {notice_link(j)}</p>
      <p class="cap">Summarised from the official notice, which is the authoritative text. A field that is missing here is not stated plainly in the notice. Check the notice before you apply. No government job requires a payment to an agent.</p>
    </div>
    <aside>
      <h2 class="blk-h">Where this recruitment stands</h2>
      {timeline(j, today)}
      <p><a class="arrow" href="/">All open government jobs</a></p>
    </aside>
  </section>
</main>
{foot}
<script src="/site.js"></script>
</body>
</html>
"""


def main():
    data = json.load(open(os.path.join(ROOT, "jobs.json"), encoding="utf-8"))
    today = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=5, minutes=30))).date().isoformat()
    for j in data["jobs"]:
        j.setdefault("s", slug(j))
    json.dump(data, open(os.path.join(ROOT, "jobs.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    try:
        forms = json.load(open(os.path.join(ROOT, "forms.json"), encoding="utf-8"))
    except (OSError, ValueError):
        forms = {}
    src = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
    absolute = lambda s: re.sub(r'(href|src)="(?!https?:|/|#|mailto:)([^"]+)"', r'\1="/\2"', s)
    head_links = absolute("\n".join(re.findall(r'<link rel="(?:icon|preconnect|stylesheet)"[^>]*>', src)))
    nav = absolute(re.search(r"<header class=\"mast\">.*?</nav>", src, re.S).group(0))
    foot = absolute(re.search(r"<footer class=\"foot\">.*?</footer>", src, re.S).group(0))

    out = os.path.join(ROOT, "job")
    os.makedirs(out, exist_ok=True)
    keep = set()
    for j in data["jobs"]:
        name = j["s"] + ".html"
        keep.add(name)
        open(os.path.join(out, name), "w", encoding="utf-8").write(page(j, today, head_links, nav, foot, forms))
    for f in os.listdir(out):
        if f.endswith(".html") and f not in keep:
            os.remove(os.path.join(out, f))

    urls = [(f"{SITE}/", data["updated"])]
    urls += [(f"{SITE}/job/{j['s']}.html", j.get("mod") or j["g"]) for j in data["jobs"]]
    xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    xml += [f"<url><loc>{esc(u)}</loc>{f'<lastmod>{m}</lastmod>' if m else ''}</url>" for u, m in urls]
    xml.append("</urlset>")
    open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8").write("\n".join(xml) + "\n")
    print(f"{len(keep)} job pages, {len(urls)} sitemap URLs")


if __name__ == "__main__":
    sys.exit(main())
