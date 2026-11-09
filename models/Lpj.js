const mongoose = require('mongoose');

const lpjSchema = new mongoose.Schema({
  namaKegiatan: { type: String, required: true },
  kategori: { type: String, required: true },
  status: { type: String, default: 'Draft' },
  anggaranKasbon: { type: Number, default: 0 },
  totalPengeluaran: { type: Number, default: 0 },
  keterangan: { type: String },
  diinputOleh: { type: String },
  
  // Array data untuk tab detail (opsional/bisa dikembangkan nanti)
  pencairanDana: [{
    tanggal: String,
    uraian: String,
    nomorOrder: String,
    jumlah: Number,
    status: String
  }],
  rincianPengeluaran: [{
    kategoriBiaya: String,
    tanggal: String,
    uraianBarang: String,
    qty: String,
    hargaSatuan: Number,
    total: Number,
    notaUrl: String
  }]
}, { timestamps: true });

module.exports = mongoose.model('Lpj', lpjSchema);