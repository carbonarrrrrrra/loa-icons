/* Versioned, self-contained URL snapshots. No network or browser storage access. */
const LoaShare = (() => {
  const MAX_BYTES = 65536, MAX_URL_DATA = 24000, MAX_UNITS = 4096;
  const fail = () => { throw new Error('共有URLのデータが不正です。送信者にURL全体をコピーし直してもらってください。'); };
  const isId = id => /^1\d{5}$/.test(String(id));
  function packIds(ids) {
    let previous = 0;
    return ids.map(id => { if (!isId(id)) fail(); const n = Number(id), delta = n - previous; previous = n; return delta.toString(36); }).join('.');
  }
  function unpackIds(text) {
    if (typeof text !== 'string' || text.length > MAX_BYTES) fail();
    if (!text) return [];
    const parts = text.split('.');
    if (parts.length > MAX_UNITS) fail();
    let previous = 0;
    const seen = new Set();
    return parts.map(part => {
      if (!/^-?[0-9a-z]{1,5}$/.test(part)) fail();
      previous += parseInt(part, 36);
      const id = String(previous);
      if (!isId(id) || seen.has(id)) fail();
      seen.add(id); return id;
    });
  }
  function validate(p) {
    if (!p || p.v !== 1 || !['tier', 'owned'].includes(p.k)) fail();
    const roster = unpackIds(p.c), catalog = new Set(roster);
    if (!roster.length) fail();
    const subset = text => { const ids = unpackIds(text); if (ids.some(id => !catalog.has(id))) fail(); return ids; };
    let data;
    if (p.k === 'tier') {
      if (typeof p.t !== 'string' || p.t.length > 80 || !Array.isArray(p.r) || !p.r.length || p.r.length > 30) fail();
      const assigned = new Set();
      data = {title: p.t, rows: p.r.map((r, i) => {
        if (!Array.isArray(r) || r.length !== 3 || typeof r[0] !== 'string' || !r[0].length || r[0].length > 24 || !/^#[0-9a-f]{6}$/i.test(r[1])) fail();
        const units = subset(r[2]);
        for (const id of units) { if (assigned.has(id)) fail(); assigned.add(id); }
        return {id: 'tier-' + i, name: r[0], color: r[1], units};
      })};
    } else data = subset(p.o);
    const f = p.f;
    if (!Array.isArray(f) || f.length !== 6 || typeof f[0] !== 'string' || f[0].length > 200 || !['name', 'formation', 'id-desc'].includes(f[1]) || !['all', 'yes', 'no'].includes(f[2]) || !['all', '物理', '魔法'].includes(f[3]) || !Number.isInteger(f[4]) || f[4] < 0 || f[4] > 5 || typeof f[5] !== 'boolean') fail();
    return {kind: p.k, data, roster, view: {search: f[0], sort: f[1], owned: p.k === 'tier' ? 'all' : f[2], attack: f[3], element: f[4], special: f[5]}};
  }
  function create(kind, data, roster, view) {
    const sorted = ids => [...ids].map(String).sort((a,b)=>Number(a)-Number(b));
    const p = {v: 1, k: kind, c: packIds(sorted(roster)), f: [view.search, view.sort, kind === 'tier' ? 'all' : view.owned, view.attack, view.element, view.special]};
    if (kind === 'tier') { p.t = data.title; p.r = data.rows.map(r => [r.name, r.color, packIds(r.units)]); }
    else p.o = packIds(sorted(data));
    validate(p); return p;
  }
  function base64(bytes) {
    let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unbase64(text) {
    if (!text || !/^[\w-]+$/.test(text) || text.length % 4 === 1) fail();
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - text.length % 4) % 4));
    return Uint8Array.from(binary, c => c.charCodeAt(0));
  }
  async function boundedRead(stream) {
    const reader = stream.getReader(), chunks = []; let size = 0;
    try {
      while (true) {
        const {value, done} = await reader.read(); if (done) break;
        size += value.length;
        if (size > MAX_BYTES) { await reader.cancel(); fail(); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const out = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.length; }
    return out;
  }
  async function encode(payload) {
    validate(payload);
    const raw = new TextEncoder().encode(JSON.stringify(payload));
    if (raw.length > MAX_BYTES) fail();
    let result = '1j.' + base64(raw);
    if (typeof CompressionStream !== 'undefined') {
      try {
        const compressed = await boundedRead(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate')));
        const zipped = '1z.' + base64(compressed); if (zipped.length < result.length) result = zipped;
      } catch { /* Uncompressed snapshots remain usable without compression. */ }
    }
    if (result.length > MAX_URL_DATA) throw new Error('共有する内容が大きすぎます。Tier名やタイトルを短くしてください。');
    return result;
  }
  async function decode(text) {
    try {
      if (typeof text !== 'string' || text.length > MAX_URL_DATA || !/^1[jz]\./.test(text)) fail();
      let bytes = unbase64(text.slice(3));
      if (text.startsWith('1z.')) {
        if (typeof DecompressionStream === 'undefined') throw new Error('この共有URLを開くには、ブラウザを最新版に更新してください。');
        bytes = await boundedRead(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate')));
      }
      if (bytes.length > MAX_BYTES) fail();
      return validate(JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes)));
    } catch (error) {
      if (error.message.includes('最新版')) throw error;
      fail();
    }
  }
  return {create, encode, decode};
})();
if (typeof module !== 'undefined') module.exports = LoaShare;
