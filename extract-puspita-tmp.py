from PIL import Image
import pymupdf, os
# simpan header Puspita dari PDF ke public/images
doc = pymupdf.open(r"C:\Users\Windows\Downloads\PUSPITA JAYA GIRI.pdf")
pix = doc.extract_image(doc[0].get_images(full=True)[0][0])
out = r"C:\Users\Windows\Documents\WEB DATABASE DGS\public\images\surat-jalan-header-puspita.png"
open(out, "wb").write(pix["image"])
print("ditulis:", out, Image.open(out).size, len(pix["image"]), "bytes")
# render halaman ke PNG untuk referensi
pg = doc[0].get_pixmap(dpi=150)
ref = os.path.join(os.environ["TEMP"], "puspita-reference.png")
pg.save(ref)
print("referensi render:", ref)
