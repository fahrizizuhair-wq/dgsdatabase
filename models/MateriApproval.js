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
    enum: ['Menunggu', 'Disetujui', 'Ditolak'],
    default: 'Menunggu'
  },
  catatan: { type: String, default: '' },
  diinputOleh: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.models.MateriApproval || mongoose.model('MateriApproval', materiApprovalSchema);
