"""Brilho difuso da Via Láctea para o fundo do Sistema Solar.

Fonte: ESO/S. Brunier, panorama eso0932a (CC BY 4.0), TIF original 6000x3000:
  https://cdn.eso.org/images/original/eso0932a.tif
As estrelas pontuais saem por abertura morfológica (mínimo e depois máximo,
7 px); fica o brilho, as nuvens de poeira e as Nuvens de Magalhães. As estrelas
são desenhadas à parte, a partir do catálogo (build-bgstars.mjs).

uso: python tools/space/build-glow.py caminho/eso0932a.tif
saída: assets/space/milkyway-glow-4k.webp e milkyway-glow-2k.webp
"""
import sys, os
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance

Image.MAX_IMAGE_PIXELS = None
root = os.path.join(os.path.dirname(__file__), '..', '..')
im = Image.open(sys.argv[1]).convert('RGB')
op = im.filter(ImageFilter.MinFilter(7)).filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(2.5))
a = np.asarray(op).astype(np.float32) / 255
a = np.clip((a - 6 / 255) / (1 - 6 / 255), 0, 1) ** 1.05
g = ImageEnhance.Color(Image.fromarray((a * 255 + 0.5).astype(np.uint8))).enhance(1.15)
for w, name in ((4096, 'milkyway-glow-4k.webp'), (2048, 'milkyway-glow-2k.webp')):
    g.resize((w, w // 2), Image.LANCZOS).save(os.path.join(root, 'assets/space', name), quality=92, method=6)
    print(name)
