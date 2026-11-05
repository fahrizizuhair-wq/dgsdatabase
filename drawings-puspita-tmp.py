import pymupdf
doc = pymupdf.open(r"C:\Users\Windows\Downloads\PUSPITA JAYA GIRI.pdf")
page = doc[0]
for i, d in enumerate(page.get_drawings()):
    print("DRAW", i, "type=", d["type"], "rect=", d["rect"], "width=", d.get("width"), "color=", d.get("color"), "fill=", d.get("fill"))
    for it in d["items"]:
        print("   item:", it)
