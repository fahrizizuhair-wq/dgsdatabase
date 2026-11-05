import pymupdf
for name in [r"C:\Users\Windows\Downloads\PT.PUSTPITA JAYA GIRI.pdf"]:
    doc = pymupdf.open(name); page = doc[0]
    print(name)
    for b in page.get_text("dict")["blocks"]:
        if b["type"] != 0: continue
        for l in b["lines"]:
            for s in l["spans"]:
                if s["bbox"][1] < 130 and s["bbox"][0] > 380:
                    print(f'x={s["bbox"][0]:7.2f} y={s["bbox"][1]:7.2f} x1={s["bbox"][2]:7.2f} color={s["color"]} size={s["size"]:5.2f} font={s["font"]} | {s["text"]!r}')
