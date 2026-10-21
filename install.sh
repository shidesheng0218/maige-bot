#!/bin/bash
# 麦格（maige-bot）一键安装：把插件铺到 ~/.minimax/plugins/，铺默认团队 agent，建好目录。
# 用法：git clone <repo> && cd minimax项目 && ./install.sh
# 幂等：重复跑只会更新文件，不会重复创建；--uninstall 卸载。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
MINIMAX_HOME="${MINIMAX_HOME:-$HOME/.minimax}"
PLUGIN_DIR="$MINIMAX_HOME/plugins/maige-bot"
AGENTS_DIR="$MINIMAX_HOME/agents"
MAIGE_ROOT="${MAIGE_ROOT:-$HOME/Documents/minimax项目}"

say() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[✗]\033[0m %s\n' "$*" >&2; exit 1; }

# ---------- 卸载 ----------
if [ "${1:-}" = "--uninstall" ]; then
  say "卸载麦格"
  [ -d "$PLUGIN_DIR" ] && mv "$PLUGIN_DIR" "$PLUGIN_DIR.bak.$(date +%s)" && echo "  插件已备份为 .bak（在 $MINIMAX_HOME/plugins/）"
  for a in huajiang-visual lengjiao-reviewer moke-writer suji-recorder suyuan-researcher tech-lead; do
    [ -d "$AGENTS_DIR/$a" ] && mv "$AGENTS_DIR/$a" "$AGENTS_DIR/$a.bak.$(date +%s)" && echo "  agent $a 已备份"
  done
  say "卸载完成（备份在各目录的 .bak 里，可手动恢复）"
  exit 0
fi

# ---------- 前置检查 ----------
say "前置检查"
command -v node >/dev/null 2>&1 || die "需要 Node.js ≥ 18，请先安装"
NODE_V=$(node -v | sed 's/v//' | cut -d. -f1)
[ "$NODE_V" -ge 18 ] || die "Node 版本太低（$(node -v)），需要 ≥ 18"
if [ -d "$MINIMAX_HOME" ]; then
  echo "  Node $(node -v) · 检测到 MiniMax Code（~/.minimax）"
else
  warn "没检测到 MiniMax Code——插件部分不会生效，但独立面板可用（自带模型即可）"
fi

# ---------- 铺插件 ----------
say "铺插件到 $PLUGIN_DIR"
mkdir -p "$PLUGIN_DIR"
cp -R "$ROOT/miniapps/maige-bot/." "$PLUGIN_DIR/"
echo "  插件文件已铺（skills/hooks/scripts/miniapp/清单）"

# ---------- 铺团队 agent ----------
say "铺默认团队 agent 到 $AGENTS_DIR"
mkdir -p "$AGENTS_DIR"
for a in huajiang-visual lengjiao-reviewer moke-writer suji-recorder suyuan-researcher tech-lead; do
  if [ -d "$AGENTS_DIR/$a" ]; then
    warn "$a 已存在，跳过（不覆盖你已有的）"
  else
    cp -R "$ROOT/maige-bot/seed/agents/$a" "$AGENTS_DIR/$a"
    echo "  $a 已入队"
  fi
done

# ---------- 建运行时目录 ----------
say "建运行时目录"
mkdir -p "$MAIGE_ROOT/maige-bot/memory" "$MAIGE_ROOT/maige-bot/tasks" "$MAIGE_ROOT/maige-outputs"
echo "  $MAIGE_ROOT/maige-bot/{memory,tasks} · $MAIGE_ROOT/maige-outputs"

# ---------- 收尾 ----------
say "完成"
cat <<EOF

  麦格装好了。

  下一步：
  1. 打开 MiniMax Code，新会话生效（叫一声「麦格」）
  2. 配模型（二选一）：
     · 面板里配：打开面板 → 设置 → 模型服务，填 Base URL / API Key / 模型列表
     · 环境变量：export MAIGE_LLM_BASE_URL=... MAIGE_LLM_API_KEY=... MAIGE_LLM_MODELS=...
     任何 OpenAI 兼容服务都行（DeepSeek / Kimi / 通义 / OpenAI / Ollama / vLLM…）
  3. 可选：配 MiniMax API key 解锁文生图/语音——面板设置页填，或：
       curl -X PUT http://127.0.0.1:17878/api/config -H 'content-type: application/json' -d '{"minimaxApiKey":"sk-..."}'
  4. 独立运行（脱离 MCode）：node miniapps/maige-bot/miniapp/node/standalone.mjs
  5. 卸载：./install.sh --uninstall

  项目根默认 \$HOME/Documents/minimax项目，用 MAIGE_ROOT 环境变量覆盖。
  文档：README.md · maige-bot/README.md · maige-bot/AGENTS.md
EOF
