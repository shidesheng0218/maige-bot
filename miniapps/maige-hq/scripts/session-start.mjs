// maige-bot SessionStart hook
// 读取 stdin 的事件 JSON，注入「麦格已就位」的上下文，然后退出。
// 升级：同时注入麦格的最近记忆（非敏感，最新 5 条）与「提示词就绪」的整活单，
// 让 MCode 会话与麦格总部面板共享记忆与任务。任何读取失败都退化为静态文案，不影响会话。

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const HOME = process.env.HOME || homedir();
const MAIGE_ROOT = process.env.MAIGE_ROOT || join(HOME, "Documents", "minimax项目");
const MEMORY_DIR = process.env.MAIGE_MEMORY_DIR || join(MAIGE_ROOT, "maige-bot", "memory");
const TASKS_DIR = process.env.MAIGE_TASKS_DIR || join(MAIGE_ROOT, "maige-bot", "tasks");

function parseFrontmatter(raw) {
  const out = {};
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return out;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (kv) out[kv[1].toLowerCase()] = kv[2].trim();
  }
  return out;
}

async function recentMemories() {
  try {
    const names = (await readdir(MEMORY_DIR)).filter((n) => n.endsWith(".md"));
    const items = [];
    for (const name of names) {
      try {
        const fm = parseFrontmatter(await readFile(`${MEMORY_DIR}/${name}`, "utf8"));
        if (fm.sensitive === "true") continue; // 敏感记忆两道门：不进自动注入
        items.push({ name: fm.name || name, description: fm.description || "", date: fm.date || "" });
      } catch { /* 单条失败跳过 */ }
    }
    items.sort((a, b) => b.date.localeCompare(a.date));
    return items.slice(0, 5);
  } catch {
    return [];
  }
}

async function readyTasks() {
  try {
    const names = (await readdir(TASKS_DIR)).filter((n) => n.endsWith(".md"));
    const items = [];
    for (const name of names) {
      try {
        const fm = parseFrontmatter(await readFile(`${TASKS_DIR}/${name}`, "utf8"));
        if (fm.status === "ready") items.push({ title: fm.title || name, kind: fm.kind || "text", id: fm.id || name });
      } catch { /* 单张失败跳过 */ }
    }
    return items;
  } catch {
    return [];
  }
}

let input = "";
process.stdin.on("data", (chunk) => {
  input += chunk;
});

process.stdin.on("end", async () => {
  let context =
    "全能 bot「麦格」(maige-bot 插件) 已就位。当用户以「麦格」「maige」称呼发起请求，或进行闲聊吐槽、热点锐评、情绪倾诉、决策纠结、全能问答时，加载 maige-persona 技能以麦格人格回应；当用户要求生成图片/梗图/表情包/视频/语音/音乐时说「整活」类需求，加载 maige-studio 技能执行。";

  try {
    const [mems, tasks] = await Promise.all([recentMemories(), readyTasks()]);
    if (mems.length) {
      context +=
        "\n\n麦格记住的事（来自麦格总部，自然使用、不要背诵）：\n" +
        mems.map((m) => `- ${m.name}：${m.description}`).join("\n");
    }
    if (tasks.length) {
      context +=
        "\n\n待制作的整活单（提示词已就绪，用户提到时就开工；任务文件在 maige-bot/tasks/，做完把状态改成 done 并填交付物）：\n" +
        tasks.map((t) => `- [${t.kind}] ${t.title}（${t.id}）`).join("\n");
    }
  } catch {
    // 读取失败不阻塞注入
  }

  const out = {
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: context,
    },
  };
  process.stdout.write(JSON.stringify(out));
});
