const mongoose = require('mongoose');

const lpjSchema = new mongoose.Schema({
  namaKegiatan: { type: String, required: true },
  kategori: { type: String, default: '' },
  status: { type: String, default: 'Draft' },
  anggaranKasbon: { type: Number, default: 0 },
  totalPengeluaran: { type: Number, default: 0 },
  keterangan: { type: String, default: '' },
  diinputOleh: { type: String, default: '' },
  
  // TAMBAHKAN BAGIAN INI:
  riwayatPencairan: [{
    tanggal: { type: Date, default: Date.now },
    nominal: Number,
    keterangan: String
  }]
}, { timestamps: true });

module.exports = mongoose.model('Lpj', lpjSchema);