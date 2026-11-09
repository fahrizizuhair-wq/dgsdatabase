const mongoose = require('mongoose');

const lpjSchema = new mongoose.Schema({
  namaKegiatan: { type: String, required: true }, 
  kategori: { type: String, required: true },
  status: { type: String, default: 'Draft' },
  anggaranKasbon: { type: Number, required: true, default: 0 },
  totalPengeluaran: { type: Number, default: 0 },
  sisaSaldo: { type: Number, default: 0 },
  progressBelanja: { type: Number, default: 0 }, // Persentase (0 - 100)
  keterangan: { type: String, default: '' },
  filePath: { type: String },
  cleanName: { type: String },
  diinputOleh: { type: String },
  tanggal: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Lpj', lpjSchema);