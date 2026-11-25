const mongoose = require('mongoose');

const projectHargaDasarSchema = new mongoose.Schema(
  {
    namaProject: { type: String, required: true, trim: true },
    biayaOperasional: { type: Number, default: 0 },
    biayaTransferBedaBank: { type: Number, default: 0 },
    diinputOleh: { type: String, default: '' },
  },
  { timestamps: true, collection: 'project_harga_dasar' },
);

module.exports =
  mongoose.models.ProjectHargaDasar ||
  mongoose.model('ProjectHargaDasar', projectHargaDasarSchema);
