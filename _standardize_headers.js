const fs = require('fs');
const path = require('path');
const os = require('os');

const files = [
  'views/admin.ejs',
  'views/harga-dasar.ejs',
  'views/harga-dasar-user.ejs',
  'views/data-bahan-kain.ejs',
  'views/data-kain-admin.ejs',
  'views/laporan.ejs',
  'views/laporan-user.ejs',
  'views/stok-masuk.ejs',
  'views/stok-masuk-user.ejs',
  'views/stok-keluar.ejs',
  'views/stok-keluar-user.ejs',
  'views/stok-opname.ejs',
  'views/stok-opname-user.ejs',
  'views/user.ejs'
];

const backupDir = path.join(os.tmpdir(), 'opencode-header-backup-' + Date.now());
fs.mkdirSync(backupDir, { recursive: true });

const hamburger = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>';

const toggleButton = [
  '      <button class="toggle-btn" onclick="toggleSidebar()" title="Buka Sidebar">',
  '        ' + hamburger,
  '      </button>'
].join('\n');

let changed = 0;

for (const rel of files) {
  const file = path.join(process.cwd(), rel);
  const original = fs.readFileSync(file, 'utf8');
  let next = original;

  if (rel === 'views/user.ejs') {
    next = next.replace(
      /<button class="menu-btn" onclick="toggleSidebar\(\)">[\s\S]*?<\/button>/,
      '<button class="menu-btn" onclick="toggleSidebar()" title="Buka Sidebar">\n      ' + hamburger + '\n    </button>'
    );
  } else {
    next = next.replace(
      / {4}<button class="toggle-btn" onclick="toggleSidebar\(\)"[^>]*>[\s\S]*?<\/button>\s*\r?\n\s*\r?\n( {4}<header class="header-section">)/,
      '$1\n' + toggleButton
    );
  }

  if (next !== original) {
    fs.copyFileSync(file, path.join(backupDir, path.basename(file)));
    fs.writeFileSync(file, next, 'utf8');
    changed++;
    console.log('UPDATED ' + rel);
  } else {
    console.log('SKIPPED ' + rel);
  }
}

console.log('Backup: ' + backupDir);
console.log('Total updated: ' + changed);
