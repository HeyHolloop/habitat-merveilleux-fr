#!/usr/bin/env python3
"""Import WordPress posts from studio27interieur.fr into Astro markdown."""
from __future__ import annotations

import hashlib
import html as htmlmod
import json
import re
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from html.parser import HTMLParser

ROOT = Path("/home/hermes/astro-sites/habitat-merveilleux-fr")
SCRATCH = Path("/home/hermes/.hermes/profiles/website-creator/cache/scratch/habitat-merveilleux")
ARTICLES = ROOT / "src/content/articles"
PUBLIC = ROOT / "public"
UA = {"User-Agent": "Mozilla/5.0 HabitatMerveilleuxImporter/1.0"}
OLD_HOSTS = ("www.studio27interieur.fr", "studio27interieur.fr")

CAT_BY_ID = {
    6: ("Décoration", "decoration"),
    7: ("Travaux et bricolage", "travaux-bricolage"),
    8: ("Jardin", "jardin"),
    9: ("Vie pratique", "vie-pratique"),
    10: ("Immobilier", "immobilier"),
    1: None,  # uncategorized — mapped below
}

UNCATEGORIZED_MAP = {
    "depannage-et-reparation-de-vitre-cassee-tout-savoir-sur-la-vitrerie": ("Travaux et bricolage", "travaux-bricolage"),
    "decoration-moderne-creer-interieur-elegant-contemporain": ("Décoration", "decoration"),
}

IMG_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif"}
UPLOAD_RE = re.compile(
    r"""https?://(?:www\.)?studio27interieur\.fr/wp-content/uploads/([^"'?\s<>]+)""",
    re.I,
)
SRCSET_RE = re.compile(r"""(?:srcset|data-srcset)\s*=\s*(['"])(.*?)\1""", re.I | re.S)
ATTR_SRC_RE = re.compile(
    r"""((?:src|data-src|data-lazy-src|data-full-url|href))\s*=\s*(['"])(https?://(?:www\.)?studio27interieur\.fr[^'"]*)\2""",
    re.I,
)
COMMENT_RE = re.compile(r"<!--.*?-->", re.S)
SCRIPT_RE = re.compile(r"<script\b[^>]*>.*?</script>", re.I | re.S)


class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data):
        self.parts.append(data)

    def text(self) -> str:
        return htmlmod.unescape(" ".join(self.parts))


def strip_tags(s: str) -> str:
    p = TextExtractor()
    try:
        p.feed(s or "")
    except Exception:
        return re.sub(r"<[^>]+>", "", s or "")
    return re.sub(r"\s+", " ", p.text()).strip()


def yaml_quote(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)


def get_category(post: dict) -> tuple[str, str]:
    slug = post["slug"]
    ids = post.get("categories") or []
    for cid in ids:
        mapped = CAT_BY_ID.get(cid)
        if mapped:
            return mapped
    if slug in UNCATEGORIZED_MAP:
        return UNCATEGORIZED_MAP[slug]
    return ("Vie pratique", "vie-pratique")


def featured_url(post: dict) -> str | None:
    emb = (post.get("_embedded") or {}).get("wp:featuredmedia") or []
    if emb and isinstance(emb, list) and isinstance(emb[0], dict):
        url = emb[0].get("source_url")
        if url:
            return url
    return None


def first_content_image(html: str) -> str | None:
    m = UPLOAD_RE.search(html or "")
    if m:
        return "https://www.studio27interieur.fr/wp-content/uploads/" + m.group(1)
    m = re.search(r"""<img[^>]+src=['"]([^'"]+)['"]""", html or "", re.I)
    return m.group(1) if m else None


def fetch(url: str, timeout: int = 40) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def download_one(url: str, dest: Path) -> tuple[str, bool, str]:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        return url, True, "exists"
    last_err = ""
    for attempt in range(3):
        try:
            data = fetch(url)
            dest.write_bytes(data)
            return url, True, f"ok {len(data)}"
        except Exception as e:
            last_err = str(e)
            time.sleep(0.6 * (attempt + 1))
    return url, False, last_err


def local_from_upload(rel: str) -> str:
    rel = rel.split("?")[0].split("#")[0]
    rel = urllib.parse_unquote if False else rel
    from urllib.parse import unquote

    rel = unquote(rel)
    rel = rel.lstrip("/")
    return "/images/uploads/" + rel


def collect_upload_urls(html: str, extra: list[str]) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for url in extra:
        if not url:
            continue
        m = UPLOAD_RE.search(url)
        if m:
            mapping[url.split("?")[0]] = local_from_upload(m.group(1))
    for m in UPLOAD_RE.finditer(html or ""):
        full = m.group(0).split("?")[0]
        mapping[full] = local_from_upload(m.group(1))
    return mapping


def rewrite_html(html: str, url_map: dict[str, str], slugs: set[str]) -> str:
    html = COMMENT_RE.sub("", html or "")
    html = SCRIPT_RE.sub("", html)

    def repl_attr(m):
        attr, quote, url = m.group(1), m.group(2), m.group(3)
        base = url.split("?")[0]
        if base in url_map:
            return f"{attr}={quote}{url_map[base]}{quote}"
        mup = UPLOAD_RE.search(url)
        if mup:
            loc = local_from_upload(mup.group(1))
            return f"{attr}={quote}{loc}{quote}"
        return m.group(0)

    html = ATTR_SRC_RE.sub(repl_attr, html)

    def repl_srcset(m):
        quote, val = m.group(1), m.group(2)
        parts = []
        for chunk in val.split(","):
            chunk = chunk.strip()
            if not chunk:
                continue
            bits = chunk.split()
            u = bits[0]
            rest = " ".join(bits[1:])
            base = u.split("?")[0]
            if base in url_map:
                u = url_map[base]
            else:
                mup = UPLOAD_RE.search(u)
                if mup:
                    u = local_from_upload(mup.group(1))
            parts.append((u + (" " + rest if rest else "")).strip())
        return f"srcset={quote}{', '.join(parts)}{quote}"

    html = SRCSET_RE.sub(repl_srcset, html)

    def repl_internal(m):
        url = m.group(0)
        path = m.group(1).strip("/")
        if path in slugs:
            return f"/{path}/"
        return url

    html = re.sub(
        r"https?://(?:www\.)?studio27interieur\.fr/([a-z0-9\-]+)/?",
        repl_internal,
        html,
        flags=re.I,
    )

    cat_map = {
        "/decoration/": "/category/decoration/",
        "/travaux-bricolage/": "/category/travaux-bricolage/",
        "/jardin-2/": "/category/jardin/",
        "/immobilier/": "/category/immobilier/",
        "/vie-pratique/": "/category/vie-pratique/",
        "/jardin/": "/category/vie-pratique/",
        "/category/decoration/": "/category/decoration/",
        "/category/travaux-bricolage/": "/category/travaux-bricolage/",
        "/category/jardin/": "/category/jardin/",
        "/category/immobilier/": "/category/immobilier/",
        "/category/vie-pratique/": "/category/vie-pratique/",
        "/category/jardin-2/": "/category/jardin/",
    }
    for old, new in cat_map.items():
        html = html.replace(f"https://www.studio27interieur.fr{old}", new)
        html = html.replace(f"https://studio27interieur.fr{old}", new)
        html = html.replace(f"http://www.studio27interieur.fr{old}", new)
        html = html.replace(f"http://studio27interieur.fr{old}", new)

    html = html.replace("https://www.studio27interieur.fr/", "/")
    html = html.replace("https://studio27interieur.fr/", "/")
    html = html.replace("http://www.studio27interieur.fr/", "/")
    html = html.replace("http://studio27interieur.fr/", "/")
    return html


def maybe_webp(src_path: Path) -> None:
    if src_path.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
        return
    webp = src_path.with_suffix(".webp")
    if webp.exists():
        return
    import subprocess

    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(src_path), "-q:v", "8", str(webp)],
            check=False,
            capture_output=True,
            timeout=40,
        )
    except Exception:
        pass


def write_article(post: dict, html: str, image: str, cat_label: str, cat_slug: str) -> Path:
    title = strip_tags(post["title"]["rendered"])
    excerpt = strip_tags(post["excerpt"]["rendered"])
    date = post["date"][:10]
    meta = (post.get("meta") or {}).get("_seopress_titles_title") or title
    if not isinstance(meta, str) or not meta.strip():
        meta = title
    body = html.strip()
    md = "\n".join(
        [
            "---",
            f"title: {yaml_quote(title)}",
            f"metaTitle: {yaml_quote(meta)}",
            f"excerpt: {yaml_quote(excerpt)}",
            f"image: {yaml_quote(image)}",
            f"category: {yaml_quote(cat_label)}",
            f"categorySlug: {yaml_quote(cat_slug)}",
            f"date: {date}",
            "featured: false",
            "status: published",
            "isDraft: false",
            "---",
            "",
            f'<div class="hm-prose">',
            body,
            "</div>",
            "",
        ]
    )
    path = ARTICLES / f"{post['slug']}.md"
    path.write_text(md, encoding="utf-8")
    return path


def main() -> None:
    posts = json.loads((SCRATCH / "posts.json").read_text())
    assert len(posts) == 207, len(posts)
    slugs = {p["slug"] for p in posts}
    ARTICLES.mkdir(parents=True, exist_ok=True)
    for old in ARTICLES.glob("*.md"):
        old.unlink()

    jobs: dict[str, Path] = {}
    per_post_maps: list[dict] = []
    failed: list[str] = []
    missing_cover: list[str] = []

    for post in posts:
        html = post["content"]["rendered"]
        feat = featured_url(post)
        extra = [feat] if feat else []
        mapping = collect_upload_urls(html, extra)
        if not feat:
            alt = first_content_image(html)
            if alt:
                extra = [alt]
                mapping.update(collect_upload_urls("", extra))
                feat = alt
        per_post_maps.append({"post": post, "html": html, "map": mapping, "feat": feat})
        for remote, local in mapping.items():
            dest = PUBLIC / local.lstrip("/")
            jobs[remote] = dest

    print(f"images to fetch: {len(jobs)}")
    ok = 0
    with ThreadPoolExecutor(max_workers=8) as ex:
        futs = [ex.submit(download_one, url, dest) for url, dest in jobs.items()]
        for i, fut in enumerate(as_completed(futs), 1):
            url, success, msg = fut.result()
            if success:
                ok += 1
            else:
                failed.append(f"{url} :: {msg}")
            if i % 50 == 0 or i == len(futs):
                print(f"  {i}/{len(futs)} ok={ok} fail={len(failed)}", flush=True)

    covers_converted = 0
    for item in per_post_maps:
        post = item["post"]
        mapping = item["map"]
        html = rewrite_html(item["html"], mapping, slugs)
        feat = item["feat"]
        image = None
        if feat:
            base = feat.split("?")[0]
            image = mapping.get(base)
            if not image:
                m = UPLOAD_RE.search(feat)
                if m:
                    image = local_from_upload(m.group(1))
            if image and image.startswith("http"):
                image = None
        if not image:
            m = re.search(r"""<img[^>]+src=['"](/images/[^'"]+)['"]""", html)
            if m:
                image = m.group(1)
        if not image:
            missing_cover.append(post["slug"])
            image = "/images/accroche.jpg"
        cat_label, cat_slug = get_category(post)
        write_article(post, html, image, cat_label, cat_slug)
        local_file = PUBLIC / image.lstrip("/")
        if local_file.exists():
            maybe_webp(local_file)
            covers_converted += 1

    leftover = []
    for md in ARTICLES.glob("*.md"):
        txt = md.read_text(encoding="utf-8")
        if "studio27interieur.fr" in txt:
            leftover.append(md.name)

    files = sorted(p.name for p in ARTICLES.glob("*.md"))
    report = {
        "articles": len(files),
        "expected": 207,
        "slugs_ok": files == sorted(f"{s}.md" for s in slugs),
        "images_ok": ok,
        "images_fail": failed,
        "missing_cover": missing_cover,
        "leftover_old_host": leftover,
        "covers_seen": covers_converted,
    }
    (SCRATCH / "import-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print("ARTICLES", len(files))
    print("IMAGES_OK", ok, "FAIL", len(failed))
    print("MISSING_COVER", missing_cover)
    print("LEFTOVER_HOST", leftover[:20], "count", len(leftover))
    if failed[:10]:
        print("FAIL_SAMPLE")
        for line in failed[:10]:
            print(" ", line)


if __name__ == "__main__":
    main()
