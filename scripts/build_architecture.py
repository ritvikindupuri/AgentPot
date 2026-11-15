#!/usr/bin/env python3
"""Build docs/architecture.svg and docs/architecture.png in the Grok Bot README style."""
from __future__ import annotations

import math
import re
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ICONS = ROOT / "docs" / "icons"
OUT_SVG = ROOT / "docs" / "architecture.svg"
OUT_PNG = ROOT / "docs" / "architecture.png"

YELLOW = "#F5C451"
ORANGE = "#F97316"
RED = "#FB2B3E"
GREEN = "#22C55E"
LINE = "#9AA0A6"
PANEL = "#F7F8F9"
BORDER = "#E4E6EA"
ACCENT_BOX = "#FFF4E8"
ACCENT_EDGE = "#F3D5B0"
ACCENT_TEXT = "#C2410C"
BG = "#FFFFFF"
W, H = 1180, 1080


def prefix_ids(svg: str, prefix: str) -> str:
    svg = re.sub(r'\bid="([^"]+)"', lambda m: f'id="{prefix}{m.group(1)}"', svg)
    svg = re.sub(r"url\(#([^)]+)\)", lambda m: f"url(#{prefix}{m.group(1)})", svg)
    return svg


def icon_inner(name: str) -> str:
    raw = (ICONS / f"{name}.svg").read_text()
    raw = re.sub(r"<\?xml[^>]*>", "", raw)
    raw = re.sub(r"<svg[^>]*>", "", raw, count=1)
    raw = raw.replace("</svg>", "")
    return prefix_ids(raw, f"{name}-")


def icon_at(name: str, x: float, y: float, size: float, label: str = "") -> str:
    inner = icon_inner(name)
    lab = f'<text class="icon-label" y="{size/2 + 16:.1f}" text-anchor="middle">{label}</text>' if label else ""
    return f'''  <g transform="translate({x:.1f},{y:.1f})">
    <g transform="translate({-size/2:.1f},{-size/2:.1f}) scale({size/24:.4f})">{inner}</g>
    {lab}
  </g>'''


def person_icon(x: float, y: float) -> str:
    return f'''  <g transform="translate({x},{y})">
    <circle cx="0" cy="-10" r="9" fill="#6B7280"/>
    <path d="M-16 18c0-9 7-14 16-14s16 5 16 14" fill="#6B7280"/>
  </g>'''


def eyes() -> str:
    return (
        '<rect x="-11" y="-8" width="7" height="16" rx="3.5" fill="#FFFFFF"/>'
        '<rect x="4" y="-8" width="7" height="16" rx="3.5" fill="#FFFFFF"/>'
    )


def rounded_hex_path(radius: float = 36, corner: float = 7) -> str:
    verts = [
        (radius * math.cos(math.radians(i * 60 - 30)), radius * math.sin(math.radians(i * 60 - 30)))
        for i in range(6)
    ]
    parts = []
    for i in range(6):
        prev, cur, nxt = verts[i - 1], verts[i], verts[(i + 1) % 6]

        def unit(a, b):
            dx, dy = a[0] - b[0], a[1] - b[1]
            mag = math.hypot(dx, dy) or 1
            return (dx / mag, dy / mag)

        p1 = (cur[0] + unit(prev, cur)[0] * corner, cur[1] + unit(prev, cur)[1] * corner)
        p2 = (cur[0] + unit(nxt, cur)[0] * corner, cur[1] + unit(nxt, cur)[1] * corner)
        cmd = "M" if i == 0 else "L"
        parts.append(f"{cmd} {p1[0]:.2f},{p1[1]:.2f}")
        parts.append(f"Q {cur[0]:.2f},{cur[1]:.2f} {p2[0]:.2f},{p2[1]:.2f}")
    parts.append("Z")
    return " ".join(parts)


def body_for(kind: str, color: str) -> str:
    if kind == "hex":
        return f'<path d="{rounded_hex_path()}" fill="{color}"/>'
    if kind == "flower":
        petals = [
            f'<ellipse cx="0" cy="-22" rx="12" ry="18" fill="{color}" transform="rotate({i * 72 - 90})"/>'
            for i in range(5)
        ]
        return "".join(petals) + f'<circle cx="0" cy="0" r="14" fill="{color}"/>'
    if kind == "shield":
        return (
            f'<path fill="{color}" d="M0,-34 L28,-24 C28,-24 28,6 28,10 '
            f'C16,28 4,34 0,36 C-4,34 -16,28 -28,10 C-28,6 -28,-24 -28,-24 Z"/>'
        )
    if kind == "capsule":
        return f'<rect x="-38" y="-22" width="76" height="44" rx="22" fill="{color}"/>'
    return f'<circle r="32" fill="{color}"/>'


def avatar(x: float, y: float, kind: str, color: str, tilt: float, name: str, cap: str) -> str:
    return f'''  <g transform="translate({x},{y})">
    <title>{name}</title>
    <g transform="rotate({tilt})">{body_for(kind, color)}</g>
    {eyes()}
    <text class="name" y="44" text-anchor="middle">{name}</text>
    <text class="cap" y="62" text-anchor="middle">{cap}</text>
  </g>'''


def panel(x, y, w, h, label=""):
    lab = f'<text class="group" x="{x + 16}" y="{y + 22}">{label}</text>' if label else ""
    return f'  <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="16" fill="{PANEL}" stroke="{BORDER}"/>\n{lab}'


def callout(x, y, w, n, line1, line2=""):
    h = 54 if line2 else 36
    second = f'<tspan x="12" dy="16">{line2}</tspan>' if line2 else ""
    return f'''  <g transform="translate({x},{y})">
    <rect x="0" y="0" width="{w}" height="{h}" rx="10" fill="{ACCENT_BOX}" stroke="{ACCENT_EDGE}"/>
    <text class="callout" x="12" y="22"><tspan fill="{ACCENT_TEXT}" font-weight="600">{n}. </tspan>{line1}{second}</text>
  </g>'''


def arrow(x1, y1, x2, y2, dashed=False):
    dash = 'stroke-dasharray="6 5"' if dashed else ""
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{LINE}" stroke-width="1.8" {dash} marker-end="url(#arrow)"/>'


def build() -> str:
    bits: list[str] = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-label="How AgentPot works">',
        f'<rect width="{W}" height="{H}" fill="{BG}"/>',
        """<defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
      <path d="M0 0 L10 5 L0 10 z" fill="#9AA0A6"/>
    </marker>
  </defs>
  <style>
    text { font-family: ui-sans-serif, Inter, system-ui, -apple-system, 'Segoe UI', sans-serif; fill: #1F2328; }
    .title { font-size: 28px; font-weight: 700; }
    .name { font-size: 14px; font-weight: 700; }
    .cap { font-size: 12px; fill: #5B616A; }
    .group { font-size: 12px; font-weight: 600; fill: #5B616A; }
    .icon-label { font-size: 11px; fill: #5B616A; }
    .callout { font-size: 12.5px; fill: #1F2328; }
    .box-title { font-size: 14px; font-weight: 700; }
    .box-cap { font-size: 12px; fill: #5B616A; }
  </style>""",
        f'<text class="title" x="{W/2}" y="48" text-anchor="middle">How AgentPot works</text>',
        person_icon(210, 118),
        '<text class="name" x="210" y="156" text-anchor="middle">You (Ritvik)</text>',
        '<text class="cap" x="210" y="174" text-anchor="middle">Owner</text>',
        """<g transform="translate(520,118)">
    <rect x="-28" y="-28" width="56" height="56" rx="12" fill="#EEF0FF" stroke="#D6DBFF"/>
    <circle cx="-8" cy="-4" r="6" fill="#5B6CFF"/>
    <circle cx="10" cy="-4" r="6" fill="#5B6CFF"/>
    <rect x="-14" y="8" width="28" height="8" rx="4" fill="#5B6CFF"/>
  </g>""",
        '<text class="name" x="520" y="156" text-anchor="middle">AI agents</text>',
        '<text class="cap" x="520" y="174" text-anchor="middle">MCP clients and crawlers</text>',
        arrow(210, 184, 210, 228),
        arrow(520, 184, 520, 228),
        panel(70, 228, 640, 560, "The honeypot"),
        '<rect x="130" y="268" width="520" height="118" rx="12" fill="#FFFFFF" stroke="#E4E6EA"/>',
        '<text class="box-title" x="390" y="296" text-anchor="middle">Decoys</text>',
        '<text class="box-cap" x="390" y="314" text-anchor="middle">MCP server, poisoned pages, and canaries</text>',
        icon_at("mcp", 230, 350, 36, "MCP"),
        """<g transform="translate(390,350)">
    <rect x="-16" y="-18" width="32" height="36" rx="3" fill="#111827"/>
    <rect x="-11" y="-13" width="22" height="3" rx="1" fill="#EDEEF0"/>
    <rect x="-11" y="-6" width="16" height="2" rx="1" fill="#9BA1AE"/>
    <rect x="-11" y="-1" width="18" height="2" rx="1" fill="#9BA1AE"/>
    <text class="icon-label" y="34" text-anchor="middle">Pages</text>
  </g>""",
        """<g transform="translate(550,350)">
    <path d="M0,-16 L6,-4 H18 L8,4 L12,16 L0,8 L-12,16 L-8,4 L-18,-4 H-6 Z" fill="#5B6CFF"/>
    <text class="icon-label" y="34" text-anchor="middle">Canaries</text>
  </g>""",
        arrow(390, 386, 390, 430),
        '<rect x="190" y="430" width="400" height="78" rx="12" fill="#FFFFFF" stroke="#E4E6EA"/>',
        '<text class="box-title" x="390" y="462" text-anchor="middle">Event classification</text>',
        '<text class="box-cap" x="390" y="482" text-anchor="middle">Type, severity, and session</text>',
        arrow(390, 508, 390, 548),
        '<rect x="190" y="548" width="400" height="88" rx="12" fill="#FFFFFF" stroke="#E4E6EA"/>',
        icon_at("supabase", 300, 592, 34, ""),
        '<text class="box-title" x="430" y="586" text-anchor="middle">Supabase</text>',
        '<text class="box-cap" x="430" y="606" text-anchor="middle">Events and sessions, with a 30-day cleanup</text>',
        arrow(390, 636, 390, 676),
        '<rect x="190" y="676" width="400" height="88" rx="12" fill="#FFFFFF" stroke="#E4E6EA"/>',
        icon_at("nextjs", 250, 720, 28, "Next.js"),
        icon_at("vercel", 330, 720, 28, "Vercel"),
        '<text class="box-title" x="470" y="712" text-anchor="middle">Dashboard</text>',
        '<text class="box-cap" x="470" y="732" text-anchor="middle">Shared live view</text>',
        # Team
        panel(740, 228, 390, 560, "Grok Bot team"),
        avatar(935, 330, "hex", YELLOW, 22, "Honeypot Lead", "Coordinates the team"),
        avatar(840, 490, "flower", ORANGE, -8, "Decoy Builder", "Designs the lures"),
        avatar(1030, 490, "shield", RED, -12, "Attack Analyst", "Reads the traffic"),
        avatar(935, 680, "capsule", GREEN, -28, "Agent Tester", "Probes the surfaces"),
        # Stack row
        panel(70, 816, 1060, 110, "Stack"),
        icon_at("nextjs", 180, 874, 36, "Next.js"),
        icon_at("vercel", 340, 874, 36, "Vercel"),
        icon_at("supabase", 500, 874, 36, "Supabase"),
        icon_at("github", 660, 874, 36, "GitHub"),
        icon_at("mcp", 820, 874, 36, "MCP"),
        # Callouts
        callout(70, 948, 340, "1", "An agent finds a decoy.", "The lure stays inert."),
        callout(420, 948, 350, "2", "The touch is classified", "and stored in Supabase."),
        callout(780, 948, 350, "3", "You review the dashboard.", "The team tends the lures."),
        # Arrow from you back? skip to avoid clutter
    ]
    bits.append("</svg>")
    return "\n".join(bits)


def render_png(svg_path: Path, png_path: Path) -> None:
    html = f"""<!doctype html><meta charset="utf-8">
<style>html,body{{margin:0;background:#fff;}}</style>
<img src="architecture.svg" width="{W}" height="{H}" alt="">
"""
    work = svg_path.parent
    html_path = work / "_architecture_preview.html"
    html_path.write_text(html)
    chrome = "/usr/bin/google-chrome"
    out = subprocess.run(
        [
            chrome,
            "--headless=new",
            "--disable-gpu",
            "--no-sandbox",
            "--hide-scrollbars",
            f"--window-size={W},{H}",
            f"--screenshot={png_path}",
            f"file://{html_path}",
        ],
        capture_output=True,
        text=True,
    )
    html_path.unlink(missing_ok=True)
    if out.returncode != 0 or not png_path.exists():
        raise SystemExit(f"chrome screenshot failed: {out.stderr[-500:]}")


def main() -> int:
    svg = build()
    OUT_SVG.write_text(svg)
    render_png(OUT_SVG, OUT_PNG)
    print(f"wrote {OUT_SVG} ({OUT_SVG.stat().st_size} bytes)")
    print(f"wrote {OUT_PNG} ({OUT_PNG.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
