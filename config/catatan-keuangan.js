// ============================================================
//  KONFIGURASI KATEGORI CATATAN KEUANGAN
// ------------------------------------------------------------
//  Cara menambah kategori baru:
//  1. Tambahkan satu objek di array KATEGORI di bawah.
//  2. Isi `nama` (teks yang tampil), `jenis` ('expense', 'income',
//     atau 'both'), `warna` (hex warna teks/badge/grafik), dan `ikon`
//     (nama ikon Lucide).
//  3. Simpan file ini, lalu restart server.
//
//  Tidak perlu mengubah server.js, view EJS, atau CSS lagi.
// ============================================================

const KATEGORI = [
  // -------------------- PENGELUARAN --------------------
  {
    nama: 'Anggaran Kasbon',
    jenis: 'expense',
    warna: '#7a1b1b',
    ikon: 'banknote',
  },
  {
    nama: 'Pencairan Kembali',
    jenis: 'both',
    warna: '#8b5cf6',
    ikon: 'rotate-ccw',
  },
  {
    nama: 'Makan & Minum',
    jenis: 'expense',
    warna: '#f59e0b',
    ikon: 'utensils',
  },
  {
    nama: 'Transportasi',
    jenis: 'expense',
    warna: '#3b82f6',
    ikon: 'car',
  },
  {
    nama: 'Belanja',
    jenis: 'expense',
    warna: '#ec4899',
    ikon: 'shopping-bag',
  },
  {
    nama: 'Tagihan',
    jenis: 'expense',
    warna: '#a855f7',
    ikon: 'receipt',
  },

  // -------------------- PEMASUKAN ----------------------
  {
    nama: 'Gaji/Pendapatan',
    jenis: 'income',
    warna: '#059669',
    ikon: 'wallet',
  },

  // -------------------- BERSAMA ------------------------
  {
    nama: 'Lainnya',
    jenis: 'both',
    warna: '#64748b',
    ikon: 'ellipsis',
  },
];

const KATEGORI_DEFAULT = 'Lainnya';

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
