// 麦格独立运行入口：脱离 MiniMax Code 宿主，起固定端口的本地服务。
// 由 麦格.app 启动，也可手动：node miniapps/maige-bot/miniapp/node/standalone.mjs
// 与 MCode 里的 Mini App 共享记忆/作品库/能力包/团队；聊天记录与本入口配置独立存放。
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { readFile } from 'node:fs/promises';
import { start } from './server.mjs';

const HOME = process.env.HOME || homedir();
const MAIGE_ROOT = process.env.MAIGE_ROOT || join(HOME, 'Documents', 'minimax项目');
const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const dataDir = process.env.MAIGE_STANDALONE_DATA || join(MAIGE_ROOT, 'maige-bot', 'data', 'standalone');
const PORT = parseInt(process.env.MAIGE_HQ_PORT || '17878', 10);

const ac = new AbortController();
const life = await start({
  pluginRoot,
  dataDir,
  listen: { host: '127.0.0.1', port: PORT },
  signal: ac.signal,
  logger: {
    info: (...a) => console.log('[maige-bot]', ...a),
    warn: (...a) => console.warn('[maige-bot]', ...a),
  },
});
// 读取访问令牌，把带 token 的完整面板 URL 打到 stdout（token 只在本地文件与内存）
let token = '';
try { token = (await readFile(join(dataDir, 'panel-token'), 'utf8')).trim(); } catch { /* 未生成 */ }
const url = `http://127.0.0.1:${PORT}/panel` + (token ? `?token=${token}` : '');
console.log(`[maige-bot] 麦格独立版已启动: ${url}`);

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    void life.dispose().then(() => process.exit(0));
  });
}
