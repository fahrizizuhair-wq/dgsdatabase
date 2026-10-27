  const mongoose = require('mongoose');

  const hargaDasarSchema = new mongoose.Schema({
    idBarang: { type: String, required: true, unique: true },
    namaBarang: { type: String, required: true },
    namaMerk: { type: String, required: true },
    spesifikasi: { type: String, default: '' },
    qty: { type: Number, default: 1 },
    harga: { type: Number, default: 0 },
    final: { type: Number, default: 0 },
    keterangan: { type: String, default: '' },
    status: { type: String, default: 'Pending' },
    tanggal: { type: Date, default: Date.now },
    gambar: [String] // <-- TAMBAHKAN BARIS INI (Array untuk menyimpan banyak nama file foto)
  }, { timestamps: true, collection: 'harga_dasar' });

  module.exports = mongoose.model('HargaDasar', hargaDasarSchema);