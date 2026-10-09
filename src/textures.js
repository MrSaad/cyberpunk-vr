import * as THREE from 'three';
import { RNG } from './rng.js';

// ---------------------------------------------------------------------------
// Sign atlas: 4 columns x 16 rows of 512x128 cells, white glyphs on black.
// Shaders tint them, so a single texture serves every neon sign in the city.
// ---------------------------------------------------------------------------
export const ATLAS_COLS = 4;
export const ATLAS_ROWS = 16;

// Cells 0-5 are station names (indices match route.js station order).
const HORIZONTAL = [
  'HOME', 'SKYDECK', 'SKYPORT', 'KUROGANE', 'NIGHT MARKET', 'KAFE 22',
  'NEOTEK', 'KAIJU COLA', 'SYNTHWAVE', 'NEURO//LINK', 'CHROME', 'VOLTA',
  'ICHIBAN', 'DATAFORGE', 'BLACK ICE', 'ORBITAL', 'NOVA', 'MECHA',
  'TOKYO-9', 'HOTEL', 'BAR', '24H', 'RAMEN', 'SUSHI', 'CYBERWARE',
  'IMPLANTS', 'NOODLES', 'OPEN', 'KARAOKE', 'GLITCH', 'YUME CORP', 'HYPERION',
];
const VERTICAL = [
  'ラーメン', '居酒屋', '電脳', '夢', '未来', '東京', 'ネオン', '寿司',
  'カラオケ', 'ホテル', '薬', '酒', 'サイバー', '龍', '桜', '夜市',
  '茶', '電気', '黒金', 'ゲーム', '占い', '麺', '生', '愛',
  'バー', '銀河', '光', '鬼', '神', '金', '月', '星',
];

export const SIGN_CELLS = {
  stationBase: 0,
  horizontalCount: HORIZONTAL.length,
  verticalBase: HORIZONTAL.length,
  verticalCount: VERTICAL.length,
};

let atlasTex = null;
export function getSignAtlas() {
  if (atlasTex) return atlasTex;
  const cw = 512, ch = 128;
  const canvas = document.createElement('canvas');
  canvas.width = cw * ATLAS_COLS;
  canvas.height = ch * ATLAS_ROWS;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.shadowColor = '#fff';

  const cellOrigin = (i) => [(i % ATLAS_COLS) * cw, Math.floor(i / ATLAS_COLS) * ch];

  HORIZONTAL.forEach((text, i) => {
    const [x, y] = cellOrigin(i);
    let size = 96;
    ctx.font = `900 ${size}px "Arial Black", "Roboto", "Helvetica", sans-serif`;
    while (ctx.measureText(text).width > cw * 0.9 && size > 20) {
      size -= 4;
      ctx.font = `900 ${size}px "Arial Black", "Roboto", "Helvetica", sans-serif`;
    }
    ctx.shadowBlur = 10;
    ctx.fillText(text, x + cw / 2, y + ch / 2 + 4);
  });

  // Vertical signs: glyphs are drawn rotated so that when the quad is rotated
  // 90 degrees in the shader, characters read upright, stacked top to bottom.
  VERTICAL.forEach((text, j) => {
    const i = HORIZONTAL.length + j;
    const [x, y] = cellOrigin(i);
    const chars = [...text];
    const step = Math.min(110, (cw * 0.92) / chars.length);
    const size = Math.min(100, step * 0.95);
    ctx.font = `900 ${size}px "Noto Sans CJK JP", "Noto Sans JP", "Hiragino Sans", "Yu Gothic", sans-serif`;
    ctx.shadowBlur = 8;
    const total = step * chars.length;
    chars.forEach((c, k) => {
      ctx.save();
      ctx.translate(x + cw / 2 - total / 2 + step * (k + 0.5), y + ch / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(c, 0, 4);
      ctx.restore();
    });
  });

  atlasTex = new THREE.CanvasTexture(canvas);
  atlasTex.colorSpace = THREE.NoColorSpace; // used as a mask
  atlasTex.anisotropy = 4;
  atlasTex.generateMipmaps = true;
  atlasTex.minFilter = THREE.LinearMipmapLinearFilter;
  return atlasTex;
}

// ---------------------------------------------------------------------------
// Tileable value-noise texture (fbm) used for clouds and smog layers.
// ---------------------------------------------------------------------------
let noiseTex = null;
export function getNoiseTexture() {
  if (noiseTex) return noiseTex;
  const N = 256;
  const rng = new RNG(1337);
  const data = new Uint8Array(N * N * 4);
  const octave = (period) => {
    const g = [];
    for (let i = 0; i < period * period; i++) g.push(rng.next());
    return (x, y) => {
      const fx = (x / N) * period, fy = (y / N) * period;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = fx - x0, ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const at = (i, j) => g[((j % period + period) % period) * period + ((i % period + period) % period)];
      const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
  };
  const octs = [octave(4), octave(8), octave(16), octave(32), octave(64)];
  const octs2 = [octave(6), octave(12), octave(24)];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let v = 0, amp = 0.5;
      for (const o of octs) { v += o(x, y) * amp; amp *= 0.5; }
      let w = 0; amp = 0.5;
      for (const o of octs2) { w += o(x, y) * amp; amp *= 0.5; }
      const i = (y * N + x) * 4;
      data[i] = Math.min(255, v * 290);
      data[i + 1] = Math.min(255, w * 290);
      data[i + 2] = Math.floor(rng.next() * 255);
      data[i + 3] = 255;
    }
  }
  noiseTex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping;
  noiseTex.magFilter = THREE.LinearFilter;
  noiseTex.minFilter = THREE.LinearMipmapLinearFilter;
  noiseTex.generateMipmaps = true;
  noiseTex.needsUpdate = true;
  return noiseTex;
}

// ---------------------------------------------------------------------------
// Small dynamic text panel (station displays, in-train "next stop" screens).
// ---------------------------------------------------------------------------
export class TextPanel {
  constructor(w = 512, h = 256) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.last = '';
  }
  draw(lines, { accent = '#fcee0a', bg = '#0a0414' } = {}) {
    const key = JSON.stringify(lines) + accent;
    if (key === this.last) return;
    this.last = key;
    const { ctx, canvas } = this;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const lh = (canvas.height - 24) / lines.length;
    lines.forEach((l, i) => {
      const text = typeof l === 'string' ? l : l.text;
      const color = typeof l === 'string' ? (i === 0 ? accent : '#e8f6ff') : l.color;
      const size = typeof l === 'string' ? Math.floor(lh * 0.62) : l.size || Math.floor(lh * 0.62);
      ctx.font = `700 ${size}px "Roboto Mono", "Consolas", monospace`;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fillText(text, 22, 12 + lh * (i + 0.5));
    });
    ctx.shadowBlur = 0;
    this.texture.needsUpdate = true;
  }
}
