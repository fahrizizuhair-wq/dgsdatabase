const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

// ============================================================
//  EXPORT EXCEL PAYMENT REQUEST — mengikuti sheet "PR Sampel"
//  pada file contoh "PR - Seragam Team Sales Force.xlsx".
// ============================================================
const LOGO_PATH = path.join(__dirname, '..', 'public', 'images', 'pr-logo.png');

const WARNA = {
  group: ['D9EAD3', 'E6B8AF', 'FFE599', 'EAD1DC'],
  headerBlue: 'CFE2F3',
  kuning: 'FFFF00',
  kream: 'FFF2CC',
  merah: 'FF0000',
  hitam: '000000',
};

const SISI_TIPIS = { style: 'thin', color: { argb: 'FF000000' } };
const SISI_MEDIUM = { style: 'medium', color: { argb: 'FF000000' } };
const BORDER_TIPIS = { top: SISI_TIPIS, left: SISI_TIPIS, bottom: SISI_TIPIS, right: SISI_TIPIS };
const BORDER_MEDIUM = { top: SISI_MEDIUM, left: SISI_MEDIUM, bottom: SISI_MEDIUM, right: SISI_MEDIUM };
const BORDER_POLOS = {};

const FONT = { name: 'Arial', size: 10, color: { theme: 1 } };
const FONT_TEBAL = { name: 'Arial', size: 10, bold: true, color: { theme: 1 } };
const FONT_JUDUL = { name: 'Arial', size: 14, bold: true, color: { theme: 1 } };
const FONT_MERAH = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFF0000' } };

const FILL_POLOS = { type: 'pattern', pattern: 'none' };
const UANG = '[$Rp     ]#,##0';
const TANGGAL = 'dd mmmm yyyy';

const RATA_KIRI = { horizontal: 'left', vertical: 'middle', wrapText: true };
const RATA_TENGAH = { horizontal: 'center', vertical: 'middle', wrapText: true };
const RATA_KANAN = { horizontal: 'right', vertical: 'middle', wrapText: true };

const LEBAR_KOLOM = [16, 1.5, 28.38, 7.75, 12.88, 18.75, 20.13];

function salin(nilai) {
  return nilai == null ? nilai : JSON.parse(JSON.stringify(nilai));
}

function isiFill(warna) {
  if (!warna) return salin(FILL_POLOS);
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + String(warna).replace(/^FF/, '') } };
}

function gaya(sel, opsi = {}) {
  sel.font = salin(opsi.font || FONT);
  sel.fill = salin(opsi.fill || FILL_POLOS);
  sel.border = salin(opsi.border == null ? BORDER_POLOS : opsi.border);
  sel.alignment = salin(opsi.align || RATA_KIRI);
  sel.numFmt = opsi.numFmt || 'General';
}

function tulis(ws, baris, kolom, nilai, opsi = {}) {
  const sel = ws.getCell(baris, kolom);
  sel.value = nilai;
  gaya(sel, opsi);
  return sel;
}

function tulisGabung(ws, b1, k1, b2, k2, nilai, opsi = {}) {
  if (b1 !== b2 || k1 !== k2) ws.mergeCells(b1, k1, b2, k2);
  for (let b = b1; b <= b2; b += 1) {
    for (let k = k1; k <= k2; k += 1) {
      gaya(ws.getCell(b, k), opsi);
    }
  }
  const sel = ws.getCell(b1, k1);
  sel.value = nilai;
  return sel;
}

function teks(nilai, pengganti = '-') {
  const hasil = String(nilai == null ? '' : nilai).trim();
  return hasil || pengganti;
}

function angka(nilai) {
  return Number(nilai) || 0;
}

function tanggalAtauTeks(nilai) {
  if (!nilai) return '-';
  const t = nilai instanceof Date ? nilai : new Date(nilai);
  if (isNaN(t.getTime())) return String(nilai);
  return t;
}

function formatTanggalPendek(nilai) {
  if (!nilai) return '-';
  const t = nilai instanceof Date ? nilai : new Date(nilai);
  if (isNaN(t.getTime())) return String(nilai);
  return t.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function tinggi(ws, baris, nilai) {
  if (nilai) ws.getRow(baris).height = nilai;
}

function siapkanLembar(ws) {
  LEBAR_KOLOM.forEach((lebar, indeks) => {
    ws.getColumn(indeks + 1).width = lebar;
  });

  ws.sheetView = null;
  ws.pageSetup = {
    paperSize: 9,
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    scale: 100,
    horizontalCentered: true,
    verticalCentered: false,
    printOptions: { gridLines: false, headings: false },
  };
  if (!ws.sheetProperties) ws.sheetProperties = {};
  ws.sheetProperties.pageSetUpPr = { fitToPage: true };
}

function headerDokumen(ws, wb) {
  tinggi(ws, 1, 18.75);
  tinggi(ws, 2, 38.25);
  tinggi(ws, 3, 35.25);
  tinggi(ws, 4, 32.25);

  for (let k = 1; k <= 7; k += 1) {
    tulis(ws, 1, k, null, { font: FONT_JUDUL, align: RATA_TENGAH });
    tulis(ws, 2, k, null, { font: FONT, align: RATA_TENGAH });
    tulis(ws, 3, k, null, { font: FONT, align: RATA_TENGAH });
    tulis(ws, 4, k, null, {
      font: { name: 'Calibri', size: 11, color: { theme: 1 } },
      fill: isiFill(WARNA.headerBlue),
      align: { horizontal: 'left', vertical: 'top' },
    });
  }

  tulisGabung(ws, 2, 1, 3, 7, null, { font: FONT, align: RATA_TENGAH });
  if (fs.existsSync(LOGO_PATH)) {
    try {
      const imageId = wb.addImage({
        buffer: fs.readFileSync(LOGO_PATH),
        extension: 'png',
      });
      ws.addImage(imageId, {
        tl: { col: 0, row: 1, colOffset: 0, rowOffset: 0 },
        ext: { width: 778, height: 128 },
      });
    } catch (err) {
      // Logo hanya dekoratif; export tetap berjalan bila gambar gagal disisipkan.
    }
  }

  tulisGabung(ws, 5, 1, 5, 7, 'Payment Request', {
    font: FONT_JUDUL,
    align: RATA_TENGAH,
  });
  tinggi(ws, 5, 24);
}

function infoDokumen(ws, dc) {
  const baris = [
    [7, 'Pekerjaan', dc.pekerjaan, false],
    [8, 'Est. Transfer', tanggalAtauTeks(dc.estTransfer), true],
    [9, 'Lokasi', dc.lokasi, false],
    [10, 'Detail', dc.detail, true],
  ];

  baris.forEach(([b, label, nilai, gabung]) => {
    tinggi(ws, b, 20);
    tulis(ws, b, 1, label, { font: FONT, align: RATA_KIRI });
    tulis(ws, b, 2, ':', { font: FONT, align: RATA_KIRI });
    if (gabung) {
      tulisGabung(ws, b, 3, b, 6, nilai, {
        font: FONT,
        align: RATA_KIRI,
        numFmt: b === 8 && nilai instanceof Date ? TANGGAL : 'General',
      });
      tulis(ws, b, 7, null, { font: FONT, align: RATA_KIRI });
    } else {
      tulis(ws, b, 3, nilai, {
        font: FONT,
        align: RATA_KIRI,
        numFmt: b === 8 && nilai instanceof Date ? TANGGAL : 'General',
      });
      for (let k = 4; k <= 7; k += 1) tulis(ws, b, k, null, { font: FONT, align: RATA_KIRI });
    }
  });
}

function ringkasanPenerima(ws, dc) {
  const penerima = dc.penerima || [];
  penerima.forEach((p, indeks) => {
    const warna = WARNA.group[indeks % WARNA.group.length];
    const fill = isiFill(warna);
    const awal = 11 + indeks * 3;

    tinggi(ws, awal, 20);
    tulis(ws, awal, 1, `${p.no || indeks + 1}. ${teks(p.summaryTitle)}`, {
      font: FONT_TEBAL,
      fill,
      align: { horizontal: 'left', vertical: 'top' },
    });
    for (let k = 2; k <= 7; k += 1) {
      tulis(ws, awal, k, null, {
        font: k === 2 || k === 3 ? FONT_TEBAL : FONT,
        fill,
        align: { horizontal: 'left', vertical: 'top' },
      });
    }

    tinggi(ws, awal + 1, 20);
    tulis(ws, awal + 1, 1, 'Cost Summary', { font: FONT, fill, align: RATA_KIRI });
    tulis(ws, awal + 1, 2, ':', { font: FONT, fill, align: RATA_KIRI });
    tulis(ws, awal + 1, 3, angka(p.total), {
      font: FONT_TEBAL,
      fill,
      align: RATA_KIRI,
      numFmt: UANG,
    });
    tulis(ws, awal + 1, 4, teks(p.terbilang), { font: FONT, fill, align: RATA_KIRI });
    for (let k = 5; k <= 7; k += 1) tulis(ws, awal + 1, k, null, { font: FONT, fill, align: RATA_KIRI });

    tinggi(ws, awal + 2, 20);
    tulis(ws, awal + 2, 1, 'Bank/No. Rek', { font: FONT, fill, align: RATA_KIRI });
    tulis(ws, awal + 2, 2, ':', { font: FONT, fill, align: RATA_KIRI });
    tulis(ws, awal + 2, 3, teks(p.rekening), { font: FONT, fill, align: RATA_KIRI });
    for (let k = 4; k <= 7; k += 1) tulis(ws, awal + 2, k, null, { font: FONT, fill, align: RATA_KIRI });
  });

  const lampiranBaris = 11 + penerima.length * 3;
  tulis(ws, lampiranBaris, 1, 'Lampiran', { font: FONT, align: RATA_KIRI });
  tulis(ws, lampiranBaris, 2, ':', { font: FONT, align: RATA_KIRI });
  tulisGabung(ws, lampiranBaris, 3, lampiranBaris, 6, teks(dc.lampiran), {
    font: FONT,
    align: RATA_KIRI,
  });
  tulis(ws, lampiranBaris, 7, null, { font: FONT, align: RATA_KIRI });
  tinggi(ws, lampiranBaris, 20);

  return lampiranBaris;
}

function tabelPembayaran(ws, dc, setelahLampiran) {
  const spacer = setelahLampiran + 1;
  tinggi(ws, spacer, 6.75);
  for (let k = 1; k <= 7; k += 1) tulis(ws, spacer, k, null, { font: FONT });

  const header = spacer + 1;
  tinggi(ws, header, 30.75);
  const opsiHeader = { font: FONT_TEBAL, border: BORDER_MEDIUM, align: RATA_TENGAH };
  tulis(ws, header, 1, 'No', opsiHeader);
  tulisGabung(ws, header, 2, header, 3, 'Deskripsi', opsiHeader);
  tulis(ws, header, 4, 'Qty', opsiHeader);
  tulis(ws, header, 5, 'Harga Satuan', opsiHeader);
  tulis(ws, header, 6, 'Total Harga', opsiHeader);
  tulis(ws, header, 7, 'Rekening Tujuan', opsiHeader);

  let baris = header + 1;
  const penerima = dc.penerima || [];

  penerima.forEach((p, indeks) => {
    const warna = WARNA.group[indeks % WARNA.group.length];
    const fill = isiFill(warna);
    const items = (p.items && p.items.length ? p.items : [{ desc: '', qty: 1, price: 0, total: 0 }]).slice();
    const grupAwal = baris;
    const grupAkhir = baris + items.length;

    tinggi(ws, baris, 28);
    tulisGabung(ws, grupAwal, 1, grupAkhir, 1, p.no || indeks + 1, {
      font: FONT_TEBAL,
      border: BORDER_MEDIUM,
      align: RATA_TENGAH,
    });
    tulisGabung(ws, baris, 2, baris, 6, teks(p.vendorName || p.summaryTitle), {
      font: FONT_TEBAL,
      border: BORDER_MEDIUM,
      align: RATA_KIRI,
    });
    tulis(ws, baris, 7, teks(p.rekening), {
      font: FONT,
      border: BORDER_MEDIUM,
      align: RATA_TENGAH,
    });
    baris += 1;

    items.forEach((it) => {
      tinggi(ws, baris, 24);
      tulisGabung(ws, baris, 2, baris, 3, teks(it.desc), {
        font: FONT,
        border: BORDER_TIPIS,
        align: RATA_KIRI,
      });
      tulis(ws, baris, 4, angka(it.qty), {
        font: FONT,
        border: BORDER_TIPIS,
        align: RATA_TENGAH,
      });
      tulis(ws, baris, 5, angka(it.price), {
        font: FONT,
        border: BORDER_TIPIS,
        align: RATA_KANAN,
        numFmt: UANG,
      });
      tulis(ws, baris, 6, angka(it.total), {
        font: FONT,
        border: BORDER_TIPIS,
        align: RATA_KANAN,
        numFmt: UANG,
      });
      tulis(ws, baris, 7, null, { font: FONT, border: BORDER_TIPIS, align: RATA_KIRI });
      baris += 1;
    });

    tinggi(ws, baris, 24);
    tulisGabung(ws, baris, 1, baris, 5, 'Total Pembayaran', {
      font: FONT_TEBAL,
      fill,
      border: BORDER_MEDIUM,
      align: RATA_TENGAH,
    });
    tulis(ws, baris, 6, angka(p.total), {
      font: FONT_TEBAL,
      fill,
      border: BORDER_MEDIUM,
      align: RATA_KANAN,
      numFmt: UANG,
    });
    tulis(ws, baris, 7, teks(p.rekening), {
      font: FONT,
      fill,
      border: BORDER_MEDIUM,
      align: RATA_KIRI,
    });
    baris += 1;
  });

  if (!penerima.length) {
    tulisGabung(ws, baris, 1, baris, 7, 'Belum ada rincian biaya.', {
      font: FONT_TEBAL,
      border: BORDER_TIPIS,
      align: RATA_TENGAH,
    });
    baris += 1;
  }

  return baris;
}

function tandaTangan(ws, dc, pengajuan, setelahTabel) {
  const kosong = setelahTabel + 1;
  tinggi(ws, kosong, 4.5);
  for (let k = 1; k <= 7; k += 1) tulis(ws, kosong, k, null, { font: FONT });

  const awal = kosong + 1;
  const tanggal = tanggalAtauTeks(
    pengajuan && (pengajuan.tanggalPengajuan || pengajuan.createdAt),
  );

  tinggi(ws, awal, 20);
  tulis(ws, awal, 1, 'Mengajukan,', { font: FONT, align: RATA_KIRI });
  tulis(ws, awal, 4, 'Approved by,', { font: FONT, align: RATA_KIRI });
  tulis(ws, awal, 7, 'Mengetahui,', { font: FONT, align: RATA_KIRI });

  if (tanggal instanceof Date) {
    tulis(ws, awal + 1, 1, tanggal, { font: FONT, align: RATA_KIRI, numFmt: TANGGAL });
  } else {
    tulis(ws, awal + 1, 1, teks(tanggal), { font: FONT, align: RATA_KIRI });
  }

  const barisNama = awal + 6;
  const barisJabatan = awal + 7;
  tinggi(ws, barisNama, 22);
  tinggi(ws, barisJabatan, 22);

  const namaPemohon =
    (pengajuan && (pengajuan.pemohon || pengajuan.diinputOleh)) ||
    (dc.info && dc.info.namaLpj) ||
    'Admin';

  const garisAtas = { top: SISI_TIPIS };
  tulis(ws, barisNama, 1, teks(namaPemohon), { font: FONT_TEBAL, border: garisAtas, align: RATA_TENGAH });
  tulis(ws, barisNama, 4, 'Dani Kurniawan', { font: FONT_TEBAL, border: garisAtas, align: RATA_TENGAH });
  tulis(ws, barisNama, 7, 'Nila Akbaria', { font: FONT_TEBAL, border: garisAtas, align: RATA_TENGAH });
  tulis(ws, barisJabatan, 1, 'Admin', { font: FONT, align: RATA_TENGAH });
  tulis(ws, barisJabatan, 4, 'Koordinator Tim Pengadaan', { font: FONT, align: RATA_TENGAH });
  tulis(ws, barisJabatan, 7, 'Direktur', { font: FONT, align: RATA_TENGAH });

  return barisJabatan;
}

function blokSederhana(ws, opsi) {
  const { judulBaris, judul, warnaJudul, barisJudul, daftarBaris, totalBaris, totalLabel, totalNilai, fontTotal } = opsi;

  if (judulBaris != null) {
    tulis(ws, judulBaris, 1, judul, { font: FONT_TEBAL, align: RATA_KIRI });
    tinggi(ws, judulBaris, 20);
  }

  if (barisJudul != null) {
    tinggi(ws, barisJudul, 22);
    tulisGabung(ws, barisJudul, 1, barisJudul, 4, judul, {
      font: FONT_TEBAL,
      fill: isiFill(warnaJudul),
      border: BORDER_TIPIS,
      align: RATA_KIRI,
    });
    tulis(ws, barisJudul, 5, null, {
      font: FONT_TEBAL,
      fill: isiFill(warnaJudul),
      border: BORDER_TIPIS,
      align: RATA_KIRI,
    });
  }

  let baris = daftarBaris;
  const daftar = daftarBaris && Array.isArray(opsi.daftar) ? opsi.daftar : [];
  daftar.forEach((item, indeks) => {
    tinggi(ws, baris, 22);
    tulis(ws, baris, 1, teks(item.label || `${indeks + 1}. ${teks(item.desc)}`), {
      font: FONT,
      border: BORDER_TIPIS,
      align: RATA_KIRI,
    });
    for (let k = 2; k <= 4; k += 1) {
      tulis(ws, baris, k, null, { font: FONT, border: BORDER_TIPIS, align: RATA_KIRI });
    }
    if (item.keterangan) {
      tulis(ws, baris, 3, teks(item.keterangan), {
        font: FONT,
        border: BORDER_TIPIS,
        align: RATA_KIRI,
      });
    }
    tulis(ws, baris, 5, angka(item.nilai), {
      font: FONT,
      border: BORDER_TIPIS,
      align: RATA_KANAN,
      numFmt: UANG,
    });
    baris += 1;
  });
  if (!daftar.length) baris += 1;

  if (totalBaris) {
    tinggi(ws, baris, 22);
    tulisGabung(ws, baris, 1, baris, 4, totalLabel, {
      font: fontTotal || FONT_TEBAL,
      fill: isiFill(opsi.warnaTotal),
      border: BORDER_TIPIS,
      align: RATA_KIRI,
    });
    tulis(ws, baris, 5, angka(totalNilai), {
      font: fontTotal || FONT_TEBAL,
      fill: isiFill(opsi.warnaTotal),
      border: BORDER_TIPIS,
      align: RATA_KANAN,
      numFmt: UANG,
    });
    baris += 1;
  }

  return baris;
}

function blokLanjutan(ws, dc, setelahTtd) {
  const kosong1 = setelahTtd + 1;
  const kosong2 = setelahTtd + 2;
  [kosong1, kosong2].forEach((b) => {
    tinggi(ws, b, 18);
    for (let k = 1; k <= 7; k += 1) tulis(ws, b, k, null, { font: FONT });
  });

  const judulRincian = kosong2 + 1;
  const headerRincian = judulRincian + 1;
  const penerima = dc.penerima || [];
  const daftarRincian = [
    {
      label: `1. Anggaran Pengadaan${dc.info && dc.info.namaLpj ? ' (' + dc.info.namaLpj + ')' : ''}`,
      nilai: dc.anggaran,
    },
    ...penerima.map((p, i) => ({
      label: `${i + 2}. ${teks(p.summaryTitle)}`,
      nilai: p.total,
    })),
  ];

  tulis(ws, judulRincian, 1, 'Rincian Pengeluaran', { font: FONT_TEBAL, align: RATA_KIRI });
  tinggi(ws, judulRincian, 20);

  tinggi(ws, headerRincian, 22);
  tulisGabung(ws, headerRincian, 1, headerRincian, 4, 'Keterangan', {
    font: FONT_TEBAL,
    fill: isiFill(WARNA.kuning),
    border: BORDER_TIPIS,
    align: RATA_TENGAH,
  });
  tulis(ws, headerRincian, 5, 'Nominal', {
    font: FONT_TEBAL,
    fill: isiFill(WARNA.kuning),
    border: BORDER_TIPIS,
    align: RATA_TENGAH,
    numFmt: UANG,
  });
  for (let k = 6; k <= 7; k += 1) tulis(ws, headerRincian, k, null, { font: FONT });

  let baris = headerRincian + 1;
  daftarRincian.forEach((item) => {
    tinggi(ws, baris, 22);
    tulis(ws, baris, 1, item.label, { font: FONT, border: BORDER_TIPIS, align: RATA_KIRI });
    for (let k = 2; k <= 4; k += 1) {
      tulis(ws, baris, k, null, { font: FONT, border: BORDER_TIPIS, align: RATA_KIRI });
    }
    tulis(ws, baris, 5, angka(item.nilai), {
      font: FONT,
      border: BORDER_TIPIS,
      align: RATA_KANAN,
      numFmt: UANG,
    });
    baris += 1;
  });

  tinggi(ws, baris, 16);
  for (let k = 1; k <= 4; k += 1) tulis(ws, baris, k, null, { font: FONT, border: BORDER_TIPIS });
  tulis(ws, baris, 5, null, { font: FONT, border: BORDER_TIPIS, numFmt: UANG });
  baris += 1;

  tinggi(ws, baris, 22);
  tulisGabung(ws, baris, 1, baris, 4, 'Sisa Anggaran', {
    font: FONT_TEBAL,
    fill: isiFill(WARNA.kuning),
    border: BORDER_TIPIS,
    align: RATA_KIRI,
  });
  tulis(ws, baris, 5, angka(dc.sisaAnggaran), {
    font: FONT_TEBAL,
    fill: isiFill(WARNA.kuning),
    border: BORDER_TIPIS,
    align: RATA_KANAN,
    numFmt: UANG,
  });
  baris += 2;

  const totalKasbon = (dc.kasbonItems || []).reduce((jumlah, it) => jumlah + angka(it.total), 0) || angka(dc.grandTotal);
  baris = blokSederhana(ws, {
    barisJudul: baris,
    judul: 'Pengajuan Kasbon',
    warnaJudul: WARNA.kream,
    daftarBaris: baris + 1,
    daftar: (dc.kasbonItems || []).map((it, i) => ({
      label: `${i + 1}. ${teks(it.desc)}`,
      keterangan: `${angka(it.qty)} pcs`,
      nilai: it.total,
    })),
    totalBaris: true,
    totalLabel: 'Total kasbon',
    totalNilai: totalKasbon,
  });

  baris += 1;
  const totalAktual = (dc.aktualItems || []).reduce((jumlah, it) => jumlah + angka(it.total), 0) || angka(dc.grandTotal);
  baris = blokSederhana(ws, {
    barisJudul: baris,
    judul: 'Aktual pengeluaran',
    warnaJudul: WARNA.kream,
    daftarBaris: baris + 1,
    daftar: (dc.aktualItems || []).map((it, i) => ({
      label: `${i + 1}. ${teks(it.desc)}`,
      keterangan: teks(it.vendor),
      nilai: it.total,
    })),
    totalBaris: true,
    totalLabel: 'Total aktual pengeluaran',
    totalNilai: totalAktual,
  });

  tinggi(ws, baris, 22);
  tulisGabung(ws, baris, 1, baris, 4, 'Selisih kasbon dengan aktual', {
    font: FONT_MERAH,
    align: RATA_KIRI,
  });
  tulis(ws, baris, 5, totalKasbon - totalAktual, {
    font: FONT_MERAH,
    align: RATA_KANAN,
    numFmt: UANG,
  });

  return baris;
}

async function buildPrWorkbook(dataCetak, pengajuan) {
  const dc = dataCetak || {};
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PT. DIAN GIRI SAPUTRA';
  wb.lastModifiedBy = 'Sistem Payment Request';
  wb.created = new Date();
  wb.modified = new Date();

  const ws = wb.addWorksheet('PR');
  siapkanLembar(ws);
  headerDokumen(ws, wb);
  infoDokumen(ws, dc);
  const setelahLampiran = ringkasanPenerima(ws, dc);
  const setelahTabel = tabelPembayaran(ws, dc, setelahLampiran);
  const setelahTtd = tandaTangan(ws, dc, pengajuan, setelahTabel);
  const barisAkhir = blokLanjutan(ws, dc, setelahTtd);

  ws.pageSetup.printArea = `A1:G${barisAkhir}`;
  return wb;
}

module.exports = { buildPrWorkbook };
