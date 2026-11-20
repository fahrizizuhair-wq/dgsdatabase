const mongoose = require('mongoose');

const gudangKategoriSchema = new mongoose.Schema(
  {
    nama: { type: String, required: true, trim: true },
    deskripsi: { type: String, default: '', trim: true },
    warna: { type: String, default: 'maroon', trim: true },
    urutan: { type: Number, default: 99 },
    sistem: { type: Boolean, default: false },
    diinputOleh: { type: String, default: '' },
  },
  { timestamps: true },
);

module.exports =
  mongoose.models.GudangKategori || mongoose.model('GudangKategori', gudangKategoriSchema);
