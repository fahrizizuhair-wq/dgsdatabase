const mongoose = require('mongoose');

const transaksiCatatanKeuanganSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProjectCatatanKeuangan',
      required: true,
      index: true,
    },
    projectNama: { type: String, default: '' },
    deskripsi: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, default: 0 },
    // 'income' atau 'expense'
    type: { type: String, required: true, enum: ['income', 'expense'], default: 'expense' },
    category: { type: String, default: 'Lainnya' },
    tanggal: { type: Date, default: Date.now },
    diinputOleh: { type: String, default: '' },
  },
  { timestamps: true, collection: 'transaksi_catatan_keuangan' },
);

module.exports =
  mongoose.models.TransaksiCatatanKeuangan ||
  mongoose.model('TransaksiCatatanKeuangan', transaksiCatatanKeuanganSchema);
