// =====================================================================
// RNG / Noise / Math / Formatting / Compression (DOM-free)
// =====================================================================
const U = {
  clamp: (v, a, b) => v < a ? a : v > b ? b : v,
  lerp: (a, b, t) => a + (b - a) * t,
  // Guards against NaN/Infinity leaking into the economy.
  safe(v, fallback = 0) {
    if (typeof v !== 'number' || v !== v) return fallback;
    if (v === Infinity) return 1e300;
    if (v === -Infinity) return -1e300;
    return v;
  },
  dist2: (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by),
  // Numeric keys for tiles and chunks (exact for |x|,|y| < 2^24).
  tileKey: (x, y) => (x + 16777216) * 33554432 + (y + 16777216),
  keyX: k => Math.floor(k / 33554432) - 16777216,
  keyY: k => (k % 33554432) - 16777216,
  chunkKey: (cx, cy) => (cx + 1048576) * 2097152 + (cy + 1048576),
  chunkKeyX: k => Math.floor(k / 2097152) - 1048576,
  chunkKeyY: k => (k % 2097152) - 1048576,
  DX: [1, 0, -1, 0],
  DY: [0, 1, 0, -1],
  opp: d => (d + 2) & 3,
  shuffle(arr, rnd) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  },
  pick: (arr, rnd) => arr[Math.floor(rnd() * arr.length) % arr.length],
  randRange: (a, b, rnd) => a + (b - a) * rnd(),
  randInt: (a, b, rnd) => a + Math.floor(rnd() * (b - a + 1)),
  weighted(weights, rnd) {
    let s = 0;
    for (let i = 0; i < weights.length; i++) s += weights[i];
    let r = rnd() * s;
    for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
    return weights.length - 1;
  },
  gauss(rnd) {
    let u = 0, v = 0;
    while (u === 0) u = rnd();
    while (v === 0) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
};

const RNG = {
  mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  // Integer hash of up to four ints, stable across platforms.
  hash(a, b = 0, c = 0, d = 0) {
    let h = 0x811c9dc5 ^ (a | 0);
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h ^= (b | 0) + 0x9e3779b9 + (h << 6) + (h >>> 2);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= (c | 0) + 0x7f4a7c15 + (h << 6) + (h >>> 2);
    h = Math.imul(h ^ (h >>> 16), 0x27d4eb2f);
    h ^= (d | 0) + 0x165667b1 + (h << 6) + (h >>> 2);
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h ^= h >>> 13;
    return h >>> 0;
  },
  hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  },
  forChunk(seed, cx, cy, salt = 0) { return RNG.mulberry32(RNG.hash(seed, cx, cy, salt)); },
  newSeed() { return (Math.floor(Math.random() * 4294967295) ^ Date.now()) >>> 0; }
};

// Seeded 2D gradient noise (Perlin-style) with fractal sum.
const Noise = {
  make(seed) {
    const perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    U.shuffle(p, RNG.mulberry32(seed));
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const gx = new Float32Array(8), gy = new Float32Array(8);
    for (let i = 0; i < 8; i++) { gx[i] = Math.cos(i * Math.PI / 4); gy[i] = Math.sin(i * Math.PI / 4); }
    const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
    function noise2(x, y) {
      // Large coordinates: wrap integer part into the permutation space without losing fraction precision.
      const xf0 = Math.floor(x), yf0 = Math.floor(y);
      const xi = xf0 & 255, yi = yf0 & 255;
      const xf = x - xf0, yf = y - yf0;
      const aa = perm[perm[xi] + yi] & 7, ab = perm[perm[xi] + yi + 1] & 7;
      const ba = perm[perm[xi + 1] + yi] & 7, bb = perm[perm[xi + 1] + yi + 1] & 7;
      const u = fade(xf), v = fade(yf);
      const n00 = gx[aa] * xf + gy[aa] * yf;
      const n10 = gx[ba] * (xf - 1) + gy[ba] * yf;
      const n01 = gx[ab] * xf + gy[ab] * (yf - 1);
      const n11 = gx[bb] * (xf - 1) + gy[bb] * (yf - 1);
      const nx0 = n00 + (n10 - n00) * u, nx1 = n01 + (n11 - n01) * u;
      return (nx0 + (nx1 - nx0) * v) * 1.41; // ~[-1,1]
    }
    function fbm(x, y, oct = 3) {
      let s = 0, a = 1, f = 1, n = 0;
      for (let i = 0; i < oct; i++) { s += a * noise2(x * f + i * 17.3, y * f - i * 9.1); n += a; a *= 0.5; f *= 2.03; }
      return s / n;
    }
    return { noise2, fbm };
  }
};

// Number / time formatting (German).
const Fmt = {
  mode: 'short', // short | sci | full
  units: ['', 'Tsd', 'Mio', 'Mrd', 'Bio', 'Brd', 'Trio', 'Trd', 'Quadr', 'Quadrd', 'Quint', 'Quintd'],
  dec(v, d) {
    return v.toFixed(d).replace('.', ',');
  },
  grouped(v) {
    const s = Math.floor(Math.abs(v)).toString();
    let out = '';
    for (let i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 === 0) out += '.';
      out += s[i];
    }
    return (v < 0 ? '-' : '') + out;
  },
  num(v, mode) {
    v = U.safe(v);
    mode = mode || Fmt.mode;
    const neg = v < 0; const a = Math.abs(v);
    let s;
    if (a < 1000) {
      if (a === 0) s = '0';
      else if (a < 10) s = Fmt.trim(Fmt.dec(a, 2));
      else if (a < 100) s = Fmt.trim(Fmt.dec(a, 1));
      else s = Math.floor(a).toString();
    } else if (mode === 'full' && a < 1e15) {
      s = Fmt.grouped(a);
    } else if (mode === 'sci' || a >= 1e36) {
      let e = Math.floor(Math.log10(a));
      let m = a / Math.pow(10, e);
      if (m >= 9.995) { m /= 10; e++; }
      s = Fmt.dec(m, 2) + 'e' + e;
    } else {
      let i = Math.floor(Math.log10(a) / 3);
      let m = a / Math.pow(1000, i);
      if (m >= 999.5) { i++; m /= 1000; }
      const d = m < 10 ? 2 : m < 100 ? 1 : 0;
      s = Fmt.dec(m, d) + ' ' + Fmt.units[i];
    }
    return (neg ? '-' : '') + s;
  },
  trim(s) { return s.indexOf(',') >= 0 ? s.replace(/0+$/, '').replace(/,$/, '') : s; },
  int(v) { v = U.safe(v); return Math.abs(v) < 1e6 ? Fmt.grouped(Math.round(v)) : Fmt.num(v); },
  money(v) { return Fmt.num(v) + ' ' + CURRENCY_SHORT; },
  pct(v, d = 0) { return Fmt.dec(U.safe(v) * 100, d) + ' %'; },
  time(sec) {
    sec = Math.max(0, Math.floor(U.safe(sec)));
    const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
    const p = n => (n < 10 ? '0' : '') + n;
    return h > 0 ? h + ':' + p(m) + ':' + p(s) : m + ':' + p(s);
  },
  duration(sec) {
    sec = Math.max(0, Math.floor(U.safe(sec)));
    const d = Math.floor(sec / 86400), h = Math.floor(sec / 3600) % 24, m = Math.floor(sec / 60) % 60, s = sec % 60;
    if (d > 0) return d + ' T ' + h + ' Std';
    if (h > 0) return h + ' Std ' + m + ' Min';
    if (m > 0) return m + ' Min ' + s + ' s';
    return s + ' s';
  }
};

// Minimal LZW + base64 used for save export strings.
const Codec = {
  utf8Encode(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    const out = [];
    for (let i = 0; i < str.length; i++) {
      let c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c >= 0xd800 && c < 0xdc00 && i + 1 < str.length) {
        const c2 = str.charCodeAt(++i); const cp = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
        out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return new Uint8Array(out);
  },
  utf8Decode(bytes) {
    if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(bytes);
    let s = '';
    for (let i = 0; i < bytes.length;) {
      const c = bytes[i++];
      if (c < 0x80) s += String.fromCharCode(c);
      else if (c < 0xe0) s += String.fromCharCode(((c & 31) << 6) | (bytes[i++] & 63));
      else if (c < 0xf0) s += String.fromCharCode(((c & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63));
      else {
        const cp = ((c & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
        s += String.fromCodePoint(cp);
      }
    }
    return s;
  },
  lzwCompress(bytes) {
    const dict = new Map();
    for (let i = 0; i < 256; i++) dict.set(String.fromCharCode(i), i);
    let next = 256, w = '';
    const codes = [];
    for (let i = 0; i < bytes.length; i++) {
      const c = String.fromCharCode(bytes[i]);
      const wc = w + c;
      if (dict.has(wc)) w = wc;
      else {
        codes.push(dict.get(w));
        if (next < 65536) dict.set(wc, next++);
        w = c;
      }
    }
    if (w !== '') codes.push(dict.get(w));
    // varint pack
    const out = [];
    for (const code of codes) {
      let v = code;
      while (v >= 128) { out.push((v & 127) | 128); v >>>= 7; }
      out.push(v);
    }
    return new Uint8Array(out);
  },
  lzwDecompress(packed) {
    const codes = [];
    for (let i = 0; i < packed.length;) {
      let v = 0, shift = 0, b;
      do { b = packed[i++]; v |= (b & 127) << shift; shift += 7; } while (b & 128 && i <= packed.length);
      codes.push(v);
    }
    if (!codes.length) return new Uint8Array(0);
    const dict = [];
    for (let i = 0; i < 256; i++) dict.push([i]);
    let w = dict[codes[0]];
    if (!w) throw new Error('bad lzw');
    const out = w.slice();
    for (let i = 1; i < codes.length; i++) {
      const k = codes[i];
      let entry;
      if (k < dict.length) entry = dict[k];
      else if (k === dict.length) entry = w.concat([w[0]]);
      else throw new Error('bad lzw code');
      for (let j = 0; j < entry.length; j++) out.push(entry[j]);
      if (dict.length < 65536) dict.push(w.concat([entry[0]]));
      w = entry;
    }
    return new Uint8Array(out);
  },
  b64chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
  toBase64(bytes) {
    const c = Codec.b64chars; let s = '';
    for (let i = 0; i < bytes.length; i += 3) {
      const a = bytes[i], b = i + 1 < bytes.length ? bytes[i + 1] : 0, d = i + 2 < bytes.length ? bytes[i + 2] : 0;
      const n = (a << 16) | (b << 8) | d;
      s += c[(n >> 18) & 63] + c[(n >> 12) & 63] + (i + 1 < bytes.length ? c[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? c[n & 63] : '=');
    }
    return s;
  },
  fromBase64(str) {
    str = str.replace(/[^A-Za-z0-9+/=]/g, '');
    const lookup = {}; for (let i = 0; i < 64; i++) lookup[Codec.b64chars[i]] = i;
    const out = [];
    for (let i = 0; i < str.length; i += 4) {
      const a = lookup[str[i]], b = lookup[str[i + 1]], c = lookup[str[i + 2]], d = lookup[str[i + 3]];
      if (a === undefined || b === undefined) throw new Error('bad base64');
      const n = (a << 18) | (b << 12) | ((c || 0) << 6) | (d || 0);
      out.push((n >> 16) & 255);
      if (str[i + 2] !== '=' && c !== undefined) out.push((n >> 8) & 255);
      if (str[i + 3] !== '=' && d !== undefined) out.push(n & 255);
    }
    return new Uint8Array(out);
  },
  pack(str) { return Codec.toBase64(Codec.lzwCompress(Codec.utf8Encode(str))); },
  unpack(b64) { return Codec.utf8Decode(Codec.lzwDecompress(Codec.fromBase64(b64))); }
};
