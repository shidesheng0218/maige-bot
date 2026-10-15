// 工具层手动 e2e：真实 LLM，验证 bot 主动调用 READ / WRITE / SEARCH / TASK。
// 用法：node ops/test-tools-e2e.mjs
process.env.MAIGE_HQ_NO_NOTIFY = '1'; // 测试期间不发系统通知
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rmSync, mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const ROOT = process.env.MAIGE_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dataDir = join(ROOT, 'maige-bot/ops/.tools-test-data');
const fakeOutputs = mkdtempSync(join(tmpdir(), 'maige-tools-out-'));
rmSync(dataDir, { recursive: true, force: true });

const { start } = await import(join(ROOT, 'miniapps/maige-bot/miniapp/node/server.mjs'));
const ac = new AbortController();
const base = 'http://127.0.0.1:18323';
const life = await start({
  pluginRoot: join(ROOT, 'miniapps/maige-bot'),
  dataDir,
  listen: { host: '127.0.0.1', port: 18323 },
  signal: ac.signal,
  logger: { info() {}, warn() {} },
});

let failed = 0;
function check(name, cond, extra) {
  if (cond) console.log('PASS', name, extra ?? '');
  else { failed++; console.error('FAIL', name, extra ?? ''); }
}

// 作品库改指到临时目录，不写真实 maige-outputs
await fetch(base + '/api/config', {
  method: 'PUT', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ outputsDir: fakeOutputs }),
});

async function sendAndWait(text) {
  // 记录发送前的基线，避免读到上一轮的旧消息
  const before = await (await fetch(base + '/api/chat/messages?conv=chief')).json();
  const beforeLastId = before.messages.length ? before.messages[before.messages.length - 1].id : 0;
  const beforeAgents = before.messages.filter((m) => m.kind === 'agent').length;
  await fetch(base + '/api/chat/send', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ conv: 'chief', text }),
  });
  const deadline = Date.now() + 120000;
  const started = Date.now();
  let sawTyping = false;
  let lastToolCount = 0;
  for (;;) {
    const d = await (await fetch(base + '/api/chat/messages?conv=chief')).json();
    const fresh = d.messages.filter((m) => m.id > beforeLastId);
    const tools = fresh.filter((m) => m.kind === 'system' && m.name === '工具');
    const agents = d.messages.filter((m) => m.kind === 'agent');
    if (d.typing) sawTyping = true;
    if (tools.length !== lastToolCount) {
      lastToolCount = tools.length;
      console.log('  [工具]', tools[tools.length - 1].text.slice(0, 80).replace(/\n/g, ' ⏎ '));
    }
    // 回合结束：出现了新的 agent 回复，且当前没人输入（typing 至少亮过一次或已等够启动窗口）
    if (agents.length > beforeAgents && !d.typing && (sawTyping || Date.now() - started > 8000)) {
      return { messages: fresh, tools, agents };
    }
    if (Date.now() > deadline) throw new Error('timeout: ' + text.slice(0, 30));
    await new Promise((r) => setTimeout(r, 2000));
  }
}

try {
  console.log('== READ：让麦格读 README ==');
  const r1 = await sendAndWait('用 READ 工具读一下 maige-bot/README.md，然后告诉我这个文件第一行写的是什么。');
  check('chief used READ tool', r1.tools.some((m) => m.text.includes('读了 maige-bot/README.md')));
  check('chief replied after read', r1.agents.length >= 1);
  console.log('  [麦格]', r1.agents[r1.agents.length - 1].text.slice(0, 100));

  console.log('== WRITE：让麦格写个作品 ==');
  const r2 = await sendAndWait('用 WRITE 工具写一首四句的打工摸鱼小诗，文件名 cheer.md。写完用一句话告诉我写了什么。');
  check('chief used WRITE tool', r2.tools.some((m) => m.text.includes('cheer.md')));
  const poem = join(fakeOutputs, 'cheer.md');
  check('cheer.md landed in outputs', existsSync(poem));
  if (existsSync(poem)) {
    const c = readFileSync(poem, 'utf8');
    check('poem has ≥4 lines', c.trim().split('\n').filter(Boolean).length >= 4, `${c.trim().split('\n').length} lines`);
    console.log('  [cheer.md]\n' + c.trim().split('\n').map((l) => '    ' + l).join('\n'));
  }

  console.log('== SEARCH：让麦格自己搜 ==');
  const r3 = await sendAndWait('用 SEARCH 工具搜「MiniMax 港股」，一句话告诉我搜到了什么。');
  const sawToolSearch = r3.tools.some((m) => m.text.includes('搜索「MiniMax 港股」'));
  const sawAutoSearch = r3.messages.some((m) => m.kind === 'system' && m.name === '联网搜索' && m.text.includes('搜到'));
  check('search happened (bot tool or user trigger)', sawToolSearch || sawAutoSearch,
    sawToolSearch ? 'bot [[SEARCH]]' : sawAutoSearch ? 'user-trigger' : 'none');
  console.log('  [麦格]', r3.agents[r3.agents.length - 1].text.slice(0, 120));

  console.log('== TASK：让麦格开整活单 ==');
  const r4 = await sendAndWait('用 TASK 工具给我开一张整活单：image 类型，标题「落日海报」，内容里写一句需求和一段完整提示词。');
  const taskToolMsg = r4.tools.find((m) => m.text.includes('开了整活单'));
  check('chief used TASK tool', !!taskToolMsg, taskToolMsg && taskToolMsg.text.slice(0, 60));
  const tasks = await (await fetch(base + '/api/tasks')).json();
  const filed = tasks.items.find((x) => x.title === '落日海报');
  check('task listed as draft', !!filed && filed.status === 'draft' && filed.kind === 'image');
  if (filed) {
    console.log('  [整活单]\n' + filed.body.slice(0, 200).split('\n').map((l) => '    ' + l).join('\n'));
    await fetch(base + '/api/tasks?id=' + filed.id, { method: 'DELETE' }); // 清理测试单
  }
} finally {
  await life.dispose();
  rmSync(dataDir, { recursive: true, force: true });
  rmSync(fakeOutputs, { recursive: true, force: true });
}

console.log(failed === 0 ? 'ALL_PASS' : `${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
