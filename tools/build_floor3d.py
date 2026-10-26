"""Turn the brochure's coloured typical floor plan into 3D data for the cut-away in the 3D story.

Reads the plan raster straight from the brochure PDF and writes:
  site/src/story/floor3d.data.js         wall boxes (and low railings/counters) per tower, in metres
  site/public/images/nebula/floor-*.webp the plan of each tower, used as the floor texture

The plan is drawn at ~24 px per metre (the 5'0" corridor and the 10'x12' bedrooms agree). Walls are the
thick mid-grey strokes and dark columns; furniture fabric is grey too, so anything chunky is dropped
and only long, thin strokes are kept. The masks are split into axis-aligned rectangles.

World axes: each tower's long side (plan x) runs along world -z, plan y runs along world +x.

Usage (from the repo root):  python tools/build_floor3d.py
"""
import json
from pathlib import Path

import cv2
import numpy as np
import pymupdf as fitz
from PIL import Image, ImageChops, ImageEnhance

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / "assets" / "client" / "elfin-nebula-brochure.pdf"
OUT_JS = ROOT / "site" / "src" / "story" / "floor3d.data.js"
OUT_IMG = ROOT / "site" / "public" / "images" / "nebula"
PX_PER_M = 24.0
STEP = 2  # rectangles are found on a 2 px grid (~8 cm)

doc = fitz.open(PDF)
page = doc[5]
raw = None
for info in page.get_images(full=True):
    pix = fitz.Pixmap(doc, info[0])
    if pix.width == 1268 and pix.height == 1016:
        if pix.n - pix.alpha >= 4:
            pix = fitz.Pixmap(fitz.csRGB, pix)
        raw = Image.frombytes("RGBA" if pix.alpha else "RGB", (pix.width, pix.height), pix.samples).convert("RGB")
assert raw is not None, "typical floor plan raster not found"
im = np.asarray(raw).astype(np.int16)

sat = im.max(axis=2) - im.min(axis=2)
val = im.mean(axis=2)
k = lambda w, h: cv2.getStructuringElement(cv2.MORPH_RECT, (w, h))
grey = ((sat < 18) & (val > 30) & (val < 165)).astype(np.uint8)
chunky = cv2.dilate(cv2.morphologyEx(grey, cv2.MORPH_OPEN, k(13, 13)), k(5, 5))  # beds, sofas
thin = grey & (1 - chunky)
strokes = cv2.morphologyEx(thin, cv2.MORPH_OPEN, k(22, 1)) | cv2.morphologyEx(thin, cv2.MORPH_OPEN, k(1, 22))
columns = cv2.morphologyEx(((sat < 18) & (val < 80)).astype(np.uint8), cv2.MORPH_OPEN, k(5, 5))
walls = cv2.morphologyEx(strokes, cv2.MORPH_OPEN, k(4, 4)) | columns
low = strokes & (1 - cv2.dilate(walls, k(3, 3)))  # railings, counters, window lines

# the two towers on the sheet: Tower Emerald above, Tower Orchid below
ys = np.where(walls.any(axis=1))[0]
gap = next(y for y in range(450, 560) if not walls[y].any())
towers = {"emerald": (0, gap), "orchid": (gap, im.shape[0])}


def rects(mask):
    """Greedy split of a binary mask into axis-aligned rectangles (pixel coords, on the STEP grid)."""
    m = mask[::STEP, ::STEP].astype(bool)
    h, w = m.shape
    used = np.zeros_like(m)
    out = []
    for y in range(h):
        x = 0
        while x < w:
            if m[y, x] and not used[y, x]:
                x1 = x
                while x1 < w and m[y, x1] and not used[y, x1]:
                    x1 += 1
                y1 = y + 1
                while y1 < h and m[y1, x:x1].all() and not used[y1, x:x1].any():
                    y1 += 1
                used[y:y1, x:x1] = True
                out.append((x * STEP, y * STEP, x1 * STEP, y1 * STEP))
                x = x1
            else:
                x += 1
    return out


data = {"pxPerM": PX_PER_M}
hi = Image.open(OUT_IMG / "plan-typical.webp").convert("RGB") if (OUT_IMG / "plan-typical.webp").exists() else None
for name, (y0, y1) in towers.items():
    band = walls[y0:y1]
    rows = np.where(band.any(axis=1))[0]
    cols = np.where(band.any(axis=0))[0]
    bx0, bx1 = int(cols.min()), int(cols.max()) + 1
    by0, by1 = int(rows.min()) + y0, int(rows.max()) + y0 + 1
    cx, cy = (bx0 + bx1) / 2, (by0 + by1) / 2

    def to_world(r):
        px0, py0, px1, py1 = r
        # plan y -> world +x, plan x -> world -z
        return [round((py0 - cy) / PX_PER_M, 2), round(-(px1 - cx) / PX_PER_M, 2), round((py1 - cy) / PX_PER_M, 2), round(-(px0 - cx) / PX_PER_M, 2)]

    sub = lambda m: np.pad(m[by0:by1, bx0:bx1], ((by0, m.shape[0] - by1), (bx0, m.shape[1] - bx1)))
    wall_rects = [to_world(r) for r in rects(sub(walls)) if (r[2] - r[0]) * (r[3] - r[1]) >= 8]
    low_rects = [to_world(r) for r in rects(sub(low)) if max(r[2] - r[0], r[3] - r[1]) >= 10]
    data[name] = {
        "w": round((by1 - by0) / PX_PER_M, 2),  # world x extent
        "d": round((bx1 - bx0) / PX_PER_M, 2),  # world z extent
        "walls": [v for r in wall_rects for v in r],
        "low": [v for r in low_rects for v in r],
    }
    # floor texture: the same crop, from the sharper upscaled plan when available
    if hi is not None:
        f = hi.width / raw.width
        crop = hi.crop((round(bx0 * f), round(by0 * f), round(bx1 * f), round(by1 * f)))
    else:
        crop = raw.crop((bx0, by0, bx1, by1))
    # the plan's tiles are very pale; seen from a distance in 3D they read as white, so the floor texture
    # gets richer colour and warmer whites (wood bedrooms, blue baths, tiled living areas stand out)
    crop = ImageEnhance.Color(crop).enhance(1.7)
    crop = ImageEnhance.Contrast(crop).enhance(1.18)
    crop = ImageChops.multiply(crop, Image.new("RGB", crop.size, (236, 221, 200)))
    crop.save(OUT_IMG / f"floor-{name}.webp", "WEBP", quality=86, method=6)
    print(f"{name}: {data[name]['w']} x {data[name]['d']} m, {len(wall_rects)} wall boxes, {len(low_rects)} low boxes, texture {crop.size}")

OUT_JS.write_text(
    "// Generated by tools/build_floor3d.py from the brochure's typical floor plan. Do not edit by hand.\n"
    "// walls/low: flat [x0, z0, x1, z1, ...] rectangles in metres, centred on each tower.\n"
    f"export const FLOOR3D = {json.dumps(data, separators=(',', ':'))};\n",
    encoding="utf-8",
)
print("wrote", OUT_JS.relative_to(ROOT), f"{OUT_JS.stat().st_size // 1024} KB")
