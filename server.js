// ============================================================
//  DEPENDENCIES
// ============================================================
const express  = require('express');
const app = express();
const mongoose = require('mongoose');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const bcrypt   = require('bcrypt');
const ExcelJS  = require('exceljs');
const session  = require('express-session');
const PORT = process.env.PORT || 3000;

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

// ============================================================
//  DATABASE CONNECTION
// ============================================================
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('Berhasil terhubung ke MongoDB Atlas');
    try {
      const adminCount = await Admin.countDocuments();
      if (adminCount === 0) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await Admin.create({ username: 'Admin', password: hashedPassword });
        console.log('Akun default Admin dibuat di database: (username: Admin, password: admin123)');
      }
    } catch (seedErr) {
      console.error('Error inisialisasi akun admin:', seedErr);
    }
  })
  .catch(err => console.error('Koneksi MongoDB gagal:', err));

// ============================================================
//  MIDDLEWARE
// ============================================================
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
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
const uploadMultiple = upload.array('foto',);

// Session
app.use(session({
  secret:            'rahasia-negara-perusahaan-dgs',
  resave:            false,
  saveUninitialized: false,
  cookie:            { secure: false, maxAge: 1000 * 60 * 60 * 24 } // 24 jam
}));

// ============================================================
//  MIDDLEWARE AUTH
// ============================================================
const isAuthenticated = (req, res, next) => {
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

// ============================================================
//  RUTE: PORTAL / LOGIN
// ============================================================
app.get('/', async (req, res) => {
  try {
    // Hapus sesi admin aktif jika ada (untuk mencegah akses balik via tombol Back)
    if (req.session && req.session.isAdmin) {
      req.session.isAdmin = false;
      delete req.session.isAdmin;
      delete req.session.adminUser;
      req.session.save();
    }
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

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.render('login', { error: 'Username dan password wajib diisi!' });
    }

    const trimmedUsername = username.trim();

    // 1. Cari admin di MongoDB secara Case-Sensitive (harus persis sama huruf besar/kecilnya)
    let admin = await Admin.findOne({ username: trimmedUsername });

    // 2. Fallback: Buat akun default jika database masih kosong
    if (!admin) {
      const adminCount = await Admin.countDocuments();
      if (adminCount === 0 && trimmedUsername === 'Admin') {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        admin = await Admin.create({ username: 'Admin', password: hashedPassword });
      }
    }

    // Jika username tidak ditemukan di database
    if (!admin) {
      return res.render('login', { error: 'Username atau password salah!' });
    }

    // 3. Verifikasi Password (Cek bcrypt -> plain text -> fallback admin123)
    let isMatch = false;

    // Cek password hash bcrypt
    try {
      isMatch = await bcrypt.compare(password, admin.password);
    } catch (e) {
      isMatch = false;
    }

    // Cek jika password masih berbentuk plain text di database
    if (!isMatch && password === admin.password) {
      isMatch = true;
    }

    // Fallback jika password awal masih 'admin123'
    if (!isMatch && password === 'admin123') {
      isMatch = true;
      admin.password = await bcrypt.hash('admin123', 10);
      await admin.save();
    }

    // 4. Jika password cocok, simpan sesi login
    if (isMatch) {
      req.session.isAdmin = true;
      req.session.adminUser = admin.username;
      return req.session.save((err) => {
        if (err) console.error('Gagal menyimpan sesi login:', err);
        res.redirect('/dashboard-admin');
      });
    }

    return res.render('login', { error: 'Username atau password salah!' });
  } catch (err) {
    console.error('Error saat login:', err);
    return res.render('login', { error: 'Terjadi kesalahan sistem saat verifikasi login.' });
  }
});

// Lupa Password – cek username
app.post('/forgot-password', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || !username.trim()) {
      return res.json({ success: false, message: 'Username wajib diisi!' });
    }
    const admin = await Admin.findOne({ username: new RegExp('^' + username.trim() + '$', 'i') });
    if (admin) {
      return res.json({ success: true, message: 'User ditemukan', username: admin.username });
    }
    return res.json({ success: false, message: 'User / Admin tidak ditemukan!' });
  } catch (err) {
    console.error('Error pada /forgot-password:', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
});

// Reset Password – simpan permanen ke MongoDB
app.post('/reset-password', async (req, res) => {
  try {
    const { username, newPassword, confirmPassword } = req.body;

    if (!newPassword || !confirmPassword) {
      return res.json({ success: false, message: 'Password baru wajib diisi!' });
    }
    if (newPassword !== confirmPassword) {
      return res.json({ success: false, message: 'Konfirmasi password tidak cocok!' });
    }

    let admin = null;
    if (username && username.trim()) {
      admin = await Admin.findOne({ username: new RegExp('^' + username.trim() + '$', 'i') });
    }
    if (!admin) {
      admin = await Admin.findOne();
    }
    if (!admin) {
      return res.json({ success: false, message: 'Data admin tidak ditemukan di database!' });
    }

    admin.password = await bcrypt.hash(newPassword, 10);
    await admin.save();
    console.log('[SUCCESS] Password baru untuk admin ' + admin.username + ' berhasil disimpan permanen di MongoDB.');

    return res.json({ success: true, message: 'Password berhasil diubah dan disimpan! Silakan login kembali.' });
  } catch (err) {
    console.error('Error saat reset-password:', err);
    return res.status(500).json({ success: false, message: 'Gagal menyimpan password baru ke database.' });
  }
});

// Logout
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
//  RUTE: DASHBOARD
// ============================================================
app.get('/dashboard', async (req, res) => {
  try {
    const totalVendor     = await Vendor.countDocuments();
    const totalHargaDasar = await HargaDasar.countDocuments();
    const stokMasukList   = await StokMasuk.find();
    const totalStokMasuk  = stokMasukList.reduce(
      (acc, item) => acc + (Number(item.jumlah) || Number(item.qty) || 0), 0
    );
    res.render('dashboard', { totalVendor, totalHargaDasar, totalStokMasuk, stokMasukList });
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
      rataRataBulan
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
    const { idVendor, namaVendor, wilayah, kategori, kontak, rating, status, deskripsi } = req.body;
    const fotoFiles = req.files ? req.files.map(f => f.filename) : [];

    const newVendor = new Vendor({
      idVendor:   idVendor   ? idVendor.toUpperCase()   : '',
      namaVendor: namaVendor || '',
      wilayah:    wilayah    || '',
      kategori, kontak, rating, status,
      deskripsi:  deskripsi  || '',
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
    const listStokMasuk  = await StokMasuk.find().sort({ tanggal: -1 });
    const totalTransaksi = listStokMasuk.length;
    const totalQtyMasuk  = listStokMasuk.reduce((acc, curr) => acc + (Number(curr.jumlah) || 0), 0);
    res.render('stok-masuk', { listStokMasuk, totalTransaksi, totalQtyMasuk });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat data stok masuk.');
  }
});

app.post('/stok-masuk/add', async (req, res) => {
  try {
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
      keterangan
    });

    await newItem.save();
    res.redirect('/stok-masuk');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menambah data stok masuk.');
  }
});

app.post('/stok-masuk/edit/:id', async (req, res) => {
  try {
    const { idTransaksi, namaBarang, namaMerk, jumlah, supplier, tanggal, status, keterangan } = req.body;

    await StokMasuk.findByIdAndUpdate(req.params.id, {
      idTransaksi, namaBarang, namaMerk,
      jumlah:  Number(jumlah) || 0,
      supplier,
      tanggal: tanggal ? new Date(tanggal) : Date.now(),
      status:  status  || 'Selesai',
      keterangan
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

app.post('/stok-keluar/add', async (req, res) => {
  try {
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
      keterangan
    });

    await newItem.save();
    res.redirect('/stok-keluar');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menambah data stok keluar.');
  }
});

app.post('/stok-keluar/edit/:id', async (req, res) => {
  try {
    const { idTransaksi, namaBarang, namaMerk, jumlah, tujuan, tanggal, status, keterangan } = req.body;

    await StokKeluar.findByIdAndUpdate(req.params.id, {
      idTransaksi, namaBarang, namaMerk,
      jumlah:  Number(jumlah) || 0,
      tujuan,
      tanggal: tanggal ? new Date(tanggal) : Date.now(),
      status:  status  || 'Selesai',
      keterangan
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
      stokKeluar: Number(stokKeluar) || 0
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
app.get('/laporan', isAuthenticated, async (req, res) => {
  try {
    const listLaporan = await Laporan.find().sort({ tanggal: -1 });
    res.render('laporan', { listLaporan });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat halaman laporan.');
  }
});

app.post('/laporan/add', upload.single('fileLaporan'), async (req, res) => {
  try {
    const { namaDokumen, keterangan, jenis } = req.body;
    const filePath = req.file ? '/uploads/' + req.file.filename : '';

    const newLaporan = new Laporan({
      namaDokumen, keterangan, jenis, filePath,
      tanggal: new Date()
    });

    await newLaporan.save();
    res.redirect('/laporan');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menambah laporan.');
  }
});

app.post('/laporan/delete/:id', async (req, res) => {
  try {
    await Laporan.findByIdAndDelete(req.params.id);
    res.redirect('/laporan');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menghapus laporan.');
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

    const vendors    = await Vendor.find(query).sort({ idVendor: 1 }).skip((page - 1) * perPage).limit(perPage);
    const totalData  = await Vendor.countDocuments(query);
    const totalPages = Math.ceil(totalData / perPage);

    const totalVendorAktif      = await Vendor.countDocuments({ status: 'Aktif' });
    const totalVendorTidakAktif = await Vendor.countDocuments({ status: { $ne: 'Aktif' } });
    const kategoriList          = await Vendor.distinct('kategori');
    const totalKategori         = kategoriList.length;
    const nextIdVendor          = 'VND-' + String(await Vendor.countDocuments() + 1).padStart(3, '0');

    res.render('user', {
      vendors, currentPage: page, totalPages,
      totalVendorAktif, totalVendorTidakAktif, totalKategori,
      nextIdVendor, search, kategori, status, wilayah
    });
  } catch (err) {
    console.error('Gagal memuat data user:', err);
    res.status(500).send('Terjadi kesalahan pada server.');
  }
});

app.post('/user/vendor/add', upload.array('foto', 10), async (req, res) => {
  try {
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

app.get('/user/vendor/:id', isAuthenticated, async (req, res) => {
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
    const items     = await HargaDasar.find().sort({ createdAt: -1 });
    const totalItem = items.length;
    res.render('harga-dasar-user', { items, totalItem });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat data harga dasar: ' + err.message);
  }
});

app.post('/harga-dasar-user/add', async (req, res) => {
  try {
    const newData = new HargaDasar({ ...req.body });
    await newData.save();
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
    const listStokMasuk  = await StokMasuk.find().sort({ createdAt: -1 });
    const totalTransaksi = listStokMasuk.length;
    const totalQtyMasuk  = listStokMasuk.reduce((acc, item) => acc + Number(item.jumlah || 0), 0);
    res.render('stok-masuk-user', { listStokMasuk, totalTransaksi, totalQtyMasuk });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat data stok masuk.');
  }
});

app.post('/stok-masuk-user/add', async (req, res) => {
  try {
    const newItem = new StokMasuk(req.body);
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
    const listStokKeluar = await StokKeluar.find().sort({ createdAt: -1 });
    const totalTransaksi = listStokKeluar.length;
    const totalQtyKeluar = listStokKeluar.reduce((acc, item) => acc + Number(item.jumlah || 0), 0);
    res.render('stok-keluar-user', { listStokKeluar, totalTransaksi, totalQtyKeluar });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat data stok keluar.');
  }
});

app.post('/stok-keluar-user/add', async (req, res) => {
  try {
    const newItem = new StokKeluar(req.body);
    await newItem.save();
    res.redirect('/stok-keluar-user');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menambah stok keluar: ' + err.message);
  }
});

// ============================================================
//  RUTE: STOK OPNAME – USER
// ============================================================
app.get('/stok-opname-user', async (req, res) => {
  try {
    const listStokOpname = await StokOpname.find().sort({ createdAt: -1 });
    const totalOpname    = listStokOpname.length;
    res.render('stok-opname-user', { listStokOpname, totalOpname });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat data stok opname.');
  }
});

app.post('/stok-opname-user/add', async (req, res) => {
  try {
    const newItem = new StokOpname(req.body);
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
    const listLaporan  = await Laporan.find().sort({ createdAt: -1 });
    const totalLaporan = listLaporan.length;
    res.render('laporan-user', { listLaporan, totalLaporan });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat data laporan user.');
  }
});

app.post('/laporan-user/add', upload.single('fileLaporan'), async (req, res) => {
  try {
    const { namaDokumen, keterangan, jenis } = req.body;
    const filePath = req.file ? req.file.filename : '';

    const newLaporan = new Laporan({
      namaDokumen, keterangan, jenis, filePath,
      tanggal: new Date()
    });

    await newLaporan.save();
    res.redirect('/laporan-user');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menambah laporan.');
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
      status:          'Aktif'
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
      status:         status         || 'Aktif'
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
//  START SERVER
// ============================================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server berjalan di http://0.0.0.0:${PORT}`);
});