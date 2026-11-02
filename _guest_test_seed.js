require('dotenv').config();
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '8.8.4.4']); } catch (e) {}
const fs = require('fs');
const mongoose = require('mongoose');
const Vendor = require('./models/Vendor');
const HargaDasar = require('./models/HargaDasar');
const DataBahanKain = require('./models/DataBahanKain');
const Laporan = require('./models/Laporan');

const mongoUri = process.env.MONGO_URI || 'mongodb+srv://fahrizizuhair_db_user:QTzFx9ErXbkYCf5O@cluster0.xp4d3tt.mongodb.net/kiosk_sblk_db?retryWrites=true&w=majority';

(async () => {
  await mongoose.connect(mongoUri);

  const vendor = await Vendor.create({
    idVendor: 'TST-001',
    namaVendor: 'Vendor Uji Guest',
    wilayah: 'Surabaya',
    kategori: 'Bahan Kain',
    status: 'Aktif',
    foto: ['1791880996424-285458848.jpeg']
  });

  const harga = await HargaDasar.create({
    idBarang: 'TST-BRG-001',
    namaBarang: 'Barang Uji Guest',
    namaMerk: 'Merk Uji',
    spesifikasi: 'Spesifikasi uji',
    status: 'Ready',
    tanggal: new Date()
  });

  const kain = await DataBahanKain.create({
    idVendor: 'TST-001',
    vendorId: 'vendor-uji-guest',
    namaVendor: 'Vendor Uji Guest',
    wilayah: 'Surabaya',
    kategoriSupply: 'Bahan Kain',
    status: 'Aktif'
  });

  const laporan = await Laporan.create({
    namaDokumen: 'Laporan Uji Guest',
    jenis: 'Umum',
    tujuan: 'Internal',
    keterangan: 'Data uji tampilan guest',
    filePath: '/uploads/file-1791796214361-835280495.pdf',
    tanggal: new Date()
  });

  fs.writeFileSync(
    '_guest_test_ids.json',
    JSON.stringify({
      vendor: vendor._id.toString(),
      harga: harga._id.toString(),
      kain: kain._id.toString(),
      laporan: laporan._id.toString()
    }, null, 2)
  );

  console.log('Seeded:', vendor._id.toString());
  await mongoose.disconnect();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
