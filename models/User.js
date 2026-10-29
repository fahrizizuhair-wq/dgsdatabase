const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  namaLengkap: { type: String, default: '' }, // Untuk sapaan & nama di sidebar/dashboard
  username: { type: String, required: true, unique: true }, // Untuk login unik
  password: { type: String, required: true }, // Password akun (bcrypt hash)
  role: { type: String, default: 'user' }     // Pembeda hak akses ('admin' atau 'user')
}, { timestamps: true, collection: 'users' });

module.exports = mongoose.model('User', userSchema);
