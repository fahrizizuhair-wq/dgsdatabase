require('dotenv').config();
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '8.8.4.4']); } catch (e) {}
const mongoose = require('mongoose');
const Vendor = require('./models/Vendor');

const mongoUri = process.env.MONGO_URI || 'mongodb+srv://fahrizizuhair_db_user:QTzFx9ErXbkYCf5O@cluster0.xp4d3tt.mongodb.net/kiosk_sblk_db?retryWrites=true&w=majority';

(async () => {
  await mongoose.connect(mongoUri);
  await Vendor.updateOne({ idVendor: 'TST-001' }, { $set: { foto: ['1791771354672-445810230.jpg'] } });
  console.log('foto updated');
  await mongoose.disconnect();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
