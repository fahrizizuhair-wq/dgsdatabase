const mongoose = require('mongoose');

const hargaDasarSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectHargaDasar', default: null },
    projectNama: { type: String, default: '' },
    idBarang: { type: String, required: true },
    namaBarang: { type: String, required: true },
    namaMerk: { type: String, default: '' },
    spesifikasi: { type: String, default: '' },
    qty: { type: Number, default: 1 },
    harga: { type: Number, default: 0 },
    final: { type: Number, default: 0 },
    keterangan: { type: String, default: '' },
    status: { type: String, default: '' },
    tanggal: { type: Date, default: Date.now },
    diinputOleh: { type: String, default: '' },
    gambar: [String],
  },
  { timestamps: true, collection: 'harga_dasar' },
);

module.exports =
  mongoose.models.HargaDasar ||
  mongoose.model('HargaDasar', hargaDasarSchema);
