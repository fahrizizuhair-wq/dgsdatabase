const mongoose = require('mongoose');

const suratJalanSchema = new mongoose.Schema({
    noSuratJalan: { type: String, required: true, unique: true },
    tanggal: { type: Date, default: Date.now },
    namaPerusahaan: { type: String, required: true },
    kepadaYth: { type: String, required: true },
    namaPenerima: { type: String, default: '' },
    namaPenyerah: { type: String, default: '' },
    noTelepon: { type: String },
    alamat: { type: String, required: true },
    perihal: { type: String },
    pekerjaan: { type: String },
    jenisKirim: { type: String, enum: ['Dokumen', 'Barang'], default: 'Barang' },
    items: [{
        no: Number,
        diskripsi: String,
        jumlah: String,
        satuan: String,
        keterangan: String
    }],
    // TAMBAHKAN ARRAY INI UNTUK MENAMPUNG KETERANGAN KODE BARANG
    kodeBarangList: [{
        no: Number,
        namaBarang: String,
        kodeBarang: String
    }],
    diinputOleh: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SuratJalan', suratJalanSchema);