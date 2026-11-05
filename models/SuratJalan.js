const mongoose = require('mongoose');

const suratJalanSchema = new mongoose.Schema({
    noSuratJalan: { type: String, required: true, unique: true },
    tanggal: { type: Date, default: Date.now },
    kepadaYth: { type: String, required: true },
    noTelepon: { type: String },
    alamat: { type: String, required: true },
    perihal: { type: String },
    pekerjaan: { type: String },
    jenisKirim: { type: String, enum: ['Dokumen', 'Barang'], default: 'Barang' },
    items: [{
        no: Number,
        diskripsi: String,
        jumlah: Number,
        satuan: String
    }],
    diinputOleh: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SuratJalan', suratJalanSchema);