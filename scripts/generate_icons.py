"""Generate On Record install icons with Pillow (run only when assets change)."""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1] / "public"
ROOT.mkdir(exist_ok=True)


def icon(size: int) -> None:
    scale = size / 512
    image = Image.new("RGB", (size, size), "#17141f")
    draw = ImageDraw.Draw(image)

    def circle(cx: float, cy: float, r: float, **style) -> None:
        draw.ellipse(tuple(round(v * scale) for v in (cx - r, cy - r, cx + r, cy + r)), **style)

    # A vinyl disc inside the maskable safe zone, with grooves, a volt label,
    # and the coral "recording" light.
    circle(256, 256, 190, fill="#2a2536")
    for radius in (172, 150, 128):
        circle(256, 256, radius, outline="#3a3548", width=max(1, round(5 * scale)))
    circle(256, 256, 84, fill="#c6f432")
    circle(256, 256, 18, fill="#17141f")
    circle(318, 214, 22, fill="#ff6a3d")
    image.save(ROOT / f"icon-{size}.png", optimize=True)


for dimension in (192, 512):
    icon(dimension)
