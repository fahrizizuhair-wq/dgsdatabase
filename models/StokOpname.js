const mongoose = require('mongoose');

const stokOpnameSchema = new mongoose.Schema({
  namaBarang: { type: String, required: true },
  kategori: { type: String, required: true },
  stokAwal: { type: Number, required: true, default: 0 },
  stokMasuk: { type: Number, required: true, default: 0 },
  stokKeluar: { type: Number, required: true, default: 0 }
}, { 
  timestamps: true,
  collection: 'stok_opname'
});

module.exports = mongoose.model('StokOpname', stokOpnameSchema);