const mongoose = require('mongoose');

const gudangItemSchema = new mongoose.Schema(
  {
    kategoriId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GudangKategori',
      required: true,
      index: true,
    },
    nama: { type: String, required: true, trim: true },
    namaDaftarBarang: { type: String, default: '', trim: true },
    kode: { type: String, default: '', trim: true },
    jumlah: { type: Number, default: 0, min: 0 },
    satuan: { type: String, default: 'pcs', trim: true },
    lokasi: { type: String, default: '', trim: true },
    keterangan: { type: String, default: '', trim: true },
    foto: { type: [String], default: [] },
    diinputOleh: { type: String, default: '' },
  },
  { timestamps: true },
);

module.exports = mongoose.models.GudangItem || mongoose.model('GudangItem', gudangItemSchema);
