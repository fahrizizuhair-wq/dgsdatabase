const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    recoveryCode: { type: String, default: '' } // Kode pemulihan 4 digit (bcrypt hash)
}, { timestamps: true, collection: 'admin' });

module.exports = mongoose.model('Admin', adminSchema);