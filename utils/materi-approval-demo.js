// Data contoh untuk halaman Materi Approval user.
// Hanya dipakai saat koleksi materi approval di database masih kosong,
// supaya tata letak tabel dan badge tetap bisa ditinjau sebelum alur
// pengajuan approval tersedia.

const hariLalu = (jumlahHari, jam = 9) => {
  const tanggal = new Date();
  tanggal.setDate(tanggal.getDate() - jumlahHari);
  tanggal.setHours(jam, 0, 0, 0);
  return tanggal;
};

const ambilContohMateriApproval = () => ([
  {
    nomorPengajuan: 'PR-2026-0912',
    tanggalPengajuan: hariLalu(1),
    pemohon: 'Rian Pratama',
    unitKerja: 'Divisi Konstruksi Sipil',
    vendor: 'PT Indometal Karya Utama',
    kategori: 'Material Konstruksi',
    deskripsi: 'Besi beton spine 12mm & kawat bendrat',
    totalNominal: 100000000,
    urgensi: 'Kritis',
    statusApproval: 'Menunggu Persetujuan'
  },
  {
    nomorPengajuan: 'PO-2026-0442',
    tanggalPengajuan: hariLalu(2),
    pemohon: 'Dewi Lestari',
    unitKerja: 'Divisi Infrastruktur Jalan',
    vendor: 'CV Semen Nusantara Enterprise',
    kategori: 'Semen & Bahan Bangunan',
    deskripsi: 'Semen Portland Type I (50kg x 1.000 sak)',
    totalNominal: 75500000,
    urgensi: 'Tinggi',
    statusApproval: 'Sedang Ditinjau'
  },
  {
    nomorPengajuan: 'LPJ-2026-0118',
    tanggalPengajuan: hariLalu(3),
    pemohon: 'Agus Setiawan',
    unitKerja: 'Divisi Transport & Logistik',
    vendor: 'PT Global Logistik Perkasa',
    kategori: 'Jasa Logistik',
    deskripsi: 'Pengiriman material proyek tahap II',
    totalNominal: 42800000,
    urgensi: 'Sedang',
    statusApproval: 'Disetujui'
  },
  {
    nomorPengajuan: 'PR-2026-0887',
    tanggalPengajuan: hariLalu(5),
    pemohon: 'Nur Aisyah',
    unitKerja: 'Divisi Pengadaan Umum',
    vendor: 'PT Sinar Baja Mandiri',
    kategori: 'Besi & Baja',
    deskripsi: 'Pipa galvanis dan plat bordes',
    totalNominal: 128500000,
    urgensi: 'Tinggi',
    statusApproval: 'Menunggu Persetujuan'
  },
  {
    nomorPengajuan: 'PO-2026-0431',
    tanggalPengajuan: hariLalu(7),
    pemohon: 'Rian Pratama',
    unitKerja: 'Divisi Konstruksi Sipil',
    vendor: 'CV Karya Beton Nusantara',
    kategori: 'Material Konstruksi',
    deskripsi: 'Readymix K-350 untuk pengecoran struktur',
    totalNominal: 64250000,
    urgensi: 'Rendah',
    statusApproval: 'Disetujui'
  },
  {
    nomorPengajuan: 'PR-2026-0879',
    tanggalPengajuan: hariLalu(9),
    pemohon: 'Dewi Lestari',
    unitKerja: 'Divisi Infrastruktur Jalan',
    vendor: 'PT Mitra Aspal Sejahtera',
    kategori: 'Material Jalan',
    deskripsi: 'Aspal hotmix AC-WC 60/70',
    totalNominal: 96500000,
    urgensi: 'Sedang',
    statusApproval: 'Ditolak'
  }
]);

module.exports = { ambilContohMateriApproval };
