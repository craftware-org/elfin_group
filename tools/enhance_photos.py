"""Clean burned-in Instagram stickers, then AI-upscale with Real-ESRGAN (x4plus).

usage: python -I enhance.py <posts_dir> <work_dir> <realesrgan_exe> <out_dir>
"""
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageFilter

POSTS, WORK, EXE, OUT = (Path(a) for a in sys.argv[1:5])
WORK.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)

# Stickers near an edge are cropped away (no artifacts at all); captions in the
# middle of a frame get a glyph-only mask (letters brighter than their local
# background) and a tight inpaint. Coordinates are in the 360x640 source frames.
JOBS = {
    "nebula-structure": {
        "src": "2025-10-29_reel_DQZiqUTDXwI.jpg",
        "crop": (0, 130, 360, 640),  # "Elfin" chip sat on the top floor
        "masks": [],
    },
    "emerald-column-casting": {
        "src": "2026-09-20_reel_DdgdVkhP5_Z.jpg",
        "crop": (0, 80, 360, 640),  # "Column Casting" caption + logo watermark
        # "Art Of Concrete": cover with real aggregate texture from just below
        "clone": [((100, 301, 262, 337), 38)],
        "masks": [],
    },
    "nebula-site-oct-2026": {
        "src": "2026-10-01_reel_Dd8hBG-vMfv.jpg",
        "crop": (0, 82, 360, 640),  # logo watermark
        # "therapy" straddles the black/white umbrella seam; both panels are flat fabric,
        # so the patch is rebuilt: seam line fitted through clean points either side.
        "seam_fill": {"rect": (142, 300, 218, 340), "p0": (138, 332), "p1": (222, 311),
                      "dark": (152, 299, 212, 305), "light": (150, 337, 210, 345), "dark_gain": 0.9},
        "masks": [],
    },
    "emerald-site-aug-2026": {
        "src": "2026-08-22_reel_DcXrsjFvmc4.jpg",
        "crop": (0, 134, 360, 640),  # below the "GUESS WHAT?" headline
        "masks": [],
    },
    "nebula-custom-interiors": {
        "src": "2025-10-23_reel_DQLReXUie3K.jpg",
        "masks": [],
    },
}


def clone_patch(img, rect, dy):
    """Poisson-blend a same-size patch from dy pixels below over rect (clone-stamp)."""
    x1, y1, x2, y2 = rect
    patch = img[y1 + dy:y2 + dy, x1:x2].copy()
    m = np.full(patch.shape[:2], 255, np.uint8)
    m[:2, :] = m[-2:, :] = 0
    m[:, :2] = m[:, -2:] = 0
    center = ((x1 + x2) // 2, (y1 + y2) // 2)
    return cv2.seamlessClone(patch, img, m, center, cv2.NORMAL_CLONE)


def seam_fill(img, spec, seed=7):
    """Rebuild a patch of two flat panels split by a straight seam, feathered into the photo."""
    x1, y1, x2, y2 = spec["rect"]
    (ax, ay), (bx, by) = spec["p0"], spec["p1"]
    def stats(r):
        p = img[r[1]:r[3], r[0]:r[2]].reshape(-1, 3).astype(np.float32)
        return np.median(p, 0), p.std(0)
    dark, dark_sd = stats(spec["dark"])
    dark = dark * spec.get("dark_gain", 1.0)  # panel shading deepens towards the seam
    light, light_sd = stats(spec["light"])
    h, w = y2 - y1, x2 - x1
    yy, xx = np.mgrid[y1:y2, x1:x2].astype(np.float32)
    seam_y = ay + (xx - ax) * (by - ay) / (bx - ax)
    t = np.clip((yy - seam_y) / 1.2 + 0.5, 0, 1)[..., None]  # ~1px anti-aliased edge
    rng = np.random.default_rng(seed)
    noise = rng.normal(0, 1, (h, w, 1)).astype(np.float32)
    fill = dark * (1 - t) + light * t + noise * (dark_sd.mean() * (1 - t) + light_sd.mean() * t) * 0.15
    fill = cv2.GaussianBlur(fill, (3, 3), 0.6)
    alpha = np.zeros((h, w), np.float32)
    alpha[3:-3, 3:-3] = 1
    alpha = cv2.GaussianBlur(alpha, (7, 7), 2)[..., None]
    roi = img[y1:y2, x1:x2].astype(np.float32)
    img[y1:y2, x1:x2] = np.clip(roi * (1 - alpha) + fill * alpha, 0, 255).astype(np.uint8)
    return img


def build_mask(img, boxes, panel=None):
    """Caption pixels that stand out from a median-filtered estimate of the background.
    panel=None: bright letters on any background.
    panel="split": bright letters where the surface is dark, letters + shadow where it is
    white, and nothing in between (keeps a black/white seam crisp)."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.int16)
    bg = cv2.medianBlur(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), 21).astype(np.int16)
    diff = gray - bg
    mask = np.zeros(gray.shape, np.uint8)
    for x1, y1, x2, y2 in boxes:
        d = diff[y1:y2, x1:x2]
        if panel == "split":
            b = bg[y1:y2, x1:x2]
            glyph = ((b < 100) & (d > 38)) | ((b >= 170) & (np.abs(d) > 22))
        else:
            glyph = d > 38
        mask[y1:y2, x1:x2][glyph] = 255
    mask = cv2.dilate(mask, np.ones((3, 3), np.uint8), iterations=2)
    if panel == "split":
        mask[(bg >= 100) & (bg < 170)] = 0  # the seam
    return mask


for name, job in JOBS.items():
    img = cv2.imread(str(POSTS / job["src"]))
    for rect, dy in job.get("clone", []):
        img = clone_patch(img, rect, dy)
    if "seam_fill" in job:
        img = seam_fill(img, job["seam_fill"])
    if job["masks"]:
        mask = build_mask(img, job["masks"], job.get("panel"))
        img = cv2.inpaint(img, mask, 3, cv2.INPAINT_TELEA)
        cv2.imwrite(str(WORK / f"{name}-mask.png"), mask)
    if "crop" in job:
        x1, y1, x2, y2 = job["crop"]
        img = img[y1:y2, x1:x2]
    clean = WORK / f"{name}-clean.png"
    cv2.imwrite(str(clean), img)

    up = WORK / f"{name}-x4.png"
    subprocess.run([str(EXE), "-i", str(clean), "-o", str(up), "-n", "realesrgan-x4plus", "-s", "4", "-f", "png"],
                   check=True, cwd=str(EXE.parent), capture_output=True)

    # Blend a little of the plain upscale back in so surfaces keep natural texture.
    ai = Image.open(up).convert("RGB")
    base = Image.open(clean).convert("RGB").resize(ai.size, Image.LANCZOS)
    mixed = Image.blend(ai, base, 0.15)
    target_w = 1080
    target_h = round(mixed.height * target_w / mixed.width)
    final = mixed.resize((target_w, target_h), Image.LANCZOS)
    final = final.filter(ImageFilter.UnsharpMask(radius=1.2, percent=35, threshold=3))
    final.save(OUT / f"{name}.jpg", quality=84, optimize=True, progressive=True)
    final.save(OUT / f"{name}.webp", quality=80, method=6)
    print(f"{name}: {final.size}, jpg {(OUT / f'{name}.jpg').stat().st_size // 1024} KB, "
          f"webp {(OUT / f'{name}.webp').stat().st_size // 1024} KB")
