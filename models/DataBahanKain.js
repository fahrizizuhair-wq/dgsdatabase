const mongoose = require('mongoose');

const DataBahanKainSchema = new mongoose.Schema({
    idVendor: { type: String, required: true },
    vendorId: { type: String, required: true },
    namaVendor: { type: String, required: true },
    wilayah: { type: String, default: '-' },
    kategoriSupply: { type: String, default: 'Bahan Kain' },
    kontak: { type: String, default: '-' },
    rating: { type: Number, default: 5 },
    deskripsi: { type: String, default: '-' },
    foto: [{ type: String }], // Menyimpan array path file foto
    status: { type: String, default: 'Aktif' }
}, { timestamps: true });

module.exports = mongoose.model('DataBahanKain', DataBahanKainSchema);