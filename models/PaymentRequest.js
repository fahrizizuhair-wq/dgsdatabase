const mongoose = require('mongoose');

const paymentRequestSchema = new mongoose.Schema(
  {
    nomorPengajuan: { type: String, default: '', trim: true },
    tanggalPengajuan: { type: Date, default: Date.now },
    pemohon: { type: String, default: '', trim: true },
    unitKerja: { type: String, required: true, trim: true },
    vendor: { type: String, default: '', trim: true },
    kategori: { type: String, default: '', trim: true },
    namaMaterial: { type: String, default: '', trim: true },
    deskripsi: { type: String, default: '', trim: true },
    totalNominal: { type: Number, default: 0 },
    urgensi: {
      type: String,
      enum: ['Rendah', 'Normal', 'Sedang', 'Tinggi', 'High', 'Kritis', 'Critical'],
      default: 'Normal',
    },
    statusApproval: {
      type: String,
      enum: [
        'Draft',
        'Menunggu',
        'Pending',
        'Menunggu Persetujuan',
        'Sedang Ditinjau',
        'Disetujui',
        'Ditolak',
        'Sudah Transfer',
      ],
      default: 'Menunggu',
    },
    // Field baru untuk tampilan Payment Request versi acuan PT. DGS.
    pekerjaan: { type: String, default: '', trim: true },
    tanggalTransfer: { type: Date, default: null },
    estimasiTransfer: { type: String, default: '', trim: true },
    lokasi: { type: String, default: '', trim: true },
    detailPekerjaan: { type: String, default: '', trim: true },
    daftarDokumen: { type: String, default: '' },
    attachments: [{ type: String, trim: true }],
    penerimaTransfer: [
      {
        // Field acuan (baru).
        summaryTitle: { type: String, default: '', trim: true },
        vendorName: { type: String, default: '', trim: true },
        pic: { type: String, default: '', trim: true },
        accountNo: { type: String, default: '', trim: true },
        accountHolder: { type: String, default: '', trim: true },
        items: [
          {
            desc: { type: String, default: '', trim: true },
            qty: { type: Number, default: 1 },
            price: { type: Number, default: 0 },
            subtotal: { type: Number, default: 0 },
          },
        ],
        // Field lama tetap didukung.
        namaPenerima: { type: String, default: '', trim: true },
        bank: { type: String, default: '', trim: true },
        noRekening: { type: String, default: '', trim: true },
        atasNama: { type: String, default: '', trim: true },
        keterangan: { type: String, default: '', trim: true },
        rincianBiaya: [
          {
            deskripsi: { type: String, default: '', trim: true },
            jumlah: { type: Number, default: 0 },
            qty: { type: Number, default: 1 },
            hargaSatuan: { type: Number, default: 0 },
          },
        ],
        subtotal: { type: Number, default: 0 },
      },
    ],

    // Field lama tetap dipertahankan supaya data/route lama tidak rusak.
    catatan: { type: String, default: '' },
    diinputOleh: { type: String, default: '' },
    fileUrl: { type: String, default: '' },
    fileName: { type: String, default: '' },
    items: [
      {
        no: Number,
        diskripsi: { type: String, default: '' },
        jumlah: { type: Number, default: 1 },
        satuan: { type: String, default: 'Pcs' },
        hargaSatuan: { type: Number, default: 0 },
        subtotal: { type: Number, default: 0 },
      },
    ],
  },
  { timestamps: true, collection: 'paymentrequest' },
);

module.exports = mongoose.models.PaymentRequest || mongoose.model('PaymentRequest', paymentRequestSchema);
