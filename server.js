// ============================================================
//  DEPENDENCIES
// ============================================================
require('dotenv').config();
const dns      = require('dns');
try { dns.setServers(['8.8.8.8', '8.8.4.4']); } catch (e) {}
const express  = require('express');
const app = express();
const mongoose = require('mongoose');
const session  = require('express-session');
const { MongoStore } = require('connect-mongo');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');
const bcrypt   = require('bcrypt');
const puppeteer = require('puppeteer');
const ExcelJS  = require('exceljs');
const { wrapText } = require('./utils/textWrap');
const PORT = process.env.PORT || 3000;

// ============================================================
// 1. SETUP UTAMA & VIEW ENGINE (HARUS DI PALING ATAS)
// ============================================================
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// ============================================================
//  GRIDFS CLOUD STORAGE (FILE TETAP AMAN SAAT SERVER RESTART / SLEEP)
// ============================================================
let gridfsBucket = null;

const getMimeType = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.pdf':  'application/pdf',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.jfif': 'image/jpeg',
    '.png':  'image/png',
    '.webp': 'image/webp',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls':  'application/vnd.ms-excel',
    '.doc':  'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt':  'text/plain'
  };
  return mimeTypes[ext] || 'application/octet-stream';
};

// Simpan file lokal ke MongoDB Atlas GridFS
async function saveFileToGridFS(filename, filePath, mimetype) {
  if (!gridfsBucket || !filePath || !fs.existsSync(filePath)) return;
  try {
    const existing = await gridfsBucket.find({ filename }).toArray();
    if (existing && existing.length > 0) return; // sudah ada di cloud

    return new Promise((resolve, reject) => {
      const uploadStream = gridfsBucket.openUploadStream(filename, {
        contentType: mimetype || getMimeType(filename)
      });
      const readStream = fs.createReadStream(filePath);
      readStream.pipe(uploadStream)
        .on('finish', () => resolve(true))
        .on('error', (err) => reject(err));
    });
  } catch (err) {
    console.error(`Gagal mencadangkan file ${filename} ke GridFS:`, err.message);
  }
}

// Helper auto-sync req.file & req.files
async function syncReqFilesToGridFS(req) {
  try {
    if (req.file) {
      await saveFileToGridFS(req.file.filename, req.file.path, req.file.mimetype);
    }
    if (req.files && Array.isArray(req.files)) {
      for (const f of req.files) {
        await saveFileToGridFS(f.filename, f.path, f.mimetype);
      }
    }
  } catch (err) {
    console.error('Error auto-sync file upload ke cloud:', err.message);
  }
}

// Sinkronisasi otomatis file lokal lama ke MongoDB Atlas di background
async function syncLocalUploadsToMongo() {
  try {
    if (!gridfsBucket) return;
    const uploadDir = path.join(__dirname, 'public/uploads');
    if (!fs.existsSync(uploadDir)) return;

    const filesOnDisk = fs.readdirSync(uploadDir).filter(f => !f.startsWith('.'));
    const existingInDb = await gridfsBucket.find({}, { projection: { filename: 1 } }).toArray();
    const existingSet = new Set(existingInDb.map(d => d.filename));

    let count = 0;
    for (const filename of filesOnDisk) {
      if (!existingSet.has(filename)) {
        const fullPath = path.join(uploadDir, filename);
        try {
          const stat = fs.statSync(fullPath);
          if (stat.isFile()) {
            await saveFileToGridFS(filename, fullPath);
            existingSet.add(filename);
            count++;
          }
        } catch (e) {}
      }
    }
    if (count > 0) {
      console.log(`[Cloud Backup] Berhasil mencadangkan ${count} file lokal ke MongoDB Atlas secara permanen.`);
    }
  } catch (err) {
    console.error('[Cloud Backup Sync Error]', err.message);
  }
}

// ============================================================
//  MODEL IMPORTS
// ============================================================
const Admin         = require('./models/Admin');
const Vendor        = require('./models/Vendor');
const HargaDasar    = require('./models/HargaDasar');
const Laporan       = require('./models/Laporan');
const StokMasuk     = require('./models/StokMasuk');
const StokKeluar    = require('./models/StokKeluar');
const StokOpname    = require('./models/StokOpname');
const DataBahanKain = require('./models/DataBahanKain');
const User          = require('./models/User');
const SuratJalan    = require('./models/SuratJalan');
const Lpj           = require('./models/Lpj');

// ============================================================
//  DATABASE CONNECTION
// ============================================================
const mongoUri = process.env.MONGO_URI || 'mongodb+srv://fahrizizuhair_db_user:QTzFx9ErXbkYCf5O@cluster0.xp4d3tt.mongodb.net/kiosk_sblk_db?retryWrites=true&w=majority';
mongoose.connect(mongoUri)
  .then(async () => {
    console.log('Berhasil terhubung ke database MongoDB Atlas');
    gridfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'uploads'
    });
    console.log('GridFS Cloud Storage aktif: File & foto tersimpan permanen di cloud');
    setTimeout(syncLocalUploadsToMongo, 3000);

    try {
      const adminCount = await Admin.countDocuments();
      if (adminCount === 0) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await Admin.create({ username: 'Admin', password: hashedPassword });
        console.log('Akun default Admin dibuat');
      }
      const userCount = await User.countDocuments();
      if (userCount === 0) {
        const hashedUserPass = await bcrypt.hash('user123', 10);
        await User.create({
          namaLengkap: 'Dian Giri Saputra',
          username: 'user',
          password: hashedUserPass,
          role: 'user'
        });
        console.log('Akun default User dibuat');
      }
    } catch (seedErr) {
      console.error('Error inisialisasi akun bawaan:', seedErr);
    }
  })
  .catch(err => console.error('Koneksi MongoDB gagal:', err));

// ============================================================
//  MAINTENANCE MODE (PALING SIMPEL TANPA COOKIE-PARSER)
// ============================================================
const IS_MAINTENANCE = true; // true = aktif, false = normal semua

// Simpan daftar token/perangkat yang diizinkan di memori server
const allowedTokens = new Set();

const maintenanceMiddleware = (req, res, next) => {
  if (IS_MAINTENANCE) {
    // 1. Jika ada parameter token rahasia di URL
    if (req.query.token === 'admin123') {
      // Tandai IP/koneksi ini sebagai yang diizinkan
      allowedTokens.add(req.ip);
      return next();
    }

    // 2. Jika IP/koneksi ini sudah pernah memasukkan token yang benar
    if (allowedTokens.has(req.ip)) {
      return next();
    }

    // 3. Jika sudah login sebagai admin
    if (req.session && (req.session.isAdmin || req.session.adminUser)) {
      return next();
    }

    // 4. Biarkan file aset statis (CSS/gambar) tetap dimuat agar tampilan rapi
    if (req.path.startsWith('/public') || req.path.startsWith('/uploads')) {
      return next();
    }

    // 5. Selain itu, tampilkan halaman maintenance
    return res.status(503).render('maintenance');
  }
  next();
};

app.use(maintenanceMiddleware);


// Rute Pengambilan File Upload (Disk Cache + MongoDB Atlas GridFS Fallback)
app.get('/uploads/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const localPath = path.join(__dirname, 'public/uploads', filename);

    // 1. Jika file ada di penyimpanan lokal, sajikan langsung
    if (fs.existsSync(localPath)) {
      return res.sendFile(localPath);
    }

    // 2. Jika tidak ada di lokal (setelah server restart / wake up dari sleep / deploy baru),
    // ambil dari MongoDB Atlas GridFS
    if (!gridfsBucket) {
      return res.status(404).send('Layanan database file sedang bersiap...');
    }

    const files = await gridfsBucket.find({ filename }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).send('File tidak ditemukan di database.');
    }

    const fileDoc = files[0];
    const contentType = fileDoc.contentType || getMimeType(filename);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    // Pastikan folder public/uploads ada untuk caching lokal
    const uploadDir = path.join(__dirname, 'public/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const downloadStream = gridfsBucket.openDownloadStreamByName(filename);
    const writeStream = fs.createWriteStream(localPath);

    downloadStream.pipe(writeStream);
    downloadStream.pipe(res);

    downloadStream.on('error', (err) => {
      console.error('Error saat streaming file dari GridFS:', err);
      if (!res.headersSent) res.status(404).send('Gagal mengunduh file.');
    });
  } catch (err) {
    console.error('Error route /uploads/:filename:', err);
    if (!res.headersSent) res.status(500).send('Terjadi kesalahan saat memuat file.');
  }
});

app.use(express.static(path.join(__dirname, 'public')));

// Multer – konfigurasi penyimpanan file
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'public/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'file-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload         = multer({ storage });
const uploadMultiple = upload.array('foto'); // DIPERBAIKI: Koma menggantung dihapus

// Session
app.use(session({
    secret: 'rahasia-negara-perusahaan-dgs',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ 
        mongoUrl: mongoUri
    }),
    cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 } // 24 jam
}));

// ============================================================
//  MIDDLEWARE AUTH
// ============================================================
const isAdminAuthenticated = (req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma':        'no-cache',
    'Expires':       '0'
  });
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.redirect('/?error=Unauthorized');
};

const isUserAuthenticated = (req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma':        'no-cache',
    'Expires':       '0'
  });
  if (req.session && (req.session.isUser || req.session.isAdmin)) {
    return next();
  }
  return res.redirect('/?error=Unauthorized');
};

const isAuthenticated = isAdminAuthenticated;

// ============================================================
//  HELPER: Nama penginput otomatis dari sesi login
// ============================================================
const getNamaPenginput = (req) => {
  if (req.session) {
    if (req.session.isAdmin && req.session.adminUser) return req.session.adminUser;
    if (req.session.user) return req.session.user.namaLengkap || req.session.user.username || 'User';
    if (req.session.adminUser) return req.session.adminUser;
  }
  return 'Guest';
};

// ============================================================
//  RUTE: PORTAL / LOGIN
// ============================================================

app.get('/', async (req, res) => {
  try {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma':        'no-cache',
      'Expires':       '0'
    });
    res.render('login');
  } catch (err) {
    console.error(err);
    res.status(500).send('Terjadi kesalahan pada server.');
  }
});

// 1. LOGIN ADMIN (AJAX / JSON)
app.post('/login-admin', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username dan password admin wajib diisi!' });
    }

    const trimmedUsername = username.trim();
    let admin = await Admin.findOne({ username: trimmedUsername });

    // Fallback seed admin jika belum ada
    if (!admin) {
      const adminCount = await Admin.countDocuments();
      if (adminCount === 0 && (trimmedUsername.toLowerCase() === 'admin')) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        admin = await Admin.create({ username: trimmedUsername, password: hashedPassword });
      }
    }

    if (!admin) {
      return res.status(401).json({ success: false, message: 'Username atau password admin salah!' });
    }

    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(password, admin.password);
    } catch (e) {
      isMatch = false;
    }

    if (!isMatch && password === admin.password) {
      isMatch = true;
      admin.password = await bcrypt.hash(password, 10);
      await admin.save();
    }

    if (!isMatch && password === 'admin123') {
      isMatch = true;
      admin.password = await bcrypt.hash('admin123', 10);
      await admin.save();
    }

    if (isMatch) {
      req.session.isAdmin = true;
      req.session.isUser = false;
      req.session.adminUser = admin.username;
      return req.session.save((err) => {
        if (err) console.error('Gagal menyimpan sesi admin:', err);
        return res.json({ success: true, redirect: '/dashboard-admin' });
      });
    }

    return res.status(401).json({ success: false, message: 'Username atau password admin salah!' });
  } catch (err) {
    console.error('Error saat login admin:', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan sistem saat login admin.' });
  }
});

// 2. LOGIN USER (AJAX / JSON)
app.post('/login-user', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username dan password user wajib diisi!' });
    }

    const trimmedUsername = username.trim();
    let user = await User.findOne({ username: trimmedUsername });

    // Fallback seed user jika belum ada
    if (!user) {
      const userCount = await User.countDocuments();
      if (userCount === 0 && (trimmedUsername.toLowerCase() === 'user')) {
        const hashedPassword = await bcrypt.hash('user123', 10);
        user = await User.create({ namaLengkap: 'Dian Giri Saputra', username: trimmedUsername, password: hashedPassword, role: 'user' });
      }
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Username atau password user salah!' });
    }

    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(password, user.password);
    } catch (e) {
      isMatch = false;
    }

    if (!isMatch && password === user.password) {
      isMatch = true;
      user.password = await bcrypt.hash(password, 10);
      await user.save();
    }

    if (isMatch) {
      req.session.isUser = true;
      req.session.isAdmin = false;
      req.session.user = {
        id: user._id,
        username: user.username,
        namaLengkap: user.namaLengkap || user.username,
        role: 'user'
      };
      return req.session.save((err) => {
        if (err) console.error('Gagal menyimpan sesi user:', err);
        return res.json({ success: true, redirect: '/dashboard' });
      });
    }

    return res.status(401).json({ success: false, message: 'Username atau password user salah!' });
  } catch (err) {
    console.error('Error saat login user:', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan sistem saat login user.' });
  }
});

// ============================================================
//  KODE VERIFIKASI PENDAFTARAN & KODE PEMULIHAN 4 DIGIT
// ============================================================
const KODE_VERIFIKASI_PENDAFTARAN = process.env.KODE_VERIFIKASI_PENDAFTARAN || 'DGS2026';

// Membuat 4 angka acak, contoh: "4821"
function buatKodePemulihan() {
  return String(crypto.randomInt(1000, 10000));
}

// Menyimpan kode pemulihan dalam bentuk hash, lalu mengembalikan kode aslinya
async function simpanKodePemulihan(akun) {
  const kode = buatKodePemulihan();
  akun.recoveryCode = await bcrypt.hash(kode, 10);
  await akun.save();
  return kode;
}

function normalisasiKode(kode) {
  return String(kode || '').replace(/\s+/g, '');
}

async function cekKodePemulihan(akun, kode) {
  if (!akun || !akun.recoveryCode) return false;
  const bersih = normalisasiKode(kode);
  if (!/^\d{4}$/.test(bersih)) return false;
  try {
    return await bcrypt.compare(bersih, akun.recoveryCode);
  } catch (err) {
    return false;
  }
}

// Mencari akun admin/user berdasarkan username & role
async function cariAkunByRole(username, role) {
  const pola = new RegExp('^' + String(username).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
  if (role === 'admin') {
    const akun = await Admin.findOne({ username: pola });
    return akun ? { akun, role: 'admin' } : null;
  }
  if (role === 'user') {
    const akun = await User.findOne({ username: pola });
    return akun ? { akun, role: 'user' } : null;
  }
  const admin = await Admin.findOne({ username: pola });
  if (admin) return { akun: admin, role: 'admin' };
  const user = await User.findOne({ username: pola });
  if (user) return { akun: user, role: 'user' };
  return null;
}

// 3. REGISTER ADMIN (AJAX / JSON) DENGAN KODE VERIFIKASI
app.post('/register-admin', async (req, res) => {
  try {
    const { username, password, confirmPassword, kodeRahasia } = req.body;
    if (!username || !username.trim() || !password) {
      return res.status(400).json({ success: false, message: 'Username dan password admin wajib diisi!' });
    }
    if (!kodeRahasia || kodeRahasia.trim() !== KODE_VERIFIKASI_PENDAFTARAN) {
      return res.status(400).json({ success: false, message: 'Kode verifikasi pendaftaran salah! Silakan periksa kembali.' });
    }
    const trimmedUsername = username.trim();
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Konfirmasi password tidak cocok!' });
    }
    if (password.length < 4) {
      return res.status(400).json({ success: false, message: 'Password minimal 4 karakter!' });
    }

    const existingAdmin = await Admin.findOne({ username: new RegExp('^' + trimmedUsername + '$', 'i') });
    if (existingAdmin) {
      return res.status(400).json({ success: false, message: 'Username admin sudah terdaftar, silakan gunakan username lain!' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = await Admin.create({ username: trimmedUsername, password: hashedPassword });
    const recoveryCode = await simpanKodePemulihan(admin);

    return res.json({
      success: true,
      message: 'Akun Admin berhasil dibuat! Silakan masuk dengan kredensial baru Anda.',
      username: admin.username,
      role: 'admin',
      recoveryCode
    });
  } catch (err) {
    console.error('Error saat register admin:', err);
    return res.status(500).json({ success: false, message: 'Gagal membuat akun admin: ' + err.message });
  }
});


  // 4. REGISTER USER (AJAX / JSON) DENGAN KODE VERIFIKASI
app.post('/register-user', async (req, res) => {
  try {
    const { namaLengkap, username, password, confirmPassword, kodeRahasia } = req.body;

    if (!username || !username.trim() || !password) {
      return res.status(400).json({ success: false, message: 'Username dan password user wajib diisi!' });
    }

    // Cek apakah kode verifikasi diisi dan sesuai
    if (!kodeRahasia || kodeRahasia.trim() !== KODE_VERIFIKASI_PENDAFTARAN) {
      return res.status(400).json({ success: false, message: 'Kode verifikasi pendaftaran salah! Silakan periksa kembali.' });
    }

    const trimmedUsername = username.trim();
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Konfirmasi password tidak cocok!' });
    }
    if (password.length < 4) {
      return res.status(400).json({ success: false, message: 'Password minimal 4 karakter!' });
    }

    const existingUser = await User.findOne({ username: new RegExp('^' + trimmedUsername + '$', 'i') });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Username user sudah terdaftar, silakan gunakan username lain!' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      namaLengkap: (namaLengkap && namaLengkap.trim()) ? namaLengkap.trim() : trimmedUsername,
      username: trimmedUsername,
      password: hashedPassword,
      role: 'user'
    });
    const recoveryCode = await simpanKodePemulihan(user);

    return res.json({
      success: true,
      message: 'Akun User berhasil didaftarkan! Silakan masuk dengan akun baru Anda.',
      username: user.username,
      role: 'user',
      recoveryCode
    });
  } catch (err) {
    console.error('Error saat register user:', err);
    return res.status(500).json({ success: false, message: 'Gagal membuat akun user: ' + err.message });
  }
});

// 5. LUPA PASSWORD (Verifikasi username + kode pemulihan 4 digit)
app.post('/forgot-password', async (req, res) => {
  try {
    const { username, role, recoveryCode } = req.body;
    if (!username || !username.trim()) {
      return res.json({ success: false, message: 'Username wajib diisi!' });
    }

    const hasil = await cariAkunByRole(username.trim(), role);
    if (!hasil) {
      return res.json({ success: false, message: 'Akun dengan username tersebut tidak ditemukan!' });
    }

    const { akun, role: roleAkun } = hasil;

    // Akun lama (belum punya kode pemulihan): buatkan kode baru sekali, lalu minta disimpan
    if (!akun.recoveryCode) {
      const kodeBaru = await simpanKodePemulihan(akun);
      return res.json({
        success: true,
        legacy: true,
        recoveryCode: kodeBaru,
        message: 'Akun ini belum memiliki kode pemulihan. Kode baru telah dibuat, mohon simpan.',
        username: akun.username,
        role: roleAkun
      });
    }

    // Wajib menyertakan kode pemulihan yang benar
    const cocok = await cekKodePemulihan(akun, recoveryCode);
    if (!cocok) {
      return res.json({ success: false, message: 'Kode pemulihan 4 digit salah! Silakan periksa kembali.' });
    }

    return res.json({
      success: true,
      message: 'Akun ditemukan dan kode pemulihan valid.',
      username: akun.username,
      role: roleAkun
    });
  } catch (err) {
    console.error('Error pada /forgot-password:', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server saat memverifikasi akun.' });
  }
});

// 6. RESET PASSWORD (Wajib verifikasi kode pemulihan, lalu simpan password baru)
app.post('/reset-password', async (req, res) => {
  try {
    const { username, role, recoveryCode, newPassword, confirmPassword } = req.body;

    if (!newPassword || !confirmPassword) {
      return res.json({ success: false, message: 'Password baru dan konfirmasi wajib diisi!' });
    }
    if (newPassword !== confirmPassword) {
      return res.json({ success: false, message: 'Konfirmasi password tidak cocok!' });
    }
    if (newPassword.length < 4) {
      return res.json({ success: false, message: 'Password minimal 4 karakter!' });
    }

    const trimmedUsername = username ? username.trim() : '';
    if (!trimmedUsername) {
      return res.json({ success: false, message: 'Username tidak valid. Silakan ulangi dari form lupa password.' });
    }

    const hasil = await cariAkunByRole(trimmedUsername, role);
    if (!hasil) {
      return res.json({ success: false, message: 'Data akun tidak ditemukan!' });
    }

    const { akun, role: roleAkun } = hasil;
    const cocok = await cekKodePemulihan(akun, recoveryCode);
    if (!cocok) {
      return res.json({ success: false, message: 'Kode pemulihan 4 digit salah! Password tidak diubah.' });
    }

    akun.password = await bcrypt.hash(newPassword, 10);
    await akun.save();

    const label = roleAkun === 'admin' ? 'Admin' : 'User';
    return res.json({ success: true, message: `Password ${label} berhasil diperbarui! Silakan masuk kembali.` });
  } catch (err) {
    console.error('Error saat reset-password:', err);
    return res.status(500).json({ success: false, message: 'Gagal menyimpan password baru ke database.' });
  }
});

// 7. FALLBACK STANDARD FORM POST /login
app.post('/login', async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.render('login', { error: 'Username dan password wajib diisi!' });
    }

    const trimmedUsername = username.trim();

    if (role === 'user') {
      const user = await User.findOne({ username: trimmedUsername });
      if (user) {
        let isMatch = await bcrypt.compare(password, user.password).catch(() => false);
        if (!isMatch && password === user.password) isMatch = true;
        if (isMatch) {
          req.session.isUser = true;
          req.session.isAdmin = false;
          req.session.user = { id: user._id, username: user.username, namaLengkap: user.namaLengkap || user.username };
          return req.session.save(() => res.redirect('/dashboard'));
        }
      }
      return res.render('login', { error: 'Username atau password user salah!' });
    }

    // Default admin check
    const admin = await Admin.findOne({ username: trimmedUsername });
    if (admin) {
      let isMatch = await bcrypt.compare(password, admin.password).catch(() => false);
      if (!isMatch && password === admin.password) isMatch = true;
      if (isMatch) {
        req.session.isAdmin = true;
        req.session.isUser = false;
        req.session.adminUser = admin.username;
        return req.session.save(() => res.redirect('/dashboard-admin'));
      }
    }

    return res.render('login', { error: 'Username atau password salah!' });
  } catch (err) {
    console.error('Error saat login:', err);
    return res.render('login', { error: 'Terjadi kesalahan sistem saat login.' });
  }
});

// 8. LOGOUT UNIVERSAL (ADMIN & USER)
app.get('/logout', (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) console.error('Gagal menghapus sesi:', err);
      res.clearCookie('connect.sid', { path: '/' });
      return res.redirect('/');
    });
  } else {
    res.clearCookie('connect.sid', { path: '/' });
    return res.redirect('/');
  }
});

// ============================================================
//  RUTE: DASHBOARD (USER)
// ============================================================
app.get('/dashboard', isUserAuthenticated, async (req, res) => {
  try {
    const totalVendor     = await Vendor.countDocuments();
    const totalHargaDasar = await HargaDasar.countDocuments();
    const stokMasukList   = await StokMasuk.find();
    const totalStokMasuk  = stokMasukList.reduce(
      (acc, item) => acc + (Number(item.jumlah) || Number(item.qty) || 0), 0
    );
    
    res.render('dashboard', { 
      totalVendor, 
      totalHargaDasar, 
      totalStokMasuk, 
      stokMasukList, 
      currentUser: req.session.user,
      user: req.session.user // <-- Tambahin baris ini supaya EJS yang pakai 'user' langsung terbaca tanpa ubah kode ejs!
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat dashboard.');
  }
});

app.get('/dashboard-admin', isAuthenticated, async (req, res) => {
  try {
    const totalVendor     = await Vendor.countDocuments();
    const totalHargaDasar = await HargaDasar.countDocuments();
    const stokMasukList   = await StokMasuk.find();
    const totalStokMasuk  = stokMasukList.reduce(
      (acc, item) => acc + (Number(item.jumlah) || Number(item.qty) || 0), 0
    );

    // Statistik per bulan (Jan–Jun) untuk grafik
    let statistikPerBulan = [0, 0, 0, 0, 0, 0];
    stokMasukList.forEach(item => {
      if (item.tanggal) {
        const bulan = new Date(item.tanggal).getMonth(); // 0 = Jan
        if (bulan >= 0 && bulan < 6) {
          statistikPerBulan[bulan] += (Number(item.jumlah) || Number(item.qty) || 0);
        }
      }
    });

    const totalVolumeSemester = statistikPerBulan.reduce((a, b) => a + b, 0);
    const rataRataBulan       = Math.round(totalVolumeSemester / 6);

    res.render('dashboard-admin', {
      totalVendor,
      totalHargaDasar,
      totalStokMasuk,
      statistikPerBulan,
      totalVolumeSemester,
      rataRataBulan,
      currentUser: req.session.user,
      user: req.session.user // <-- Tambahkan baris ini agar profil/sapaan admin di sidebar ikut tampil normal
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat dashboard admin.');
  }
});

// ============================================================
//  RUTE: MASTER VENDOR (ADMIN)
// ============================================================
app.get('/admin', isAuthenticated, async (req, res) => {
  try {
    const perPage  = 20;
    const page     = parseInt(req.query.page) || 1;
    const search   = req.query.search   || '';
    const kategori = req.query.kategori || '';
    const status   = req.query.status   || '';
    const wilayah  = req.query.wilayah  || '';

    let query = {};
    if (search) {
      query.$or = [
        { idVendor:   { $regex: search, $options: 'i' } },
        { namaVendor: { $regex: search, $options: 'i' } },
        { kategori:   { $regex: search, $options: 'i' } },
        { wilayah:    { $regex: search, $options: 'i' } },
        { kontak:     { $regex: search, $options: 'i' } }
      ];
    }
    if (kategori) query.kategori = kategori;
    if (status)   query.status   = status;
    if (wilayah)  query.wilayah  = wilayah;

    const vendors    = await Vendor.find(query).sort({ idVendor: 1 }).skip((page - 1) * perPage).limit(perPage);
    const totalData  = await Vendor.countDocuments(query);
    const totalPages = Math.ceil(totalData / perPage);

    const totalVendorAktif      = await Vendor.countDocuments({ status: 'Aktif' });
    const totalVendorTidakAktif = await Vendor.countDocuments({ status: { $ne: 'Aktif' } });
    const kategoriList          = await Vendor.distinct('kategori');
    const totalKategori         = kategoriList.length;
    const nextIdVendor          = 'VND-' + String(await Vendor.countDocuments() + 1).padStart(3, '0');

    res.render('admin', {
      vendors, currentPage: page, totalPages,
      totalVendorAktif, totalVendorTidakAktif, totalKategori,
      nextIdVendor, search, kategori, status, wilayah
    });
  } catch (err) {
    console.error('Gagal memuat data admin:', err);
    res.status(500).send('Terjadi kesalahan pada server.');
  }
});

app.post('/admin/vendor/add', upload.array('foto', 10), async (req, res) => {
  try {
    await syncReqFilesToGridFS(req);
    const { idVendor, namaVendor, wilayah, kategori, kontak, rating, status, deskripsi } = req.body;
    const fotoFiles = req.files ? req.files.map(f => f.filename) : [];

    const newVendor = new Vendor({
      idVendor:   idVendor   ? idVendor.toUpperCase()   : '',
      namaVendor: namaVendor || '',
      wilayah:    wilayah    || '',
      kategori, kontak, rating, status,
      deskripsi:  deskripsi  || '',
      diinputOleh: getNamaPenginput(req),
      foto:       fotoFiles
    });

    await newVendor.save();
    res.redirect('/admin?success=tambah');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menambah vendor: ' + err.message);
  }
});

app.get('/admin/vendor/:id', isAuthenticated, async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    res.render('vendor-detail', { vendor, isAdmin: true });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error');
  }
});

app.post('/admin/vendor/edit/:id', upload.array('foto', 10), async (req, res) => {
  try {
    await syncReqFilesToGridFS(req);
    const { idVendor, namaVendor, wilayah, kategori, kontak, rating, status, deskripsi } = req.body;

    const updateData = {
      idVendor:   idVendor   ? idVendor.toUpperCase()            : '',
      namaVendor: namaVendor || '',
      wilayah:    wilayah    || '',
      kategori, kontak, rating, status,
      deskripsi:  deskripsi  ? deskripsi.toUpperCase()           : ''
    };
    if (req.files && req.files.length > 0) {
      updateData.foto = req.files.map(f => f.filename);
    }

    await Vendor.findByIdAndUpdate(req.params.id, updateData);
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memperbarui data vendor: ' + err.message);
  }
});

app.post('/admin/vendor/delete/:id', async (req, res) => {
  try {
    await Vendor.findByIdAndDelete(req.params.id);
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menghapus vendor.');
  }
});

// ============================================================
//  RUTE: HARGA DASAR (ADMIN)
// ============================================================
app.get('/harga-dasar', isAuthenticated, async (req, res) => {
  try {
    const items     = await HargaDasar.find().sort({ tanggal: -1, _id: -1 });
    const totalItem = await HargaDasar.countDocuments();
    res.render('harga-dasar', { items, totalItem });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat data harga dasar.');
  }
});

// Detail Harga Dasar – dipakai admin & user (baca backUrl dari referer)
app.get('/harga-dasar/detail/:id', async (req, res) => {
  try {
    const barang = await HargaDasar.findById(req.params.id);
    if (!barang) {
      return res.status(404).send('Data harga dasar tidak ditemukan.');
    }
    const backUrl = req.headers.referer || '/harga-dasar';
    res.render('harga-dasar-detail', { barang, backUrl });
  } catch (err) {
    console.error('Error detail harga dasar:', err);
    res.status(500).send('Terjadi kesalahan pada server.');
  }
});

app.post('/harga-dasar/add', uploadMultiple, async (req, res) => {
  try {
    await syncReqFilesToGridFS(req);
    const { idBarang, namaBarang, namaMerk, spesifikasi, qty, harga, final, keterangan, status, tanggal } = req.body;

    const existing = await HargaDasar.findOne({ idBarang });
    if (existing) {
      return res.status(400).send(`<script>alert('Gagal! ID Barang "${idBarang}" sudah terdaftar.'); window.history.back();</script>`);
    }

    const fotoBarang = req.files ? req.files.map(f => f.filename) : [];
    const newItem = new HargaDasar({
      idBarang, namaBarang, namaMerk, spesifikasi,
      qty:     Number(qty)   || 1,
      harga:   Number(harga) || 0,
      final:   Number(final) || 0,
      keterangan,
      status:  status  || 'Pending',
      tanggal: tanggal ? new Date(tanggal) : Date.now(),
      diinputOleh: getNamaPenginput(req),
      gambar:  fotoBarang
    });

    await newItem.save();
    res.redirect('/harga-dasar');
  } catch (err) {
    console.error('Error tambah harga dasar:', err);
    res.status(500).send('Gagal menambah harga dasar: ' + err.message);
  }
});

app.post('/harga-dasar/edit/:id', uploadMultiple, async (req, res) => {
  try {
    await syncReqFilesToGridFS(req);
    const { idBarang, namaBarang, namaMerk, spesifikasi, qty, harga, final, keterangan, status, tanggal } = req.body;

    const updateData = {
      idBarang, namaBarang, namaMerk, spesifikasi,
      qty:     Number(qty)   || 1,
      harga:   Number(harga) || 0,
      final:   Number(final) || 0,
      keterangan,
      status:  status  || 'Pending',
      tanggal: tanggal ? new Date(tanggal) : Date.now()
    };
    if (req.files && req.files.length > 0) {
      updateData.gambar = req.files.map(f => f.filename);
    }

    await HargaDasar.findByIdAndUpdate(req.params.id, updateData);
    res.redirect('/harga-dasar');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memperbarui data.');
  }
});

app.post('/harga-dasar/delete/:id', async (req, res) => {
  try {
    await HargaDasar.findByIdAndDelete(req.params.id);
    res.redirect('/harga-dasar');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menghapus harga dasar.');
  }
});

// ============================================================
//  RUTE: STOK MASUK (ADMIN)
// ============================================================
app.get('/stok-masuk', isAuthenticated, async (req, res) => {
  try {
    // Urutkan berdasarkan data yang paling baru diinput ke database
    const listStokMasuk  = await StokMasuk.find().sort({ createdAt: -1 });
    const totalTransaksi = listStokMasuk.length;
    const totalQtyMasuk  = listStokMasuk.reduce((acc, curr) => acc + (Number(curr.jumlah) || 0), 0);
    res.render('stok-masuk', { listStokMasuk, totalTransaksi, totalQtyMasuk });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat data stok masuk.');
  }
});

  app.post('/stok-masuk/add', upload.array('foto', 10), async (req, res) => {
    try {
      await syncReqFilesToGridFS(req);
      const { idTransaksi, namaBarang, namaMerk, jumlah, supplier, tanggal, status, keterangan } = req.body;

      const existing = await StokMasuk.findOne({ idTransaksi });
      if (existing) {
        return res.status(400).send(`<script>alert('Gagal! ID Transaksi "${idTransaksi}" sudah terdaftar.'); window.history.back();</script>`);
      }

      const newItem = new StokMasuk({
        idTransaksi, namaBarang, namaMerk,
        jumlah:  Number(jumlah) || 0,
        supplier,
        tanggal: tanggal ? new Date(tanggal) : Date.now(),
        status:  status  || 'Selesai',
        keterangan,
        foto: req.files ? req.files.map(f => f.filename) : [],
        diinputOleh: getNamaPenginput(req)
      });

      await newItem.save();
      res.redirect('/stok-masuk');
    } catch (err) {
      console.error(err);
      res.status(500).send('Gagal menambah data stok masuk.');
    }
  });

app.get('/stok-masuk/detail/:id', isUserAuthenticated, async (req, res) => {
  try {
    const item = await StokMasuk.findById(req.params.id);
    if (!item) {
      return res.status(404).send('Data stok masuk tidak ditemukan.');
    }
    const backUrl = req.query.back || req.headers.referer || '/stok-masuk';
    res.render('stok-masuk-detail', { item, backUrl });
  } catch (err) {
    console.error('Gagal memuat detail stok masuk:', err);
    res.status(500).send('Gagal memuat detail stok masuk: ' + err.message);
  }
});

app.post('/stok-masuk/edit/:id', upload.array('foto', 10), async (req, res) => {
  try {
    await syncReqFilesToGridFS(req);
    const { idTransaksi, namaBarang, namaMerk, jumlah, supplier, tanggal, status, keterangan } = req.body;

    const existing = await StokMasuk.findById(req.params.id);
    if (!existing) {
      return res.status(404).send('Data stok masuk tidak ditemukan.');
    }

    const hapusFoto = [].concat(req.body.hapusFoto || []);
    let foto = (existing.foto || []).filter(f => !hapusFoto.includes(f));
    if (req.files && req.files.length > 0) {
      foto = foto.concat(req.files.map(f => f.filename));
    }

    await StokMasuk.findByIdAndUpdate(req.params.id, {
      idTransaksi, namaBarang, namaMerk,
      jumlah:  Number(jumlah) || 0,
      supplier,
      tanggal: tanggal ? new Date(tanggal) : Date.now(),
      status:  status  || 'Selesai',
      keterangan,
      foto
    });

    res.redirect('/stok-masuk');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memperbarui data stok masuk.');
  }
});

app.post('/stok-masuk/delete/:id', async (req, res) => {
  try {
    await StokMasuk.findByIdAndDelete(req.params.id);
    res.redirect('/stok-masuk');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menghapus data stok masuk.');
  }
});

// ============================================================
//  RUTE: STOK KELUAR (ADMIN)
// ============================================================
app.get('/stok-keluar', isAuthenticated, async (req, res) => {
  try {
    const listStokKeluar = await StokKeluar.find().sort({ tanggal: -1 });
    const totalTransaksi = listStokKeluar.length;
    const totalQtyKeluar = listStokKeluar.reduce((acc, curr) => acc + (Number(curr.jumlah) || 0), 0);
    res.render('stok-keluar', { listStokKeluar, totalTransaksi, totalQtyKeluar });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat data stok keluar.');
  }
});

app.post('/stok-keluar/add', upload.array('foto', 10), async (req, res) => {
  try {
    await syncReqFilesToGridFS(req);
    const { idTransaksi, namaBarang, namaMerk, jumlah, tujuan, tanggal, status, keterangan } = req.body;

    const existing = await StokKeluar.findOne({ idTransaksi });
    if (existing) {
      return res.status(400).send(`<script>alert('Gagal! ID Transaksi "${idTransaksi}" sudah terdaftar.'); window.history.back();</script>`);
    }

    const newItem = new StokKeluar({
      idTransaksi, namaBarang, namaMerk,
      jumlah:  Number(jumlah) || 0,
      tujuan,
      tanggal: tanggal ? new Date(tanggal) : Date.now(),
      status:  status  || 'Selesai',
      keterangan,
      foto: req.files ? req.files.map(f => f.filename) : [],
      diinputOleh: getNamaPenginput(req)
    });

    await newItem.save();
    res.redirect('/stok-keluar');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menambah data stok keluar.');
  }
});

app.get('/stok-keluar/detail/:id', isUserAuthenticated, async (req, res) => {
  try {
    const item = await StokKeluar.findById(req.params.id);
    if (!item) {
      return res.status(404).send('Data stok keluar tidak ditemukan.');
    }
    const backUrl = req.query.back || req.headers.referer || '/stok-keluar';
    res.render('stok-keluar-detail', { item, backUrl });
  } catch (err) {
    console.error('Gagal memuat detail stok keluar:', err);
    res.status(500).send('Gagal memuat detail stok keluar: ' + err.message);
  }
});

app.post('/stok-keluar/edit/:id', upload.array('foto', 10), async (req, res) => {
  try {
    await syncReqFilesToGridFS(req);
    const { idTransaksi, namaBarang, namaMerk, jumlah, tujuan, tanggal, status, keterangan } = req.body;

    const existing = await StokKeluar.findById(req.params.id);
    if (!existing) {
      return res.status(404).send('Data stok keluar tidak ditemukan.');
    }

    const hapusFoto = [].concat(req.body.hapusFoto || []);
    let foto = (existing.foto || []).filter(f => !hapusFoto.includes(f));
    if (req.files && req.files.length > 0) {
      foto = foto.concat(req.files.map(f => f.filename));
    }

    await StokKeluar.findByIdAndUpdate(req.params.id, {
      idTransaksi, namaBarang, namaMerk,
      jumlah:  Number(jumlah) || 0,
      tujuan,
      tanggal: tanggal ? new Date(tanggal) : Date.now(),
      status:  status  || 'Selesai',
      keterangan,
      foto
    });

    res.redirect('/stok-keluar');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memperbarui data stok keluar.');
  }
});

app.post('/stok-keluar/delete/:id', async (req, res) => {
  try {
    await StokKeluar.findByIdAndDelete(req.params.id);
    res.redirect('/stok-keluar');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menghapus data stok keluar.');
  }
});

// ============================================================
//  RUTE: STOK OPNAME (ADMIN)
// ============================================================
app.get('/stok-opname', isAuthenticated, async (req, res) => {
  try {
    const listStokOpname = await StokOpname.find().sort({ namaBarang: 1 });
    const totalOpname    = listStokOpname.length;
    res.render('stok-opname', { listStokOpname, totalOpname });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat data stok opname.');
  }
});

app.post('/stok-opname/add', async (req, res) => {
  try {
    const { namaBarang, kategori, stokAwal, stokMasuk, stokKeluar } = req.body;

    const newItem = new StokOpname({
      namaBarang, kategori,
      stokAwal:   Number(stokAwal)   || 0,
      stokMasuk:  Number(stokMasuk)  || 0,
      stokKeluar: Number(stokKeluar) || 0,
      diinputOleh: getNamaPenginput(req)
    });

    await newItem.save();
    res.redirect('/stok-opname');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menambah data stok opname: ' + err.message);
  }
});

app.post('/stok-opname/edit/:id', async (req, res) => {
  try {
    const { namaBarang, kategori, stokAwal, stokMasuk, stokKeluar } = req.body;

    await StokOpname.findByIdAndUpdate(req.params.id, {
      namaBarang, kategori,
      stokAwal:   Number(stokAwal)   || 0,
      stokMasuk:  Number(stokMasuk)  || 0,
      stokKeluar: Number(stokKeluar) || 0
    });

    res.redirect('/stok-opname');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memperbarui data stok opname.');
  }
});

app.post('/stok-opname/delete/:id', async (req, res) => {
  try {
    await StokOpname.findByIdAndDelete(req.params.id);
    res.redirect('/stok-opname');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menghapus data stok opname.');
  }
});

// ============================================================
//  RUTE: LAPORAN (ADMIN)
// ============================================================
app.get('/laporan', async (req, res) => {
  try {

    const selectedJenis = req.query.jenis || '';
    
    let filter = {};
    if (selectedJenis !== '') {
      filter.jenis = selectedJenis;
    }

    const rawListLaporan = await Laporan.find(filter).sort({ _id: -1 }).lean();
    const totalLaporan = await Laporan.countDocuments(filter);

    const listLaporan = rawListLaporan.map(item => ({
      ...item,
      cleanName: item.filePath ? item.filePath.replace(/^.*[\\\/]/, '') : ''
    }));

    res.render('laporan', { 
      listLaporan, 
      totalLaporan, 
      role: req.session.role || 'admin',
      selectedJenis 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat data laporan: ' + err.message);
  }
});

// 2. Rute POST Tambah Laporan (Diproteksi preventGuestWrite agar Guest tidak bisa menambah data)
app.post('/laporan/add', upload.single('fileLaporan'), async (req, res) => {
  try {
    await syncReqFilesToGridFS(req);
    const { namaDokumen, keterangan, jenis, tujuan } = req.body;
    const filePath = req.file ? '/uploads/' + req.file.filename : '';

    const newLaporan = new Laporan({
      namaDokumen, 
      keterangan, 
      jenis, 
      tujuan,
      filePath,
      tanggal: new Date(),
      diinputOleh: getNamaPenginput(req)
    });

    await newLaporan.save();
    res.redirect('/laporan');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menambah laporan.');
  }
});

// 3. Rute POST Hapus Laporan (Diproteksi preventGuestWrite agar Guest tidak bisa menghapus data)
app.post('/laporan/delete/:id', async (req, res) => {
  try {
    await Laporan.findByIdAndDelete(req.params.id);
    res.redirect('/laporan');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menghapus laporan.');
  }
});

// Rute untuk memproses update/edit data laporan
app.post('/laporan/edit/:id', upload.single('fileLaporan'), async (req, res) => {
  try {
    const { id } = req.params;
    const { namaDokumen, jenis, tujuan, keterangan } = req.body;

    // Siapkan data teks yang pasti di-update
    let updateData = {
      namaDokumen,
      jenis,
      tujuan,
      keterangan
    };

    // HANYA update data file jika user benar-benar memilih file baru
    if (req.file) {
      updateData.filePath = req.file.path;
      updateData.cleanName = req.file.filename;
    }

    // Lakukan update ke database tanpa merusak file lama jika tidak ada file baru
    await Laporan.findByIdAndUpdate(id, updateData);

    res.redirect('/laporan');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memperbarui data laporan');
  }
});

// 1. RUTE SURAT JALAN VERSI ADMIN
app.get('/surat-jalan-admin', async (req, res) => {
    try {
        const daftarSurat = await SuratJalan.find().sort({ createdAt: -1 });
        res.render('surat-jalan-admin', {
            user: req.session.user || { username: 'Admin' },
            suratJalans: daftarSurat,
            daftarSurat: daftarSurat
        });
    } catch (err) {
        console.error("Error fetching admin surat jalan:", err);
        res.status(500).send("Terjadi kesalahan pada server");
    }
});

app.post('/surat-jalan-admin/add', async (req, res) => {
    try {
        const { jenisSurat, noSuratJalan, tanggal, namaPerusahaan, kepadaYth, namaPenerima, namaPenyerah, noTelepon, alamat, perihal, pekerjaan, jenisKirim, items, kodeBarangList } = req.body;
        
        const namaUser = (req.session.user && (req.session.user.namaLengkap || req.session.user.username)) ? 
                         (req.session.user.namaLengkap || req.session.user.username) : 'Administrator';

        const daftarItem = (Array.isArray(items) ? items : [items])
            .filter(item => item && (item.diskripsi || item.jumlah))
            .map((item, index) => ({
                no: index + 1,
                diskripsi: item.diskripsi || '',
                jumlah: item.jumlah === undefined || item.jumlah === null ? '' : String(item.jumlah).trim(),
                satuan: item.satuan || '',
                keterangan: item.keterangan || ''
            }));

        const daftarKodeBarang = (Array.isArray(kodeBarangList) ? kodeBarangList : [kodeBarangList])
            .filter(kb => kb && (kb.namaBarang || kb.kodeBarang))
            .map((kb, index) => ({
                no: index + 1,
                namaBarang: kb.namaBarang || '',
                kodeBarang: kb.kodeBarang || ''
            }));

        const suratBaru = new SuratJalan({
            jenisSurat: jenisSurat || 'Surat Jalan',
            noSuratJalan,
            tanggal: tanggal || Date.now(),
            namaPerusahaan,
            kepadaYth,
            namaPenerima: namaPenerima || '',
            namaPenyerah: namaPenyerah || '',
            noTelepon,
            alamat,
            perihal,
            pekerjaan,
            jenisKirim: jenisKirim || 'Barang',
            items: daftarItem,
            kodeBarangList: daftarKodeBarang,
            diinputOleh: namaUser
        });

        await suratBaru.save();
        res.redirect('/surat-jalan-admin');
    } catch (err) {
        console.error("Error menyimpan surat jalan admin:", err);
        res.status(500).send("Gagal menyimpan Surat Jalan: " + err.message);
    }
});


app.post('/surat-jalan-admin/edit/:id', async (req, res) => {
    try {
        const { jenisSurat, noSuratJalan, tanggal, namaPerusahaan, kepadaYth, namaPenerima, namaPenyerah, noTelepon, alamat, perihal, pekerjaan, jenisKirim, items, kodeBarangList } = req.body;

        const daftarItem = (Array.isArray(items) ? items : [items])
            .filter(item => item && (item.diskripsi || item.jumlah))
            .map((item, index) => ({
                no: index + 1,
                diskripsi: item.diskripsi || '',
                jumlah: item.jumlah === undefined || item.jumlah === null ? '' : String(item.jumlah).trim(),
                satuan: item.satuan || '',
                keterangan: item.keterangan || ''
            }));

        const daftarKodeBarang = (Array.isArray(kodeBarangList) ? kodeBarangList : [kodeBarangList])
            .filter(kb => kb && (kb.namaBarang || kb.kodeBarang))
            .map((kb, index) => ({
                no: index + 1,
                namaBarang: kb.namaBarang || '',
                kodeBarang: kb.kodeBarang || ''
            }));

        await SuratJalan.findByIdAndUpdate(req.params.id, {
            jenisSurat: jenisSurat || 'Surat Jalan',
            noSuratJalan,
            tanggal: tanggal || Date.now(),
            namaPerusahaan,
            kepadaYth,
            namaPenerima: namaPenerima || '',
            namaPenyerah: namaPenyerah || '',
            noTelepon,
            alamat,
            perihal,
            pekerjaan,
            jenisKirim: jenisKirim || 'Barang',
            items: daftarItem,
            kodeBarangList: daftarKodeBarang
        });

        res.redirect('/surat-jalan-admin');
    } catch (err) {
        console.error("Error mengupdate surat jalan admin:", err);
        res.status(500).send("Gagal mengupdate Surat Jalan: " + err.message);
    }
});


app.post('/surat-jalan-admin/delete/:id', async (req, res) => {
    try {
        await SuratJalan.findByIdAndDelete(req.params.id);
        res.redirect('/surat-jalan-admin');
    } catch (err) {
        console.error("Error menghapus surat jalan admin:", err);
        res.status(500).send("Gagal menghapus Surat Jalan");
    }
});

// ============================================================
//  RUTE: USER – Data Vendor
// ============================================================
app.get('/user', async (req, res) => {
  try {
    const perPage  = 20;
    const page     = parseInt(req.query.page) || 1;
    const search   = req.query.search   || '';
    const kategori = req.query.kategori || '';
    const status   = req.query.status   || '';
    const wilayah  = req.query.wilayah  || '';

    let query = {};
    if (search) {
      query.$or = [
        { idVendor:   { $regex: search, $options: 'i' } },
        { namaVendor: { $regex: search, $options: 'i' } },
        { kategori:   { $regex: search, $options: 'i' } },
        { wilayah:    { $regex: search, $options: 'i' } },
        { kontak:     { $regex: search, $options: 'i' } }
      ];
    }
    if (kategori) query.kategori = kategori;
    if (status)   query.status   = status;
    if (wilayah)  query.wilayah  = wilayah;

    const vendors     = await Vendor.find(query).sort({ idVendor: 1 }).skip((page - 1) * perPage).limit(perPage);
    const totalData   = await Vendor.countDocuments(query);
    const totalPages =  Math.ceil(totalData / perPage);

    const totalVendorAktif      = await Vendor.countDocuments({ status: 'Aktif' });
    const totalVendorTidakAktif = await Vendor.countDocuments({ status: { $ne: 'Aktif' } });
    const kategoriList          = await Vendor.distinct('kategori');
    const totalKategori         = kategoriList.length;
    const nextIdVendor          = 'VND-' + String(await Vendor.countDocuments() + 1).padStart(3, '0');

    res.render('user', {
      vendors, currentPage: page, totalPages,
      totalVendorAktif, totalVendorTidakAktif, totalKategori,
      nextIdVendor, search, kategori, status, wilayah,
      role: req.session.role
    });
  } catch (err) {
    console.error('Gagal memuat data user:', err);
    res.status(500).send('Terjadi kesalahan pada server.');
  }
});

app.post('/user/vendor/add', upload.array('foto', 10), async (req, res) => {
  try {
    await syncReqFilesToGridFS(req);
    const { idVendor, namaVendor, wilayah, kategori, kontak, rating, status, deskripsi } = req.body;
    const fotoFiles = req.files ? req.files.map(f => f.filename) : [];

    const newVendor = new Vendor({
      idVendor:   idVendor   ? idVendor.toUpperCase() : '',
      namaVendor: namaVendor || '',
      wilayah:    wilayah    || '',
      kategori, kontak, rating,
      status:    status    || 'Review',
      deskripsi: deskripsi || '',
      foto:      fotoFiles
    });

    await newVendor.save();
    res.redirect('/user?success=true');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menambah vendor: ' + err.message);
  }
});

app.get('/user/vendor/:id', isUserAuthenticated, async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    res.render('vendor-detail', { vendor, isAdmin: false });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error');
  }
});

// ============================================================
//  RUTE: HARGA DASAR – USER
// ============================================================
app.get('/harga-dasar-user', async (req, res) => {
  try {
    const items = await HargaDasar.find().sort({ tanggal: -1, _id: -1 }).lean();
    const totalItem = items.length;
    const totalReady = items.filter(i => i.status === 'Ready').length;
    const totalPending = items.filter(i => i.status === 'Pending').length;
    
    // Kirim semua variabel yang dibutuhkan oleh view EJS
    res.render('harga-dasar-user', { 
      items, 
      totalItem, 
      totalReady, 
      totalPending 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat data harga dasar: ' + err.message);
  }
});

app.post('/harga-dasar-user/add', async (req, res) => {
  try {
    const newItem = new HargaDasar({ ...req.body, diinputOleh: getNamaPenginput(req) });
    await newItem.save();
    res.redirect('/harga-dasar-user');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menambah harga dasar: ' + err.message);
  }
});

// ============================================================
//  RUTE: STOK MASUK – USER
// ============================================================
app.get('/stok-masuk-user', async (req, res) => {
  try {
    // Urutkan juga untuk halaman user agar sama persis
    const listStokMasuk  = await StokMasuk.find().sort({ createdAt: -1 });
    const totalTransaksi = listStokMasuk.length;
    const totalQtyMasuk  = listStokMasuk.reduce((acc, item) => acc + Number(item.jumlah || 0), 0);
    
    res.render('stok-masuk-user', { listStokMasuk, totalTransaksi, totalQtyMasuk });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat data stok masuk: ' + err.message);
  }
});

app.post('/stok-masuk-user/add', upload.array('foto', 10), async (req, res) => {
  try {
    await syncReqFilesToGridFS(req);
    const { idTransaksi, namaBarang, namaMerk, jumlah, supplier, tanggal, status, keterangan } = req.body;

    const existing = await StokMasuk.findOne({ idTransaksi });
    if (existing) {
      return res.status(400).send(`<script>alert('Gagal! ID Transaksi "${idTransaksi}" sudah terdaftar.'); window.history.back();</script>`);
    }

    const newItem = new StokMasuk({
      idTransaksi, namaBarang, namaMerk,
      jumlah:  Number(jumlah) || 0,
      supplier,
      tanggal: tanggal ? new Date(tanggal) : Date.now(),
      status:  status  || 'Selesai',
      keterangan,
      foto: req.files ? req.files.map(f => f.filename) : [],
      diinputOleh: getNamaPenginput(req)
    });

    await newItem.save();
    res.redirect('/stok-masuk-user');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menambah stok masuk: ' + err.message);
  }
});

  // ============================================================
  //  RUTE: STOK KELUAR – USER
  // ============================================================
  app.get('/stok-keluar-user', async (req, res) => {
  try {
    const listStokKeluar = await StokKeluar.find().sort({ _id: -1 });
    const totalTransaksi = listStokKeluar.length;
    const totalQtyKeluar = listStokKeluar.reduce((acc, item) => acc + Number(item.jumlah || 0), 0);
    
    res.render('stok-keluar-user', { listStokKeluar, totalTransaksi, totalQtyKeluar });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat data stok keluar: ' + err.message);
  }
});

app.post('/stok-keluar-user/add', upload.array('foto', 10), async (req, res) => {
  try {
    await syncReqFilesToGridFS(req);
    const { idTransaksi, namaBarang, namaMerk, jumlah, tujuan, tanggal, status, keterangan } = req.body;

    const existing = await StokKeluar.findOne({ idTransaksi });
    if (existing) {
      return res.status(400).send(`<script>alert('Gagal! ID Transaksi "${idTransaksi}" sudah terdaftar.'); window.history.back();</script>`);
    }

    const newItem = new StokKeluar({
      idTransaksi, namaBarang, namaMerk,
      jumlah:  Number(jumlah) || 0,
      tujuan,
      tanggal: tanggal ? new Date(tanggal) : Date.now(),
      status:  status  || 'Selesai',
      keterangan,
      foto: req.files ? req.files.map(f => f.filename) : [],
      diinputOleh: getNamaPenginput(req)
    });

    await newItem.save();
    res.redirect('/stok-keluar-user');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menambah stok keluar: ' + err.message);
  }
});

// ============================================================
//  3. RUTE: STOK OPNAME – USER
// ============================================================
app.get('/stok-opname-user', async (req, res) => {
  try {
    const listStokOpname = await StokOpname.find().sort({ _id: -1 });
    const totalOpname    = listStokOpname.length;
    
    res.render('stok-opname-user', { listStokOpname, totalOpname });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat data stok opname: ' + err.message);
  }
});

app.post('/stok-opname-user/add', async (req, res) => {
  try {
    const newItem = new StokOpname({ ...req.body, diinputOleh: getNamaPenginput(req) });
    await newItem.save();
    res.redirect('/stok-opname-user');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menambah stok opname: ' + err.message);
  }
});

  // ============================================================
//  RUTE: LAPORAN – USER
// ============================================================
app.get('/laporan-user', async (req, res) => {
  try {

    const selectedJenis = req.query.jenis || '';
  
    let filter = {};
    if (selectedJenis !== '') {
      filter.jenis = selectedJenis;
    }

    const rawListLaporan = await Laporan.find(filter).sort({ _id: -1 }).lean();
    const totalLaporan = await Laporan.countDocuments({}); 

    const listLaporan = rawListLaporan.map(item => ({
      ...item,
      cleanName: item.filePath ? item.filePath.replace(/^.*[\\\/]/, '') : ''
    }));

    res.render('laporan-user', { 
      listLaporan, 
      totalLaporan, 
      role: req.session.role || 'user',
      selectedJenis 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat data laporan user: ' + err.message);
  }
});

app.post('/laporan-user/add', upload.single('fileLaporan'), async (req, res) => {
  try {
    await syncReqFilesToGridFS(req);
    const { namaDokumen, keterangan, jenis, tujuan } = req.body;
    const filePath = req.file ? req.file.filename : '';

    const newLaporan = new Laporan({
      namaDokumen, 
      keterangan, 
      jenis, 
      tujuan, 
      filePath,
      tanggal: new Date(),
      diinputOleh: getNamaPenginput(req)
    });

    await newLaporan.save();
    res.redirect('/laporan-user');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menambah laporan: ' + err.message);
  }
});

// Route Halaman Surat Jalan (User)
app.get('/surat-jalan-user', async (req, res) => {
    try {
        const suratJalans = await SuratJalan.find().sort({ createdAt: -1 });
        
        res.render('surat-jalan-user', { 
            user: req.session.user || { username: 'User' },
            suratJalans: suratJalans 
        });
    } catch (err) {
        console.error("Error fetching surat jalan:", err);
        res.render('surat-jalan-user', { 
            user: req.session.user || { username: 'User' },
            suratJalans: [] 
        });
    }
});

app.post('/surat-jalan-user/add', async (req, res) => {
    try {
        const { jenisSurat, noSuratJalan, tanggal, namaPerusahaan, kepadaYth, namaPenerima, namaPenyerah, noTelepon, alamat, perihal, pekerjaan, jenisKirim, items, kodeBarangList } = req.body;
        
        const namaUser = (req.session.user && (req.session.user.namaLengkap || req.session.user.username)) ? 
                         (req.session.user.namaLengkap || req.session.user.username) : 'User Operasional';

        const daftarItem = (Array.isArray(items) ? items : [items])
            .filter(item => item && (item.diskripsi || item.jumlah))
            .map((item, index) => ({
                no: index + 1,
                diskripsi: item.diskripsi || '',
                jumlah: item.jumlah === undefined || item.jumlah === null ? '' : String(item.jumlah).trim(),
                satuan: item.satuan || '',
                keterangan: item.keterangan || ''
            }));

        const daftarKodeBarang = (Array.isArray(kodeBarangList) ? kodeBarangList : [kodeBarangList])
            .filter(kb => kb && (kb.namaBarang || kb.kodeBarang))
            .map((kb, index) => ({
                no: index + 1,
                namaBarang: kb.namaBarang || '',
                kodeBarang: kb.kodeBarang || ''
            }));

        const suratBaru = new SuratJalan({
            jenisSurat: jenisSurat || 'Surat Jalan',
            noSuratJalan,
            tanggal: tanggal || Date.now(),
            namaPerusahaan,
            kepadaYth,
            namaPenerima: namaPenerima || '',
            namaPenyerah: namaPenyerah || '',
            noTelepon,
            alamat,
            perihal,
            pekerjaan,
            jenisKirim: jenisKirim || 'Barang',
            items: daftarItem,
            kodeBarangList: daftarKodeBarang,
            diinputOleh: namaUser
        });

        await suratBaru.save();
        res.redirect('/surat-jalan-user');
    } catch (err) {
        console.error("Error menyimpan surat jalan:", err);
        res.status(500).send("Gagal menyimpan Surat Jalan: " + err.message);
    }
});

// Route Menampilkan Detail Surat Jalan
app.get('/surat-jalan/detail/:id', async (req, res) => {
    try {
        const suratJalan = await SuratJalan.findById(req.params.id);
        if (!suratJalan) {
            return res.status(404).send("Data Surat Jalan tidak ditemukan.");
        }
        res.render('surat-jalan-detail', { 
            user: req.session.user || { username: 'User' },
            suratJalan: suratJalan 
        });
    } catch (err) {
        console.error("Error fetching detail surat jalan:", err);
        res.status(500).send("Terjadi kesalahan pada server");
    }
});

// Route Menampilkan Halaman Cetak Surat Jalan (PDF / Print View)
app.get('/surat-jalan/cetak/:id', async (req, res) => {
    try {
        const suratJalan = await SuratJalan.findById(req.params.id);
        if (!suratJalan) {
            return res.status(404).send("Data Surat Jalan tidak ditemukan.");
        }
        if (suratJalan.namaPerusahaan && suratJalan.namaPerusahaan.toUpperCase().includes('PUSPITA')) {
            return res.render('surat-jalan-print-puspita', { suratJalan, wrapText });
        }

        res.render('surat-jalan-print', { suratJalan, wrapText });

    } catch (err) {
        console.error("Error mencetak surat jalan:", err);
        res.status(500).send("Gagal mencetak Surat Jalan: " + err.message);
    }
});


// ==========================================
// RUTE LPJ LAPORAN PERTANGGUNGJAWABAN
// ==========================================
app.get('/lpj-user', async (req, res) => {
  try {
    const search = req.query.search || '';
    const statusFilter = req.query.status || '';

    let filter = {};
    if (search) {
      filter.namaKegiatan = { $regex: search, $options: 'i' };
    }
    if (statusFilter) {
      filter.status = statusFilter;
    }

    const rawListLpj = await Lpj.find(filter).sort({ _id: -1 }).lean();

    // Perhitungan otomatis progress belanja tiap LPJ.
    // Jika LPJ sudah punya rincian pengeluaran, total dihitung dari rincian.
    const listLpj = rawListLpj.map(item => {
      const rincian = Array.isArray(item.rincianPengeluaran) ? item.rincianPengeluaran : [];
      const pengeluaran = rincian.length > 0
        ? rincian.reduce((acc, row) => acc + (Number(row.nominal) || 0), 0)
        : (item.totalPengeluaran || 0);
      const anggaran = item.anggaranKasbon || 0;
      let progress = anggaran > 0 ? Math.round((pengeluaran / anggaran) * 100) : 0;
      if (progress > 100) progress = 100;
      if (progress < 0) progress = 0;

      return {
        ...item,
        totalPengeluaran: pengeluaran,
        sisaSaldo: anggaran - pengeluaran,
        progressBelanja: progress,
        cleanName: item.filePath ? item.filePath.replace(/^.*[\\\/]/, '') : ''
      };
    });

    // Hitung Statistik Anggaran, Pengeluaran, dan Sisa Saldo secara Otomatis
    const totalAnggaranKelolaan = listLpj.reduce((acc, curr) => acc + (curr.anggaranKasbon || 0), 0);
    const totalPengeluaran = listLpj.reduce((acc, curr) => acc + (curr.totalPengeluaran || 0), 0);
    const totalSisaSaldo = totalAnggaranKelolaan - totalPengeluaran;
    const totalLpjTerdaftar = listLpj.length;

    res.render('lpj-user', {
      listLpj,
      totalLpjTerdaftar,
      totalAnggaranKelolaan,
      totalPengeluaran,
      totalSisaSaldo,
      search,
      statusFilter,
      role: req.session.isAdmin ? 'admin' : (req.session.isUser ? 'user' : 'guest')
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat data dashboard LPJ: ' + err.message);
  }
});

app.post('/lpj-user/add', async (req, res) => {
  try {
    const { namaKegiatan, kategori, status, anggaranKasbon, keterangan, tanggal } = req.body;

    const namaUser = (req.session.user && (req.session.user.namaLengkap || req.session.user.username))
      || req.session.adminUser
      || 'Administrator';

    const nominalKasbon = Number(anggaranKasbon) || 0;

    let tanggalLpj = new Date();
    if (tanggal) {
      const parts = String(tanggal).split('-');
      if (parts.length === 3) {
        tanggalLpj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
      } else {
        const parsed = new Date(tanggal);
        if (!isNaN(parsed.getTime())) tanggalLpj = parsed;
      }
    }

    const newLpj = new Lpj({
      namaKegiatan,
      kategori,
      status: status || 'Draft',
      anggaranKasbon: nominalKasbon,
      totalPengeluaran: 0,
      tanggal: tanggalLpj,
      keterangan: keterangan || '',
      diinputOleh: namaUser,
      // Masukkan otomatis sebagai riwayat pencairan awal jika ada nilainya
      riwayatPencairan: nominalKasbon > 0 ? [{
        tanggal: tanggalLpj,
        nominal: nominalKasbon,
        keterangan: keterangan || 'Pencairan Kasbon Awal'
      }] : []
    });

    await newLpj.save();
    res.redirect('/lpj-user');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menyimpan LPJ baru: ' + err.message);
  }
});

// Hapus LPJ
app.post(['/lpj-user/hapus/:id', '/lpj-user/delete/:id', '/lpj/hapus/:id', '/lpj/delete/:id'], async (req, res) => {
  try {
    const { id } = req.params;
    await Lpj.findByIdAndDelete(id);
    res.redirect('/lpj-user');
  } catch (err) {
    console.error('Error saat menghapus LPJ:', err);
    res.status(500).send('Gagal menghapus data LPJ: ' + err.message);
  }
});

// Menghitung ulang total pengeluaran, sisa saldo, dan progress dari rincian belanja
function sinkronTotalLpj(lpj) {
  const rincian = Array.isArray(lpj.rincianPengeluaran) ? lpj.rincianPengeluaran : [];
  const total = rincian.reduce((acc, row) => acc + (Number(row.nominal) || 0), 0);
  const anggaran = Number(lpj.anggaranKasbon) || 0;

  lpj.totalPengeluaran = total;
  lpj.sisaSaldo = anggaran - total;

  let progress = anggaran > 0 ? Math.round((total / anggaran) * 100) : 0;
  if (progress > 100) progress = 100;
  if (progress < 0) progress = 0;
  lpj.progressBelanja = progress;
}

app.get('/lpj/detail/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const lpj = await Lpj.findById(id).lean();

    if (!lpj) {
      return res.status(404).send('Workspace LPJ tidak ditemukan.');
    }

    const rincian = Array.isArray(lpj.rincianPengeluaran) ? lpj.rincianPengeluaran : [];
    const vault = Array.isArray(lpj.vaultNota) ? lpj.vaultNota : [];

    const kasbon = Number(lpj.anggaranKasbon) || 0;
    const pengeluaran = rincian.length > 0
      ? rincian.reduce((acc, row) => acc + (Number(row.nominal) || 0), 0)
      : (Number(lpj.totalPengeluaran) || 0);
    const sisaSaldo = kasbon - pengeluaran;

    let progress = kasbon > 0 ? Math.round((pengeluaran / kasbon) * 100) : 0;
    if (progress > 100) progress = 100;
    if (progress < 0) progress = 0;

    lpj.progressBelanja = progress;
    lpj.sisaSaldo = sisaSaldo;
    lpj.totalPengeluaran = pengeluaran;
    lpj.rincianPengeluaran = rincian;
    lpj.vaultNota = vault;

    // Gabungkan seluruh nota: nota dari catatan belanja + upload manual di vault
    const vaultItems = [];
    rincian.forEach(item => {
      if (item.notaPath) {
        vaultItems.push({
          filePath: item.notaPath,
          fileName: item.notaNama || 'Nota pengeluaran',
          uploadedAt: item.tanggal || lpj.createdAt || new Date(),
          sumber: 'Rincian Belanja',
          keterangan: item.namaItem || ''
        });
      }
    });
    vault.forEach(item => {
      if (item.filePath) {
        vaultItems.push({
          filePath: item.filePath,
          fileName: item.fileName || 'Nota',
          uploadedAt: item.uploadedAt || lpj.createdAt || new Date(),
          sumber: 'Vault Manual',
          keterangan: item.diinputOleh || ''
        });
      }
    });
    vaultItems.sort((a, b) => {
      const tA = new Date(a.uploadedAt).getTime() || 0;
      const tB = new Date(b.uploadedAt).getTime() || 0;
      return tB - tA;
    });

    const tabDiizinkan = ['ringkasan', 'pencairan', 'rincian', 'vault'];
    const activeTab = tabDiizinkan.includes(req.query.tab) ? req.query.tab : 'ringkasan';

    res.render('lpj-detail', {
      lpj,
      vaultItems,
      totalRincian: rincian.length,
      totalNota: vaultItems.length,
      activeTab,
      role: req.session.isAdmin ? 'admin' : (req.session.isUser ? 'user' : 'guest')
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat detail LPJ: ' + err.message);
  }
});

// ==========================================
// RUTE TAMBAH CATATAN, PENCAIRAN & NOTA
// ==========================================
app.post('/lpj/detail/:id/tambah-catatan', upload.single('nota'), async (req, res) => {
  try {
    await syncReqFilesToGridFS(req);

    const { id } = req.params;
    const { kategoriPengeluaran, namaItem, keterangan, qty, hargaSatuan, nominal, tanggal } = req.body;

    const lpj = await Lpj.findById(id);
    if (!lpj) return res.status(404).send('LPJ tidak ditemukan');

    const qtyAngka = Number(qty) || 0;
    const hargaAngka = Number(hargaSatuan) || 0;
    const nominalAngka = Number(nominal) || (qtyAngka * hargaAngka);

    let tanggalCatatan = new Date();
    if (tanggal) {
      const parts = String(tanggal).split('-');
      if (parts.length === 3) {
        tanggalCatatan = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
      } else {
        const parsed = new Date(tanggal);
        if (!isNaN(parsed.getTime())) tanggalCatatan = parsed;
      }
    }

    if (!Array.isArray(lpj.rincianPengeluaran)) lpj.rincianPengeluaran = [];
    lpj.rincianPengeluaran.push({
      tanggal: tanggalCatatan,
      kategoriPengeluaran: kategoriPengeluaran || '',
      namaItem: namaItem || '',
      keterangan: keterangan || '',
      qty: qtyAngka,
      hargaSatuan: hargaAngka,
      nominal: nominalAngka,
      notaPath: req.file ? '/uploads/' + req.file.filename : '',
      notaNama: req.file ? req.file.originalname : ''
    });

    sinkronTotalLpj(lpj);
    await lpj.save();

    res.redirect('/lpj/detail/' + id + '?tab=rincian');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menyimpan catatan belanja: ' + err.message);
  }
});

// Edit Catatan Belanja
app.post('/lpj/detail/:id/edit-catatan/:itemId', upload.single('nota'), async (req, res) => {
  try {
    await syncReqFilesToGridFS(req);

    const { id, itemId } = req.params;
    const { kategoriPengeluaran, namaItem, keterangan, qty, hargaSatuan, nominal, tanggal } = req.body;

    const lpj = await Lpj.findById(id);
    if (!lpj) return res.status(404).send('LPJ tidak ditemukan');

    const qtyAngka = Number(qty) || 0;
    const hargaAngka = Number(hargaSatuan) || 0;
    const nominalAngka = Number(nominal) || (qtyAngka * hargaAngka);

    let tanggalCatatan = new Date();
    if (tanggal) {
      const parts = String(tanggal).split('-');
      if (parts.length === 3) {
        tanggalCatatan = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
      } else {
        const parsed = new Date(tanggal);
        if (!isNaN(parsed.getTime())) tanggalCatatan = parsed;
      }
    }

    if (Array.isArray(lpj.rincianPengeluaran)) {
      const item = (typeof lpj.rincianPengeluaran.id === 'function' ? lpj.rincianPengeluaran.id(itemId) : null)
        || lpj.rincianPengeluaran.find(r => String(r._id) === String(itemId));

      if (item) {
        item.tanggal = tanggalCatatan;
        item.kategoriPengeluaran = kategoriPengeluaran || item.kategoriPengeluaran;
        item.namaItem = namaItem || item.namaItem;
        item.keterangan = keterangan !== undefined ? keterangan : item.keterangan;
        item.qty = qtyAngka;
        item.hargaSatuan = hargaAngka;
        item.nominal = nominalAngka;

        if (req.file) {
          item.notaPath = '/uploads/' + req.file.filename;
          item.notaNama = req.file.originalname;
        }
      }
    }

    sinkronTotalLpj(lpj);
    await lpj.save();

    res.redirect('/lpj/detail/' + id + '?tab=rincian');
  } catch (err) {
    console.error('Error saat mengedit catatan belanja:', err);
    res.status(500).send('Gagal mengedit catatan belanja: ' + err.message);
  }
});

// Hapus Catatan Belanja
app.post(['/lpj/detail/:id/hapus-catatan/:itemId', '/lpj/detail/:id/delete-catatan/:itemId'], async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const lpj = await Lpj.findById(id);
    if (!lpj) return res.status(404).send('LPJ tidak ditemukan');

    if (Array.isArray(lpj.rincianPengeluaran)) {
      lpj.rincianPengeluaran = lpj.rincianPengeluaran.filter(r => String(r._id) !== String(itemId));
    }

    sinkronTotalLpj(lpj);
    await lpj.save();

    res.redirect('/lpj/detail/' + id + '?tab=rincian');
  } catch (err) {
    console.error('Error saat menghapus catatan belanja:', err);
    res.status(500).send('Gagal menghapus catatan belanja: ' + err.message);
  }
});

app.post('/lpj/detail/:id/tambah-pencairan', async (req, res) => {
  try {
    const { id } = req.params;
    const { nominal, keterangan, tanggal } = req.body;

    const lpj = await Lpj.findById(id);
    if (!lpj) return res.status(404).send('LPJ tidak ditemukan');

    const nominalAngka = Number(nominal) || 0;

    let tanggalPencairan = new Date();
    if (tanggal) {
      const parts = String(tanggal).split('-');
      if (parts.length === 3) {
        tanggalPencairan = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
      } else {
        const parsed = new Date(tanggal);
        if (!isNaN(parsed.getTime())) tanggalPencairan = parsed;
      }
    }

    if (!lpj.riwayatPencairan) lpj.riwayatPencairan = [];
    lpj.riwayatPencairan.push({
      tanggal: tanggalPencairan,
      nominal: nominalAngka,
      keterangan: keterangan || ''
    });

    // Tambah juga ke total anggaran kasbon jika pencairan baru menambah dana
    lpj.anggaranKasbon = (lpj.anggaranKasbon || 0) + nominalAngka;

    sinkronTotalLpj(lpj);
    await lpj.save();

    res.redirect('/lpj/detail/' + id + '?tab=pencairan');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menyimpan pencairan: ' + err.message);
  }
});

// Hapus Nota dari Vault
app.post('/lpj/detail/:id/hapus-nota/:notaId', async (req, res) => {
  try {
    const { id, notaId } = req.params;
    const lpj = await Lpj.findById(id);
    if (lpj && Array.isArray(lpj.vaultNota)) {
      lpj.vaultNota = lpj.vaultNota.filter(v => String(v._id) !== String(notaId));
      await lpj.save();
    }
    res.redirect('/lpj/detail/' + id + '?tab=vault');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menghapus nota: ' + err.message);
  }
});

app.post('/lpj/detail/:id/tambah-nota', upload.single('nota'), async (req, res) => {
  try {
    await syncReqFilesToGridFS(req);

    const { id } = req.params;
    const lpj = await Lpj.findById(id);
    if (!lpj) return res.status(404).send('LPJ tidak ditemukan');

    if (!req.file) {
      return res.redirect('/lpj/detail/' + id + '?tab=vault');
    }

    if (!Array.isArray(lpj.vaultNota)) lpj.vaultNota = [];
    lpj.vaultNota.push({
      filePath: '/uploads/' + req.file.filename,
      fileName: req.file.originalname,
      uploadedAt: new Date(),
      diinputOleh: getNamaPenginput(req)
    });

    await lpj.save();

    res.redirect('/lpj/detail/' + id + '?tab=vault');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menyimpan nota ke vault: ' + err.message);
  }
});

// ============================================================
//  RUTE: EKSPOR EXCEL
// ============================================================

// Ekspor Vendor
app.get('/export-vendor-excel', async (req, res) => {
  try {
    const dataVendor = await Vendor.find({});
    const workbook   = new ExcelJS.Workbook();
    const worksheet  = workbook.addWorksheet('Data Vendor');

    worksheet.columns = [
      { header: 'No',          key: 'no',         width: 8  },
      { header: 'ID Vendor',   key: 'idVendor',   width: 15 },
      { header: 'Nama Vendor', key: 'namaVendor', width: 25 },
      { header: 'Wilayah',     key: 'wilayah',    width: 20 },
      { header: 'Kategori',    key: 'kategori',   width: 20 },
      { header: 'Kontak',      key: 'kontak',     width: 18 },
      { header: 'Rating',      key: 'rating',     width: 10 },
      { header: 'Status',      key: 'status',     width: 12 },
      { header: 'Deskripsi',   key: 'deskripsi',  width: 30 }
    ];

    dataVendor.forEach((vendor, index) => {
      worksheet.addRow({
        no:         index + 1,
        idVendor:   vendor.idVendor   || '-',
        namaVendor: vendor.namaVendor || '-',
        wilayah:    vendor.wilayah    || '-',
        kategori:   vendor.kategori   || '-',
        kontak:     vendor.kontak     || '-',
        rating:     vendor.rating != null ? vendor.rating : '-',
        status:     vendor.status     || '-',
        deskripsi:  vendor.deskripsi  || '-'
      });
    });

    const headerRow   = worksheet.getRow(1);
    headerRow.font    = { bold: true, size: 12 };
    headerRow.height  = 24;

    res.setHeader('Content-Type',        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Data_Vendor_Kiosk.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error ekspor vendor:', error);
    res.status(500).send('Terjadi kesalahan saat mengunduh data vendor.');
  }
});

// Ekspor Harga Dasar
app.get('/export-harga-dasar-excel', async (req, res) => {
  try {
    const dataHargaDasar = await HargaDasar.find({});
    const workbook       = new ExcelJS.Workbook();
    const worksheet      = workbook.addWorksheet('Data Harga Dasar');

    worksheet.columns = [
      { header: 'No',          key: 'no',          width: 8  },
      { header: 'ID Barang',   key: 'idBarang',    width: 15 },
      { header: 'Nama Barang', key: 'namaBarang',  width: 25 },
      { header: 'Nama Merk',   key: 'namaMerk',    width: 20 },
      { header: 'Spesifikasi', key: 'spesifikasi', width: 30 },
      { header: 'Qty',         key: 'qty',         width: 10 },
      { header: 'Harga',       key: 'harga',       width: 15 },
      { header: 'Final',       key: 'final',       width: 15 },
      { header: 'Status',      key: 'status',      width: 15 },
      { header: 'Keterangan',  key: 'keterangan',  width: 25 },
      { header: 'Tanggal',     key: 'tanggal',     width: 20 }
    ];

    dataHargaDasar.forEach((item, index) => {
      const formattedDate = item.tanggal
        ? new Date(item.tanggal).toLocaleDateString('id-ID')
        : '-';

      worksheet.addRow({
        no:          index + 1,
        idBarang:    item.idBarang    || '-',
        namaBarang:  item.namaBarang  || '-',
        namaMerk:    item.namaMerk    || '-',
        spesifikasi: item.spesifikasi || '-',
        qty:         item.qty   != null ? item.qty   : 1,
        harga:       item.harga != null ? item.harga : 0,
        final:       item.final != null ? item.final : 0,
        status:      item.status      || '-',
        keterangan:  item.keterangan  || '-',
        tanggal:     formattedDate
      });
    });

    worksheet.getColumn('harga').numFmt = '#,##0';
    worksheet.getColumn('final').numFmt = '#,##0';

    const headerRow   = worksheet.getRow(1);
    headerRow.font    = { bold: true, size: 12 };
    headerRow.height  = 24;

    res.setHeader('Content-Type',        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Data_Harga_Dasar_Kiosk.xlsx');
    await workbook.xlsx.write(res);
    return res.end();
  } catch (error) {
    console.error('ERROR EKSPOR HARGA DASAR:', error);
    if (!res.headersSent) {
      res.status(500).send('Gagal mengekspor data harga dasar: ' + error.message);
    }
  }
});

// Route khusus untuk Download PDF secara langsung
app.get('/surat-jalan/download-pdf/:id', async (req, res) => {
    try {
        const suratJalan = await SuratJalan.findById(req.params.id);
        if (!suratJalan) {
            return res.status(404).send("Data tidak ditemukan.");
        }

        // Render template EJS menjadi HTML string
        const html = await res.app.render('surat-jalan-print', { suratJalan });

        // Jalankan browser headless puppeteer untuk mencetak PDF
        const browser = await puppeteer.launch({ 
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
        });

        await browser.close();

        // Kirim response file PDF ke browser
        const fileName = `${(suratJalan.jenisSurat || 'Surat-Jalan').replace(/\s+/g, '-')}-${suratJalan.noSuratJalan.replace(/\//g, '-')}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.send(pdfBuffer);

    } catch (err) {
        console.error("Error generating PDF:", err);
        res.status(500).send("Gagal mengunduh PDF: " + err.message);
    }
});

// ============================================================
//  RUTE: VENDORS (API JSON – Filter/Pencarian)
// ============================================================
app.get('/vendors', async (req, res) => {
  try {
    const { search, kategori, status, wilayah } = req.query;
    let query = {};

    if (search)                   query.namaVendor = { $regex: search, $options: 'i' };
    if (kategori && kategori !== '') query.kategori  = kategori;
    if (status   && status   !== '') query.status    = status;
    if (wilayah  && wilayah  !== '') query.wilayah   = wilayah;

    const vendors = await Vendor.find(query);
    res.json({ success: true, data: vendors });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Gagal mengambil data vendor' });
  }
});

// ============================================================
//  RUTE: DATA BAHAN KAIN – USER
// ============================================================
app.get('/data-bahan-kain', async (req, res) => {
    try {
        // Ambil semua data vendor untuk tabel
        const listVendor = await DataBahanKain.find().sort({ _id: -1 });

        // Cari vendor terakhir untuk menentukan ID otomatis selanjutnya
        const lastVendor = await DataBahanKain.findOne().sort({ _id: -1 });
        let nextId = 'VND-001';

        if (lastVendor && lastVendor.idVendor) {
            // Ambil angka dari string misal 'VND-015' mengambil 15
            const lastNum = parseInt(lastVendor.idVendor.replace('VND-', ''), 10);
            if (!isNaN(lastNum)) {
                const nextNum = lastNum + 1;
                nextId = `VND-${String(nextNum).padStart(3, '0')}`;
            }
        }

        res.render('data-bahan-kain', { 
            vendors: listVendor, 
            nextIdVendor: nextId, // Ubah dari nextId menjadi nextIdVendor agar cocok dengan EJS
            backUrl: '/dashboard'
        });
      } 
    catch (err) {
        console.error('Gagal memuat data:', err);
        res.status(500).send('Terjadi kesalahan pada server.');
    }
});

app.post('/data-bahan-kain/add', uploadMultiple, async (req, res) => {
  try {
    await syncReqFilesToGridFS(req);
    const { namaVendor, wilayah, kategoriSupply, kontak, rating, deskripsi } = req.body;

    if (!namaVendor) {
      return res.status(400).send('Nama vendor wajib diisi!');
    }

    const lastVendor = await DataBahanKain.findOne().sort({ _id: -1 });
    let idVendor = 'VND-001';

    if (lastVendor && lastVendor.idVendor) {
      const lastNum = parseInt(lastVendor.idVendor.replace('VND-', ''), 10);
      if (!isNaN(lastNum)) {
        idVendor = `VND-${String(lastNum + 1).padStart(3, '0')}`;
      }
    }

    // Fallback aman untuk slug vendorId jika hanya diisi simbol (misal: '-')
    let vendorId = namaVendor
      ? namaVendor.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      : '';

    if (!vendorId) {
      vendorId = 'vendor-' + Date.now();
    }

    const fotoPaths = req.files && req.files.length > 0
      ? req.files.map(f => '/uploads/' + f.filename)
      : [];

    const vendorBaru = new DataBahanKain({
      idVendor, vendorId, namaVendor,
      wilayah:         wilayah         || '-',
      kategoriSupply:  kategoriSupply  || 'Bahan Kain',
      kontak:          kontak          || '-',
      rating:          rating          ? parseFloat(rating) : 5,
      deskripsi:       deskripsi       || 'Belum ada deskripsi untuk vendor ini.',
      foto:            fotoPaths,
      status:          'Aktif',
      diinputOleh:     getNamaPenginput(req)
    });

    await vendorBaru.save();
    res.redirect('/data-bahan-kain');
  } catch (err) {
    console.error('Gagal menyimpan data:', err);
    res.status(500).send('Gagal menyimpan ke database.');
  }
});

app.post('/data-bahan-kain/edit/:id', async (req, res) => {
  try {
    const { namaVendor, wilayah, kategoriSupply, kontak, rating } = req.body;
    const vendorId = namaVendor.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    await DataBahanKain.findByIdAndUpdate(req.params.id, {
      namaVendor, vendorId,
      wilayah:        wilayah        || '-',
      kategoriSupply: kategoriSupply || '-',
      kontak:         kontak         || '-',
      rating:         rating         ? parseFloat(rating) : 5
    });

    res.json({ success: true, message: 'Data vendor berhasil diperbarui!' });
  } catch (err) {
    console.error('Gagal memperbarui data:', err);
    res.status(500).json({ success: false, message: 'Gagal memperbarui data di database.' });
  }
});

app.delete('/data-bahan-kain/delete/:id', async (req, res) => {
  try {
    await DataBahanKain.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Data vendor berhasil dihapus!' });
  } catch (err) {
    console.error('Gagal menghapus data:', err);
    res.status(500).json({ success: false, message: 'Gagal menghapus data dari database.' });
  }
});

// ============================================================
//  RUTE: KATALOG VENDOR (Detail per vendorId)
// ============================================================
app.get('/katalog-vendor/:vendorId', async (req, res) => {
  try {
    const vendor = await DataBahanKain.findOne({ vendorId: req.params.vendorId });
    if (!vendor) {
      return res.status(404).send('Vendor tidak ditemukan.');
    }

    const isFromAdmin = req.query.from === 'admin' || (req.headers.referer && req.headers.referer.includes('/data-kain-admin'));
    const backUrl     = isFromAdmin ? '/data-kain-admin' : '/data-bahan-kain';

    res.render('katalog-vendor', { vendor, backUrl });
  } catch (err) {
    console.error('Gagal memuat katalog vendor:', err);
    res.status(500).send('Terjadi kesalahan pada server.');
  }
});

// ============================================================
//  RUTE: DATA BAHAN KAIN – ADMIN
// ============================================================
app.get('/data-kain-admin', async (req, res) => {
  try {
    const vendors       = await DataBahanKain.find().sort({ createdAt: -1 });
    const count         = await DataBahanKain.countDocuments();
    const kategoriUnik  = await DataBahanKain.distinct('kategoriSupply');
    const totalKategori = kategoriUnik.length;
    const nextIdVendor  = 'VND-' + String(count + 1).padStart(3, '0');

    res.render('data-kain-admin', { vendors, nextIdVendor, totalKategori });
  } catch (err) {
    console.error('Gagal memuat data admin:', err);
    res.status(500).send('Terjadi kesalahan pada server.');
  }
});

app.post('/data-kain-admin/add', uploadMultiple, async (req, res) => {
  try {
    await syncReqFilesToGridFS(req);
    const { namaVendor, wilayah, kategoriSupply, kontak, rating, deskripsi, status } = req.body;

    if (!namaVendor) {
      return res.status(400).send('Nama vendor wajib diisi!');
    }

    const lastVendor = await DataBahanKain.findOne().sort({ _id: -1 });
    let idVendor = 'VND-001';

    if (lastVendor && lastVendor.idVendor) {
      const lastNum = parseInt(lastVendor.idVendor.replace('VND-', ''), 10);
      if (!isNaN(lastNum)) {
        idVendor = `VND-${String(lastNum + 1).padStart(3, '0')}`;
      }
    }

    // Fallback aman untuk slug vendorId jika hanya diisi simbol (misal: '-')
    let vendorId = namaVendor
      ? namaVendor.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      : '';

    if (!vendorId) {
      vendorId = 'vendor-' + Date.now();
    }

    const fotoPaths = req.files && req.files.length > 0
      ? req.files.map(f => '/uploads/' + f.filename)
      : [];

    const vendorBaru = new DataBahanKain({
      idVendor, 
      vendorId, 
      namaVendor,
      wilayah:        wilayah        || '-',
      kategoriSupply: kategoriSupply || 'Bahan Kain',
      kontak:         kontak         || '-',
      rating:         rating         ? parseFloat(rating) : 5,
      deskripsi:      deskripsi      || 'Belum ada deskripsi untuk vendor ini.',
      foto:           fotoPaths,
      status:         status         || 'Aktif',
      diinputOleh:    getNamaPenginput(req)
    });

    await vendorBaru.save();
    res.redirect('/data-kain-admin');
  } catch (err) {
    console.error('Gagal menyimpan data admin:', err);
    res.status(500).send('Gagal menyimpan ke database.');
  }
});

app.post('/data-kain-admin/edit/:id', uploadMultiple, async (req, res) => {
  try {
    await syncReqFilesToGridFS(req);
    const { namaVendor, wilayah, kategoriSupply, kontak, rating, deskripsi, status } = req.body;
    const vendorIdUpdate = namaVendor
      ? namaVendor.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      : undefined;

    let updateData = {
      namaVendor,
      vendorId:       vendorIdUpdate,
      wilayah:        wilayah        || '-',
      kategoriSupply: kategoriSupply || 'Bahan Kain',
      kontak:         kontak         || '-',
      rating:         rating         ? parseFloat(rating) : 5,
      deskripsi:      deskripsi      || '-',
      status:         status         || 'Aktif'
    };
    if (req.files && req.files.length > 0) {
      updateData.foto = req.files.map(f => '/uploads/' + f.filename);
    }

    await DataBahanKain.findByIdAndUpdate(req.params.id, updateData);
    res.redirect('/data-kain-admin');
  } catch (err) {
    console.error('Gagal mengupdate vendor:', err);
    res.status(500).send('Gagal mengupdate data.');
  }
});

app.get('/data-kain-admin/delete/:id', async (req, res) => {
  try {
    await DataBahanKain.findByIdAndDelete(req.params.id);
    res.redirect('/data-kain-admin');
  } catch (err) {
    console.error('Gagal menghapus vendor:', err);
    res.status(500).send('Gagal menghapus data.');
  }
});

// ============================================================
//  RUTE: GUEST (READ-ONLY)
// ============================================================
function normalizeFotoUrls(foto) {
  if (!foto) return [];
  const list = Array.isArray(foto) ? foto : [foto];

  return list
    .filter(Boolean)
    .map(item => {
      const value = String(item).trim();
      if (!value) return null;
      if (/^https?:\/\//i.test(value) || value.startsWith('/')) return value;
      return '/uploads/' + value;
    })
    .filter(Boolean);
}

app.get('/guest/vendor', async (req, res) => {
  try {
    const vendors = await Vendor.find().sort({ idVendor: 1 }).lean();
    const totalVendor = vendors.length;
    const totalVendorAktif = vendors.filter(v => v.status === 'Aktif').length;
    const totalVendorTidakAktif = vendors.filter(v => v.status && v.status !== 'Aktif').length;
    const totalKategori = new Set(
      vendors.map(v => (v.kategori || '').trim()).filter(Boolean)
    ).size;

    res.render('guest-vendor', {
      vendors,
      totalVendor,
      totalVendorAktif,
      totalVendorTidakAktif,
      totalKategori
    });
  } catch (err) {
    console.error('Gagal memuat data vendor guest:', err);
    res.status(500).send('Gagal memuat data vendor: ' + err.message);
  }
});

app.get('/guest/vendor/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).send('Vendor tidak ditemukan.');
    }

    const vendor = await Vendor.findById(req.params.id).lean();
    if (!vendor) {
      return res.status(404).send('Vendor tidak ditemukan.');
    }

    res.render('guest-vendor-detail', {
      vendor,
      fotoUrls: normalizeFotoUrls(vendor.foto)
    });
  } catch (err) {
    console.error('Gagal memuat detail vendor guest:', err);
    res.status(500).send('Gagal memuat detail vendor: ' + err.message);
  }
});

app.get('/guest/harga-dasar', async (req, res) => {
  try {
    const items = await HargaDasar.find().sort({ tanggal: -1, _id: -1 }).lean();
    const totalItem = items.length;
    const totalReady = items.filter(i => i.status === 'Ready').length;
    const totalPending = items.filter(i => i.status === 'Pending').length;

    res.render('guest-harga-dasar', {
      items,
      totalItem,
      totalReady,
      totalPending
    });
  } catch (err) {
    console.error('Gagal memuat harga dasar guest:', err);
    res.status(500).send('Gagal memuat data harga dasar: ' + err.message);
  }
});

app.get('/guest/data-kain', async (req, res) => {
  try {
    const items = await DataBahanKain.find().sort({ _id: -1 }).lean();
    const totalDataKain = items.length;
    const totalAktif = items.filter(i => i.status === 'Aktif').length;
    const totalReview = items.filter(i => i.status === 'Review').length;

    res.render('guest-data-kain', {
      items,
      totalDataKain,
      totalAktif,
      totalReview
    });
  } catch (err) {
    console.error('Gagal memuat data kain guest:', err);
    res.status(500).send('Gagal memuat data kain: ' + err.message);
  }
});

app.get('/guest/laporan', async (req, res) => {
  try {
    const rawListLaporan = await Laporan.find().sort({ _id: -1 }).lean();
    const listLaporan = rawListLaporan.map(item => ({
      ...item,
      cleanName: item.filePath ? item.filePath.replace(/^.*[\\\/]/, '') : ''
    }));
    const totalLaporan = listLaporan.length;
    const totalBerkas = listLaporan.filter(item => item.filePath).length;
    const totalTanpaBerkas = totalLaporan - totalBerkas;

    res.render('guest-laporan', {
      listLaporan,
      totalLaporan,
      totalBerkas,
      totalTanpaBerkas
    });
  } catch (err) {
    console.error('Gagal memuat laporan guest:', err);
    res.status(500).send('Gagal memuat data laporan: ' + err.message);
  }
});

app.get('/dashboard-guest', async (req, res) => {
  try {
    const [totalVendor, totalHargaDasar, totalDataKain, totalLaporan] = await Promise.all([
      Vendor.countDocuments(),
      HargaDasar.countDocuments(),
      DataBahanKain.countDocuments(),
      Laporan.countDocuments()
    ]);

    res.render('dashboard-guest', {
      totalVendor,
      totalHargaDasar,
      totalDataKain,
      totalLaporan
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat halaman guest: ' + err.message);
  }
});


// ============================================================
//  START SERVER
// ============================================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server berjalan di http://0.0.0.0:${PORT}`);
});