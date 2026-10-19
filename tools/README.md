# tools

## enhance_photos.py
Cleans burned-in Instagram captions and watermarks from the site photos, then sharpens them 4x with
[Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN) (`realesrgan-x4plus`, ncnn-vulkan build), and exports
1080px-wide JPG + WebP for `site/public/images/`.

- Stickers on an edge are cropped off. Mid-frame captions get either a glyph-only mask, a clone-stamp from nearby
  texture, or (for the two-tone umbrella) a rebuilt seam patch. Coordinates in `JOBS` are for the 360x640 source frames.
- About 15% of a plain upscale is blended back in so surfaces keep natural texture rather than an "AI-smooth" look.

```bash
pip install opencv-python-headless numpy pillow
python -I enhance_photos.py ../assets/posts <work_dir> <path-to>/realesrgan-ncnn-vulkan.exe ../site/public/images
```

Get the Real-ESRGAN Windows build from the official v0.2.5.0 release:
`realesrgan-ncnn-vulkan-20220424-windows.zip`.
