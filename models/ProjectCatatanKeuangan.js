const mongoose = require('mongoose');

const projectCatatanKeuanganSchema = new mongoose.Schema(
  {
    namaProject: { type: String, required: true, trim: true },
    diinputOleh: { type: String, default: '' },
  },
  { timestamps: true, collection: 'project_catatan_keuangan' },
);

module.exports =
  mongoose.models.ProjectCatatanKeuangan ||
  mongoose.model('ProjectCatatanKeuangan', projectCatatanKeuanganSchema);
