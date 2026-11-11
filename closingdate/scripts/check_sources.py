#!/usr/bin/env python3
"""Check every employer careers page in jobs-sources.json from this computer.

Many gov.lk servers drop connections from cloud servers abroad, so run this from a
computer in Sri Lanka. Run it from the site folder (closingdate/):

    python3 scripts/check_sources.py              # check all, update jobs-sources.json
    python3 scripts/check_sources.py --save pages # also save each page that loads, to read later
    python3 scripts/check_sources.py --only-failed

It updates "status" for each employer and the "checked" date, and touches nothing else:
  unreachable  connection refused, reset or timed out, or a 5xx error
  blocked      the server answered 401, 403 or 429
  to review    the page now loads but was not readable before: open it and set
               "ok" (it lists vacancies) or "no careers page found"
A page that was already "ok" or "no careers page found" keeps that status when it loads.
Standard library only.
"""
import argparse, concurrent.futures as cf, datetime, json, os, re, socket, ssl, sys, urllib.error, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/124.0 Safari/537.36")


def fetch(url, timeout):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,*/*;q=0.8",
                                               "Accept-Language": "en,si;q=0.8,ta;q=0.6"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read(5_000_000)
    except urllib.error.HTTPError as e:
        return e.code, b""
    except ssl.SSLCertVerificationError:
        # Some gov.lk sites have broken certificates; note it but still try to read the page.
        ctx = ssl.create_default_context()
        ctx.check_hostname, ctx.verify_mode = False, ssl.CERT_NONE
        try:
            with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
                return r.status, r.read(5_000_000)
        except Exception:
            return None, b""
    except (urllib.error.URLError, socket.timeout, ConnectionError, OSError):
        return None, b""


def new_status(old, code):
    if code is None or code >= 500:
        return "unreachable"
    if code in (401, 403, 429):
        return "blocked"
    if code >= 400:
        return "unreachable"
    return old if old in ("ok", "no careers page found") else "to review"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--save", metavar="DIR", help="save each page that loads into DIR")
    ap.add_argument("--only-failed", action="store_true", help="only recheck unreachable and blocked pages")
    ap.add_argument("--timeout", type=float, default=25)
    ap.add_argument("--workers", type=int, default=8)
    a = ap.parse_args()

    path = os.path.join(ROOT, "jobs-sources.json")
    data = json.load(open(path, encoding="utf-8"))
    emp = data["employers"]
    todo = [e for e in emp if not a.only_failed or e.get("status") in ("unreachable", "blocked")]
    if a.save:
        os.makedirs(a.save, exist_ok=True)

    def run(e):
        code, body = fetch(e["page"], a.timeout)
        return e, code, body

    changed = {}
    with cf.ThreadPoolExecutor(a.workers) as ex:
        for i, (e, code, body) in enumerate(ex.map(run, todo), 1):
            old, st = e.get("status"), new_status(e.get("status"), code)
            e["status"] = st
            if st != old:
                changed[(old, st)] = changed.get((old, st), 0) + 1
            if a.save and body:
                name = re.sub(r"[^a-z0-9]+", "-", e["name"].lower()).strip("-")[:80] + ".html"
                open(os.path.join(a.save, name), "wb").write(body)
            print(f"[{i}/{len(todo)}] {code or '---'} {st:<22} {e['page']}", flush=True)

    data["checked"] = datetime.date.today().isoformat()
    json.dump(data, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    count = {}
    for e in emp:
        count[e["status"]] = count.get(e["status"], 0) + 1
    print("\nNow:", ", ".join(f"{v} {k}" for k, v in sorted(count.items(), key=lambda x: -x[1])))
    for (o, n), v in sorted(changed.items(), key=lambda x: -x[1]):
        print(f"  {v} changed from {o} to {n}")
    if count.get("to review"):
        print('Open the "to review" pages and set each to "ok" or "no careers page found".')


if __name__ == "__main__":
    sys.exit(main())
