import pymupdf
doc = pymupdf.open(r"C:\Users\Windows\Downloads\PUSPITA JAYA GIRI.pdf")
page = doc[0]
raw = page.get_text("rawdict")
for b in raw["blocks"]:
    if b["type"] != 0: continue
    for l in b["lines"]:
        for s in l["spans"]:
            if 130 < s["bbox"][1] < 180:
                text = "".join(ch["c"] for ch in s["chars"])
                print("SPAN", tuple(round(v,2) for v in s["bbox"]), repr(text), s["font"], s["size"])
                for ch in s["chars"][:26]:
                    print(f'  {ch["c"]!r} x0={ch["bbox"][0]:7.2f} x1={ch["bbox"][2]:7.2f}')
