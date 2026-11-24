const mongoose = require('mongoose');

const pengajuanHargaSchema = new mongoose.Schema(
  {
    kode: { type: String, required: true, unique: true },
    namaBarang: { type: String, required: true },
    qty: { type: Number, required: true, default: 1 },
    satuan: { type: String, default: 'pcs' },
    timProduksi: { type: String, default: '' },
    hargaProduksi: { type: Number, default: 0 },
    includeAllIn: { type: Boolean, default: false },

    // Rincian biaya tambahan per unit dari dropdown (branding, packaging, packing akhir)
    biayaTambahan: [
      {
        grup: { type: String, default: '' },
        item: { type: String, default: '' },
        harga: { type: Number, default: 0 },
      },
    ],

    // Field tetap mengikuti gambar acuan (bukan dropdown)
    ongkirTimDgs: { type: Number, default: 0 },
    sampelSurvey: { type: Number, default: 0 },
    ongkirDgsClient: { type: Number, default: 0 },
    totalBiayaTambahan: { type: Number, default: 0 },

    hargaAllIn: { type: Number, default: 0 },
    totalHarga: { type: Number, default: 0 },

    spesifikasi: { type: String, default: '' },
    keterangan: { type: String, default: '' },
    pic: { type: String, default: '' },
    jangkaWaktu: { type: String, default: '' },

    gambar: [String],
    status: { type: String, default: 'Diajukan' },
    diinputOleh: { type: String, default: '' },
  },
  { timestamps: true, collection: 'pengajuan_harga' },
);

module.exports = mongoose.model('PengajuanHarga', pengajuanHargaSchema);
