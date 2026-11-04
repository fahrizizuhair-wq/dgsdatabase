const mongoose = require('mongoose');

const stokKeluarSchema = new mongoose.Schema({
  idTransaksi: { type: String, required: true, unique: true },
  namaBarang: { type: String, required: true },
  namaMerk: { type: String, required: true },
  jumlah: { type: Number, required: true },
  tujuan: { type: String, required: true },
  tanggal: { type: Date, required: true },
  status: { type: String, default: 'Selesai' },
  keterangan: { type: String, default: '' },
  foto: { type: [String], default: [] },
  diinputOleh: { type: String, default: '' }
}, { timestamps: true, collection: 'stok_keluar' });

module.exports = mongoose.model('StokKeluar', stokKeluarSchema);