const mongoose = require('mongoose');

const projectPengajuanHargaSchema = new mongoose.Schema(
  {
    namaProject: { type: String, required: true, trim: true },
    totalKasbonSampel: { type: Number, default: 0 },
    totalQtyBoq: { type: Number, default: 0 },
    // Nilai desimal penuh: totalKasbonSampel / totalQtyBoq (tidak dibulatkan di tengah jalan).
    sampelPerUnit: { type: Number, default: 0 },
    diinputOleh: { type: String, default: '' },
  },
  { timestamps: true, collection: 'project_pengajuan_harga' },
);

module.exports =
  mongoose.models.ProjectPengajuanHarga ||
  mongoose.model('ProjectPengajuanHarga', projectPengajuanHargaSchema);
