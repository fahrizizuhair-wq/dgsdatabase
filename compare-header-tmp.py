import pymupdf, os, hashlib
from PIL import Image
base = r"C:\Users\Windows\Downloads"
for name in ["PT.PUSTPITA JAYA GIRI.pdf", "PUSPITA JAYA GIRI.pdf", r"C:\Users\Windows\Downloads\Template surat jalan.pdf"]:
    path = name if os.path.isabs(name) else os.path.join(base, name)
    if not os.path.exists(path):
        print("tidak ada:", path); continue
    doc = pymupdf.open(path)
    for img in doc[0].get_images(full=True):
        xref = img[0]
        pix = doc.extract_image(xref)
        h = hashlib.md5(pix["image"]).hexdigest()
        print(f"{os.path.basename(path):32s} xref={xref} {pix['width']}x{pix['height']} ext={pix['ext']} md5={h}")
        out = os.path.join(r"C:\Users\Windows\Documents\WEB DATABASE DGS", f"header-extract-{xref}-tmp.{pix['ext']}")
        open(out, "wb").write(pix["image"])
print("--- file pembanding ---")
for p in [r"C:\Users\Windows\Documents\WEB DATABASE DGS\public\images\surat-jalan-header.png", os.path.join(base, "PT.PUSPITA.PNG")]:
    if os.path.exists(p):
        im = Image.open(p)
        print(f"{os.path.basename(p):32s} {im.size} md5={hashlib.md5(open(p,'rb').read()).hexdigest()}")
