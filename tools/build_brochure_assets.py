"""Build every brochure-derived asset for the site.

Reads the client's brochure + files in assets/client/ and writes:
  site/public/brand/*          logo (+ white-outlined copy for dark grounds), mark, favicons, og-image (from the exact official logo, never recoloured)
  site/public/images/nebula/*  renders, floor plans, 3D unit plans, brochure map, sub-brand marks
  site/public/images/life/*    lifestyle / amenity photos from the brochure
  site/public/images/projects/* completed-project photos from the brochure
  site/src/plans.data.js       every flat (unit no, tower, BHK, SBA, rooms) + hotspot positions

Usage (from the repo root):  python tools/build_brochure_assets.py
Needs: pip install pymupdf pillow numpy opencv-python-headless
"""
import json
import re
from pathlib import Path

import cv2
import numpy as np
import pymupdf as fitz
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
CLIENT = ROOT / "assets" / "client"
PUB = ROOT / "site" / "public"
BRAND = PUB / "brand"
NEB = PUB / "images" / "nebula"
LIFE = PUB / "images" / "life"
PROJ = PUB / "images" / "projects"
for d in (BRAND, NEB, LIFE, PROJ):
    d.mkdir(parents=True, exist_ok=True)

doc = fitz.open(CLIENT / "elfin-nebula-brochure.pdf")


# ------------------------------------------------------------------ helpers
def save(im: Image.Image, base: Path, q=82, webp_only=False, jpg=True):
    """Save as .webp (+ .jpg fallback for opaque images)."""
    if im.mode == "RGBA":
        im.save(base.with_suffix(".webp"), "WEBP", quality=q, method=6)
        if not webp_only:
            im.save(base.with_suffix(".png"), optimize=True)
    else:
        im = im.convert("RGB")
        im.save(base.with_suffix(".webp"), "WEBP", quality=q, method=6)
        if jpg and not webp_only:
            im.save(base.with_suffix(".jpg"), "JPEG", quality=q, optimize=True, progressive=True)
    print("  wrote", base.relative_to(ROOT), im.size)


def upscale(im: Image.Image, width: int) -> Image.Image:
    """Lanczos upscale + light unsharp mask (only ever enlarges)."""
    if im.width >= width:
        return im
    h = round(im.height * width / im.width)
    big = im.resize((width, h), Image.LANCZOS)
    return big.filter(ImageFilter.UnsharpMask(radius=1.4, percent=55, threshold=2))


def fit(im: Image.Image, width: int) -> Image.Image:
    if im.width <= width:
        return im
    return im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)


def xref_image(xref: int, smask: int = 0) -> Image.Image:
    pix = fitz.Pixmap(doc, xref)
    if smask:
        pix = fitz.Pixmap(pix, fitz.Pixmap(doc, smask))
    if pix.n - pix.alpha >= 4:  # CMYK
        pix = fitz.Pixmap(fitz.csRGB, pix)
    mode = "RGBA" if pix.alpha else "RGB"
    return Image.frombytes(mode, (pix.width, pix.height), pix.samples)


def render(page: int, clip, zoom=2.4, alpha=False) -> Image.Image:
    pix = doc[page].get_pixmap(matrix=fitz.Matrix(zoom, zoom), clip=fitz.Rect(*clip), alpha=alpha)
    return Image.frombytes("RGBA" if pix.alpha else "RGB", (pix.width, pix.height), pix.samples)


def white_to_alpha(im: Image.Image) -> Image.Image:
    """Unmultiply a graphic drawn on white (keeps antialiased edges and colours)."""
    a = np.asarray(im.convert("RGB")).astype(np.float32) / 255
    alpha = np.clip(1 - a.min(axis=2), 0, 1)
    alpha = np.clip((alpha - 0.02) / 0.98, 0, 1)
    safe = np.maximum(alpha, 1e-4)[..., None]
    rgb = np.clip((a - (1 - alpha[..., None])) / safe, 0, 1)
    out = np.dstack([rgb, alpha]) * 255
    return Image.fromarray(out.astype(np.uint8), "RGBA")


def trim(im: Image.Image, pad=0) -> Image.Image:
    bbox = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    im = im.crop(bbox)
    if pad:
        c = Image.new("RGBA", (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
        c.paste(im, (pad, pad))
        im = c
    return im


# ------------------------------------------------------------------ brand
print("brand")
src = np.asarray(Image.open(CLIENT / "logo-official.jpg").convert("RGB")).astype(np.float32)
L = src.mean(axis=2)
sat = src.max(axis=2) - src.min(axis=2)
# neutral pixels: alpha from darkness (black-on-white antialiasing); saturated (gold) pixels: opaque
alpha = np.where(sat < 38, np.clip((250 - L) / 205, 0, 1), 1.0)
# white enclosed by the mark (not connected to the border) stays white
light = ((L > 200) & (sat < 38)).astype(np.uint8)
n, lab = cv2.connectedComponents(light, connectivity=4)
border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
enclosed = (light == 1) & ~np.isin(lab, list(border))
rgb = np.where((sat < 38)[..., None], np.zeros_like(src) + 10, src)  # pure brand black #0a0a0a
rgb = np.where(enclosed[..., None], 255, rgb)
alpha = np.where(enclosed, 1.0, alpha)
logo = Image.fromarray(np.dstack([rgb, alpha * 255]).astype(np.uint8), "RGBA")
logo = trim(logo, pad=6)
save(logo, BRAND / "logo")

# the same logo with a thin white outline traced around its shapes, for dark grounds. The logo's own
# pixels are copied unchanged on top; only the outline is added around them (crisp at every size,
# unlike a CSS drop-shadow outline, which blurs on phones).
pad = 22
la = np.asarray(logo.getchannel("A"))
la = np.pad(la, pad)
r = 15
yy, xx = np.mgrid[-r:r + 1, -r:r + 1]
disk = ((xx * xx + yy * yy) <= r * r).astype(np.uint8)
stroke = cv2.dilate(la, disk)
stroke = cv2.GaussianBlur(stroke, (0, 0), 1.0)
outlined = Image.new("RGBA", (logo.width + 2 * pad, logo.height + 2 * pad), (255, 255, 255, 0))
outlined.putalpha(Image.fromarray(stroke))
outlined.alpha_composite(logo, (pad, pad))
save(outlined, BRAND / "logo-outline")


# emblem only (towers + horse), everything above the long horizontal rule
dark = (np.asarray(logo.getchannel("A")) > 128)
rows = dark.mean(axis=1)
rule = int(np.argmax(rows > 0.8))
mark = trim(logo.crop((0, 0, logo.width, rule - 2)), pad=2)
save(mark, BRAND / "mark")

on_white = Image.new("RGB", (900, 900), "white")
lw = 720
lg = logo.resize((lw, round(logo.height * lw / logo.width)), Image.LANCZOS)
on_white.paste(lg, ((900 - lw) // 2, (900 - lg.height) // 2), lg)
on_white.save(BRAND / "logo-on-white.png", optimize=True)


def square_icon(size, bg=None, scale=0.84):
    c = Image.new("RGBA", (size, size), bg or (0, 0, 0, 0))
    h = round(size * scale)
    w = round(mark.width * h / mark.height)
    m = mark.resize((w, h), Image.LANCZOS)
    c.paste(m, ((size - w) // 2, (size - h) // 2), m)
    return c


square_icon(32).save(BRAND / "favicon-32.png")
square_icon(192).save(BRAND / "favicon-192.png")
square_icon(512).save(BRAND / "favicon-512.png")
square_icon(180, (255, 255, 255, 255), 0.72).convert("RGB").save(BRAND / "apple-touch-icon.png")

# share card: dusk render + logo on a white disc
render_dusk = Image.open(CLIENT / "nebula-render-dusk.jpg").convert("RGB")
og = render_dusk.resize((1200, 675), Image.LANCZOS).crop((0, 22, 1200, 652))
shade = Image.new("L", (1200, 630))
sd = np.linspace(235, 0, 760).astype(np.uint8)
shade.paste(Image.fromarray(np.tile(np.concatenate([sd, np.zeros(440, np.uint8)]), (630, 1))))
og = Image.composite(Image.new("RGB", og.size, (10, 10, 10)), og, shade)
disc = Image.new("RGBA", (300, 300))
ImageDraw.Draw(disc).ellipse((0, 0, 299, 299), fill=(255, 255, 255, 255))
lg = logo.resize((236, round(logo.height * 236 / logo.width)), Image.LANCZOS)
disc.paste(lg, ((300 - 236) // 2, (300 - lg.height) // 2), lg)
og.paste(disc, (70, 70), disc)
d = ImageDraw.Draw(og)
try:
    f1 = ImageFont.truetype("C:/Windows/Fonts/georgiab.ttf", 50)
    f2 = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 26)
except OSError:
    f1 = f2 = ImageFont.load_default()
d.text((70, 410), "Elfin Nebula, Hubballi", font=f1, fill=(255, 255, 255))
d.text((72, 478), "1, 2 & 3 BHK homes · Gopankoppa Sulla Road", font=f2, fill=(232, 196, 130))
og.save(BRAND / "og-image.jpg", quality=86, optimize=True)
print("  wrote site/public/brand/og-image.jpg")

# ------------------------------------------------------------------ renders
print("renders")
save(fit(render_dusk, 1600), NEB / "render-dusk")
save(fit(render_dusk, 900), NEB / "render-dusk-900")
day = xref_image(8)
save(fit(day, 1515), NEB / "render-day")
save(fit(day, 900), NEB / "render-day-900")
night = xref_image(16)
save(fit(night, 1611), NEB / "render-night")
save(fit(night, 900), NEB / "render-night-900")

# sub-brand marks (vector, rendered large)
neb_logo = trim(white_to_alpha(render(0, (1172, 640, 1382, 772), zoom=6)), pad=4)
save(fit(neb_logo, 900), NEB / "nebula-mark")
credai = trim(white_to_alpha(render(0, (922, 72, 1072, 134), zoom=6)), pad=4)
save(fit(credai, 600), BRAND / "credai")

# brochure location map (Page 16)
save(render(0, (34, 30, 862, 640), zoom=2.6), NEB / "location-map", q=84)
site_office = upscale(xref_image(338), 980)
save(site_office, NEB / "site-office")

# ------------------------------------------------------------------ plans
print("plans")
PLANS = {
    # key: (page, clip)
    "typical": (5, (52, 51, 1003, 813)),
    "first": (4, (675, 41, 1674, 826)),
    "ground": (4, (54, 306, 677, 809)),
}
# brochure decorations that bleed into a plan crop (page coords), painted out
MASKS = {"typical": [(915, 51, 1003, 168)]}
for key, (pg, clip) in PLANS.items():
    im = render(pg, clip, zoom=2.6)
    dr = ImageDraw.Draw(im)
    for x0, y0, x1, y1 in MASKS.get(key, []):
        z = 2.6
        dr.rectangle(((x0 - clip[0]) * z, (y0 - clip[1]) * z, (x1 - clip[0]) * z, (y1 - clip[1]) * z), fill="white")
    save(im, NEB / f"plan-{key}", q=84)

# 3D individual plans (page 13) with their transparency masks
for name, (x, m) in {"plan3d-1bhk": (49, 50), "plan3d-2bhk": (47, 48), "plan3d-3bhk": (45, 46)}.items():
    im = trim(xref_image(x, m), pad=2)
    save(upscale(im, 1100), NEB / name, webp_only=True)

# ------------------------------------------------------------------ units data
print("units")
SKIP = re.compile(r"^(LIFT|CORRIDOR|FIRE|UP|DN|V1|ROAD|R|O|A|D|N|E|W|S|TOWER|SECOND|FIRST|\(Typical)", re.I)


def lines(page):
    out = []
    for b in doc[page].get_text("dict")["blocks"]:
        for ln in b.get("lines", []):
            t = "".join(s["text"] for s in ln["spans"]).strip()
            if t:
                x0, y0, x1, y1 = ln["bbox"]
                out.append((t, (x0 + x1) / 2, (y0 + y1) / 2))
    return out


def rooms_from(page, xmin, xmax):
    """Pair room names with the dimension line printed right below them."""
    items = [l for l in lines(page) if xmin <= l[1] <= xmax]
    dims = [l for l in items if re.fullmatch(r"\.?\d+'[\d.]+\"?X\d+'[\d.]+\"?", l[0].replace(" ", ""))]
    names = [l for l in items if re.fullmatch(r"[A-Z][A-Z &/.]+", l[0]) and not SKIP.match(l[0])]
    rooms = []
    for t, x, y in names:
        best = None
        for dt, dx, dy in dims:
            if 0 < dy - y < 14 and abs(dx - x) < 30:
                if best is None or (dy - y) < best[2] - y:
                    best = (dt, dx, dy)
        if best:
            rooms.append((t.rstrip("."), best[0].lstrip("."), x, y))
    return rooms


def build_floor(page, clip, rows, floor_label):
    """rows: (tower, sba_y0, sba_y1, num_y0, num_y1). Each flat has a 'xBHK - SBA' label inside it and its
    door number by the corridor; within a row both are matched left-to-right."""
    ls = [l for l in lines(page) if clip[0] <= l[1] <= clip[2] and clip[1] <= l[2] <= clip[3]]
    nums = [l for l in ls if re.fullmatch(r"\d{3}", l[0])]
    sbas = [l for l in ls if re.match(r"\dBHK - SBA", l[0])]
    W, H = clip[2] - clip[0], clip[3] - clip[1]
    units = []
    for tower, y0, y1, n0, n1 in rows:
        row_s = sorted([s for s in sbas if y0 <= s[2] <= y1], key=lambda s: s[1])
        row_n = sorted([n for n in nums if n0 <= n[2] <= n1], key=lambda n: n[1])
        assert len(row_s) == len(row_n), (tower, [s[0] for s in row_s], [n[0] for n in row_n])
        cuts = [clip[0]] + [(a[1] + b[1]) / 2 for a, b in zip(row_s, row_s[1:])] + [clip[2]]
        for i, (s, num) in enumerate(zip(row_s, row_n)):
            lo, hi = cuts[i], cuts[i + 1]
            m = re.match(r"(\d)BHK - SBA ([\d.]+)", s[0])
            units.append({
                "no": num[0],
                "tower": tower,
                "floor": floor_label,
                "bhk": int(m.group(1)),
                "sba": float(m.group(2)),
                "x": round((s[1] - clip[0]) / W * 100, 2),
                "y": round((s[2] - clip[1]) / H * 100, 2),
                "_band": (lo, hi, y0, y1),
            })
    for u in units:
        del u["_band"]
    return sorted(units, key=lambda u: u["no"])


typical = build_floor(5, PLANS["typical"][1], [
    ("Emerald", 140, 170, 220, 236), ("Emerald", 300, 330, 236, 252),
    ("Orchid", 535, 560, 614, 630), ("Orchid", 700, 720, 630, 646)], "2nd–8th")
first = build_floor(4, PLANS["first"][1], [
    ("Emerald", 130, 155, 208, 226), ("Emerald", 290, 325, 226, 242),
    ("Orchid", 545, 565, 624, 641), ("Orchid", 712, 732, 641, 658)], "1st")

shops = []
gclip = PLANS["ground"][1]
GW, GH = gclip[2] - gclip[0], gclip[3] - gclip[1]
gl = [l for l in lines(4) if gclip[0] <= l[1] <= gclip[2] and gclip[1] <= l[2] <= gclip[3]]
for t, x, y in gl:
    m = re.match(r"SHOP - (\d+)", t)
    if m:
        size = None
        for t2, x2, y2 in gl:
            mm = re.search(r"([\d.]+)\s*sft", t2)
            if mm and abs(x2 - x) < 30 and 0 < y2 - y < 26:
                size = float(mm.group(1))
                break
        shops.append({"no": int(m.group(1)), "sba": size, "x": round((x - gclip[0]) / GW * 100, 2), "y": round((y - gclip[1]) / GH * 100, 2)})
shops.sort(key=lambda s: s["no"])

data = {"typical": typical, "first": first, "shops": shops}
for k in ("typical", "first"):
    print(f"  {k}: {len(data[k])} units", [(u['no'], u['bhk'], u['sba'], len(u.get('rooms', []))) for u in data[k]])
print("  shops:", [(s['no'], s['sba']) for s in shops])
(ROOT / "site" / "src" / "plans.data.js").write_text(
    "// Generated by tools/build_brochure_assets.py from the client's brochure. Do not edit by hand.\n"
    f"export const PLANS = {json.dumps(data, ensure_ascii=False, indent=1)};\n",
    encoding="utf-8",
)

# ------------------------------------------------------------------ life + projects
print("life")
LIFE_IMAGES = {
    "family-home": (4, 0),
    "kids-reading": (15, 0),
    "first-steps": (299, 0),
    "family-play": (42, 43),
    "father-son": (40, 41),
    "girl-ride": (57, 58),
    "couple": (56, 0),
    "gym": (31, 0),
    "celebration": (32, 33),
    "shopping": (35, 0),
    "water": (36, 0),
}
for name, (x, m) in LIFE_IMAGES.items():
    im = xref_image(x, m)
    if im.mode == "RGBA":
        bg = Image.new("RGB", im.size, "white")
        bg.paste(im, (0, 0), im)
        im = bg
    save(upscale(fit(im, 1200), 900 if im.width < 700 else im.width), LIFE / name)

print("projects")
for name, x in {"castle": 75, "sapphire": 74, "oakwood": 76}.items():
    save(upscale(xref_image(x), 900), PROJ / name)
print("done")
