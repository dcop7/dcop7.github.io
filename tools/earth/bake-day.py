"""Bake the Realtime Earth day texture from NASA GIBS Blue Marble (public domain).
Land = Blue Marble shaded relief (gamma-lifted, gently saturated).
Water = a natural deep-ocean palette driven by the bathymetry brightness
(shallow shelves lighter/teal, abyss deep navy) with a hint of relief detail."""
import sys
import numpy as np
from PIL import Image, ImageFilter

src = sys.argv[1]
out = sys.argv[2]
im = Image.open(src).convert('RGB')
a = np.asarray(im).astype(np.float32) / 255.0
r, g, b = a[..., 0], a[..., 1], a[..., 2]

# water mask: blue-dominant pixels; soften the coastline a touch
water = (((b > r * 1.18 + 0.02) & (b > g * 1.02) & (b > 0.12)) | (a.max(-1) < 0.09)).astype(np.float32)
m = Image.fromarray((water * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
w = np.asarray(m).astype(np.float32)[..., None] / 255.0

# land: gamma lift + saturation
land = np.clip(a, 0, 1) ** 0.82
lum = (land[..., 0:1] * 0.2126 + land[..., 1:2] * 0.7152 + land[..., 2:3] * 0.0722)
land = np.clip(lum + (land - lum) * 1.12, 0, 1)

# water: depth proxy = brightness of the bathymetry shading (bright = shallow)
depth = np.clip((b - 0.18) / 0.55, 0, 1)[..., None]
deep = np.array([0.028, 0.098, 0.235], np.float32)
mid = np.array([0.045, 0.185, 0.385], np.float32)
shallow = np.array([0.120, 0.400, 0.560], np.float32)
t1 = np.clip(depth * 2.0, 0, 1)
t2 = np.clip(depth * 2.0 - 1.0, 0, 1) ** 1.6
wcol = deep + (mid - deep) * t1
wcol = wcol + (shallow - wcol) * t2
# keep a little of the relief texture so the sea floor isn't flat plastic
detail = (b[..., None] - np.asarray(Image.fromarray((b * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))).astype(np.float32)[..., None] / 255.0)
wcol = np.clip(wcol + detail * 0.35, 0, 1)

res = land * (1 - w) + wcol * w
img = Image.fromarray((np.clip(res, 0, 1) * 255 + 0.5).astype(np.uint8))
for size, path in ((int(sys.argv[3]) if len(sys.argv) > 3 else 4096, out),):
    img.resize((size, size // 2), Image.LANCZOS).save(path, quality=86, optimize=True, progressive=True)
print('mean', [round(x * 255) for x in res.reshape(-1, 3).mean(0)])
