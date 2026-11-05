import pymupdf
for name in [r"C:\Users\Windows\Downloads\PUSPITA JAYA GIRI.pdf", r"C:\Users\Windows\Downloads\PT.PUSTPITA JAYA GIRI.pdf"]:
    doc = pymupdf.open(name)
    page = doc[0]
    print("="*80); print(name)
    print("image rects:", page.get_image_rects(doc[0].get_images(full=True)[0][0]))
    print("annotations:", list(page.annots()) if page.annots() else None)
    print("widgets:", list(page.widgets()) if page.widgets() else None)
    # gambar semua teks mentah termasuk spasi
    print("raw text:")
    print(repr(page.get_text()))
