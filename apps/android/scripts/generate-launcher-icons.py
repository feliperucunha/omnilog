#!/usr/bin/env python3
"""
Sync Android launcher mipmaps from the web app logo (dark variant for black splash/background).

Run from repo root:
  python3 apps/android/scripts/generate-launcher-icons.py

Requires: Pillow (pip install pillow)
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[3]
RES = REPO_ROOT / "apps/android/android/app/src/main/res"
# Same asset as splash + adaptive icon foreground (values/styles.xml, mipmap-anydpi-v26)
LOGO_SRC = REPO_ROOT / "apps/web/public/logo-dark.png"
DRAWABLE_LOGO = RES / "drawable" / "logo_splash.png"
# Match drawable/logo_splash_square.xml scale
LOGO_SCALE = 0.65


def composite_icon(size: int, src: Path) -> Image.Image:
    logo = Image.open(src).convert("RGBA")
    bg = Image.new("RGBA", (size, size), (0, 0, 0, 255))
    lw, lh = logo.size
    target = int(size * LOGO_SCALE)
    ratio = min(target / lw, target / lh)
    nw, nh = max(1, int(lw * ratio)), max(1, int(lh * ratio))
    logo = logo.resize((nw, nh), Image.Resampling.LANCZOS)
    x, y = (size - nw) // 2, (size - nh) // 2
    bg.alpha_composite(logo, (x, y))
    return bg


def main() -> None:
    if not LOGO_SRC.is_file():
        raise SystemExit(f"Missing logo: {LOGO_SRC}")

    DRAWABLE_LOGO.parent.mkdir(parents=True, exist_ok=True)
    import shutil

    shutil.copyfile(LOGO_SRC, DRAWABLE_LOGO)
    print(f"Copied {LOGO_SRC.name} -> {DRAWABLE_LOGO.relative_to(REPO_ROOT)}")

    legacy = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192,
    }
    foreground = {
        "mipmap-mdpi": 108,
        "mipmap-hdpi": 162,
        "mipmap-xhdpi": 216,
        "mipmap-xxhdpi": 324,
        "mipmap-xxxhdpi": 432,
    }

    for folder, px in legacy.items():
        out_dir = RES / folder
        out_dir.mkdir(parents=True, exist_ok=True)
        img = composite_icon(px, LOGO_SRC)
        img.save(out_dir / "ic_launcher.png", optimize=True)
        img.save(out_dir / "ic_launcher_round.png", optimize=True)

    for folder, px in foreground.items():
        out_dir = RES / folder
        img = composite_icon(px, LOGO_SRC)
        img.save(out_dir / "ic_launcher_foreground.png", optimize=True)

    print("Updated mipmap ic_launcher / ic_launcher_round / ic_launcher_foreground.")


if __name__ == "__main__":
    main()
