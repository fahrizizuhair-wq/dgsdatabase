const mongoose = require('mongoose');

const laporanSchema = new mongoose.Schema({
  namaDokumen: { type: String, required: true },
  jenis: { type: String, default: '' },
  tujuan: { type: String, default: '' },
  keterangan: { type: String, default: '' },
  filePath: { type: String, default: '' },
  cleanName: { type: String, default: '' },
  tanggal: { type: Date, default: Date.now },
  diinputOleh: { type: String, default: '' }
}, { timestamps: true, collection: 'laporan' });

// Gunakan pengecekan ini agar tidak terjadi OverwriteModelError
module.exports = mongoose.models.Laporan || mongoose.model('Laporan', laporanSchema);
