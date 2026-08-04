#!/usr/bin/env python3
"""Generate the formatted Boarding Rush model guide from MODEL.md."""

from __future__ import annotations

import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODEL = ROOT / "MODEL.md"
OUTPUT = ROOT / "model.html"
VERSION_MODULE = ROOT / "src" / "js" / "version.js"


def read_app_version() -> str:
    source = VERSION_MODULE.read_text(encoding="utf-8")
    match = re.search(r'APP_VERSION\s*=\s*"([^"]+)"', source)
    if not match:
        raise RuntimeError("Could not read APP_VERSION from src/js/version.js")
    return match.group(1)


def slugify(text: str, used: dict[str, int]) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "section"
    count = used.get(base, 0)
    used[base] = count + 1
    return base if count == 0 else f"{base}-{count + 1}"


def inline(text: str) -> str:
    rendered = html.escape(text, quote=True)
    placeholders: list[str] = []

    def stash(fragment: str) -> str:
        placeholders.append(fragment)
        return f"\x00{len(placeholders) - 1}\x00"

    rendered = re.sub(
        r"`([^`]+)`",
        lambda match: stash(f"<code>{match.group(1)}</code>"),
        rendered,
    )
    rendered = re.sub(
        r"\[([^\]]+)\]\(([^)]+)\)",
        lambda match: stash(f'<a href="{match.group(2)}">{match.group(1)}</a>'),
        rendered,
    )
    rendered = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", rendered)
    rendered = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", rendered)
    for index, fragment in enumerate(placeholders):
        rendered = rendered.replace(f"\x00{index}\x00", fragment)
    return rendered


def split_table_row(line: str) -> list[str]:
    value = line.strip()
    if value.startswith("|"):
        value = value[1:]
    if value.endswith("|"):
        value = value[:-1]
    return [cell.strip() for cell in value.split("|")]


def is_table_separator(line: str) -> bool:
    cells = split_table_row(line)
    return bool(cells) and all(
        re.fullmatch(r":?-{3,}:?", cell.replace(" ", "")) for cell in cells
    )


def render_markdown(markdown: str) -> tuple[str, list[tuple[int, str, str]]]:
    lines = markdown.splitlines()
    output: list[str] = []
    headings: list[tuple[int, str, str]] = []
    used_slugs: dict[str, int] = {}
    index = 0

    def starts_block(line: str, following: str = "") -> bool:
        stripped = line.strip()
        return (
            not stripped
            or stripped.startswith("```")
            or bool(re.match(r"^#{1,6}\s+", stripped))
            or bool(re.match(r"^[-*]\s+", stripped))
            or bool(re.match(r"^\d+\.\s+", stripped))
            or (following and "|" in stripped and is_table_separator(following))
        )

    while index < len(lines):
        line = lines[index]
        stripped = line.strip()
        if not stripped:
            index += 1
            continue

        if stripped.startswith("```"):
            language = stripped[3:].strip()
            index += 1
            code_lines: list[str] = []
            while index < len(lines) and not lines[index].strip().startswith("```"):
                code_lines.append(lines[index])
                index += 1
            index += 1
            language_class = (
                f' class="language-{html.escape(language, quote=True)}"'
                if language
                else ""
            )
            output.append(
                f"<pre><code{language_class}>"
                + html.escape("\n".join(code_lines))
                + "</code></pre>"
            )
            continue

        heading_match = re.match(r"^(#{1,6})\s+(.+)$", stripped)
        if heading_match:
            level = len(heading_match.group(1))
            title = heading_match.group(2).strip()
            slug = slugify(re.sub(r"[`*_]", "", title), used_slugs)
            headings.append((level, title, slug))
            output.append(f'<h{level} id="{slug}">{inline(title)}</h{level}>')
            index += 1
            continue

        if (
            index + 1 < len(lines)
            and "|" in stripped
            and is_table_separator(lines[index + 1])
        ):
            headers = split_table_row(line)
            index += 2
            rows: list[list[str]] = []
            while index < len(lines) and "|" in lines[index] and lines[index].strip():
                rows.append(split_table_row(lines[index]))
                index += 1
            output.append('<div class="table-wrap"><table><thead><tr>')
            output.extend(f"<th>{inline(cell)}</th>" for cell in headers)
            output.append("</tr></thead><tbody>")
            for row in rows:
                padded = row + [""] * (len(headers) - len(row))
                output.append("<tr>")
                output.extend(f"<td>{inline(cell)}</td>" for cell in padded[: len(headers)])
                output.append("</tr>")
            output.append("</tbody></table></div>")
            continue

        unordered = re.match(r"^[-*]\s+(.+)$", stripped)
        ordered = re.match(r"^\d+\.\s+(.+)$", stripped)
        if unordered or ordered:
            tag = "ul" if unordered else "ol"
            pattern = r"^[-*]\s+(.+)$" if unordered else r"^\d+\.\s+(.+)$"
            items: list[str] = []
            while index < len(lines):
                match = re.match(pattern, lines[index].strip())
                if not match:
                    break
                items.append(match.group(1))
                index += 1
            output.append(f"<{tag}>")
            output.extend(f"<li>{inline(item)}</li>" for item in items)
            output.append(f"</{tag}>")
            continue

        paragraph = [stripped]
        index += 1
        while index < len(lines):
            following = lines[index + 1] if index + 1 < len(lines) else ""
            if starts_block(lines[index], following):
                break
            paragraph.append(lines[index].strip())
            index += 1
        output.append("<p>" + inline(" ".join(paragraph)) + "</p>")

    return "\n".join(output), headings


def build() -> None:
    version = read_app_version()
    article, headings = render_markdown(MODEL.read_text(encoding="utf-8"))
    toc_items = []
    for level, title, slug in headings:
        if level not in (2, 3):
            continue
        css_class = "toc-sub" if level == 3 else ""
        toc_items.append(
            f'<li class="{css_class}"><a href="#{slug}">{inline(title)}</a></li>'
        )
    toc = "\n".join(toc_items)
    page = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Detailed assumptions, formulas, rules, measurements, and omissions for the Boarding Rush aircraft boarding simulator.">
<title>How Boarding Rush Works — Model Guide</title>
<style>
:root{{color-scheme:dark;--bg:#07111f;--panel:#0e1c2e;--ink:#e8f0ff;--muted:#9eb0c9;--line:#29405f;--accent:#63d7ff}}
*{{box-sizing:border-box}}
html{{scroll-behavior:smooth}}
body{{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:radial-gradient(circle at 12% -10%,rgba(80,157,255,.22),transparent 34rem),var(--bg);color:var(--ink)}}
a{{color:#9fdfff}}
.shell{{max-width:1320px;margin:0 auto;padding:24px}}
.hero{{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:24px;align-items:start;padding:24px;border:1px solid var(--line);border-radius:20px;background:linear-gradient(160deg,rgba(19,36,58,.98),rgba(10,24,41,.98))}}
.eyebrow{{margin:0 0 7px;color:var(--accent);font-size:.75rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}}
h1{{margin:0;font-size:clamp(2rem,5vw,4rem);letter-spacing:-.05em;line-height:1}}
.hero p{{max-width:780px;color:var(--muted);line-height:1.55}}
.hero-actions{{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}}
.button{{display:inline-flex;align-items:center;gap:7px;padding:9px 12px;border:1px solid #456889;border-radius:10px;background:#102943;color:#eaf8ff;text-decoration:none;font-weight:700}}
.version{{display:grid;justify-items:end;gap:5px;padding:11px 13px;border:1px solid #456889;border-radius:14px;background:#081625}}
.version span{{color:var(--muted);font-size:.68rem;text-transform:uppercase;letter-spacing:.1em}}
.version strong{{color:#9ee8ff;font-size:1.05rem;font-variant-numeric:tabular-nums}}
.layout{{display:grid;grid-template-columns:270px minmax(0,1fr);gap:22px;margin-top:22px}}
nav{{position:sticky;top:18px;align-self:start;max-height:calc(100vh - 36px);overflow:auto;padding:16px;border:1px solid var(--line);border-radius:16px;background:rgba(10,24,41,.96)}}
nav h2{{margin:0 0 10px;font-size:.82rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}}
nav ol{{list-style:none;padding:0;margin:0;display:grid;gap:3px}}
nav a{{display:block;padding:6px 8px;border-radius:8px;color:#c6def3;text-decoration:none;font-size:.78rem;line-height:1.3}}
nav a:hover{{background:#132e49;color:white}}
nav .toc-sub a{{padding-left:20px;color:#8faac3;font-size:.72rem}}
article{{min-width:0;padding:22px clamp(17px,4vw,44px);border:1px solid var(--line);border-radius:18px;background:linear-gradient(180deg,rgba(19,36,58,.97),rgba(10,24,41,.97));box-shadow:0 16px 50px rgba(0,0,0,.2)}}
article h1{{display:none}}
article h2{{margin:48px 0 13px;padding-top:8px;font-size:1.45rem;letter-spacing:-.02em;border-top:1px solid #29405f}}
article h2:first-of-type{{margin-top:0;border-top:0}}
article h3{{margin:28px 0 9px;color:#dff7ff;font-size:1.05rem}}
article p,article li{{color:#c1cfdf;line-height:1.65}}
article li+li{{margin-top:5px}}
code{{padding:2px 5px;border-radius:5px;background:#081625;color:#bcecff}}
pre{{overflow:auto;padding:14px;border:1px solid #29405f;border-radius:12px;background:#061321}}
pre code{{padding:0;background:transparent}}
.table-wrap{{overflow:auto;margin:14px 0 22px;border:1px solid #29405f;border-radius:12px}}
table{{width:100%;border-collapse:collapse;font-size:.87rem}}
th,td{{padding:10px 11px;border-bottom:1px solid #243d5a;text-align:left;vertical-align:top}}
th{{background:#0b1b2d;color:#bcecff}}
tr:last-child td{{border-bottom:0}}
footer{{padding:22px 0 4px;text-align:center;color:#71869f;font-size:.76rem}}
@media(max-width:900px){{.hero{{grid-template-columns:1fr}}.version{{justify-items:start}}.layout{{grid-template-columns:1fr}}nav{{position:static;max-height:none}}}}
@media(max-width:560px){{.shell{{padding:12px}}.hero,article{{padding:17px}}nav{{display:none}}}}
</style>
</head>
<body>
<div class="shell">
<header class="hero">
  <div>
    <p class="eyebrow">Boarding Rush model guide</p>
    <h1>How the boarding race works</h1>
    <p>A transparent guide to the passengers, parties, queue rules, movement, luggage, delays, measurements, and deliberate simplifications behind the simulation.</p>
    <div class="hero-actions">
      <a class="button" href="https://bortlip.github.io/SharedInfo/simulations/group-aware-boarding/">✈ Open simulator</a>
      <a class="button" href="https://github.com/bortlip/SharedInfo/blob/main/simulations/group-aware-boarding/MODEL.md">View Markdown source</a>
    </div>
  </div>
  <div class="version"><span>Model version</span><strong>v{html.escape(version)}</strong></div>
</header>
<div class="layout">
  <nav aria-label="Model guide contents"><h2>On this page</h2><ol>{toc}</ol></nav>
  <article>{article}</article>
</div>
<footer>Boarding Rush v{html.escape(version)} · This guide is generated from the canonical MODEL.md specification.</footer>
</div>
</body>
</html>
'''
    OUTPUT.write_text(page, encoding="utf-8")


if __name__ == "__main__":
    build()
