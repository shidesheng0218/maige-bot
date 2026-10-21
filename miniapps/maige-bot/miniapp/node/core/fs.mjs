// 文件访问边界：所有路径都经 realpath 校验，fail-closed 限定在授权目录内。

import { readdir, stat, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { ID_PATTERN } from './parse.mjs';

/** 把路径限定在工作区内（支持子路径；realpath 解析软链；fail-closed） */
export async function resolveWorkspace(root, p) {
  const realRoot = await realpath(root).catch(() => null);
  if (!realRoot) return null;
  const abs = p.startsWith('/') ? p : join(realRoot, p);
  const target = await realpath(abs).catch(() => null);
  if (!target || (target !== realRoot && !target.startsWith(realRoot + '/'))) return null;
  return target;
}

/** 将用户提交的文件名限定在授权目录内（fail-closed） */
export async function resolveInside(dir, name) {
  if (!ID_PATTERN.test(name) || name.includes('..')) return null;
  const real = await realpath(dir).catch(() => null);
  if (!real) return null;
  const target = await realpath(join(real, name)).catch(() => null);
  if (!target || !target.startsWith(real + '/')) return null;
  return target;
}

/** 列目录内文件并附带 stat 信息；目录不存在时返回 dirExists:false */
export async function listDir(dir) {
  try {
    const real = await realpath(dir);
    const names = await readdir(real);
    const items = [];
    for (const name of names) {
      if (name.startsWith('.')) continue;
      try {
        const st = await stat(join(real, name));
        if (!st.isFile()) continue;
        items.push({ name, size: st.size, mtime: st.mtime.toISOString() });
      } catch { /* 单个文件失败不阻塞列表 */ }
    }
    return { dirExists: true, real, items };
  } catch {
    return { dirExists: false, real: null, items: [] };
  }
}