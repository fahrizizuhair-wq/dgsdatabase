import pymupdf
from PIL import Image
import numpy as np
path = r"C:\Users\Windows\Downloads\PUSPITA JAYA GIRI.pdf"
doc = pymupdf.open(path); page = doc[0]
print("--- spans with color ---")
for b in page.get_text("dict")["blocks"]:
    if b["type"] != 0: continue
    for l in b["lines"]:
        for s in l["spans"]:
            if s["bbox"][1] < 130 and s["bbox"][0] > 380:
                print(f'x={s["bbox"][0]:7.2f} y={s["bbox"][1]:7.2f} color={s["color"]} alpha={s.get("alpha")} size={s["size"]:5.2f} font={s["font"]} | {s["text"]!r}')
# render crop area and cari komponen gelap
clip = pymupdf.Rect(400, 65, 545, 120)
pix = page.get_pixmap(dpi=300, clip=clip)
img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
arr = np.asarray(img.convert("L"))
mask = arr < 128
print("crop size px:", img.size, "dark px:", int(mask.sum()))
# connected components sederhana
from collections import deque
seen = np.zeros_like(mask, dtype=bool)
comps = []
h, w = mask.shape
for y in range(h):
    for x in range(w):
        if mask[y, x] and not seen[y, x]:
            q = deque([(y,x)]); seen[y,x]=True; minx=maxx=x; miny=maxy=y; n=0
            while q:
                cy,cx=q.popleft(); n+=1
                minx=min(minx,cx); maxx=max(maxx,cx); miny=min(miny,cy); maxy=max(maxy,cy)
                for dy in (-1,0,1):
                    for dx in (-1,0,1):
                        ny,nx=cy+dy,cx+dx
                        if 0<=ny<h and 0<=nx<w and mask[ny,nx] and not seen[ny,nx]:
                            seen[ny,nx]=True; q.append((ny,nx))
            if n>=4:
                comps.append((n,minx,miny,maxx,maxy))
comps.sort(reverse=True)
scale=300/72
print("komponen gelap (n, x0pt, y0pt, x1pt, y1pt):")
for n,x0,y0,x1,y1 in comps[:40]:
    print(f" n={n:5d} x={400+x0/scale:7.2f}-{400+x1/scale:7.2f} y={65+y0/scale:7.2f}-{65+y1/scale:7.2f} w={(x1-x0)/scale:5.2f} h={(y1-y0)/scale:5.2f}")
