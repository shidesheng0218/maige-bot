// 上下文压缩手动验证：小阈值起服务，连发 5 轮触发压缩 + 再压缩，
// 然后问一个只存在于被压掉消息里的问题，看纪要是否真的进了上下文。
// 用法：MAIGE_COMPRESS_TRIGGER=6 MAIGE_COMPRESS_KEEP=4 MAIGE_COMPRESS_EVERY=4 node ops/test-compress.mjs
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rmSync } from 'node:fs';

const ROOT = process.env.MAIGE_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dataDir = join(ROOT, 'maige-bot/ops/.compress-test-data');
rmSync(dataDir, { recursive: true, force: true });

const { start } = await import(join(ROOT, 'miniapps/maige-hq/miniapp/node/server.mjs'));
const ac = new AbortController();
const base = 'http://127.0.0.1:18322';
const life = await start({
  pluginRoot: join(ROOT, 'miniapps/maige-hq'),
  dataDir,
  listen: { host: '127.0.0.1', port: 18322 },
  signal: ac.signal,
  logger: { info() {}, warn() {} },
});

let failed = 0;
function check(name, cond, extra) {
  if (cond) console.log('PASS', name, extra ?? '');
  else { failed++; console.error('FAIL', name, extra ?? ''); }
}

async function waitRound(conv, agentCount) {
  const deadline = Date.now() + 90000;
  for (;;) {
    const d = await (await fetch(`${base}/api/chat/messages?conv=${conv}`)).json();
    const agents = d.messages.filter((m) => m.kind === 'agent');
    if (!d.typing && agents.length >= agentCount) return agents;
    if (Date.now() > deadline) throw new Error('timeout waiting round ' + agentCount);
    await new Promise((r) => setTimeout(r, 2000));
  }
}

try {
  for (let i = 1; i <= 5; i++) {
    await fetch(base + '/api/chat/send', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ conv: 'chief', text: `第${i}条：我喜欢的数字是 ${i}。` }),
    });
    await waitRound('chief', i);
    console.log(`round ${i} done`);
  }

  const diag = await (await fetch(base + '/api/diagnostics')).json();
  const sum = diag.summaries && diag.summaries.chief;
  check('summary exists', !!sum, sum && `${sum.chars} chars upToId=${sum.upToId}`);

  // 压缩事件应在聊天里留了系统消息
  const msgs = await (await fetch(base + '/api/chat/messages?conv=chief')).json();
  check('compress event in chat', msgs.messages.some((m) => m.kind === 'system' && m.text.includes('压缩成纪要')));

  // 第 1、2 条早已滚出最近原文窗口，只能来自纪要
  await fetch(base + '/api/chat/send', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ conv: 'chief', text: '我第一条说喜欢的数字是几？只回数字。' }),
  });
  const agents = await waitRound('chief', 6);
  const last = agents[agents.length - 1];
  console.log('--- 纪要内容 ---\n' + (sum ? '(见上)' : ''));
  const diag2 = await (await fetch(base + '/api/diagnostics')).json();
  console.log('summary chars:', diag2.summaries?.chief?.chars);
  console.log('--- 麦格回答 ---\n' + last.text);
  check('recall via summary (含数字 1)', last.text.includes('1'), last.text.slice(0, 50));
} finally {
  await life.dispose();
  rmSync(dataDir, { recursive: true, force: true });
}

console.log(failed === 0 ? 'ALL_PASS' : `${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
