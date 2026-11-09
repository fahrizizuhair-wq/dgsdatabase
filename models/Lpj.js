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
  tanggal: { type: Date, default: Date.now },

  // Riwayat pencairan dana / kasbon
  riwayatPencairan: [{
    tanggal: { type: Date, default: Date.now },
    nominal: Number,
    keterangan: String
  }],

  // Catatan belanja -> masuk ke rincian pengeluaran
  rincianPengeluaran: [{
    tanggal: { type: Date, default: Date.now },
    kategoriPengeluaran: { type: String, default: '' },
    namaItem: { type: String, default: '' },
    keterangan: { type: String, default: '' },
    qty: { type: Number, default: 0 },
    hargaSatuan: { type: Number, default: 0 },
    nominal: { type: Number, default: 0 },
    notaPath: { type: String, default: '' },
    notaNama: { type: String, default: '' }
  }],

  // Vault nota digital (upload manual / nota tambahan)
  vaultNota: [{
    filePath: { type: String, default: '' },
    fileName: { type: String, default: '' },
    uploadedAt: { type: Date, default: Date.now },
    diinputOleh: { type: String, default: '' }
  }]
}, { timestamps: true });

// Gunakan pengecekan ini agar tidak terjadi OverwriteModelError
module.exports = mongoose.models.Lpj || mongoose.model('Lpj', lpjSchema);
