// ============================================================
//  KONFIGURASI KATEGORI CATATAN KEUANGAN
// ------------------------------------------------------------
//  CARA MENAMBAH / MENGUBAH KATEGORI:
//  Cukup tambah atau edit SATU BARIS NAMA di salah satu daftar
//  di bawah ini (mirip menambah <option> pada <select>).
//
//    PENGELUARAN  -> muncul hanya di transaksi pengeluaran
//    PEMASUKAN    -> muncul hanya di transaksi pemasukan
//    BERSAMA      -> muncul di keduanya
//
//  Warna dan ikon untuk grafik dibuat otomatis. Jika ingin
//  warna/ikon tertentu, tambahkan override di META_KATEGORI.
//  Setelah mengubah daftar, restart server.
//
//  Tidak perlu mengubah server.js, view EJS, atau CSS lagi.
// ============================================================

const PENGELUARAN = [
  'Makan & Minum',
  'Transportasi',
  'Belanja',
  'Tagihan',
  // 'Biaya Produksi',  <-- contoh penambahan kategori
];

const PEMASUKAN = [
  'Anggaran Kasbon',
  'Pencairan Kembali',
];

const BERSAMA = [
  'Lainnya',
];

// Warna & ikon opsional. Tidak wajib diisi untuk kategori baru.
const META_KATEGORI = {
  'Anggaran Kasbon': { warna: '#7a1b1b', ikon: 'banknote' },
  'Pencairan Kembali': { warna: '#0f9f6e', ikon: 'rotate-ccw' },
  'Makan & Minum': { warna: '#b84a39', ikon: 'utensils' },
  Transportasi: { warna: '#2c4c70', ikon: 'car' },
  Belanja: { warna: '#991b1b', ikon: 'shopping-bag' },
  Tagihan: { warna: '#c9933b', ikon: 'receipt' },
  'Gaji/Pendapatan': { warna: '#059669', ikon: 'wallet' },
  Lainnya: { warna: '#64748b', ikon: 'ellipsis' },
};

const KATEGORI_DEFAULT = 'Lainnya';

const PALETTE_WARNA = [
  '#7a1b1b', '#c9933b', '#2c4c70', '#b84a39', '#0f766e',
  '#881337', '#d97706', '#334155', '#9e2a2b', '#64748b',
];

let penunjukWarna = 0;
const warnaTerpakai = new Set(
  Object.values(META_KATEGORI)
    .map((meta) => meta.warna)
    .filter(Boolean),
);

function warnaOtomatis() {
  if (warnaTerpakai.size >= PALETTE_WARNA.length) return '#64748b';
  let warna = PALETTE_WARNA[penunjukWarna % PALETTE_WARNA.length];
  while (warnaTerpakai.has(warna)) {
    penunjukWarna += 1;
    warna = PALETTE_WARNA[penunjukWarna % PALETTE_WARNA.length];
  }
  penunjukWarna += 1;
  warnaTerpakai.add(warna);
  return warna;
}

function bangunKategori(daftar, jenis) {
  return daftar.map((nama) => {
    const namaBersih = String(nama || '').trim();
    const meta = META_KATEGORI[namaBersih] || {};
    return {
      nama: namaBersih,
      jenis,
      warna: meta.warna || warnaOtomatis(),
      ikon: meta.ikon || 'circle',
    };
  });
}

const KATEGORI = [
  ...bangunKategori(PENGELUARAN, 'expense'),
  ...bangunKategori(PEMASUKAN, 'income'),
  ...bangunKategori(BERSAMA, 'both'),
].filter((item, indeks, semua) => semua.findIndex((k) => k.nama === item.nama) === indeks);

function daftarKategori(jenis) {
  if (jenis !== 'income' && jenis !== 'expense') return KATEGORI.slice();
  return KATEGORI.filter((item) => item.jenis === jenis || item.jenis === 'both');
}

function metaKategori(nama) {
  return (
    KATEGORI.find((item) => item.nama === String(nama || '')) || {
      nama: String(nama || KATEGORI_DEFAULT),
      jenis: 'both',
      warna: '#64748b',
      ikon: 'ellipsis',
    }
  );
}

function validasiKategori(nama, jenis) {
  const meta = KATEGORI.find((item) => item.nama === String(nama || ''));
  if (!meta) return KATEGORI_DEFAULT;
  if (meta.jenis === 'both' || meta.jenis === jenis) return meta.nama;
  return KATEGORI_DEFAULT;
}

module.exports = {
  KATEGORI,
  KATEGORI_DEFAULT,
  daftarKategori,
  metaKategori,
  validasiKategori,
};
