// 媒体类型与确定性头像（纯函数，无 I/O）。

import { createHash } from 'node:crypto';

export const MEDIA_TYPES = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg',
  '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
};

export function extOf(name) {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

export function kindOf(name) {
  const mime = MEDIA_TYPES[extOf(name)] || '';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'file';
}

/** 确定性头像：key 哈希 → 品牌紫系 HSL 色 + 5×5 左右对称几何图案（identicon 风）。
 *  同一 key 永远同一图案，不同 key 图案/颜色都不同——新 bot 零素材即得独一无二头像。 */
export function avatarSvgFor(seed) {
  const h = createHash('sha256').update(String(seed)).digest();
  const hue = 240 + (h[0] % 60);            // 240~300 蓝紫带（品牌紫系）
  const sat = 55 + (h[1] % 25);             // 55~80
  const bgL = 22 + (h[2] % 12);             // 深色底 22~34
  const fgL = 62 + (h[3] % 14);             // 亮色前景 62~76
  const N = 5, cell = 96 / N;
  const bit = (x, y) => (h[4 + ((y * 3 + x) % 28)] >> ((y * 3 + x) % 8)) & 1; // 取左 3 列做对称源
  let cells = '';
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const mx = x < 3 ? x : N - 1 - x;     // 右半镜像左半 → 左右对称
      if (!bit(mx, y)) continue;
      cells += `<rect x="${(x * cell).toFixed(1)}" y="${(y * cell).toFixed(1)}" width="${cell.toFixed(1)}" height="${cell.toFixed(1)}"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">`
    + `<rect width="96" height="96" rx="20" fill="hsl(${hue} ${sat}% ${bgL}%)"/>`
    + `<g fill="hsl(${hue} ${sat}% ${fgL}%)">${cells}</g></svg>`;
}