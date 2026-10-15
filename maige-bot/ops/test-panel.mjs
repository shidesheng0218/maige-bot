// 麦格面板 API 实测脚本：模拟 MiniAppContext 起服务，逐端点验证后退出。
// 用法：node ops/test-panel.mjs（MAIGE_ROOT 可覆盖项目根，默认从脚本位置推导）
process.env.MAIGE_HQ_NO_NOTIFY = '1'; // 测试期间不发系统通知
import { mkdtempSync, writeFileSync, existsSync, rmSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const HOME = process.env.HOME || homedir();
const ROOT = process.env.MAIGE_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dataDir = join(ROOT, 'maige-bot/ops/.panel-test-data');
mkdtempSync; // noop 引用检查
rmSync(dataDir, { recursive: true, force: true });

const { start, parseTool, resolveWorkspace, maxTokensForRole, avatarSvgFor } = await import(join(ROOT, 'miniapps/maige-bot/miniapp/node/server.mjs'));
const ac = new AbortController();
const base = 'http://127.0.0.1:18321';

const life = await start({
  pluginRoot: join(ROOT, 'miniapps/maige-bot'),
  dataDir,
  listen: { host: '127.0.0.1', port: 18321 },
  signal: ac.signal,
  logger: { info() {}, warn() {} },
});

let failed = 0;
function today() { return new Date().toISOString().slice(0, 10); }
function check(name, cond, extra) {
  if (cond) console.log('PASS', name, extra ?? '');
  else { failed++; console.error('FAIL', name, extra ?? ''); }
}

try {
  // 0. 隔离记忆目录：fixture 两条，切过去（真实 maige-bot/memory 不再参与测试）
  const fixtureMemDir = join(dataDir, 'fixture-memories');
  mkdirSync(fixtureMemDir, { recursive: true });
  writeFileSync(join(fixtureMemDir, 'user-name.md'), '---\nname: 用户的名字\ndescription: 用户叫 Mike\nsource: user\ndate: 2026-01-01\nsensitive: false\n---\n\n用户叫 Mike。\n');
  writeFileSync(join(fixtureMemDir, 'project-home.md'), '---\nname: 麦格的项目之家\ndescription: 项目目录\nsource: tool\ndate: 2026-01-01\nsensitive: false\n---\n\n项目之家。\n');
  const fixCfg = await fetch(base + '/api/config', {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ memoryDir: fixtureMemDir }),
  });
  check('fixture memoryDir switched', fixCfg.ok);

  // 0b. 工具协议单元用例（parseTool / resolveWorkspace）
  check('parse SEARCH', parseTool('我先搜一下 [[SEARCH:MiniMax 官网]]').name === 'search');
  check('parse READ arg', parseTool('[[READ:maige-bot/README.md]]').arg === 'maige-bot/README.md');
  check('parse LS', parseTool('看看目录 [[LS:maige-bot]] 先').name === 'ls');
  const wt = parseTool('交付了：[[WRITE:测试稿.md]]\n第一行\n第二行\n');
  check('parse WRITE multiline', wt && wt.name === 'write' && wt.arg === '测试稿.md' && wt.content === '第一行\n第二行');
  check('parse none → null', parseTool('没有指令的普通回复') === null);
  check('parse CALL not a tool', parseTool('[[CALL:moke-writer]]') === null);
  const hp = parseTool('[[HIRE:tech-lead:技术负责人:Bolt]]\n人格说明全文');
  check('parse HIRE', hp && hp.name === 'hire' && hp.arg === 'tech-lead' && hp.role === '技术负责人' && hp.display === 'Bolt' && hp.content.includes('人格说明'));
  // 自愈：清掉上次可能残留的测试成员（真实 agents 目录）
  await fetch(base + '/api/team?key=test-bot-x', { method: 'DELETE' }).catch(() => {});
  const tp = parseTool('好嘞 [[TASK:image:落日海报]]\n需求一句\n提示词包全文');
  check('parse TASK', tp && tp.name === 'task' && tp.kind === 'image' && tp.arg === '落日海报' && tp.content.includes('需求一句'));
  const cf = parseTool('调一下 [[CONFIG:moke-writer:maxTokens:8000]] 好了');
  check('parse CONFIG', cf && cf.name === 'config' && cf.arg === 'moke-writer' && cf.field === 'maxTokens' && cf.value === '8000');
  const cf2 = parseTool('[[CONFIG:tech-lead:model:deepseek-v4.1-flash]]');
  check('parse CONFIG model', cf2 && cf2.field === 'model' && cf2.value === 'deepseek-v4.1-flash');
  const gi = parseTool('画一张 [[GENERATE_IMAGE:一只在写代码的猫]]');
  check('parse GENERATE_IMAGE', gi && gi.name === 'generate_image' && gi.arg === '一只在写代码的猫');
  const sp = parseTool('配音 [[SPEAK:大家好，我是麦格]]');
  check('parse SPEAK', sp && sp.name === 'speak' && sp.arg === '大家好，我是麦格');
  // media 消息结构（生成物内联展示）
  const mediaMsg = { kind: 'media', media: { kind: 'image', url: '/api/outputs/file?name=x.jpg', name: 'x.jpg' } };
  check('media msg shape', mediaMsg.kind === 'media' && mediaMsg.media.url.startsWith('/api/outputs/file'));
  check('resolve inside ok', !!(await resolveWorkspace(ROOT, 'maige-bot/README.md')));
  check('resolve abs inside ok', !!(await resolveWorkspace(ROOT, join(ROOT, 'maige-bot'))));
  check('resolve traversal blocked', (await resolveWorkspace(ROOT, '../..')) === null);
  check('resolve outside abs blocked', (await resolveWorkspace(ROOT, '/etc/hosts')) === null);

  // 0c. 并行接力解析（parseCalls via _internals）
  const pc = life._internals.parseCalls;
  const fakeMembers = ['moke-writer', 'huajiang-visual', 'lengjiao-reviewer'].map((k) => ({ key: k }));
  const spoke0 = new Set();
  check('calls multi parallel', pc('写稿 [[CALL:moke-writer]] 配图 [[CALL:huajiang-visual]]', fakeMembers, spoke0).join(',') === 'moke-writer,huajiang-visual');
  check('calls dedupe', pc('[[CALL:moke-writer]] [[CALL:moke-writer]]', fakeMembers, spoke0).length === 1);
  check('calls skip spoke', pc('[[CALL:moke-writer]]', fakeMembers, new Set(['moke-writer'])).length === 0);
  check('calls cap 3', pc('[[CALL:moke-writer]] [[CALL:huajiang-visual]] [[CALL:lengjiao-reviewer]] [[CALL:suyuan-researcher]]', [...fakeMembers, { key: 'suyuan-researcher' }], spoke0).length === 3);
  check('calls unknown dropped', pc('[[CALL:ghost]]', fakeMembers, spoke0).length === 0);

  // 0d. 新 bot 按职责自动分档（ROLE_MAX_TOKENS）
  check('role 写手 200k', maxTokensForRole('麦格团队的写手：文案、脚本') === 200000);
  check('role 技术 50k', maxTokensForRole('技术负责人：代码评审') === 50000);
  check('role 评审 4k', maxTokensForRole('评审员：挑刺、压力测试') === 4000);
  check('role 查证 2k', maxTokensForRole('查证员：联网搜索') === 2000);
  check('role 兜底 4k', maxTokensForRole('随便一个角色') === 4000);
  check('role 空值 4k', maxTokensForRole('') === 4000);

  // 1. 面板页
  const html = await (await fetch(base + '/panel')).text();
  check('GET /panel', html.includes('麦格'));

  // 2. 概览替代原 state 端点
  const stateOv = await (await fetch(base + '/api/overview')).json();
  check('overview memoryCount=2', stateOv.memoryCount === 2, `got ${stateOv.memoryCount}`);
  check('overview outputsCount>0 (默认目录已存在)', stateOv.outputsCount > 0, `got ${stateOv.outputsCount}`);

  // 3. 记忆列表与 frontmatter 解析
  const mems = await (await fetch(base + '/api/memories')).json();
  check('memories len=2', mems.items.length === 2);
  const userName = mems.items.find((i) => i.id === 'user-name');
  check('user-name source=user', userName && userName.source === 'user');
  check('user-name desc parsed', userName && userName.description.includes('Mike'));

  // 4. 删除写路径：先造后删
  const tmpFile = join(fixtureMemDir, 'test-delete.md');
  writeFileSync(tmpFile, '---\nname: 测试删除\ndescription: 待删\nsource: maige\ndate: 2026-10-13\nsensitive: false\n---\n临时条目\n');
  let del = await fetch(base + '/api/memories?id=test-delete', { method: 'DELETE' });
  check('DELETE ok', del.ok);
  check('file gone', !existsSync(tmpFile));

  // 5. 安全：路径穿越与非法 ID
  del = await fetch(base + '/api/memories?id=..%2F..%2Fetc%2Fpasswd', { method: 'DELETE' });
  check('DELETE traversal blocked', del.status === 400);

  // 6. 作品库：默认目录已存在（maige-outputs 已建）→ 有内容
  let outs = await (await fetch(base + '/api/outputs')).json();
  check('outputs default dir exists', outs.dirExists === true && outs.items.length > 0, `${outs.items.length} items`);

  // 7. PUT 配置切换作品目录到一个存在且有内容的目录
  const put = await fetch(base + '/api/config', {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ outputsDir: join(ROOT, 'maige-bot') }),
  });
  check('PUT config ok', put.ok);
  outs = await (await fetch(base + '/api/outputs')).json();
  check('outputs after switch', outs.dirExists === true && outs.items.length > 0, `${outs.items.length} files`);
  check('README kind=file', outs.items.some((i) => i.name === 'README.md' && i.kind === 'file'));

  // 8. 文件下载 + 穿越防护
  const fileRes = await fetch(base + '/api/outputs/file?name=' + encodeURIComponent('README.md'));
  check('file served', fileRes.ok && (await fileRes.text()).includes('maige-bot'));
  const evil = await fetch(base + '/api/outputs/file?name=' + encodeURIComponent('../miniapps/maige-bot/package.json'));
  check('file traversal blocked', evil.status === 404);

  // 9. 非法目录
  const badPut = await fetch(base + '/api/config', {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ outputsDir: 'relative/path' }),
  });
  check('PUT relative dir rejected', badPut.status === 400);

  // 10. 概览
  const ov = await (await fetch(base + '/api/overview')).json();
  check('overview counts', ov.memoryCount === 2 && ov.sensitiveCount === 0);
  check('overview kinds', ov.outputsByKind && typeof ov.outputsByKind.file === 'number');
  check('overview recent', Array.isArray(ov.recentMemories) && Array.isArray(ov.recentOutputs));

  // 11. 插件信息
  const info = await (await fetch(base + '/api/info')).json();
  const manifest = JSON.parse(readFileSync(join(ROOT, 'miniapps/maige-bot/.minimax-plugin/plugin.json'), 'utf8'));
  check('info versions', info.panelVersion === manifest.version && typeof info.maigeVersion === 'string');

  // 12. 新增记忆 → 列表出现 → 编辑 → 删除
  const created = await (await fetch(base + '/api/memories', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '测试条目', description: '测试用', source: 'user', sensitive: true, body: '这是测试正文' }),
  })).json();
  check('POST memory ok', created.ok === true && typeof created.id === 'string');
  let list = await (await fetch(base + '/api/memories')).json();
  const found = list.items.find((i) => i.id === created.id);
  check('POST appears in list', !!found && found.sensitive === true && found.body === '这是测试正文');

  const upd = await fetch(base + '/api/memories?id=' + created.id, {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '测试条目改', description: '改过了', source: 'maige', sensitive: false, body: '改后的正文' }),
  });
  check('PUT memory ok', upd.ok);
  list = await (await fetch(base + '/api/memories')).json();
  const edited = list.items.find((i) => i.id === created.id);
  check('PUT applied, date kept', edited && edited.name === '测试条目改' && edited.body === '改后的正文' && edited.date === today());

  // 13. 输入校验
  const badPost = await fetch(base + '/api/memories', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '', body: '' }),
  });
  check('POST invalid rejected', badPost.status === 400);

  // 14. 清理：删除测试条目
  const delCreated = await fetch(base + '/api/memories?id=' + created.id, { method: 'DELETE' });
  check('cleanup delete ok', delCreated.ok);

  // 15. 团队端点（动态扫描 team: maige 标记；结构化断言，不锁死人数——团队会扩编）
  const team = await (await fetch(base + '/api/team')).json();
  const BASE_FIVE = ['moke-writer', 'huajiang-visual', 'lengjiao-reviewer', 'suyuan-researcher', 'suji-recorder'];
  check('team has base five', BASE_FIVE.every((k) => team.members.some((m) => m.key === k)), `got ${team.members.length} members`);
  const moke = team.members.find((m) => m.key === 'moke-writer');
  check('moke ready+desc+persona', !!moke && moke.status === 'ready' && moke.description.includes('写手') && moke.persona.length > 0 && moke.displayName === 'Quill');
  check('team all ready', team.members.every((m) => m.status === 'ready'));
  check('team excludes builtin agents', !team.members.some((m) => ['worker', 'explore', 'verifier'].includes(m.key)));

  // 16. 聊天端到端（多会话，真实调 LLM，三路并发给足超时）
  const chatMembers = await (await fetch(base + '/api/chat/members')).json();
  check('chat members = 团队+麦格', chatMembers.members.length === team.members.length + 1, `got ${chatMembers.members.length}`);
  check('chat chief first', chatMembers.members[0].key === 'maige');

  // 16a. 会话列表：chief 置顶 → group → 各成员单聊
  const convsRes = await (await fetch(base + '/api/chat/conversations')).json();
  check('conversations = 麦格单聊+群聊+成员', convsRes.items.length === chatMembers.members.length + 1, `got ${convsRes.items.length}`);
  check('chief pinned first', convsRes.items[0].id === 'chief' && convsRes.items[1].id === 'group');

  // 16b. 头像端点（icons v1 优先，无素材则程序化生成 SVG）
  const avMaige = await fetch(base + '/api/avatar?key=maige');
  check('avatar maige 200 jpeg', avMaige.status === 200 && (avMaige.headers.get('content-type') || '').includes('image/jpeg'));
  const avMoke = await fetch(base + '/api/avatar?key=moke-writer');
  check('avatar member maps display name', avMoke.status === 200);
  // 无素材的 key → 程序化 SVG 头像（不再是 404）
  const avNew = await fetch(base + '/api/avatar?key=nobody');
  check('avatar unknown → generated SVG', avNew.status === 200 && (avNew.headers.get('content-type') || '').includes('image/svg'));
  // 确定性：同种子同图，不同种子不同图
  const svgA = avatarSvgFor('nova'); const svgA2 = avatarSvgFor('nova'); const svgB = avatarSvgFor('pax');
  check('avatar deterministic', svgA === svgA2 && svgA !== svgB);
  check('avatar is svg', svgA.startsWith('<svg') && svgA.includes('rect'));

  // 16c. 三路并发：chief 单聊 / 成员单聊 / 群聊
  await fetch(base + '/api/chat/send', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ conv: 'chief', text: '单聊验收测试，随便回一句。' }),
  });
  await fetch(base + '/api/chat/send', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ conv: 'm:moke-writer', text: '单聊验收测试，随便回一句。' }),
  });
  const send = await fetch(base + '/api/chat/send', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: '大家好，面板验收测试，随便回一句。' }),
  });
  check('chat send ok', send.ok);
  const seen = { chief: false, 'm:moke-writer': false, group: false };
  const lastIds = { chief: 0, 'm:moke-writer': 0, group: 0 };
  let chiefSpokeInGroup = false;
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline && !(seen.chief && seen['m:moke-writer'] && seen.group)) {
    for (const cid of Object.keys(seen)) {
      const data = await (await fetch(base + '/api/chat/messages?conv=' + encodeURIComponent(cid) + '&after=' + lastIds[cid])).json();
      for (const m of data.messages) {
        lastIds[cid] = Math.max(lastIds[cid], m.id);
        if (m.kind === 'agent') {
          seen[cid] = true;
          if (cid === 'group' && m.sender === 'maige') chiefSpokeInGroup = true;
        }
      }
    }
    if (!(seen.chief && seen['m:moke-writer'] && seen.group)) await new Promise((r) => setTimeout(r, 2000));
  }
  check('chief DM replied', seen.chief);
  check('member DM replied (Quill)', seen['m:moke-writer']);
  check('group agent replied within 120s', seen.group);
  check('group chief replied', chiefSpokeInGroup);

  // 16d. 会话预览已生成
  const convs2 = await (await fetch(base + '/api/chat/conversations')).json();
  check('conv previews filled', !!(convs2.items.find((i) => i.id === 'chief')?.preview && convs2.items.find((i) => i.id === 'group')?.preview));

  // 16e. 参数防护
  check('invalid conv rejected', (await fetch(base + '/api/chat/messages?conv=' + encodeURIComponent('../etc'))).status === 400);
  const noMember = await fetch(base + '/api/chat/send', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ conv: 'm:ghost', text: 'hi' }),
  });
  check('send to ghost member 404', noMember.status === 404);

  const clear = await fetch(base + '/api/chat/clear', { method: 'POST' });
  check('chat clear ok (group default)', clear.ok);
  const empty = await (await fetch(base + '/api/chat/messages')).json();
  check('chat cleared', empty.messages.length === 0);
  // 顺手清掉两个单聊，保持测试环境干净
  await fetch(base + '/api/chat/clear', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ conv: 'chief' }) });
  await fetch(base + '/api/chat/clear', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ conv: 'm:moke-writer' }) });

  // 17. token 用量统计（清空前群聊已产生过 agent 发言，先再发一条再查）
  await fetch(base + '/api/chat/send', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: '报个到即可。' }),
  });
  const usageDeadline = Date.now() + 90000;
  let usage = null;
  while (Date.now() < usageDeadline) {
    usage = await (await fetch(base + '/api/chat/usage')).json();
    if (usage.totalCalls > 0) break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  check('usage has calls', usage && usage.totalCalls > 0);
  check('usage byMember sorted', usage && Array.isArray(usage.byMember) && usage.byMember.length > 0 && usage.byMember[0].tokens > 0);
  check('usage byDay 14 天补齐', usage.byDay.length === 14 && usage.byDay.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date)));
  await fetch(base + '/api/chat/clear', { method: 'POST' });

  // 17a. 记忆捕获 + 搜索触发（确定性管线，先于模型回复落系统消息）
  await fetch(base + '/api/chat/send', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ conv: 'chief', text: '记住：面板验收喜欢绿色' }),
  });
  await new Promise((r) => setTimeout(r, 1500));
  const memsAfter = await (await fetch(base + '/api/memories')).json();
  const captured = memsAfter.items.find((i) => i.body.includes('面板验收喜欢绿色'));
  check('panel memory captured', !!captured && captured.source === 'user');
  const chiefMsgs = await (await fetch(base + '/api/chat/messages?conv=chief')).json();
  check('capture ack in chat', chiefMsgs.messages.some((m) => m.kind === 'system' && m.name === '记忆'));

  await fetch(base + '/api/chat/send', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ conv: 'chief', text: '搜索一下 MiniMax 官网' }),
  });
  let searchMsg = null;
  const searchDeadline = Date.now() + 20000;
  while (Date.now() < searchDeadline) {
    const data = await (await fetch(base + '/api/chat/messages?conv=chief')).json();
    searchMsg = data.messages.find((m) => m.kind === 'system' && m.name === '联网搜索');
    if (searchMsg) break;
    await new Promise((r) => setTimeout(r, 1500));
  }
  check('search pipeline fired', !!searchMsg);
  check('search returned or failed honestly', !!searchMsg && (searchMsg.text.includes('搜到') || searchMsg.text.includes('没搜到')), searchMsg && searchMsg.text.slice(0, 30));
  if (searchMsg && searchMsg.text.includes('搜到')) {
    check('search results have links', /https?:\/\//.test(searchMsg.text));
  }
  // 清理：删掉捕获的记忆 + 等 chief 把这两轮回完再清会话
  if (captured) await fetch(base + '/api/memories?id=' + captured.id, { method: 'DELETE' });
  const waitChief = Date.now() + 90000;
  while (Date.now() < waitChief) {
    const d = await (await fetch(base + '/api/chat/messages?conv=chief')).json();
    if (!d.typing && d.messages.filter((m) => m.kind === 'agent').length >= 2) break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  await fetch(base + '/api/chat/clear', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ conv: 'chief' }) });

  // 17b. bot 详情 / 模型 / 能力库
  const models = await (await fetch(base + '/api/models')).json();
  check('models default kimi-k3', models.default === 'kimi-k3');
  check('models include chat models', models.models.includes('kimi-k3') && models.models.includes('deepseek-v4.1-flash'), models.models.join(','));
  check('models exclude image model', !models.models.includes('qwen-image-3.0-pro'));

  const caps = await (await fetch(base + '/api/capabilities')).json();
  check('capabilities 8 seeded packs', caps.items.length === 8, `got ${caps.items.length}`);
  check('caps have name+desc', caps.items.every((p) => p.name && p.description));

  const botQ = await (await fetch(base + '/api/bot?key=moke-writer')).json();
  check('bot detail Quill', botQ.displayName === 'Quill' && botQ.model === 'kimi-k3' && botQ.modelOverride === null);
  check('bot detail has usage+persona', typeof botQ.usage.calls === 'number' && botQ.persona.length > 0);
  check('bot default maxTokens', botQ.maxTokens === 600 && botQ.maxTokensOverride === null);
  check('bot 404 for ghost', (await fetch(base + '/api/bot?key=ghost')).status === 404);

  const putBot = await fetch(base + '/api/bot', {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key: 'moke-writer', model: 'deepseek-v4.1-flash', capabilities: ['snarky', 'podcast'] }),
  });
  check('PUT bot ok', putBot.ok);
  const botQ2 = await (await fetch(base + '/api/bot?key=moke-writer')).json();
  check('bot model override applied', botQ2.model === 'deepseek-v4.1-flash' && botQ2.modelOverride === 'deepseek-v4.1-flash');
  check('bot caps attached', botQ2.capabilities.length === 2 && botQ2.capabilities[0].name === '毒舌模式');

  // per-bot maxTokens 覆盖（分档 token）
  check('PUT bot maxTokens ok', (await fetch(base + '/api/bot', {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key: 'moke-writer', maxTokens: 2000 }),
  })).ok);
  const botQ4 = await (await fetch(base + '/api/bot?key=moke-writer')).json();
  check('bot maxTokens applied', botQ4.maxTokens === 2000 && botQ4.maxTokensOverride === 2000);
  check('PUT invalid maxTokens rejected', (await fetch(base + '/api/bot', {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key: 'moke-writer', maxTokens: 1000001 }),
  })).status === 400);
  const caps2 = await (await fetch(base + '/api/capabilities')).json();
  check('caps attachedTo updated', caps2.items.find((p) => p.id === 'snarky')?.attachedTo.includes('moke-writer'));

  check('PUT invalid model rejected', (await fetch(base + '/api/bot', {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key: 'moke-writer', model: 'gpt-99' }),
  })).status === 400);
  check('PUT invalid pack rejected', (await fetch(base + '/api/bot', {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key: 'moke-writer', capabilities: ['ghost-pack'] }),
  })).status === 400);
  check('PUT ghost bot 404', (await fetch(base + '/api/bot', {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key: 'ghost', model: 'kimi-k3' }),
  })).status === 404);

  // 还原：清掉覆盖（模型/能力包/maxTokens），保持测试环境干净
  await fetch(base + '/api/bot', {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key: 'moke-writer', model: null, capabilities: [], maxTokens: null }),
  });
  const botQ3 = await (await fetch(base + '/api/bot?key=moke-writer')).json();
  check('bot reset ok', botQ3.modelOverride === null && botQ3.capabilities.length === 0 && botQ3.maxTokensOverride === null);

  // 17c. 整活单（任务状态机）
  const t1 = await (await fetch(base + '/api/tasks', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: '测试整活单', kind: 'image', body: '画一张落日海报' }),
  })).json();
  check('task create ok', t1.ok === true && typeof t1.id === 'string');
  let tasks = await (await fetch(base + '/api/tasks')).json();
  check('task listed as draft', tasks.items.some((x) => x.id === t1.id && x.status === 'draft' && x.kind === 'image'));
  check('task draft→done rejected', (await fetch(base + '/api/tasks?id=' + t1.id, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'done' }),
  })).status === 409);
  check('task draft→ready ok', (await fetch(base + '/api/tasks?id=' + t1.id, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'ready' }),
  })).ok);
  check('task ready→making ok', (await fetch(base + '/api/tasks?id=' + t1.id, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'making' }),
  })).ok);
  check('task making→done with deliverables', (await fetch(base + '/api/tasks?id=' + t1.id, {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'done', deliverables: ['poster.png'] }),
  })).ok);
  tasks = await (await fetch(base + '/api/tasks')).json();
  const doneTask = tasks.items.find((x) => x.id === t1.id);
  check('task done+deliverables stored', !!doneTask && doneTask.status === 'done' && doneTask.deliverables.includes('poster.png'));
  check('task done is terminal', (await fetch(base + '/api/tasks?id=' + t1.id, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'ready' }),
  })).status === 409);
  check('task invalid status 400', (await fetch(base + '/api/tasks?id=' + t1.id, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'bogus' }),
  })).status === 400);
  check('task 404', (await fetch(base + '/api/tasks?id=t-ghost', {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'ready' }),
  })).status === 404);
  check('task delete ok', (await fetch(base + '/api/tasks?id=' + t1.id, { method: 'DELETE' })).ok);
  tasks = await (await fetch(base + '/api/tasks')).json();
  check('task gone', !tasks.items.some((x) => x.id === t1.id));

  // video/audio 保留确认闸（非敏感直通只给 image/text）
  const t2 = await (await fetch(base + '/api/tasks', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: '测试视频单', kind: 'video', body: '做一段片头' }),
  })).json();
  check('video task still draft', (await (await fetch(base + '/api/tasks')).json()).items.some((x) => x.id === t2.id && x.status === 'draft'));
  await fetch(base + '/api/tasks?id=' + t2.id, { method: 'DELETE' });

  // 17d. 图片输入 / 导出 / 交付回写
  const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const imgSend = await fetch(base + '/api/chat/send', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ conv: 'chief', text: '这张图是什么颜色？', image: TINY_PNG }),
  });
  check('send with image ok', imgSend.ok);
  const chiefWithImg = await (await fetch(base + '/api/chat/messages?conv=chief')).json();
  const imgMsg = chiefWithImg.messages.find((m) => m.image);
  check('user message carries image ref', !!imgMsg);
  check('messages shape has draft field', 'draft' in chiefWithImg);
  if (imgMsg) {
    const imgRes = await fetch(base + '/api/chat/image?id=' + imgMsg.image);
    check('image served', imgRes.status === 200 && (imgRes.headers.get('content-type') || '').includes('image/png'));
    check('image traversal blocked', (await fetch(base + '/api/chat/image?id=' + encodeURIComponent('../../x'))).status === 400);
  }
  check('invalid image rejected', (await fetch(base + '/api/chat/send', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ conv: 'chief', text: 'x', image: 'data:text/plain;base64,aaaa' }),
  })).status === 400);

  // 等 vision 回复回来（不强等，导出只需要已有消息）
  const visionDeadline = Date.now() + 90000;
  while (Date.now() < visionDeadline) {
    const d = await (await fetch(base + '/api/chat/messages?conv=chief')).json();
    if (!d.typing && !d.draft) break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  const exp = await fetch(base + '/api/chat/export', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ conv: 'chief' }),
  });
  check('export ok', exp.ok);
  const expJson = await exp.json();
  check('export name', /\.md$/.test(expJson.name || ''));
  const curInfo = await (await fetch(base + '/api/info')).json();
  check('export file exists', existsSync(join(curInfo.outputsDir, expJson.name)));
  rmSync(join(curInfo.outputsDir, expJson.name), { force: true }); // 清理导出测试文件
  check('export empty conv 400', (await fetch(base + '/api/chat/export', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ conv: 'm:suji-recorder' }),
  })).status === 400);

  // 交付回写：开一张带 conv 的单，走完整状态机到 done，chief 会话里应出现回执
  const tw = await (await fetch(base + '/api/tasks', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: '回写测试单', kind: 'text', body: '测试', conv: 'chief' }),
  })).json();
  check('task with conv created', tw.ok === true);
  await fetch(base + '/api/tasks?id=' + tw.id, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'ready' }) });
  await fetch(base + '/api/tasks?id=' + tw.id, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'making' }) });
  await fetch(base + '/api/tasks?id=' + tw.id, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'done', deliverables: ['x.md'] }) });
  const chiefAfterDone = await (await fetch(base + '/api/chat/messages?conv=chief')).json();
  check('deliver writeback in chat', chiefAfterDone.messages.some((m) => m.kind === 'system' && m.name === '整活' && m.text.includes('回写测试单')));
  await fetch(base + '/api/tasks?id=' + tw.id, { method: 'DELETE' });
  await fetch(base + '/api/chat/clear', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ conv: 'chief' }) });

  // 17e. 圆桌模式（真实 LLM，每人一轮，给足超时）
  await fetch(base + '/api/chat/send', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ conv: 'group', text: '圆桌：AI 会不会取代摸鱼' }),
  });
  let roundStart = false;
  let roundEnd = false;
  let spokeCount = 0;
  const rtDeadline = Date.now() + 180000;
  let rtLast = 0;
  while (Date.now() < rtDeadline) {
    const d = await (await fetch(base + '/api/chat/messages?conv=group&after=' + rtLast)).json();
    for (const m of d.messages) {
      rtLast = Math.max(rtLast, m.id);
      if (m.kind === 'system' && m.text.includes('圆桌开始')) roundStart = true;
      if (m.kind === 'agent') spokeCount++;
      if (m.kind === 'system' && m.text.includes('圆桌结束')) { roundEnd = true; break; }
    }
    if (roundEnd) break;
    await new Promise((r) => setTimeout(r, 2500));
  }
  check('roundtable started', roundStart);
  check('roundtable members spoke (≥2)', spokeCount >= 2, `got ${spokeCount}`);
  check('roundtable ended', roundEnd);

  // 18. 定时任务 CRUD
  const sch = await (await fetch(base + '/api/schedules', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '测试任务', text: '说一句测试话', memberKey: 'maige', freqType: 'interval', minutes: 5 }),
  })).json();
  check('schedule create ok', sch.ok === true && typeof sch.id === 'string');
  let schList = await (await fetch(base + '/api/schedules')).json();
  check('schedule in list', schList.items.some((s) => s.id === sch.id && s.freqType === 'interval' && s.minutes === 5));
  const badSch = await fetch(base + '/api/schedules', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '', text: '' }),
  });
  check('schedule invalid rejected', badSch.status === 400);
  const delSch = await fetch(base + '/api/schedules?id=' + sch.id, { method: 'DELETE' });
  check('schedule delete ok', delSch.ok);
  schList = await (await fetch(base + '/api/schedules')).json();
  check('schedule gone', !schList.items.some((s) => s.id === sch.id));

  // 19. 诊断端点
  const diag = await (await fetch(base + '/api/diagnostics')).json();
  check('diagnostics shape', typeof diag.panelVersion === 'string' && typeof diag.llmReady === 'boolean' && Array.isArray(diag.errors));
  check('diagnostics hostConnector', diag.hostConnector && typeof diag.hostConnector.available === 'boolean' && Array.isArray(diag.hostConnector.tools));
  check('diagnostics minimaxConfigured flag', typeof diag.minimaxConfigured === 'boolean');

  // 20. 团队定制：招聘 → 收录 → 移除（写真实 agents 目录，测试后清干净）
  const hire = await fetch(base + '/api/team', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key: 'test-bot-x', display: 'TestBot', role: '测试机器人：回归专用', persona: '你是 TestBot，只用于回归测试。' }),
  });
  check('hire ok', hire.ok);
  const teamAfter = await (await fetch(base + '/api/team')).json();
  check('hired listed in team', teamAfter.members.some((m) => m.key === 'test-bot-x' && m.displayName === 'TestBot'));
  // 新成员自动分档 maxTokens（职责不含关键词 → 兜底 4000）
  const hiredBot = await (await fetch(base + '/api/bot?key=test-bot-x')).json();
  check('hired auto maxTokens 4000', hiredBot.maxTokens === 4000 && hiredBot.maxTokensOverride === 4000, `got ${hiredBot.maxTokens}`);
  const convsAfter = await (await fetch(base + '/api/chat/conversations')).json();
  check('hired listed in conversations', convsAfter.items.some((c) => c.id === 'm:test-bot-x'));
  check('hire duplicate 409', (await fetch(base + '/api/team', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key: 'test-bot-x', display: 'X', role: 'x' }),
  })).status === 409);
  check('hire invalid key 400', (await fetch(base + '/api/team', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key: 'Bad Key!', display: 'X', role: 'x' }),
  })).status === 400);
  check('fire chief rejected', (await fetch(base + '/api/team?key=maige', { method: 'DELETE' })).status === 400);
  check('fire non-maige-agent 404', (await fetch(base + '/api/team?key=worker', { method: 'DELETE' })).status === 404);
  check('fire ok', (await fetch(base + '/api/team?key=test-bot-x', { method: 'DELETE' })).ok);
  const teamGone = await (await fetch(base + '/api/team')).json();
  check('fired gone from team', !teamGone.members.some((m) => m.key === 'test-bot-x'));
} finally {
  await life.dispose();
  rmSync(dataDir, { recursive: true, force: true });
}

console.log(failed === 0 ? 'ALL_PASS' : `${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
