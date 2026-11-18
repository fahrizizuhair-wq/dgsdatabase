/**
 * Live update sederhana untuk seluruh halaman DGS.
 *
 * Server mengirim event SSE setiap ada data yang berhasil ditambah/diubah/dihapus.
 * Tab lain yang sedang membuka entity terkait akan memuat ulang halaman secara
 * otomatis. Halaman yang sedang dipakai mengetik atau membuka modal tidak
 * di-reload sampai pengguna selesai, supaya input tidak hilang.
 */
(function () {
  'use strict';

  var ACTION_KEY = 'dgs-live-action-until';
  var STATE_KEY = 'dgs-live-reload-state';
  var SOURCE_FIELD = '_liveClientId';

  var clientId = buatClientId();
  var localActionUntil = bacaActionUntil();
  var pendingReload = false;
  var reloadTimer = null;
  var lastReloadAt = 0;

  function buatClientId() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
      }
    } catch (err) {
      // Lanjut ke fallback.
    }
    return 'tab-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  }

  function bacaActionUntil() {
    try {
      var value = parseInt(sessionStorage.getItem(ACTION_KEY), 10);
      if (value > Date.now() && value < Date.now() + 60000) return value;
      sessionStorage.removeItem(ACTION_KEY);
    } catch (err) {
      // sessionStorage bisa diblokir browser.
    }
    return 0;
  }

  function tandaiAksiLokal(ms) {
    localActionUntil = Math.max(localActionUntil, Date.now() + (ms || 4000));
    try {
      sessionStorage.setItem(ACTION_KEY, String(localActionUntil));
    } catch (err) {
      // Abaikan.
    }
  }

  function normalisasiPath(pathname) {
    return String(pathname || '')
      .replace(/\/+$/, '')
      .toLowerCase();
  }

  function pathStarts(path, prefixes) {
    for (var i = 0; i < prefixes.length; i += 1) {
      var prefix = prefixes[i];
      if (path === prefix || path.indexOf(prefix + '/') === 0) return true;
    }
    return false;
  }

  function entityHalamanIni() {
    var path = normalisasiPath(location.pathname);

    // Dashboard menampilkan ringkasan semua entity.
    if (path === '/dashboard' || path === '/dashboard-admin' || path === '/dashboard-guest') {
      return '*';
    }

    if (pathStarts(path, ['/data-bahan-kain', '/data-kain-admin', '/guest/data-kain', '/katalog-vendor'])) {
      return 'data-kain';
    }
    if (path === '/admin' || path === '/user' || pathStarts(path, ['/admin/vendor', '/user/vendor', '/guest/vendor'])) {
      return 'vendor';
    }
    if (pathStarts(path, ['/harga-dasar', '/harga-dasar-user', '/guest/harga-dasar'])) {
      return 'harga-dasar';
    }
    if (pathStarts(path, ['/stok-masuk', '/stok-masuk-user'])) {
      return 'stok-masuk';
    }
    if (pathStarts(path, ['/stok-keluar', '/stok-keluar-user'])) {
      return 'stok-keluar';
    }
    if (pathStarts(path, ['/stok-opname', '/stok-opname-user'])) {
      return 'stok-opname';
    }
    if (pathStarts(path, ['/laporan', '/laporan-user', '/guest/laporan'])) {
      return 'laporan';
    }
    if (pathStarts(path, ['/surat-jalan', '/surat-jalan-admin', '/surat-jalan-user'])) {
      return 'surat-jalan';
    }
    if (pathStarts(path, ['/lpj', '/lpj-admin', '/lpj-user'])) {
      return 'lpj';
    }
    if (pathStarts(path, ['/materi-approval-admin', '/materi-approval-user'])) {
      return 'materi-approval';
    }
    if (pathStarts(path, ['/payment-request-admin', '/payment-request-user', '/payment-request'])) {
      return 'payment-request';
    }

    return null;
  }

  function eventPerluReload(entity) {
    var halaman = entityHalamanIni();
    if (!halaman || !entity) return false;
    return halaman === '*' || halaman === entity;
  }

  function urlSamaOrigin(value) {
    try {
      return new URL(value, location.href).origin === location.origin;
    } catch (err) {
      return false;
    }
  }

  function pathDeleteAtauHapus(pathname) {
    return /(^|\/)(delete|hapus)(\/|$)/i.test(String(pathname || ''));
  }

  function ambilPath(value) {
    try {
      return new URL(value, location.href).pathname.toLowerCase();
    } catch (err) {
      return String(value || '').toLowerCase();
    }
  }

  // Login/registrasi bukan aksi ubah data. Jangan menahan auto-reload setelah
  // request ini, supaya update pertama sesudah login tetap langsung masuk.
  function bukanAksiData(pathname) {
    return /^\/(login|login-admin|login-user|register-admin|register-user|forgot-password|reset-password|logout)(\/|$)/.test(
      String(pathname || '').toLowerCase(),
    );
  }

  // ------------------------------------------------------------------
  // Kirim ID tab pada setiap request tulis, supaya tab penyubmit tidak
  // ikut me-reload dirinya sendiri.
  // ------------------------------------------------------------------
  function tambahFieldSumber(form) {
    if (!form) return;

    var method = String(form.getAttribute('method') || 'GET').toUpperCase();
    var action = form.getAttribute('action') || location.pathname;
    var path = action;

    try {
      path = new URL(action, location.href).pathname;
    } catch (err) {
      // Pakai action apa adanya.
    }

    // Form GET biasa (misalnya pencarian) tidak perlu membawa ID tab.
    if (method === 'GET' && !pathDeleteAtauHapus(path)) return;

    if (form.querySelector('input[name="' + SOURCE_FIELD + '"]')) return;

    var input = document.createElement('input');
    input.type = 'hidden';
    input.name = SOURCE_FIELD;
    input.value = clientId;
    form.appendChild(input);
  }

  function tambahFieldKeSemuaForm() {
    var forms = document.querySelectorAll('form');
    for (var i = 0; i < forms.length; i += 1) tambahFieldSumber(forms[i]);
  }

  document.addEventListener(
    'submit',
    function (event) {
      var form = event.target;
      if (!form || !form.tagName || form.tagName.toLowerCase() !== 'form') return;
      tambahFieldSumber(form);
      var actionPath = ambilPath(form.getAttribute('action') || location.pathname);
      if (!bukanAksiData(actionPath)) tandaiAksiLokal(5000);
    },
    true,
  );

  document.addEventListener(
    'click',
    function (event) {
      var target = event.target;
      if (!target || typeof target.closest !== 'function') return;
      var link = target.closest('a[href]');
      if (!link) return;

      try {
        var url = new URL(link.href, location.href);
        if (url.origin !== location.origin || !pathDeleteAtauHapus(url.pathname)) return;
        url.searchParams.set(SOURCE_FIELD, clientId);
        link.href = url.toString();
        tandaiAksiLokal(5000);
      } catch (err) {
        // Abaikan URL yang tidak valid.
      }
    },
    true,
  );

  // Patch fetch agar request JSON/fetch juga menyertakan ID tab.
  if (typeof window.fetch === 'function') {
    var fetchAsli = window.fetch;
    window.fetch = function (input, init) {
      var args = Array.prototype.slice.call(arguments);
      var method = 'GET';

      try {
        var isRequest = typeof Request !== 'undefined' && input instanceof Request;
        var url = isRequest ? input.url : input;
        method = String((init && init.method) || (isRequest && input.method) || 'GET').toUpperCase();

        if (urlSamaOrigin(url)) {
          var headers = new Headers((init && init.headers) || (isRequest ? input.headers : undefined));
          if (!headers.has('X-Live-Client-Id')) headers.set('X-Live-Client-Id', clientId);

          if (isRequest && !init) {
            args[0] = new Request(input, { headers: headers });
          } else {
            args[1] = Object.assign({}, init || {}, { headers: headers });
          }

          if (['POST', 'PUT', 'PATCH', 'DELETE'].indexOf(method) !== -1) {
            var requestPath = ambilPath(isRequest ? input.url : url);
            if (!bukanAksiData(requestPath)) tandaiAksiLokal(5000);
          }
        }
      } catch (err) {
        // Jangan sampai patch ini mengganggu request utama.
      }

      return fetchAsli.apply(this, args);
    };
  }

  // Patch XMLHttpRequest untuk halaman yang mungkin memakainya.
  if (typeof XMLHttpRequest !== 'undefined') {
    var openAsli = XMLHttpRequest.prototype.open;
    var sendAsli = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
      try {
        this.__dgsLiveUrl = url;
        this.__dgsLiveMethod = String(method || 'GET').toUpperCase();
      } catch (err) {
        // Abaikan.
      }
      return openAsli.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
      try {
        if (this.__dgsLiveUrl && urlSamaOrigin(this.__dgsLiveUrl)) {
          this.setRequestHeader('X-Live-Client-Id', clientId);
          if (['POST', 'PUT', 'PATCH', 'DELETE'].indexOf(this.__dgsLiveMethod) !== -1) {
            var xhrPath = ambilPath(this.__dgsLiveUrl);
            if (!bukanAksiData(xhrPath)) tandaiAksiLokal(5000);
          }
        }
      } catch (err) {
        // Abaikan.
      }
      return sendAsli.apply(this, arguments);
    };
  }

  // ------------------------------------------------------------------
  // Deteksi kondisi yang tidak boleh di-reload.
  // ------------------------------------------------------------------
  function modalTerbuka() {
    var selector = [
      '.modal.open',
      '.modal.show',
      '.modal.active',
      '.modal[style*="display: flex"]',
      '.modal[style*="display:flex"]',
      '.modal[style*="display: block"]',
      '.modal[style*="display:block"]',
      '.modal-overlay.open',
      '.modal-overlay.show',
      '.modal-overlay.active',
      '.img-modal[style*="display: flex"]',
      '.img-modal[style*="display:flex"]',
      '[role="dialog"][aria-modal="true"]',
      '.sidebar-overlay.active',
    ].join(',');

    var elements = document.querySelectorAll(selector);
    for (var i = 0; i < elements.length; i += 1) {
      var el = elements[i];
      try {
        var style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        var rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) return true;
      } catch (err) {
        // Abaikan elemen yang tidak bisa diperiksa.
      }
    }
    return false;
  }

  function sedangMengetik() {
    var el = document.activeElement;
    if (!el) return false;

    // Modal yang baru ditutup bisa meninggalkan fokus pada input di dalamnya.
    // Input yang tidak terlihat tidak boleh menghalangi auto-reload.
    try {
      var style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      if (typeof el.getClientRects === 'function' && el.getClientRects().length === 0) return false;
    } catch (err) {
      // Lanjutkan pemeriksaan tag di bawah.
    }

    if (el.isContentEditable) return true;

    var tag = String(el.tagName || '').toUpperCase();
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag === 'INPUT') {
      var type = String(el.type || 'text').toLowerCase();
      return ['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'range', 'color'].indexOf(type) === -1;
    }
    return false;
  }

  function tidakBolehReload() {
    return document.hidden || modalTerbuka() || sedangMengetik();
  }

  // ------------------------------------------------------------------
  // Simpan dan pulihkan posisi scroll, tab aktif, dan isi kolom pencarian.
  // ------------------------------------------------------------------
  function simpanState() {
    var state = {
      scrollY: window.scrollY || document.documentElement.scrollTop || 0,
      search: [],
      activePaneId: '',
      activeButtonIndex: -1,
    };

    var searches = document.querySelectorAll(
      'input[type="search"], input[id*="search" i], input[name*="search" i], input[placeholder*="cari" i]',
    );
    for (var i = 0; i < searches.length; i += 1) {
      var input = searches[i];
      state.search.push({
        id: input.id || '',
        name: input.name || '',
        index: i,
        value: input.value || '',
      });
    }

    var pane = document.querySelector('.tab-pane.active');
    if (pane && pane.id) state.activePaneId = pane.id;

    var buttons = document.querySelectorAll('.tab-btn');
    for (var j = 0; j < buttons.length; j += 1) {
      if (buttons[j].classList.contains('active')) {
        state.activeButtonIndex = j;
        break;
      }
    }

    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (err) {
      // Abaikan.
    }
  }

  function bacaState() {
    try {
      var raw = sessionStorage.getItem(STATE_KEY);
      if (!raw) return null;
      sessionStorage.removeItem(STATE_KEY);
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }

  function cariInput(stateItem, index) {
    if (stateItem.id) {
      var byId = document.getElementById(stateItem.id);
      if (byId) return byId;
    }
    if (stateItem.name) {
      var byName = document.querySelector('input[name="' + stateItem.name + '"]');
      if (byName) return byName;
    }
    var all = document.querySelectorAll(
      'input[type="search"], input[id*="search" i], input[name*="search" i], input[placeholder*="cari" i]',
    );
    return all[index] || null;
  }

  function pulihkanState() {
    var state = bacaState();
    if (!state) return;

    if (state.activePaneId) {
      var pane = document.getElementById(state.activePaneId);
      if (pane) {
        var buttons = document.querySelectorAll('.tab-btn');
        for (var i = 0; i < buttons.length; i += 1) {
          var btn = buttons[i];
          var onclick = btn.getAttribute('onclick') || '';
          var target = btn.getAttribute('data-tab') || btn.getAttribute('aria-controls') || '';
          if (onclick.indexOf("'" + state.activePaneId + "'") !== -1 ||
              onclick.indexOf('"' + state.activePaneId + '"') !== -1 ||
              target === state.activePaneId) {
            if (!btn.classList.contains('active')) btn.click();
            break;
          }
        }
      }
    } else if (state.activeButtonIndex >= 0) {
      var allButtons = document.querySelectorAll('.tab-btn');
      var activeButton = allButtons[state.activeButtonIndex];
      if (activeButton && !activeButton.classList.contains('active')) activeButton.click();
    }

    var search = state.search || [];
    for (var j = 0; j < search.length; j += 1) {
      var input = cariInput(search[j], j);
      if (!input || input.value === search[j].value) continue;
      input.value = search[j].value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('keyup', { bubbles: true }));
    }

    try {
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    } catch (err) {
      // Abaikan.
    }

    var targetScroll = Number(state.scrollY) || 0;
    var pulihkanScroll = function () {
      try {
        window.scrollTo(0, targetScroll);
      } catch (err) {
        // Abaikan.
      }
    };
    setTimeout(pulihkanScroll, 60);
    setTimeout(pulihkanScroll, 250);
  }

  // ------------------------------------------------------------------
  // Reload dengan jeda, cooldown, dan pengecekan kondisi halaman.
  // ------------------------------------------------------------------
  function jadwalkanReload(entity) {
    if (!eventPerluReload(entity)) return;
    pendingReload = true;
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(cobaReload, 550);
  }

  function cobaReload() {
    if (!pendingReload) return;
    if (tidakBolehReload()) return;

    var now = Date.now();
    if (now - lastReloadAt < 1500) {
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(cobaReload, 1500 - (now - lastReloadAt));
      return;
    }

    pendingReload = false;
    lastReloadAt = now;
    simpanState();
    location.reload();
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && pendingReload) cobaReload();
  });

  setInterval(function () {
    if (pendingReload) cobaReload();
  }, 1000);

  // ------------------------------------------------------------------
  // SSE
  // ------------------------------------------------------------------
  function mulaiLive() {
    if (typeof window.EventSource !== 'function') return;

    var source = new EventSource('/realtime/events');

    source.addEventListener('change', function (event) {
      var payload;
      try {
        payload = JSON.parse(event.data);
      } catch (err) {
        return;
      }

      if (!payload || !payload.entity) return;
      if (payload.source && payload.source === clientId) return;
      if (Date.now() < localActionUntil) return;
      jadwalkanReload(payload.entity);
    });

    // EventSource otomatis reconnect. Error koneksi tidak perlu ditampilkan
    // ke pengguna karena halaman tetap berfungsi normal.
    source.onerror = function () {};

    window.addEventListener('beforeunload', function () {
      source.close();
    });
  }

  pulihkanState();
  tambahFieldKeSemuaForm();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tambahFieldKeSemuaForm);
  }

  mulaiLive();
})();
