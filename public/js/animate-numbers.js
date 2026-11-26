/* ============================================================
   ANIMASI ANGKA TOTAL
   Saat halaman pertama dibuka, angka total "beracak" dulu lalu
   berhenti tepat pada nilai aslinya.
   ============================================================ */
(function () {
  'use strict';

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  /* Selector yang memuat angka total/ringkasan di seluruh halaman. */
  var SELECTORS = [
    '[data-animate-number]',

    /* Kartu statistik (vendor, kain, dashboard, stok, laporan, dll.) */
    '.card-value',
    '.card-value1',
    '.card-value2',
    '.card-value3',
    '.stat-value',
    '.stat-number',
    '.total-value',
    '.summary-value',

    /* Ringkasan khusus per halaman */
    '.auto-total-value',
    '.grand-total',
    '.detail-value',
    '.ck-badge',
    '.ck-project-card .text-orange',
    '.project-box-badge',
    '.project-guest-badge',
    '.project-box-row strong',
    '.project-guest-row strong',
    'tr.item-row td:nth-child(8) strong',
    'tr[data-row] td:nth-child(8) strong',
    '.lpj-finances .finance-row span:last-child',
    '.kategori-angka strong',
    '.ph-total-row td:not(:first-child):not(:last-child)',
    '.ph-detail-summary-item.ph-total strong',
    '.vendor-subtotal .subtotal-label',
    '.total-chip',
    '.badge-count',
    '.summary-val-nominal',
    '.total-bar-value',
    '.approval-footer .count-info strong',
    '.stat-card .card-footer span:last-child',

    /* Elemen yang diperbarui live: cukup dianimasikan sekali saat buka */
    '#ph-total-qty-display',
    '#ph-live-total',
    '#textTotalOtomatis',
    '#editTextTotalOtomatis',
    '#jumlahTampil',
    '#tampilanTotalAnggaran',
    '#valTotalAnggaran',
    '#stat-total-nominal',
    '#stat-paid-nominal',
    '#info-lpj-anggaran',
    '#info-lpj-sisa',
    '#form-live-grand-total',
    '#grandTotal',
    '#doc-grand-total',
    '#doc-lpj-anggaran',
    '#doc-lpj-sisa-awal',
    '#doc-lpj-sisa-pengajuan',
    '#doc-lpj-sisa-akhir'
  ];

  function isField(el) {
    return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
  }

  function readText(el) {
    return isField(el) ? el.value : el.textContent;
  }

  function findNumberNode(el) {
    if (isField(el)) return null;
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
    var node;
    while ((node = walker.nextNode())) {
      if (/[0-9]/.test(node.nodeValue)) return node;
    }
    return null;
  }

  function parseToken(raw) {
    var match = raw.match(/([0-9][0-9.,]*)/);
    if (!match) return null;

    var token = match[1];
    var commaAt = token.indexOf(',');
    var dotParts = token.split('.');
    var digits = token.replace(/[.,]/g, '');
    var decimals = 0;
    var normal = digits;
    var thousand = dotParts.length > 1;

    if (commaAt !== -1) {
      decimals = token.length - commaAt - 1;
      normal = digits.slice(0, digits.length - decimals) + '.' + digits.slice(digits.length - decimals);
    } else if (thousand && dotParts[dotParts.length - 1].length !== 3) {
      /* "99.8%" memakai titik sebagai desimal, bukan pemisah ribuan. */
      decimals = dotParts[dotParts.length - 1].length;
      normal = digits.slice(0, digits.length - decimals) + '.' + digits.slice(digits.length - decimals);
      thousand = false;
    }

    var target = parseFloat(normal);
    if (!isFinite(target)) return null;

    return {
      token: token,
      prefix: raw.slice(0, match.index),
      suffix: raw.slice(match.index + token.length),
      target: target,
      decimals: decimals,
      thousand: thousand
    };
  }

  function formatValue(value, meta) {
    var fixed = value.toFixed(meta.decimals);
    var parts = fixed.split('.');
    var whole = parts[0];
    if (meta.thousand) {
      whole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }
    return meta.prefix + whole + (meta.decimals ? ',' + parts[1] : '') + meta.suffix;
  }

  function animateElement(el) {
    if (!el || el.dataset.animated === 'done' || el.dataset.animating === '1') return;

    var node = findNumberNode(el);
    var raw = isField(el) ? el.value : (node ? node.nodeValue : readText(el));
    var meta = parseToken(raw);
    if ((!node && !isField(el)) || !meta || meta.target === 0) return;

    var original = raw;
    var duration = 900 + Math.random() * 350;
    var start = null;

    el.dataset.animating = '1';

    function write(text) {
      if (isField(el)) {
        el.value = text;
      } else if (node) {
        node.nodeValue = text;
      }
    }

    function frame(now) {
      if (start === null) start = now;
      var p = Math.min(1, (now - start) / duration);
      var value;

      if (p < 0.55) {
        /* Fase mengacak. */
        value = Math.random() * meta.target * 1.5;
      } else {
        /* Fase konvergen ke nilai sebenarnya. */
        var q = (p - 0.55) / 0.45;
        var eased = 1 - Math.pow(1 - q, 3);
        value = meta.target * eased
          + (Math.random() - 0.5) * meta.target * (1 - eased) * 0.5;
      }

      if (meta.decimals === 0) value = Math.round(value);
      value = Math.max(0, value);

      write(p < 1 ? formatValue(value, meta) : original);

      if (p < 1) {
        requestAnimationFrame(frame);
      } else {
        write(original);
        delete el.dataset.animating;
        el.dataset.animated = 'done';
      }
    }

    requestAnimationFrame(frame);
  }

  var pendingScan = false;

  function scan() {
    pendingScan = false;
    for (var i = 0; i < SELECTORS.length; i++) {
      var elements = document.querySelectorAll(SELECTORS[i]);
      for (var j = 0; j < elements.length; j++) {
        var el = elements[j];
        if (el.dataset.observed !== '1') {
          el.dataset.observed = '1';
          if (observer) {
            observer.observe(el, {
              childList: true,
              characterData: true,
              subtree: true
            });
          }
        }
        animateElement(el);
      }
    }
  }

  function scheduleScan() {
    if (pendingScan) return;
    pendingScan = true;
    requestAnimationFrame(scan);
  }

  var observer = typeof MutationObserver !== 'undefined'
    ? new MutationObserver(scheduleScan)
    : null;

  function init() {
    scan();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.animateAngka = animateElement;
})();
