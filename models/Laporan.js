const mongoose = require('mongoose');

const laporanSchema = new mongoose.Schema({
  namaDokumen: { type: String, required: true },
  keterangan: { type: String, default: '' },
  jenis: { type: String, default: 'Umum' },
  tujuan: { type: String, default: '' }, // <-- Tambahkan baris ini di sini!
  filePath: { type: String, default: '' },
  tanggal: { type: Date, default: Date.now }
}, { timestamps: true, collection: 'laporan' });

module.exports = mongoose.model('Laporan', laporanSchema);