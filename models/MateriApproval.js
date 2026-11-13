const mongoose = require('mongoose');

const materiApprovalSchema = new mongoose.Schema({
  nomorPengajuan: { type: String, default: '', trim: true },
  tanggalPengajuan: { type: Date, default: Date.now },
  pemohon: { type: String, default: '', trim: true },
  unitKerja: { type: String, required: true, trim: true },
  vendor: { type: String, default: '', trim: true },
  kategori: { type: String, default: '', trim: true },
  namaMaterial: { type: String, default: '', trim: true },
  deskripsi: { type: String, default: '', trim: true },
  totalNominal: { type: Number, default: 0 },
  urgensi: {
    type: String,
    enum: ['Normal', 'High', 'Critical'],
    default: 'Normal'
  },
  statusApproval: {
    type: String,
    enum: ['Menunggu Persetujuan', 'Disetujui', 'Ditolak'],
    default: 'Menunggu'
  },
  catatan: { type: String, default: '' },
  diinputOleh: { type: String, default: '' },
  items: [{
    no: Number,
    diskripsi: { type: String, default: '' },
    jumlah: { type: Number, default: 1 },
    satuan: { type: String, default: 'Pcs' },
    hargaSatuan: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 }
  }]
}, { timestamps: true });

module.exports = mongoose.models.MateriApproval || mongoose.model('MateriApproval', materiApprovalSchema);
