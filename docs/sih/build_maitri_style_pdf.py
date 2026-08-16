#!/usr/bin/env python3
"""Build a 6-slide landscape PDF in the same visual format as Maitri AI.pdf."""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import fitz
from PIL import Image

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
OUT = ROOT / "STS-Safety-Idea-Presentation.pdf"

sys.path.insert(0, str(ROOT / "_vendor"))
import qrcode  # noqa: E402

# 16:9 landscape — same canvas as Maitri AI.pdf
W, H = 1440.0, 810.0

ARIAL = "/System/Library/Fonts/Supplemental/Arial.ttf"
ARIAL_B = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
TIMES_B = "/System/Library/Fonts/Supplemental/Times New Roman Bold.ttf"
F_AR = fitz.Font(fontfile=ARIAL)
F_AB = fitz.Font(fontfile=ARIAL_B)
F_TB = fitz.Font(fontfile=TIMES_B)
FONTFILE = {"AR": ARIAL, "AB": ARIAL_B, "TB": TIMES_B}
FONTOBJ = {"AR": F_AR, "AB": F_AB, "TB": F_TB}

NAVY = (0.043, 0.145, 0.271)
RED = (0.706, 0.071, 0.094)
GREEN = (0.106, 0.541, 0.290)
ORANGE = (0.953, 0.424, 0.129)
BLUE = (0.000, 0.439, 0.753)
TEAL = (0.055, 0.420, 0.420)
INK = (0.102, 0.133, 0.180)
MUTED = (0.290, 0.333, 0.388)
WHITE = (1, 1, 1)
SOFT = (0.839, 0.871, 0.910)
LIGHT = (0.965, 0.973, 0.980)
BOX = (0.000, 0.447, 0.698)
FOOTER = "Smart India Hackathon 2025  ·  SIH25002  ·  Travel & Tourism  ·  Software  ·  MDoNER"


def tl(text: str, font: str, size: float) -> float:
    return FONTOBJ[font].text_length(text, fontsize=size)


def fonts(page: fitz.Page) -> None:
    page.insert_font(fontname="AR", fontfile=ARIAL)
    page.insert_font(fontname="AB", fontfile=ARIAL_B)
    page.insert_font(fontname="TB", fontfile=TIMES_B)


def rr(page: fitz.Page, r: fitz.Rect, radius: float, fill=None, color=None, width: float = 0.8) -> None:
    # PyMuPDF radius is a fraction of the shorter side, not pixels.
    frac = min(0.5, radius / max(min(r.width, r.height), 1.0))
    page.draw_rect(r, color=color, fill=fill, width=width, radius=frac)


def oval(page: fitz.Page, r: fitz.Rect, fill, color=None) -> None:
    page.draw_oval(r, color=color, fill=fill, width=0)


def put(page: fitz.Page, point, text: str, size: float, font="AR", color=INK, align=0) -> None:
    page.insert_text(point, text, fontsize=size, fontname=font, color=color)


def put_center(page: fitz.Page, x, y, w, text, size, font="AB", color=INK) -> None:
    page.insert_textbox(
        fitz.Rect(x, y, x + w, y + size * 1.6),
        text,
        fontsize=size,
        fontname=font,
        color=color,
        align=1,
    )


def chrome(page: fitz.Page, title: str | None, footer: str | None = None) -> None:
    """SIH landscape chrome: saffron/green bar, logo, serif title, quiet footer."""
    page.draw_rect(fitz.Rect(0, 0, W, 6), color=None, fill=ORANGE)
    page.draw_rect(fitz.Rect(0, 6, W, 8), color=None, fill=GREEN)
    logo = ASSETS / "sih-header-logo.png"
    if logo.exists():
        page.insert_image(fitz.Rect(1188, 16, 1418, 82), filename=str(logo))
    if title:
        page.insert_textbox(
            fitz.Rect(36, 18, 1160, 78),
            title,
            fontsize=28,
            fontname="TB",
            color=INK,
            align=1,
        )
    if footer:
        page.draw_rect(fitz.Rect(0, 786, W, H), color=None, fill=NAVY)
        page.insert_textbox(
            fitz.Rect(24, 790, 1416, 808),
            footer,
            fontsize=9,
            fontname="AR",
            color=WHITE,
            align=1,
        )


def draw_runs(page, x0, y, width, runs, size=10, leading=13.2) -> float:
    """Wrap mixed-style runs. Each run is (text, font, color)."""
    x = x0
    for text, font, color in runs:
        words = text.split(" ")
        for i, word in enumerate(words):
            piece = word if i == len(words) - 1 else word + " "
            if not piece.strip() and piece != " ":
                continue
            tw = tl(piece, font, size)
            if x > x0 and x + tw > x0 + width:
                y += leading
                x = x0
            page.insert_text((x, y), piece, fontsize=size, fontname=font, color=color)
            x += tw
    return y + leading


def bullet(page, x, y, width, label, body, reds: list[str], size=9.2, leading=12.2) -> float:
    runs = [("•  ", "AB", INK), (label + "  ", "AB", INK)]
    remaining = body
    for phrase in reds:
        if phrase not in remaining:
            continue
        before, remaining = remaining.split(phrase, 1)
        if before:
            runs.append((before, "AR", INK))
        runs.append((phrase, "AB", RED))
    if remaining:
        runs.append((remaining, "AR", INK))
    return draw_runs(page, x, y, width, runs, size=size, leading=leading)


def picture_frame(page, rect: fitz.Rect, path: Path, caption: str | None = None) -> None:
    mat = rect + (-5, -5, 5, 5)
    page.draw_rect(mat, color=SOFT, fill=WHITE, width=1.0, radius=0.04)
    page.draw_rect(rect, color=None, fill=(0.06, 0.07, 0.09), radius=0.03)
    if path.exists():
        page.insert_image(rect, filename=str(path), keep_proportion=True)
    if caption:
        page.insert_textbox(
            fitz.Rect(rect.x0, rect.y1 + 4, rect.x1, rect.y1 + 22),
            caption,
            fontsize=8.5,
            fontname="AB",
            color=MUTED,
            align=1,
        )


def black_to_transparent(src: Path, dest: Path) -> Path:
    im = Image.open(src).convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r < 28 and g < 28 and b < 28:
                px[x, y] = (0, 0, 0, 0)
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest)
    return dest


def make_qr(url: str, dest: Path) -> Path:
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=2, box_size=10)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#004EA8", back_color="white")
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest)
    return dest


def pie(page, cx, cy, radius, slices) -> None:
    total = sum(v for _, v, _ in slices)
    ang = -90.0
    for label, value, color in slices:
        sweep = 360.0 * value / total
        # approximate sector with a triangle fan
        steps = max(8, int(abs(sweep) / 6))
        pts = [fitz.Point(cx, cy)]
        for i in range(steps + 1):
            a = math.radians(ang + sweep * i / steps)
            pts.append(fitz.Point(cx + radius * math.cos(a), cy + radius * math.sin(a)))
        page.draw_polyline(pts, color=color, fill=color, width=0, closePath=True)
        ang += sweep
    page.draw_circle(fitz.Point(cx, cy), radius, color=WHITE, width=1.4)
    ly = cy - radius + 8
    for label, value, color in slices:
        page.draw_rect(fitz.Rect(cx + radius + 24, ly - 8, cx + radius + 38, ly + 4), color=None, fill=color)
        page.insert_text((cx + radius + 44, ly), f"{label}   {value}", fontsize=9, fontname="AB", color=INK)
        ly += 22


def slide_1(doc: fitz.Document, live_url: str | None = None, github_url: str | None = None) -> None:
    page = doc.new_page(width=W, height=H)
    fonts(page)
    page.draw_rect(fitz.Rect(0, 0, W, H), color=None, fill=WHITE)
    page.draw_rect(fitz.Rect(0, 0, W, 6), color=None, fill=ORANGE)
    page.draw_rect(fitz.Rect(0, 6, W, 8), color=None, fill=GREEN)
    page.insert_textbox(
        fitz.Rect(80, 70, 1360, 140),
        "SMART INDIA HACKATHON 2025",
        fontsize=36,
        fontname="AB",
        color=NAVY,
        align=1,
    )
    logo = ASSETS / "sih-header-logo.png"
    if logo.exists():
        page.insert_image(fitz.Rect(1165, 18, 1415, 92), filename=str(logo))

    rows = [
        ("Problem Statement ID  –  ", "SIH25002", RED, True),
        (
            "Problem Statement Title  –  ",
            "Smart Tourist Safety Monitoring & Incident Response System using AI, Geo-Fencing, and Blockchain-based Digital ID",
            RED,
            True,
        ),
        ("Theme  –  ", "Travel & Tourism", RED, True),
        ("PS Category  –  ", "Software", RED, True),
        ("Organisation  –  ", "Ministry of Development of North Eastern Region (MDoNER)", RED, True),
        ("Team Name  –  ", "STS Safety", INK, True),
    ]
    y = 210
    x = 90
    for label, value, color, bold in rows:
        page.insert_text((x, y), label, fontsize=18, fontname="AB", color=INK)
        vx = x + tl(label, "AB", 18)
        page.insert_textbox(
            fitz.Rect(vx, y - 18, 860, y + 52),
            value,
            fontsize=18,
            fontname="AB" if bold else "AR",
            color=color,
            align=0,
        )
        y += 58 if len(value) > 70 else 48

    brain = ASSETS / "sih-brain-clear.png"
    if brain.exists():
        page.insert_image(fitz.Rect(900, 165, 1385, 700), filename=str(brain))

    page.draw_rect(fitz.Rect(0, 736, W, H), color=None, fill=NAVY)
    live = live_url or "Prototype URL will appear here after deploy"
    footer_text = f"LIVE PROTOTYPE   {live}"
    if github_url:
        footer_text += f"\nGitHub   {github_url}"
    page.insert_textbox(
        fitz.Rect(36, 744, 1404, 804),
        footer_text,
        fontsize=12,
        fontname="AB",
        color=WHITE,
        align=1,
    )
    if live_url:
        page.insert_link({"kind": fitz.LINK_URI, "from": fitz.Rect(36, 744, 1404, 774), "uri": live_url})
    if github_url:
        page.insert_link({"kind": fitz.LINK_URI, "from": fitz.Rect(36, 774, 1404, 804), "uri": github_url})


def slide_2(doc: fitz.Document, qr_path: Path, live_url: str) -> None:
    page = doc.new_page(width=W, height=H)
    fonts(page)
    page.draw_rect(fitz.Rect(0, 0, W, H), color=None, fill=LIGHT)
    chrome(page, None, None)

    page.insert_textbox(
        fitz.Rect(200, 20, 1160, 56),
        "Smart Tourist Safety",
        fontsize=26,
        fontname="TB",
        color=ORANGE,
        align=1,
    )
    page.insert_textbox(
        fitz.Rect(200, 50, 1160, 78),
        "Smart Tourist Safety Monitoring & Incident Response  ·  North-East India",
        fontsize=13,
        fontname="AB",
        color=BLUE,
        align=1,
    )

    # left: problem
    rr(page, fitz.Rect(28, 96, 710, 430), 8, fill=WHITE, color=SOFT, width=0.9)
    page.insert_text((48, 126), "Understanding The Problem", fontsize=16, fontname="TB", color=INK)
    page.draw_line(fitz.Point(48, 132), fitz.Point(310, 132), color=INK, width=0.8)
    y = 156
    problems = [
        (
            "Delayed Detection:",
            "No live geo-fence means restricted-zone, missing-person and signal-loss events are identified too late.",
            ["too late"],
        ),
        (
            "Limited Context:",
            "Generic tourist apps do not capture North-East terrain, Inner Line, forest cores or checkpoint reality.",
            ["North-East terrain"],
        ),
        (
            "Fragmented Insights:",
            "Check-post, hotel, forest office and police do not share a database — a Tawang desk cannot verify a Guwahati ID.",
            ["do not share a database"],
        ),
        (
            "Ineffective Support:",
            "SOS that depends on a cloud round-trip fails when the hills go dark.",
            ["fails when the hills go dark"],
        ),
        (
            "Poor Autonomy:",
            "7 of 8 NE states have no dedicated Tourist Police; NCRB has no domestic-tourist crime series.",
            ["no dedicated Tourist Police"],
        ),
    ]
    for lab, body, reds in problems:
        y = bullet(page, 48, y, 640, lab, body, reds, size=10, leading=13.4)
        y += 6

    # left bottom: solution
    rr(page, fitz.Rect(28, 444, 710, 742), 8, fill=WHITE, color=SOFT, width=0.9)
    page.insert_text((48, 474), "Our Solution", fontsize=16, fontname="TB", color=INK)
    page.draw_line(fitz.Point(48, 480), fitz.Point(168, 480), color=INK, width=0.8)
    y = 502
    sols = [
        ("Real-Time Geo-fence:", "PostGIS AFTER INSERT trigger — the phone cannot skip an incident.", ["cannot skip an incident"]),
        ("Soulbound Digital ID:", "ERC-5192 TDID; chain stores only keccak256(KYC ‖ salt), never PII.", ["never PII"]),
        ("Hold-to-SOS:", "1.5 s hold writes a critical incident under RLS; SMS fallback if the insert fails.", ["SMS fallback"]),
        ("On-device Warning:", "Turf.js + IndexedDB + Background Sync for Arunachal towers.", ["On-device"]),
        ("AI beside the path:", "IsolationForest ranks; Groq/Gemini draft E-FIR. Alert still fires if they die.", ["Alert still fires"]),
        ("Live Command Room:", "Critical-first queue, nearest-unit dispatch, MTTA/MTTR on one map.", ["one map"]),
        ("DPDP by design:", "Consent, pgcrypto KYC, RLS, 24 h ping purge, emergency contacts only at critical.", ["DPDP by design"]),
    ]
    for lab, body, reds in sols:
        y = bullet(page, 48, y, 640, lab, body, reds, size=9.4, leading=12.4)

    # right: unique
    rr(page, fitz.Rect(730, 96, 1412, 430), 8, fill=WHITE, color=SOFT, width=0.9)
    page.insert_text((750, 126), "Our Unique Solutions", fontsize=16, fontname="TB", color=INK)
    page.draw_line(fitz.Point(750, 132), fitz.Point(960, 132), color=INK, width=0.8)
    y = 156
    uniq = [
        ("Safety path is the database.", "Blockchain and AI sit beside it. Unplug WAN: Realtime + Anvil + ONNX still demo.", ["beside it"]),
        ("Lawful identity, not an NFT.", "Hotel learns match / no-match, never the passport number.", ["never the passport number"]),
        ("Evidentiary E-FIR.", "Officer must approve. PDF hash is anchored. LLM never files to CCTNS.", ["never files to CCTNS"]),
        ("Honest ML.", "Synthetic NE tracks (DPDP). Hold-out: 0 FP on 1,500 normal-trek windows.", ["0 FP on 1,500"]),
        ("Zero-cost infrastructure.", "Vercel Hobby + Supabase Free + HF CPU + Amoy. No credit card in the stack.", ["No credit card"]),
        ("Five locales.", "en · hi · as · bn · ne matching the PS multilingual clause.", ["Five locales"]),
        ("Measured SOS.", "180–450 ms first channel on the local stack; Telegram target < 2 s.", ["180–450 ms"]),
    ]
    for lab, body, reds in uniq:
        y = bullet(page, 750, y, 640, lab, body, reds, size=10, leading=13.2)
        y += 2

    # USPs
    page.insert_text((750, 456), "USPs {", fontsize=12, fontname="AB", color=NAVY)
    usps = [
        "Real-time geo-fence for instant restricted-zone checks.",
        "Lightweight stack tuned for hill connectivity.",
        "On-device micro-warnings to keep tourists safe.",
        "Seamless command-room dispatch, even offline.",
    ]
    x = 800
    for u in usps:
        rr(page, fitz.Rect(x, 448, x + 148, 548), 8, fill=(0.88, 0.96, 0.90), color=GREEN, width=0.7)
        page.insert_textbox(fitz.Rect(x + 6, 456, x + 142, 540), u, fontsize=8.5, fontname="AR", color=INK, align=1)
        x += 154
    page.insert_text((1400, 500), "}", fontsize=12, fontname="AB", color=NAVY)

    # screenshots + QR (keep the live URL off the screenshots)
    picture_frame(page, fitz.Rect(730, 560, 1048, 708), ASSETS / "shot-landing.png", None)
    picture_frame(page, fitz.Rect(1060, 560, 1218, 708), ASSETS / "shot-tourist.png", None)
    qr_box = fitz.Rect(1230, 548, 1412, 748)
    rr(page, qr_box, 8, fill=WHITE, color=BLUE, width=1.6)
    page.insert_textbox(
        fitz.Rect(1236, 552, 1406, 572),
        "SCAN LIVE DEMO",
        fontsize=8,
        fontname="AB",
        color=RED,
        align=1,
    )
    if qr_path.exists():
        page.insert_image(fitz.Rect(1252, 574, 1390, 712), filename=str(qr_path))
    page.insert_textbox(
        fitz.Rect(1236, 714, 1406, 744),
        live_url.replace("https://", ""),
        fontsize=7,
        fontname="AB",
        color=NAVY,
        align=1,
    )
    if live_url.startswith("http"):
        page.insert_link({"kind": fitz.LINK_URI, "from": qr_box, "uri": live_url})

    # red banner
    page.draw_rect(fitz.Rect(0, 756, W, H), color=None, fill=RED)
    page.insert_textbox(
        fitz.Rect(0, 766, W, 804),
        "WORKING PROTOTYPE IS ALREADY COMPLETED  ·  TOURIST PWA + COMMAND CENTRE + POSTGIS ENGINE",
        fontsize=14,
        fontname="AB",
        color=WHITE,
        align=1,
    )


def slide_3(doc: fitz.Document) -> None:
    page = doc.new_page(width=W, height=H)
    fonts(page)
    page.draw_rect(fitz.Rect(0, 0, W, H), color=None, fill=WHITE)
    chrome(page, "Technical Approach", FOOTER)

    page.insert_text((40, 100), "Methodology", fontsize=14, fontname="AB", color=NAVY)
    y = 122
    steps = [
        (
            "Multimodal Data Acquisition:",
            "Capture tourist GPS (watchPosition), zone polygons, itinerary LineString, SOS gesture and optional IoT-band pings from the simulator.",
            ["GPS", "SOS gesture"],
        ),
        (
            "On-device Pre-check:",
            "Turf.js evaluates cached GeoJSON zones, vibrates a warning, queues pings in IndexedDB if the tower is gone.",
            ["Turf.js", "IndexedDB"],
        ),
        (
            "Hot-path Ingest:",
            "RLS insert into location_pings (~80–150 ms). No serverless hop. AFTER INSERT → evaluate_position().",
            ["RLS insert", "evaluate_position()"],
        ),
        (
            "Geo Feature Extraction:",
            "ST_Covers / ST_DWithin, corridor deviation, implausible speed, dwell, silence (pg_cron 20 min).",
            ["ST_Covers", "ST_DWithin"],
        ),
        (
            "Fusion & Decision:",
            "Rules always create the incident. IsolationForest only ranks. Groq → Gemini → template writes the brief.",
            ["Rules always create", "only ranks"],
        ),
        (
            "Dispatch & Evidence:",
            "Nearest on-duty unit, Telegram + Web Push + email. High/SOS records hash-anchored on Polygon Amoy / Anvil.",
            ["hash-anchored"],
        ),
    ]
    for lab, body, reds in steps:
        y = bullet(page, 40, y, 430, lab, body, reds, size=9.2, leading=12.4)
        y += 8

    page.insert_text((40, 560), "Tech Stack", fontsize=14, fontname="AB", color=NAVY)
    groups = [
        ("Frontend", ["Next.js 16 PWA", "MapLibre", "Tailwind + shadcn", "Turf.js"], ORANGE),
        ("Geo & Backend", ["PostGIS 3", "Supabase RLS", "PostgREST", "pg_cron / pg_net"], BLUE),
        ("AI & Chain", ["ONNX IForest", "Groq / Gemini", "Polygon Amoy", "ERC-5192 TDID"], GREEN),
    ]
    gy = 576
    for title, items, col in groups:
        page.insert_text((40, gy + 12), title, fontsize=9, fontname="AB", color=col)
        x = 140
        for it in items:
            tw = tl(it, "AB", 8.5) + 16
            rr(page, fitz.Rect(x, gy, x + tw, gy + 22), 8, fill=col, color=None)
            page.insert_textbox(fitz.Rect(x, gy + 3, x + tw, gy + 20), it, fontsize=8.5, fontname="AB", color=WHITE, align=1)
            x += tw + 8
        gy += 30

    # screenshots column
    page.insert_text((500, 100), "User Interface", fontsize=14, fontname="AB", color=NAVY)
    picture_frame(page, fitz.Rect(500, 112, 930, 430), ASSETS / "shot-landing.png")
    page.insert_textbox(fitz.Rect(500, 434, 930, 454), "Tourist PWA landing  ·  dual persona entry", fontsize=9, fontname="AB", color=MUTED, align=1)

    page.insert_text((500, 478), "Admin / Command", fontsize=14, fontname="AB", color=NAVY)
    picture_frame(page, fitz.Rect(500, 490, 700, 742), ASSETS / "shot-tourist.png")
    picture_frame(page, fitz.Rect(716, 490, 930, 742), ASSETS / "shot-officer.png")
    page.insert_textbox(fitz.Rect(500, 746, 930, 768), "Tourist demo login                    Officer / command login", fontsize=8.5, fontname="AB", color=MUTED, align=1)

    # flow
    page.insert_text((960, 100), "Implementation Flow", fontsize=14, fontname="AB", color=NAVY)
    boxes = [
        (980, 118, "Device", "GPS · Turf.js · SOS", ORANGE),
        (1188, 118, "Ingest", "RLS ping insert", BLUE),
        (980, 220, "PostGIS", "zone · speed · silence", GREEN),
        (1188, 220, "Incident", "Realtime < 100 ms", RED),
        (980, 322, "Side path", "ONNX · LLM · chain", (0.55, 0.25, 0.55)),
        (1188, 322, "Dispatch", "Telegram · Push · E-FIR", TEAL),
    ]
    for x, yb, t, b, c in boxes:
        rr(page, fitz.Rect(x, yb, x + 190, yb + 78), 8, fill=WHITE, color=c, width=1.4)
        page.insert_text((x + 12, yb + 28), t, fontsize=13, fontname="AB", color=c)
        page.insert_text((x + 12, yb + 52), b, fontsize=9, fontname="AR", color=MUTED)

    # arrows
    def arrow(p1, p2):
        page.draw_line(p1, p2, color=NAVY, width=1.2)

    arrow(fitz.Point(1170, 157), fitz.Point(1188, 157))
    arrow(fitz.Point(1075, 196), fitz.Point(1075, 220))
    arrow(fitz.Point(1170, 259), fitz.Point(1188, 259))
    arrow(fitz.Point(1283, 298), fitz.Point(1283, 322))
    arrow(fitz.Point(1170, 361), fitz.Point(1188, 361))

    rr(page, fitz.Rect(960, 430, 1410, 742), 8, fill=NAVY, color=None)
    page.insert_text((980, 458), "Panic path  —  nothing optional between button and siren", fontsize=12, fontname="AB", color=ORANGE)
    page.insert_textbox(
        fitz.Rect(980, 474, 1390, 720),
        "Hold 1.5 s → INSERT incidents {type:sos, severity:critical} under RLS (no Route Handler) → trigger skips debounce → Realtime full-screen takeover → Telegram + Web Push + email in parallel → 2 s ping cadence for 30 min.\n\n"
        "Offline: Background Sync retries the insert; PWA opens a pre-composed sms: URI with last coordinates.\n\n"
        "Design rule: blockchain and AI are enhancements on the side of the safety path, never inside it.\n\n"
        "Surfaces:  /home   /sos   /onboard   /dashboard   /verify\n"
        "Simulator stands in for the IoT band on the same ingest path.",
        fontsize=11,
        fontname="AR",
        color=WHITE,
        align=0,
    )


def slide_4(doc: fitz.Document) -> None:
    page = doc.new_page(width=W, height=H)
    fonts(page)
    page.draw_rect(fitz.Rect(0, 0, W, H), color=None, fill=WHITE)
    chrome(page, "IMPACT AND BENEFITS", FOOTER)

    def panel(r, title, items):
        page.draw_rect(r, color=BOX, width=1.3)
        page.insert_text((r.x0 + 16, r.y0 + 28), title, fontsize=14, fontname="AB", color=INK)
        y = r.y0 + 52
        for lab, body, reds in items:
            y = bullet(page, r.x0 + 16, y, r.width - 32, lab, body, reds, size=10, leading=13.4)
            y += 6

    panel(
        fitz.Rect(28, 96, 720, 430),
        "Potential Impact on Tourists",
        [
            ("Early Danger Detection –", "Restricted-zone, signal-loss and SOS signs fire before a missing-person file.", ["before"]),
            ("On-device Stability –", "Turf.js warnings and hold-to-SOS work when the tower is gone.", ["when the tower is gone"]),
            ("Companion ID –", "Soulbound QR at hotel / check-post / forest office — green, amber or red in one scan.", ["one scan"]),
            ("Task Readiness –", "Control room sees last-known point, digital ID and nearest unit together.", ["last-known point"]),
            ("Adaptive Support –", "Five UI languages (en, hi, as, bn, ne) matching the PS multilingual clause.", ["Five UI languages"]),
        ],
    )
    panel(
        fitz.Rect(740, 96, 1412, 430),
        "Mission & Operational Benefit",
        [
            ("Risk Reduction –", "Continuous geo-fence lowers illegal entry into Kaziranga core and border approaches.", ["Continuous geo-fence"]),
            ("Autonomous Safety –", "Works offline: IndexedDB, Anvil, ONNX, PMTiles. Reliability during blackouts.", ["Works offline"]),
            ("Efficient Crew Management –", "Nearest on-duty dispatch; MTTA / MTTR become measurable.", ["MTTA / MTTR"]),
            ("Extended Coverage –", "Force-multiplier for 7 NE states with no Tourist Police unit.", ["no Tourist Police"]),
            ("Crisis Handling –", "Escalates SOS instantly with logs, chain proof and an officer-approved E-FIR draft.", ["instantly"]),
        ],
    )
    panel(
        fitz.Rect(28, 448, 900, 742),
        "Economic and Strategic Gains",
        [
            ("Tourism is national-scale –", "5.22% of GDP, 8.46 crore jobs, 9.95 million FTA (2024). NE still takes only 2.05% of FTAs.", ["5.22% of GDP"]),
            ("Perception of safety –", "A binding constraint on high-value / foreign itineraries into the hills.", ["binding constraint"]),
            ("Rs.0 to run the prototype -", "First paid production line is SMS + a non-pausing database, not a rewrite.", ["Rs.0"]),
            ("Paperwork cut –", "E-FIR drafts cut officer time; the officer still signs. Nothing is filed to CCTNS automatically.", ["officer still signs"]),
        ],
    )

    page.draw_rect(fitz.Rect(920, 448, 1412, 742), color=BOX, width=1.3)
    page.insert_textbox(
        fitz.Rect(936, 460, 1396, 490),
        "Proportional impact across key domains.",
        fontsize=11,
        fontname="AB",
        color=INK,
        align=1,
    )
    pie(
        page,
        1088,
        620,
        72,
        [
            ("Tourist safety", 35, (0.55, 0.82, 0.82)),
            ("Response speed", 20, (0.62, 0.82, 0.55)),
            ("Offline autonomy", 20, (0.86, 0.33, 0.27)),
            ("Lawful identity", 15, (0.95, 0.60, 0.28)),
            ("Ops efficiency", 10, (0.97, 0.85, 0.28)),
        ],
    )


def slide_5(doc: fitz.Document) -> None:
    page = doc.new_page(width=W, height=H)
    fonts(page)
    page.draw_rect(fitz.Rect(0, 0, W, H), color=None, fill=LIGHT)
    chrome(page, "FEASIBILITY AND VIABILITY", FOOTER)

    page.draw_rect(fitz.Rect(28, 96, 720, 400), color=INK, width=1.2)
    page.insert_text((44, 124), "Analysis of the feasibility of the idea:", fontsize=14, fontname="AB", color=INK)
    y = 150
    feas = [
        ("Proven research base:", "PostGIS containment and IsolationForest are validated; metrics are published in-repo.", ["published in-repo"]),
        ("Hardware compatibility:", "PWA + edge ONNX run on a phone and a laptop. No custom spacecraft hardware.", ["PWA + edge ONNX"]),
        ("Scalability:", "Same geofence engine from 50 demo tourists to a district control room.", ["Same geofence engine"]),
        ("Training data:", "Synthetic NE trajectories (DPDP). Rules catch what the forest misses.", ["DPDP"]),
        ("Operational reliability:", "Four env switches: DB / chain / AI / tiles. Rehearsed unplugged.", ["Rehearsed unplugged"]),
        ("Energy / cost:", "Rs.0 infra. IsolationForest hold-out P=1.00  R=0.56  F1=0.72  ·  0 FP / 1,500.", ["Rs.0 infra"]),
    ]
    for lab, body, reds in feas:
        y = bullet(page, 44, y, 650, lab, body, reds, size=10.2, leading=13.6)
        y += 6

    # before / after bars
    page.draw_rect(fitz.Rect(740, 96, 1412, 400), color=INK, width=1.2)
    page.insert_textbox(
        fitz.Rect(760, 110, 1392, 140),
        "Control-room capability  -  Before vs After",
        fontsize=13,
        fontname="AB",
        color=BLUE,
        align=1,
    )
    bars = [
        ("Time to raise SOS", 25, 92),
        ("Restricted-zone coverage", 18, 88),
        ("ID verify if server is down", 12, 86),
        ("Auditable E-FIR trail", 20, 80),
    ]
    y = 160
    page.insert_text((980, 152), "Before", fontsize=9, fontname="AB", color=RED)
    page.insert_text((1180, 152), "After", fontsize=9, fontname="AB", color=TEAL)
    for name, b, a in bars:
        page.insert_text((760, y + 12), name, fontsize=9, fontname="AR", color=INK)
        page.draw_rect(fitz.Rect(980, y, 980 + b * 1.6, y + 14), color=None, fill=RED)
        page.draw_rect(fitz.Rect(980, y + 18, 980 + a * 1.6, y + 32), color=None, fill=TEAL)
        y += 52
    page.insert_text((760, 372), "Bars are qualitative capability scores (0–100), not invented crime-drop %.", fontsize=8, fontname="AB", color=MUTED)

    # WHAT IFs
    page.insert_text((40, 430), "WHAT IFs....?", fontsize=18, fontname="AB", color=INK)
    whats = [
        ("01", RED, "AI mis-ranks a trek?", "Rules + PostGIS still decide. IsolationForest only escalates. rules-only is one env flip."),
        ("02", BLUE, "hardware / WAN dies mid-demo?", "IndexedDB + sms: SOS. Anvil + ONNX + PMTiles. Four local fallbacks."),
        ("03", (0.75, 0.55, 0.12), "tourists reject tracking?", "Opt-in, trip-scoped, purpose = safety. Visible score on /home. Not a camera grid."),
        ("04", GREEN, "extreme GPS / spoofed phone?", "Refuse >150 km/h. Session JWT. SOS is a user gesture. Checkpoint QR binds the person."),
        ("05", (0.42, 0.22, 0.55), "LLM drafts a bad E-FIR?", "Draft PDF only. approved_by is a human. Nothing is submitted to CCTNS."),
    ]
    x = 28
    for num, col, q, a in whats:
        rr(page, fitz.Rect(x, 448, x + 268, 628), 8, fill=WHITE, color=col, width=1.4)
        oval(page, fitz.Rect(x + 110, 456, x + 158, 504), col)
        put_center(page, x + 110, 466, 48, num, 12, "AB", WHITE)
        page.insert_textbox(fitz.Rect(x + 10, 512, x + 258, 548), q, fontsize=10, fontname="AB", color=col, align=1)
        page.insert_textbox(fitz.Rect(x + 10, 548, x + 258, 616), a, fontsize=8.5, fontname="AR", color=MUTED, align=1)
        x += 280

    page.draw_rect(fitz.Rect(28, 640, 1412, 776), color=INK, width=1.2)
    page.insert_text((44, 664), "Strategies to Overcome Challenges", fontsize=13, fontname="AB", color=INK)
    y = 686
    strats = [
        ("Limited connectivity (Arunachal / hills)", "IndexedDB queue + Background Sync. Turf.js warns on-device. SOS falls back to sms: with coordinates."),
        ("Accuracy with limited real GPS (DPDP)", "Stated in the pitch. Decision to alert is rules + PostGIS. Forest is unsupervised on generated NE tracks."),
        ("Trust & engagement / “is this surveillance?”", "Consent primer, purpose limitation, RLS on every table, 24 h ping retention, emergency contacts only at critical."),
    ]
    for lab, body in strats:
        page.insert_text((44, y), lab, fontsize=10, fontname="AB", color=BLUE)
        y += 14
        page.insert_text((44, y), "Strategy: " + body, fontsize=9, fontname="AR", color=INK)
        y += 20


def slide_6(doc: fitz.Document) -> None:
    page = doc.new_page(width=W, height=H)
    fonts(page)
    page.draw_rect(fitz.Rect(0, 0, W, H), color=None, fill=WHITE)
    chrome(page, "RESEARCH & REFERENCES", FOOTER)

    headers = ["Feature", "Our Proposed Solution", "Existing Conventional Solutions"]
    rows = [
        ["Geo-fence", "PostGIS trigger; client cannot skip", "App if-else or Mongo $geoWithin"],
        ["Digital ID", "ERC-5192 soulbound + keccak256 commitment", "QR in a database, or NFT with PII"],
        ["AI role", "Ranks only. Rules decide. LLM never gates SOS", "LLM on GPS / “predictive hotspot”"],
        ["Offline", "Turf.js + IndexedDB + sms: + Anvil + ONNX", "Needs internet / paid Map SDK"],
        ["Privacy", "RLS, pgcrypto, 24 h ping purge, no PII on-chain", "Central Aadhaar log"],
        ["E-FIR", "Officer-approved PDF; hash anchored", "Chatbot “files” a legal document"],
        ["Cost", "Rs.0, no card, four local fallbacks", "Twilio + Mapbox + Firebase Blaze"],
        ["ML honesty", "Synthetic tracks; metrics published", "Unstated accuracy on unseen GPS"],
    ]
    widths = [150, 430, 470]
    x0, y0 = 28, 100
    x = x0
    for i, h in enumerate(headers):
        r = fitz.Rect(x, y0, x + widths[i], y0 + 32)
        page.draw_rect(r, color=None, fill=(0.10, 0.42, 0.28))
        page.insert_textbox(r + (6, 6, -4, -4), h, fontsize=10, fontname="AB", color=WHITE, align=1)
        x += widths[i]
    y = y0 + 32
    for ri, row in enumerate(rows):
        bg = LIGHT if ri % 2 == 0 else WHITE
        x = x0
        hrow = 36
        for i, cell in enumerate(row):
            r = fitz.Rect(x, y, x + widths[i], y + hrow)
            page.draw_rect(r, color=SOFT, fill=bg, width=0.5)
            page.insert_textbox(
                r + (6, 8, -4, -4),
                cell,
                fontsize=9,
                fontname="AB" if i == 0 else "AR",
                color=NAVY if i == 0 else INK,
                align=0,
            )
            x += widths[i]
        y += hrow

    page.insert_text((1080, 118), "Research and Datasets references", fontsize=13, fontname="AB", color=RED)
    page.draw_line(fitz.Point(1080, 124), fitz.Point(1390, 124), color=RED, width=0.9)

    refs = [
        ("MoT / PIB — Tourism in NER, DTV+FTV 2023", "https://tourism.gov.in/sites/default/files/2024-12/PIB2082598.pdf"),
        ("MoT Compendium Key Highlights 2024 (NE FTA 2.05%)", "https://tourism.gov.in/sites/default/files/2025-02/India%20Tourism%20Data%20Compendium%20key%20highlights%202024.pdf"),
        ("PIB — FTA 9.95M (2024); GDP 5.22%; jobs 84.63M", "https://www.pib.gov.in/PressReleasePage.aspx?PRID=2240657"),
        ("Lok Sabha USQ 1299 (27.07.2026) — Tourist Police + NCRB 156", "https://sansad.in/getFile/lsapps/loksabhaquestions/annex/188/AU1299_510Xy0.pdf"),
        ("DPDP Act 2023  ·  ERC-5192  ·  W3C Verifiable Credentials", None),
        ("Liu et al., Isolation Forest, ICDM 2008", None),
        ("PostGIS ST_Covers / GiST spatial index", None),
        ("SIH PS SIH25002 — MDoNER, Travel & Tourism, Software", None),
    ]
    y = 150
    for label, url in refs:
        page.insert_text((1080, y), "•  " + label, fontsize=8.5, fontname="AR", color=BLUE if url else INK)
        if url:
            page.insert_link({"kind": fitz.LINK_URI, "from": fitz.Rect(1080, y - 12, 1412, y + 4), "uri": url})
            y += 14
            page.insert_text((1096, y), url[:78] + ("…" if len(url) > 78 else ""), fontsize=7, fontname="AR", color=MUTED)
        y += 22

    page.insert_textbox(
        fitz.Rect(28, 428, 1050, 772),
        "Future scope  —  only what the architecture already allows\n\n"
        "•  Ministry SMS short-code on the existing notification adapter.\n"
        "•  Real Inner Line Permit / KYC adapter; custodial HD wallet → ERC-4337 paymaster.\n"
        "•  Polygon mainnet + hardware-backed issuer. Contracts are vanilla OZ v5 — config, not a rewrite.\n"
        "•  Physical IoT band posting to the same location_pings ingest (the simulator is that interface today).\n"
        "•  CERT-In intake + threat model. Geofence engine stays in Postgres.\n\n"
        "Prototype: tourist PWA + command centre + checkpoint verify + PostGIS engine + ONNX model + Anvil/Amoy contracts.\n"
        "Demo: docs/DEMO-SCRIPT.md    Hostile Q&A: docs/JUDGE-QA.md",
        fontsize=10.5,
        fontname="AR",
        color=INK,
        align=0,
    )


def main() -> Path:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="https://sts-safety.vercel.app")
    parser.add_argument("--github", default="https://github.com/mitanshj07/sts-safety")
    args = parser.parse_args()
    live_url = args.url.strip() or "https://sts-safety.vercel.app"
    github_url = args.github.strip() or None

    brain_src = ASSETS / "maitri-img0-1.png"
    if brain_src.exists():
        black_to_transparent(brain_src, ASSETS / "sih-brain-clear.png")
    qr_path = make_qr(live_url, ASSETS / "prototype-qr.png")

    doc = fitz.open()
    slide_1(doc, live_url, github_url)
    slide_2(doc, qr_path, live_url)
    slide_3(doc)
    slide_4(doc)
    slide_5(doc)
    slide_6(doc)
    doc.save(str(OUT), deflate=True, garbage=4)
    doc.close()
    return OUT


if __name__ == "__main__":
    print(main())
