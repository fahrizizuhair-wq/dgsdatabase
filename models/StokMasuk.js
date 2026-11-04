const mongoose = require('mongoose');

const stokMasukSchema = new mongoose.Schema({
  idTransaksi: { type: String, required: true, unique: true },
  namaBarang: { type: String, required: true },
  namaMerk: { type: String, required: true },
  jumlah: { type: Number, required: true },
  supplier: { type: String, required: true },
  tanggal: { type: Date, required: true }, // <-- Diubah jadi wajib diisi dari input manual
  status: { type: String, default: 'Selesai' },
  keterangan: { type: String, default: '' },
  foto: { type: [String], default: [] }
}, { timestamps: true, collection: 'stok_masuk' });

module.exports = mongoose.model('StokMasuk', stokMasukSchema);