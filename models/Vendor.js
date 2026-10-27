const mongoose = require('mongoose');

const VendorSchema = new mongoose.Schema({
  idVendor: String,
  namaVendor: String,
  wilayah: String,
  kategori: String,
  kontak: String,
  rating: Number,
  status: String,
  deskripsi: String,
  foto: mongoose.Schema.Types.Mixed
}, { 
  timestamps: true,
  collection: 'vendor' // Mengunci agar selalu menggunakan koleksi 'vendor' yang asli
});

module.exports = mongoose.model('Vendor', VendorSchema);