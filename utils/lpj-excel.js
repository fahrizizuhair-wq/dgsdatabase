const path = require('path');
const ExcelJS = require('exceljs');
const { wrapText } = require('./textWrap');

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'lpj-template.xlsx');
const TEMPLATE_SHEET = 'LPJ Produksi';

// ============================================================
//  FORMAT & GAYA (mengikuti template LPJ)
// ============================================================
const RUPIAH = '_-[$Rp-421]* #,##0_-;_-[$Rp-421]* -#,##0_-;_-[$Rp-421]* "-"??_-;_-@';
const RUPIAH_HEADER = '"Rp"#,##0.00';
const DATE_FMT = 'd" "mmm" "yyyy';
const QTY_FMT = '#,##0';

const THIN = { style: 'thin', color: { argb: 'FF000000' } };
const BORDER_BOX = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const BORDER_NONE = {};

const FONT = { name: 'Calibri', size: 12, color: { theme: 1 } };
const FONT_BOLD = { name: 'Calibri', size: 12, bold: true, color: { theme: 1 } };
const FONT_TITLE = { name: 'Calibri', size: 14, bold: true, color: { theme: 1 } };
const FONT_SECTION = { name: 'Calibri', size: 14, bold: false, color: { theme: 1 } };

const FILL_NONE = { type: 'pattern', pattern: 'none' };
const FILL_GROUP = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FFFF' } };
const FILL_YELLOW = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
const FILL_CREAM = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };

const ALIGN_CENTER = { horizontal: 'center', vertical: 'middle', wrapText: true };
const ALIGN_LEFT = { horizontal: 'left', vertical: 'middle', wrapText: true };
const ALIGN_RIGHT = { horizontal: 'right', vertical: 'middle', wrapText: true };

const COLUMN_WIDTHS = [8.63, 21.5, 42.63, 11.88, 16.88, 15.88, 46.75];

const clone = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)));

function styleCell(cell, opts = {}) {
  cell.font = clone(opts.font || FONT);
  cell.fill = clone(opts.fill || FILL_NONE);
  cell.border = clone(opts.border || BORDER_BOX);
  cell.alignment = clone(opts.align || ALIGN_LEFT);
  cell.numFmt = opts.numFmt || 'General';
}

function writeCell(ws, row, col, value, opts = {}) {
  const cell = ws.getCell(row, col);
  cell.value = value;
  styleCell(cell, opts);
  return cell;
}

function writeMerged(ws, row1, col1, row2, col2, value, opts = {}) {
  ws.mergeCells(row1, col1, row2, col2);
  for (let r = row1; r <= row2; r += 1) {
    for (let c = col1; c <= col2; c += 1) {
      styleCell(ws.getCell(r, c), opts);
    }
  }
  ws.getCell(row1, col1).value = value;
}

function setHeight(ws, row, entries) {
  let lines = 1;
  entries.forEach((entry) => {
    if (!entry || entry.text == null) return;
    const text = String(entry.text);
    const size = entry.size || 12;
    const width = COLUMN_WIDTHS[(entry.col || 1) - 1] || 10;
    const wrapped = wrapText(text, size >= 14 ? 'bold' : 'regular', size, width * 7 - 4);
    lines = Math.max(lines, wrapped.length || 1);
  });
  ws.getRow(row).height = Math.max(17.25, lines * 15 + 2.25);
}

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function formatTanggal(value) {
  const date = toDate(value);
  if (!date) return '-';
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ============================================================
//  PENGELOMPOKAN DATA
// ============================================================
function normalisasiKategori(kategori) {
  return /operasional|oprasional/i.test(String(kategori || '')) ? 'operasional' : 'produksi';
}

function siapkanData(lpj) {
  const pencairan = (Array.isArray(lpj.riwayatPencairan) ? lpj.riwayatPencairan : [])
    .map((row) => ({
      tanggal: toDate(row.tanggal),
      nominal: Number(row.nominal) || 0,
      keterangan: String(row.keterangan || '').trim()
    }))
    .sort((a, b) => (a.tanggal ? a.tanggal.getTime() : 0) - (b.tanggal ? b.tanggal.getTime() : 0));

  const rincian = (Array.isArray(lpj.rincianPengeluaran) ? lpj.rincianPengeluaran : [])
    .map((row) => {
      const qty = Number(row.qty) || 0;
      const harga = Number(row.hargaSatuan) || 0;
      const nominal = Number(row.nominal) || qty * harga;
      return {
        tanggal: toDate(row.tanggal),
        kategori: String(row.kategoriPengeluaran || '').trim(),
        namaItem: String(row.namaItem || '').trim() || 'Tanpa uraian',
        keterangan: String(row.keterangan || '').trim(),
        qty,
        hargaSatuan: harga,
        nominal
      };
    })
    .sort((a, b) => (a.tanggal ? a.tanggal.getTime() : 0) - (b.tanggal ? b.tanggal.getTime() : 0));

  const grupProduksi = rincian.filter((row) => normalisasiKategori(row.kategori) === 'produksi');
  const grupOperasional = rincian.filter((row) => normalisasiKategori(row.kategori) === 'operasional');

  const totalPencairan = pencairan.reduce((total, row) => total + row.nominal, 0)
    || (Number(lpj.anggaranKasbon) || 0);
  const totalPengeluaran = rincian.reduce((total, row) => total + row.nominal, 0);

  // Rekap barang untuk bagian bawah template
  const rekapMap = new Map();
  rincian.forEach((row) => {
    const kunci = row.namaItem.toLowerCase();
    if (!rekapMap.has(kunci)) {
      rekapMap.set(kunci, { namaItem: row.namaItem, qty: 0, nominal: 0 });
    }
    const rekap = rekapMap.get(kunci);
    rekap.qty += row.qty;
    rekap.nominal += row.nominal;
  });
  const rekapBarang = Array.from(rekapMap.values());

  const notaVault = Array.isArray(lpj.vaultNota)
    ? lpj.vaultNota.filter((nota) => nota && nota.filePath).length
    : 0;
  const notaRincian = Array.isArray(lpj.rincianPengeluaran)
    ? lpj.rincianPengeluaran.filter((baris) => baris && baris.notaPath).length
    : 0;

  return {
    pencairan,
    grupProduksi,
    grupOperasional,
    totalPencairan,
    totalPengeluaran,
    rekapBarang,
    jumlahNota: notaVault + notaRincian
  };
}

// ============================================================
//  PEMBUATAN WORKBOOK
// ============================================================
async function buildLpjWorkbook(lpj) {
  const template = new ExcelJS.Workbook();
  await template.xlsx.readFile(TEMPLATE_PATH);
  const source = template.getWorksheet(TEMPLATE_SHEET) || template.worksheets[0];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DGS Procurement';
  workbook.created = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const ws = workbook.addWorksheet('LPJ', {
    views: [{ showGridLines: false, zoomScale: 100 }]
  });

  ws.columns = COLUMN_WIDTHS.map((width) => ({ width }));
  Object.assign(ws.pageSetup, {
    paperSize: 9,
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: false,
    verticalCentered: false,
    showGridLines: false,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.2, header: 0, footer: 0 }
  });

  const data = siapkanData(lpj);
  const namaKegiatan = String(lpj.namaKegiatan || 'LPJ Pengadaan').trim();
  const judul = `Laporan Pertanggungjawaban (LPJ)\n${namaKegiatan}`;

  // ---------- JUDUL ----------
  ws.getRow(1).height = 19.5;
  writeMerged(ws, 2, 1, 4, 7, judul, {
    font: FONT_TITLE,
    fill: FILL_NONE,
    border: BORDER_NONE,
    align: ALIGN_CENTER
  });
  [2, 3, 4].forEach((row) => { ws.getRow(row).height = 30; });
  ws.getRow(5).height = 19.5;

  let row = 6;

  // ---------- TABEL PENERIMAAN DANA ----------
  writeCell(ws, row, 1, 'No.', { font: FONT_BOLD, align: ALIGN_CENTER });
  writeCell(ws, row, 2, 'Tanggal', { font: FONT_BOLD, align: ALIGN_CENTER });
  writeCell(ws, row, 3, 'Uraian', { font: FONT_BOLD, align: ALIGN_CENTER });
  writeMerged(ws, row, 4, row, 6, '', { font: FONT_BOLD, align: ALIGN_CENTER });
  writeCell(ws, row, 7, 'Pencairan', { font: FONT_BOLD, align: ALIGN_CENTER, numFmt: RUPIAH_HEADER });
  ws.getRow(row).height = 17.25;
  row += 1;

  writeMerged(ws, row, 1, row, 7, 'Penerimaan Dana', { font: FONT_BOLD, align: ALIGN_CENTER });
  ws.getRow(row).height = 17.25;
  row += 1;

  const barisPencairanPertama = row;
  if (data.pencairan.length === 0) {
    writeCell(ws, row, 1, 1, { align: ALIGN_CENTER });
    writeCell(ws, row, 2, '-', { align: ALIGN_CENTER });
    writeCell(ws, row, 3, 'Belum ada pencairan dana', {});
    writeMerged(ws, row, 4, row, 6, String(lpj.kategori || ''), { align: ALIGN_CENTER });
    writeCell(ws, row, 7, 0, { align: ALIGN_RIGHT, numFmt: RUPIAH });
    setHeight(ws, row, [{ col: 3, text: 'Belum ada pencairan dana' }]);
    row += 1;
  } else {
    data.pencairan.forEach((item, index) => {
      writeCell(ws, row, 1, index + 1, { align: ALIGN_CENTER });
      writeCell(ws, row, 2, item.tanggal, { align: ALIGN_CENTER, numFmt: DATE_FMT });
      writeCell(ws, row, 3, item.keterangan || `Pencairan ${formatTanggal(item.tanggal)}`, {});
      writeMerged(ws, row, 4, row, 6, String(lpj.kategori || ''), { align: ALIGN_CENTER });
      writeCell(ws, row, 7, item.nominal, { align: ALIGN_RIGHT, numFmt: RUPIAH });
      setHeight(ws, row, [{ col: 3, text: item.keterangan || `Pencairan ${formatTanggal(item.tanggal)}` }]);
      row += 1;
    });
  }
  const barisPencairanTerakhir = row - 1;

  // Total kasbon
  writeMerged(ws, row, 1, row, 6, 'Total Kasbon', { font: FONT_BOLD, align: ALIGN_CENTER });
  writeCell(ws, row, 7, {
    formula: `SUM(G${barisPencairanPertama}:G${barisPencairanTerakhir})`,
    result: data.totalPencairan
  }, { font: FONT_BOLD, align: ALIGN_RIGHT, numFmt: RUPIAH });
  const barisTotalKasbon = row;
  ws.getRow(row).height = 17.25;
  row += 1;

  // ---------- TABEL PENGELUARAN DANA ----------
  writeMerged(ws, row, 1, row, 7, 'Pengeluaran Dana', { font: FONT_BOLD, align: ALIGN_CENTER });
  ws.getRow(row).height = 17.25;
  row += 1;

  const barisHeaderPengeluaran = row;
  const barisHeaderPengeluaran2 = row + 1;
  writeMerged(ws, barisHeaderPengeluaran, 1, barisHeaderPengeluaran2, 1, 'No.', {
    font: FONT_BOLD,
    align: ALIGN_CENTER
  });
  writeMerged(ws, barisHeaderPengeluaran, 2, barisHeaderPengeluaran2, 2, 'Tanggal', {
    font: FONT_BOLD,
    align: ALIGN_CENTER
  });
  writeMerged(ws, barisHeaderPengeluaran, 3, barisHeaderPengeluaran2, 3, 'Uraian', {
    font: FONT_BOLD,
    align: ALIGN_CENTER
  });
  writeMerged(ws, barisHeaderPengeluaran, 4, barisHeaderPengeluaran, 6, 'Pemakaian', {
    font: FONT_BOLD,
    align: ALIGN_CENTER,
    numFmt: RUPIAH_HEADER
  });
  writeCell(ws, barisHeaderPengeluaran2, 4, 'Qty', {
    font: FONT_BOLD,
    align: ALIGN_CENTER,
    numFmt: QTY_FMT
  });
  writeCell(ws, barisHeaderPengeluaran2, 5, 'Satuan', {
    font: FONT_BOLD,
    align: ALIGN_CENTER,
    numFmt: RUPIAH
  });
  writeCell(ws, barisHeaderPengeluaran2, 6, 'Harga', {
    font: FONT_BOLD,
    align: ALIGN_CENTER,
    numFmt: RUPIAH
  });
  writeMerged(ws, barisHeaderPengeluaran, 7, barisHeaderPengeluaran2, 7, 'Keterangan', {
    font: FONT_BOLD,
    align: ALIGN_CENTER
  });
  ws.getRow(barisHeaderPengeluaran).height = 17.25;
  ws.getRow(barisHeaderPengeluaran2).height = 17.25;
  row += 2;

  // Grup biaya: BIAYA PRODUKSI lalu BIAYA OPERASIONAL
  const grup = [
    { label: 'BIAYA PRODUKSI', rows: data.grupProduksi },
    { label: 'BIAYA OPERASIONAL', rows: data.grupOperasional }
  ].filter((item) => item.rows.length > 0);
  if (grup.length === 0) grup.push({ label: 'BIAYA PRODUKSI', rows: [] });

  const totalPerGrup = [];
  grup.forEach((item) => {
    const barisJudulGrup = row;
    writeMerged(ws, row, 1, row, 5, item.label, { font: FONT_BOLD, fill: FILL_GROUP, align: ALIGN_CENTER });
    const selTotalGrup = ws.getCell(row, 6);
    styleCell(selTotalGrup, { font: FONT_BOLD, fill: FILL_GROUP, align: ALIGN_CENTER, numFmt: RUPIAH });
    writeCell(ws, row, 7, '', { fill: FILL_GROUP });
    ws.getRow(row).height = 17.25;
    row += 1;

    const barisAwalItem = row;
    if (item.rows.length === 0) {
      const teksKosong = 'Belum ada pengeluaran';
      writeCell(ws, row, 1, '', { align: ALIGN_CENTER });
      writeCell(ws, row, 2, '', { align: ALIGN_CENTER });
      writeCell(ws, row, 3, teksKosong, {});
      writeCell(ws, row, 4, 0, { align: ALIGN_CENTER, numFmt: QTY_FMT });
      writeCell(ws, row, 5, 0, { align: ALIGN_RIGHT, numFmt: RUPIAH });
      writeCell(ws, row, 6, 0, { align: ALIGN_RIGHT, numFmt: RUPIAH });
      writeCell(ws, row, 7, '', {});
      setHeight(ws, row, [{ col: 3, text: teksKosong }]);
      row += 1;
    }
    item.rows.forEach((baris, index) => {
      writeCell(ws, row, 1, index + 1, { align: ALIGN_CENTER });
      writeCell(ws, row, 2, baris.tanggal, { align: ALIGN_CENTER, numFmt: DATE_FMT });
      writeCell(ws, row, 3, baris.namaItem, {});
      writeCell(ws, row, 4, baris.qty, { align: ALIGN_CENTER, numFmt: QTY_FMT });
      writeCell(ws, row, 5, baris.hargaSatuan, { align: ALIGN_RIGHT, numFmt: RUPIAH });
      writeCell(ws, row, 6, baris.nominal, { align: ALIGN_RIGHT, numFmt: RUPIAH });
      writeCell(ws, row, 7, baris.keterangan, {});
      setHeight(ws, row, [
        { col: 3, text: baris.namaItem },
        { col: 7, text: baris.keterangan }
      ]);
      row += 1;
    });

    const barisAkhirItem = row - 1;
    const totalGrup = item.rows.reduce((total, baris) => total + baris.nominal, 0);
    if (barisAkhirItem >= barisAwalItem) {
      selTotalGrup.value = {
        formula: `SUM(F${barisAwalItem}:F${barisAkhirItem})`,
        result: totalGrup
      };
    } else {
      selTotalGrup.value = 0;
    }
    totalPerGrup.push({ baris: barisJudulGrup, total: totalGrup });
  });

  // Total keseluruhan
  writeMerged(ws, row, 1, row, 5, 'Total Keseluruhan', { font: FONT_BOLD, align: ALIGN_CENTER });
  const selTotalKeseluruhan = ws.getCell(row, 6);
  styleCell(selTotalKeseluruhan, { font: FONT_BOLD, align: ALIGN_RIGHT, numFmt: RUPIAH });
  selTotalKeseluruhan.value = {
    formula: totalPerGrup.map((item) => `F${item.baris}`).join('+') || '0',
    result: data.totalPengeluaran
  };
  writeCell(ws, row, 7, '', {});
  const barisTotalKeseluruhan = row;
  ws.getRow(row).height = 17.25;
  row += 1;

  // Balance
  writeMerged(ws, row, 1, row, 5, 'Balance', { font: FONT_BOLD, align: ALIGN_RIGHT });
  const selBalance = ws.getCell(row, 6);
  styleCell(selBalance, { font: FONT_BOLD, align: ALIGN_RIGHT, numFmt: RUPIAH });
  ws.mergeCells(row, 6, row, 7);
  styleCell(ws.getCell(row, 7), { font: FONT_BOLD, align: ALIGN_RIGHT, numFmt: RUPIAH });
  selBalance.value = {
    formula: `G${barisTotalKasbon}-F${barisTotalKeseluruhan}`,
    result: data.totalPencairan - data.totalPengeluaran
  };
  ws.getRow(row).height = 17.25;
  row += 2;

  // ---------- SUMMARY LPJ ----------
  writeMerged(ws, row, 1, row, 2, 'Summary LPJ', {
    font: FONT_SECTION,
    border: BORDER_NONE,
    align: ALIGN_LEFT
  });
  ws.getRow(row).height = 19.5;
  row += 1;

  writeCell(ws, row, 1, 'No.', { font: FONT_BOLD, align: ALIGN_CENTER });
  writeMerged(ws, row, 2, row, 4, 'Uraian', { font: FONT_BOLD, align: ALIGN_CENTER });
  writeCell(ws, row, 5, 'Pengeluaran', { font: FONT_BOLD, align: ALIGN_CENTER, numFmt: RUPIAH_HEADER });
  writeCell(ws, row, 6, 'Pencairan', { font: FONT_BOLD, align: ALIGN_CENTER, numFmt: RUPIAH_HEADER });
  writeCell(ws, row, 7, '', { border: BORDER_NONE });
  ws.getRow(row).height = 19.5;
  row += 1;

  const uraianSummary = String(lpj.keterangan || '').trim() || namaKegiatan;
  writeCell(ws, row, 1, 1, { align: ALIGN_CENTER });
  writeMerged(ws, row, 2, row, 4, uraianSummary, {});
  writeCell(ws, row, 5, '', {});
  writeCell(ws, row, 6, data.totalPencairan, { align: ALIGN_RIGHT, numFmt: RUPIAH });
  writeCell(ws, row, 7, '', { border: BORDER_NONE });
  setHeight(ws, row, [{ col: 2, text: uraianSummary }]);
  row += 1;

  writeCell(ws, row, 1, 2, { align: ALIGN_CENTER });
  writeMerged(ws, row, 2, row, 4, 'Pengeluaran Kasbon', {});
  writeCell(ws, row, 5, data.totalPengeluaran, { align: ALIGN_RIGHT, numFmt: RUPIAH });
  writeCell(ws, row, 6, '', {});
  writeCell(ws, row, 7, '', { border: BORDER_NONE });
  ws.getRow(row).height = 19.5;
  row += 1;

  writeMerged(ws, row, 1, row, 4, 'Total Lebih Bayar', { font: FONT_BOLD, fill: FILL_YELLOW, align: ALIGN_RIGHT });
  writeMerged(ws, row, 5, row, 6, data.totalPencairan - data.totalPengeluaran, {
    font: FONT_BOLD,
    fill: FILL_YELLOW,
    align: ALIGN_RIGHT,
    numFmt: RUPIAH
  });
  writeCell(ws, row, 7, '', { border: BORDER_NONE });
  ws.getRow(row).height = 19.5;
  row += 2;

  // ---------- SUPPORTING DOCUMENTS ----------
  writeMerged(ws, row, 5, row, 7, 'Supporting Documents:', { font: FONT_SECTION, border: BORDER_NONE, align: ALIGN_LEFT });
  ws.getRow(row).height = 19.5;
  row += 1;

  const dokumen = [
    { label: 'Lembar LPJ', ada: true },
    { label: 'FC Kasbon', ada: data.pencairan.length > 0 },
    { label: 'Bukti Transfer Bank (Cash)', ada: data.pencairan.length > 0 },
    { label: 'Invoice/Nota', ada: data.jumlahNota > 0 }
  ];
  dokumen.forEach((item) => {
    writeMerged(ws, row, 5, row, 6, item.label, { border: BORDER_BOX, align: ALIGN_LEFT });
    writeCell(ws, row, 7, item.ada, { align: ALIGN_CENTER, border: BORDER_BOX });
    ws.getRow(row).height = 19.5;
    row += 1;
  });

  // ---------- REKAP BARANG ----------
  if (data.rekapBarang.length > 0) {
    row += 1;
    writeMerged(ws, row, 1, row, 4, 'Rekap Barang', { font: FONT_SECTION, border: BORDER_NONE, align: ALIGN_LEFT });
    ws.getRow(row).height = 19.5;
    row += 1;

    writeCell(ws, row, 1, 'No.', { font: FONT_BOLD, fill: FILL_CREAM, align: ALIGN_CENTER });
    writeCell(ws, row, 2, 'Nama Barang', { font: FONT_BOLD, fill: FILL_CREAM, align: ALIGN_CENTER });
    writeCell(ws, row, 3, 'Qty', { font: FONT_BOLD, fill: FILL_CREAM, align: ALIGN_CENTER });
    writeMerged(ws, row, 4, row, 7, 'Total Nominal', { font: FONT_BOLD, fill: FILL_CREAM, align: ALIGN_CENTER });
    ws.getRow(row).height = 19.5;
    row += 1;

    const barisRekapAwal = row;
    data.rekapBarang.forEach((item, index) => {
      writeCell(ws, row, 1, index + 1, { align: ALIGN_CENTER });
      writeCell(ws, row, 2, item.namaItem, {});
      writeCell(ws, row, 3, item.qty, { align: ALIGN_CENTER, numFmt: QTY_FMT });
      writeMerged(ws, row, 4, row, 7, item.nominal, { align: ALIGN_RIGHT, numFmt: RUPIAH });
      setHeight(ws, row, [{ col: 2, text: item.namaItem }]);
      row += 1;
    });

    const totalQty = data.rekapBarang.reduce((total, item) => total + item.qty, 0);
    writeMerged(ws, row, 1, row, 2, 'Total', { font: FONT_BOLD, fill: FILL_CREAM, align: ALIGN_LEFT });
    writeCell(ws, row, 3, `${totalQty.toLocaleString('id-ID')} pcs`, {
      font: FONT_BOLD,
      fill: FILL_CREAM,
      align: ALIGN_CENTER
    });
    writeMerged(ws, row, 4, row, 7, {
      formula: `SUM(D${barisRekapAwal}:D${row - 1})`,
      result: data.totalPengeluaran
    }, { font: FONT_BOLD, fill: FILL_CREAM, align: ALIGN_RIGHT, numFmt: RUPIAH });
    ws.getRow(row).height = 19.5;
    row += 1;
  }

  // ---------- GAMBAR (logo header dari template) ----------
  const media = (template.model && Array.isArray(template.model.media)) ? template.model.media : [];
  const gambar = source && typeof source.getImages === 'function' ? source.getImages() : [];
  gambar.forEach((image) => {
    const berkas = media[image.imageId];
    if (!berkas || !berkas.buffer) return;
    const imageId = workbook.addImage({
      buffer: berkas.buffer,
      extension: (berkas.extension || 'png').replace('jpeg', 'jpg')
    });
    const range = image.range || {};
    const anchor = { tl: { col: (range.tl && range.tl.col) || 0, row: (range.tl && range.tl.row) || 0 } };
    if (range.ext && range.ext.width && range.ext.height) {
      anchor.ext = { width: range.ext.width, height: range.ext.height };
    } else if (range.br) {
      anchor.br = { col: range.br.col, row: range.br.row };
    }
    ws.addImage(imageId, anchor);
  });

  // Area cetak mengikuti panjang tabel
  ws.pageSetup.printArea = `A1:G${Math.max(row - 1, 1)}`;

  // Pastikan tinggi minimum untuk semua baris yang terpakai
  for (let index = 1; index <= row; index += 1) {
    const current = ws.getRow(index);
    if (!current.height) current.height = 17.25;
  }

  return workbook;
}

module.exports = { buildLpjWorkbook };
