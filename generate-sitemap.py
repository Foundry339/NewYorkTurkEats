#!/usr/bin/env python3
"""
Regenerates sitemap.xml from the live restaurant sheet.

The restaurant directory is entirely client-rendered (app.js fetches the
sheet and builds the DOM after page load), so search engines have no way
to discover the individual restaurant.html?slug=... pages from the raw
HTML alone. This script lists them explicitly.

Run it whenever restaurants are added or removed in bulk:

    python3 generate-sitemap.py

It fetches the same published-CSV URL as data.js, so it always reflects
whatever is currently in the sheet.
"""

import csv
import io
import re
import subprocess
from datetime import date

SITE_URL = "https://newyorkturkeats.com"
CSV_URL = (
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTqiAuXaS7947xRntXY5LAdzDqHNuZnjJmaJNquc-68FFMkpGhkWVvarPN-W_GULo5YY4HDPsG6xyAk"
    "/pub?output=csv"
)


def slugify(name):
    # Mirrors slugify() in common.js exactly, so slugs match the live site.
    s = name.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"^-+|-+$", "", s)
    return s


def iso_date_from_posted(date_str):
    # "7/9/2026" -> "2026-07-09", mirrors isoDateFromPosted() in common.js.
    try:
        month, day, year = [p.strip() for p in date_str.split("/")]
        return f"{year}-{int(month):02d}-{int(day):02d}"
    except (ValueError, AttributeError):
        return None


def fetch_restaurants():
    # Shells out to curl rather than urllib — sidesteps local Python SSL
    # cert-store quirks (common on macOS Python.org installs) using the
    # same tool the rest of this project's tooling already relies on.
    result = subprocess.run(
        ["curl", "-sL", CSV_URL], capture_output=True, check=True
    )
    text = result.stdout.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))
    restaurants = []
    for row in reader:
        name = (row.get("Restaurant") or "").strip()
        if not name:
            continue
        restaurants.append(
            {
                "slug": slugify(name),
                "last_visited": iso_date_from_posted(row.get("Date Posted") or ""),
            }
        )
    return restaurants


def build_sitemap(restaurants):
    today = date.today().isoformat()
    urls = [
        (f"{SITE_URL}/", "1.0", today),
        (f"{SITE_URL}/map.html", "0.6", today),
        (f"{SITE_URL}/stats.html", "0.6", today),
    ]
    for r in restaurants:
        urls.append(
            (
                f"{SITE_URL}/restaurant.html?slug={r['slug']}",
                "0.8",
                r["last_visited"] or today,
            )
        )

    entries = []
    for loc, priority, lastmod in urls:
        entries.append(
            f"  <url>\n"
            f"    <loc>{loc}</loc>\n"
            f"    <lastmod>{lastmod}</lastmod>\n"
            f"    <priority>{priority}</priority>\n"
            f"  </url>"
        )

    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(entries)
        + "\n</urlset>\n"
    )


def main():
    restaurants = fetch_restaurants()
    xml = build_sitemap(restaurants)
    with open("sitemap.xml", "w", encoding="utf-8") as f:
        f.write(xml)
    print(f"wrote sitemap.xml with {len(restaurants) + 3} URLs ({len(restaurants)} restaurants)")


if __name__ == "__main__":
    main()
