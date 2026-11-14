"""Generate PNG icons (apple-touch-icon + maskable) from scratch with Pillow."""
from PIL import Image, ImageDraw
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "english-reading-practice", "assets")

BG = (61, 91, 214)          # #3d5bd6
WHITE = (255, 255, 255)
YELLOW = (255, 215, 110)

for size, name in [(180, "icon.png"), (512, "icon-512.png")]:
    img = Image.new("RGBA", (size, size), BG)
    d = ImageDraw.Draw(img)
    s = size / 180.0

    # 圓角底板
    r = int(40 * s)
    img2 = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d2 = ImageDraw.Draw(img2)
    d2.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=BG + (255,))
    img = img2
    d = ImageDraw.Draw(img)

    # 打開的書本
    lw = max(2, int(9 * s))
    cx, top, bottom = size / 2, 52 * s, 130 * s
    # 左頁
    d.line([(cx, top), (cx, bottom)], fill=WHITE, width=lw)
    d.arc([18 * s, 44 * s, 90 * s, 88 * s], 180, 300, fill=WHITE, width=lw) if False else None
    d.polygon([(cx, top), (50 * s, 40 * s), (26 * s, 46 * s), (26 * s, 118 * s), (50 * s, 112 * s), (cx, bottom)],
              outline=WHITE, width=lw)
    d.polygon([(cx, top), (130 * s, 40 * s), (154 * s, 46 * s), (154 * s, 118 * s), (130 * s, 112 * s), (cx, bottom)],
              outline=WHITE, width=lw)
    # 底線
    d.line([(26 * s, 138 * s), (154 * s, 138 * s)], fill=WHITE, width=max(2, int(7 * s)))
    # 光點
    pr = int(6 * s)
    d.ellipse([cx - pr, 32 * s - pr, cx + pr, 32 * s + pr], fill=YELLOW)

    if name == "icon.png":
        img = img.resize((180, 180), Image.LANCZOS)
    img.save(os.path.join(OUT, name))
    print("saved", name)
