// 工具执行层：把 bot 回复里的 [[...]] 指令落成真实动作。
// execTool 需要访问运行时状态（配置/会话/成员），所以用工厂注入，保持模块本身无全局状态。

import { readFile, readdir, stat, writeFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import * as minimax from '../minimax.mjs';
import { resolveWorkspace } from './fs.mjs';
import { chatModelsOf } from './host.mjs';
import { NON_CHAT_MODEL } from './llm.mjs';
import { MAX_TOKENS_LIMIT } from './roles.mjs';
import { TASK_KINDS, AUTO_READY_KINDS } from './tasks.mjs';

/**
 * @param {object} deps
 * @param {() => any} deps.getConfig            取当前配置（可被 PUT /api/config 动态替换）
 * @param {(patch: object) => Promise<any>} deps.updateConfig  合并保存配置并返回新配置
 * @param {object} deps.context                 MiniApp 上下文（logger）
 * @param {Function} deps.appendMessage
 * @param {Function} deps.getMembers
 * @param {Function} deps.hireBot
 * @param {Function} deps.writeTask
 * @param {Function} deps.notify
 * @param {Function} deps.webSearch
 * @param {() => any[]} deps.listProviders     可用 provider 列表（自带模型）
 * @param {Function} deps.splitModelRef         'provider/model' 解析
 * @param {Function} deps.joinModelRef         拼回引用格式
 * @param {string} deps.workspaceRoot
 */
export function createToolExecutor(deps) {
  const {
    getConfig, updateConfig, context, appendMessage, getMembers,
    hireBot, writeTask, notify, webSearch, workspaceRoot,
    listProviders, splitModelRef, joinModelRef,
  } = deps;

  /** 执行工具：读/列限定工作区，写只进作品库，搜索走 webSearch。返回 { note } */
  return async function execTool(tool, speakerName, convId) {
    const config = getConfig();
    try {
      if (tool.name === 'search') {
        const found = await webSearch(tool.arg);
        if (!found) return { note: `${speakerName} 搜索「${tool.arg}」失败（几个搜索源都没通）` };
        const { engine, items: results } = found;
        // 搜索结果贴成卡片直接可见（不止转述），链接可点
        await appendMessage(convId, 'system', '搜索', '', 'card', undefined, {
          type: 'search', query: tool.arg,
          items: results.map((r) => ({ title: r.title, snippet: r.snippet, url: r.url })),
        });
        return {
          note: `${speakerName} 搜索「${tool.arg}」（来自${engine}），搜到 ${results.length} 条：\n`
            + results.map((r, i) => `${i + 1}. ${r.title}\n${r.snippet}\n${r.url}`).join('\n'),
        };
      }
      if (tool.name === 'read') {
        const target = await resolveWorkspace(workspaceRoot, tool.arg);
        if (!target) return { note: `${speakerName} 读 ${tool.arg} 被拒：不在工作区内` };
        const st = await stat(target);
        if (!st.isFile()) return { note: `${speakerName} 读 ${tool.arg} 失败：不是文件` };
        if (st.size > 256 * 1024) return { note: `${speakerName} 读 ${tool.arg} 被拒：文件太大（${Math.round(st.size / 1024)} KB > 256 KB）` };
        const content = await readFile(target, 'utf8');
        const truncated = content.length > 4000;
        return {
          note: `${speakerName} 读了 ${tool.arg}（${(st.size / 1024).toFixed(1)} KB${truncated ? '，已截断' : ''}）：\n`
            + content.slice(0, 4000),
        };
      }
      if (tool.name === 'ls') {
        const target = await resolveWorkspace(workspaceRoot, tool.arg);
        if (!target) return { note: `${speakerName} 列 ${tool.arg} 被拒：不在工作区内` };
        const names = await readdir(target);
        const shown = names.filter((n) => !n.startsWith('.')).slice(0, 100);
        return { note: `${speakerName} 列了 ${tool.arg}（${names.length} 项）：\n` + shown.join('\n') };
      }
      if (tool.name === 'write') {
        // 文件名扁平化：禁路径分隔符与穿越，只落在作品库根
        const fname = tool.arg.replace(/[/\\]/g, '').replace(/^\.+/, '').trim();
        if (!fname || fname.length > 120) return { note: `${speakerName} 写文件被拒：文件名不合法` };
        if (!tool.content) return { note: `${speakerName} 写 ${fname} 失败：没有内容` };
        if (tool.content.length > 100 * 1024) return { note: `${speakerName} 写 ${fname} 被拒：内容超过 100 KB` };
        const dir = await realpath(config.outputsDir).catch(() => null);
        if (!dir) return { note: `${speakerName} 写文件失败：作品库目录不存在` };
        await writeFile(join(dir, fname), tool.content, 'utf8');
        context.logger.info('maige-bot.tool.write');
        // 作品内容贴成卡片直接可见（截断预览，全文在作品库）
        const preview = tool.content.length > 2000 ? tool.content.slice(0, 2000) + '\n…（全文在作品库）' : tool.content;
        await appendMessage(convId, 'system', '作品', '', 'card', undefined, {
          type: 'work', name: fname, body: preview, size: `${(tool.content.length / 1024).toFixed(1)} KB`,
        });
        return { note: `${speakerName} 写了作品「${fname}」（${(tool.content.length / 1024).toFixed(1)} KB），已贴在上面、也进了作品库` };
      }
      if (tool.name === 'task') {
        if (!tool.arg) return { note: `${speakerName} 开整活单失败：没有标题` };
        if (!tool.content) return { note: `${speakerName} 开整活单失败：没有需求内容` };
        const kind = TASK_KINDS.includes(tool.kind) ? tool.kind : 'text';
        const autoReady = AUTO_READY_KINDS.includes(kind); // 非敏感类型直通 ready，Mike 在看板上仍可退回/取消
        const id = `t-${Date.now().toString(36)}`;
        await writeTask({
          id, title: tool.arg.slice(0, 80), kind, status: autoReady ? 'ready' : 'draft',
          created: new Date().toISOString(), updated: '', createdBy: speakerName, conv: convId,
          deliverables: [], body: tool.content,
        });
        context.logger.info('maige-bot.task.created');
        // 整活单贴成卡片直接可见（结构由服务端给，文案由客户端按语言渲染）
        const taskPreview = tool.content.length > 600 ? tool.content.slice(0, 600) + '\n…' : tool.content;
        await appendMessage(convId, 'system', '整活单', '', 'card', undefined, {
          type: 'task', title: tool.arg.slice(0, 60), kind, status: autoReady ? 'ready' : 'draft',
          body: taskPreview,
        });
        if (autoReady) {
          notify('麦格 · 新整活单', `${speakerName} 开了「${tool.arg.slice(0, 40)}」（${kind}），已就绪可直接制作`);
          return { note: `${speakerName} 开了整活单「${tool.arg}」（${kind}，已就绪免确认），已贴在上面，点开始即制作` };
        }
        notify('麦格 · 新整活单', `${speakerName} 开了「${tool.arg.slice(0, 40)}」，等你确认提示词`);
        return { note: `${speakerName} 开了整活单「${tool.arg}」（待确认），已贴在上面` };
      }
      if (tool.name === 'hire') {
        const r = await hireBot({ key: tool.arg, display: tool.display, role: tool.role, persona: tool.content, createdBy: speakerName });
        if (r.error === 'key_exists') return { note: `${speakerName} 想招 ${tool.display}，但 ${tool.arg} 这个工位已经有人了` };
        if (r.error) return { note: `${speakerName} 招聘失败：${r.error}` };
        notify('麦格 · 新成员入职', `${tool.display}（${tool.role}）`);
        return { note: `新成员 ${tool.display} 已入职（${tool.role}），侧栏可见，可单聊、可进群` };
      }
      if (tool.name === 'config') {
        // 自治边界：麦格不能改自己的配置（防自我开挂）；只能改团队真实成员；值仍走白名单校验
        if (tool.arg === 'maige') return { note: `${speakerName} 不能改自己的配置（防自我开挂），要改麦格得 Mike 来` };
        const members = await getMembers();
        if (!members.some((m) => m.key === tool.arg)) return { note: `${speakerName} 想配的 ${tool.arg} 不在团队里` };
        const providers = listProviders();
        const defId = providers.find((p) => !p.builtin)?.id || providers[0]?.id || '';
        const nextModels = { ...(config.models || {}) };
        const nextMaxTokens = { ...(config.maxTokens || {}) };
        if (tool.field === 'maxTokens') {
          const n = parseInt(tool.value, 10);
          if (!Number.isInteger(n) || n < 128 || n > MAX_TOKENS_LIMIT) return { note: `${speakerName} 给 ${tool.arg} 配的 maxTokens「${tool.value}」越界（128~${MAX_TOKENS_LIMIT}）` };
          nextMaxTokens[tool.arg] = n;
        } else if (tool.field === 'model') {
          // 值格式 'provider/model'（也接受裸 model id → 落到默认 provider）
          const parsed = splitModelRef(tool.value, defId);
          const provider = providers.find((p) => p.id === parsed.providerId);
          if (!provider) return { note: `${speakerName} 想用的模型服务「${parsed.providerId}」不存在` };
          const chatModels = chatModelsOf(provider, NON_CHAT_MODEL);
          if (chatModels.length && !chatModels.includes(parsed.model)) {
            return { note: `${speakerName} 给 ${tool.arg} 配的模型「${parsed.model}」不在 ${provider.name} 的模型列表里` };
          }
          nextModels[tool.arg] = joinModelRef(provider.id, parsed.model);
        }
        await updateConfig({ models: nextModels, maxTokens: nextMaxTokens });
        context.logger.info('maige-bot.bot.config-by-chief');
        const after = tool.field === 'maxTokens' ? nextMaxTokens[tool.arg] : nextModels[tool.arg];
        return { note: `${speakerName} 把 ${tool.arg} 的 ${tool.field} 调成了 ${after}` };
      }
      if (tool.name === 'generate_image' || tool.name === 'speak') {
        const apiKey = minimax.resolveApiKey(process.env, config.minimaxApiKey);
        if (!apiKey) return { note: `${speakerName} 想生成${tool.name === 'generate_image' ? '图' : '语音'}，但 MiniMax API key 还没配（Mike 在设置里填一下）` };
        const dir = await realpath(config.outputsDir).catch(() => null);
        if (!dir) return { note: `${speakerName} 生成失败：作品库目录不存在` };
        if (tool.name === 'generate_image') {
          const r = await minimax.generateImage(apiKey, tool.arg);
          const url = r.imageUrls[0];
          const imgBuf = await (await fetch(url)).arrayBuffer();
          const fname = `gen-${Date.now().toString(36)}.jpg`;
          await writeFile(join(dir, fname), Buffer.from(imgBuf));
          context.logger.info('maige-bot.tool.generate_image');
          // 把图直接贴进聊天（media 字段），不止一句"画好了"
          const mediaUrl = `/api/outputs/file?name=${encodeURIComponent(fname)}`;
          await appendMessage(convId, 'system', '生成', '', 'media', undefined, { kind: 'image', url: mediaUrl, name: fname });
          return { note: `${speakerName} 生成了图「${fname}」，已贴在上面、也进了作品库` };
        }
        const r = await minimax.synthesizeSpeech(apiKey, tool.arg);
        if (!r.audioHex) return { note: `${speakerName} 语音生成走了异步，暂不支持，先这样吧` };
        const fname = `tts-${Date.now().toString(36)}.mp3`;
        await writeFile(join(dir, fname), Buffer.from(r.audioHex, 'hex'));
        context.logger.info('maige-bot.tool.speak');
        const mediaUrl = `/api/outputs/file?name=${encodeURIComponent(fname)}`;
        await appendMessage(convId, 'system', '生成', '', 'media', undefined, { kind: 'audio', url: mediaUrl, name: fname });
        return { note: `${speakerName} 配了音「${fname}」，已贴在上面、也进了作品库` };
      }
      return { note: `${speakerName} 调了个不认识的工具` };
    } catch (e) {
      deps.logError('tool', `${speakerName} ${tool.name}: ${e.message}`);
      return { note: `${speakerName} 工具 ${tool.name} 出错了：${e.message}` };
    }
  };
}