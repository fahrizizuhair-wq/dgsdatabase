import pymupdf, os
for name in ["PT.PUSTPITA JAYA GIRI.pdf", "PUSPITA JAYA GIRI.pdf"]:
    path = os.path.join(r"C:\Users\Windows\Downloads", name)
    doc = pymupdf.open(path)
    print("="*100)
    print(name, "pages:", doc.page_count, "size:", doc[0].rect)
    page = doc[0]
    print("images:", [(i[0], i[2], i[3]) for i in page.get_images(full=True)])
    print("--- TEXT ---")
    for b in page.get_text("dict")["blocks"]:
        if b["type"] != 0:
            continue
        for l in b["lines"]:
            for s in l["spans"]:
                print(f'x0={s["bbox"][0]:7.2f} y0={s["bbox"][1]:7.2f} x1={s["bbox"][2]:7.2f} y1={s["bbox"][3]:7.2f} size={s["size"]:5.2f} font={s["font"]:22s} | {s["text"]!r}')
    print("--- DRAWINGS ---")
    for d in page.get_drawings():
        r = d["rect"]
        print(f'{d["type"]:6s} x0={r.x0:7.2f} y0={r.y0:7.2f} x1={r.x1:7.2f} y1={r.y1:7.2f} w={d.get("width")} color={d.get("color")}')
