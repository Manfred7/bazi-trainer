"""PNG эмблем от Codex → public/ranks/<id>.webp (256×256), как build-images.py в «Паре вкуса».

    python scripts/build-ranks.py <папка с png>

Эмблема на сайте обрезается кругом (CSS). Медальон на картинке занимает ~93% кадра, поэтому
сначала обрезаем кремовые поля по краям (CROP — доля стороны от центра), чтобы медальон заполнил круг.
"""
import os
import sys

from PIL import Image

RANKS = ['novice', 'amateur', 'adept', 'master', 'magister', 'grandmaster']
CROP = 0.95

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = sys.argv[1]
dst = os.path.join(root, 'public', 'ranks')
os.makedirs(dst, exist_ok=True)

total = 0
for rank in RANKS:
    png = os.path.join(src, rank + '.png')
    if not os.path.exists(png):
        print(f'нет {rank}.png')
        continue
    out = os.path.join(dst, rank + '.webp')
    img = Image.open(png).convert('RGB')
    w, h = img.size
    side = min(w, h) * CROP
    box = ((w - side) / 2, (h - side) / 2, (w + side) / 2, (h + side) / 2)
    img.crop(tuple(round(v) for v in box)).resize((256, 256), Image.LANCZOS).save(out, 'WEBP', quality=82, method=6)
    total += os.path.getsize(out)
print(f'готово, {total // 1024} КБ')
