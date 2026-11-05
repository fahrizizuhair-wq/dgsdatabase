const widths = require('./calibri-widths');

const FALLBACK_EM = 0.6;

function charWidth(ch, weight, sizePt) {
  const cp = ch.codePointAt(0);
  const table = weight === 'bold' ? widths.bold : widths.regular;
  let em = FALLBACK_EM;
  if (cp >= 32 && cp <= 255) {
    const w = table[cp - 32];
    if (typeof w === 'number' && w > 0) em = w;
  }
  return em * sizePt;
}

function textWidth(text, weight, sizePt) {
  let total = 0;
  for (const ch of String(text)) total += charWidth(ch, weight, sizePt);
  return total;
}

function wrapLine(line, weight, sizePt, maxWidth) {
  const clean = String(line).replace(/\t/g, '    ').replace(/\s+$/, '');
  if (clean === '') return [''];

  if (textWidth(clean, weight, sizePt) <= maxWidth) return [clean];

  const lines = [];
  let current = '';
  const words = clean.split(/ +/).filter(function (w) { return w !== ''; });

  words.forEach(function (word) {
    const candidate = current === '' ? word : current + ' ' + word;
    if (textWidth(candidate, weight, sizePt) <= maxWidth) {
      current = candidate;
      return;
    }

    if (current !== '') {
      lines.push(current);
      current = '';
    }

    if (textWidth(word, weight, sizePt) <= maxWidth) {
      current = word;
      return;
    }

    // Kata tunggal yang lebih panjang dari kolom: pecah per karakter.
    let part = '';
    for (const ch of word) {
      if (part !== '' && textWidth(part + ch, weight, sizePt) > maxWidth) {
        lines.push(part);
        part = ch;
      } else {
        part += ch;
      }
    }
    current = part;
  });

  if (current !== '') lines.push(current);
  return lines.length ? lines : [''];
}

/**
 * Bungkus teks agar tidak melewati lebar kolom.
 * Baris baru (\n) tetap dipertahankan sebagai baris terpisah.
 */
function wrapText(text, weight, sizePt, maxWidth) {
  const source = String(text === null || text === undefined ? '' : text)
    .replace(/\r\n?/g, '\n');
  if (source === '') return [];
  const hasil = [];
  source.split('\n').forEach(function (line) {
    wrapLine(line, weight, sizePt, maxWidth).forEach(function (visual) {
      hasil.push(visual);
    });
  });
  return hasil;
}

module.exports = { textWidth, wrapLine, wrapText };
