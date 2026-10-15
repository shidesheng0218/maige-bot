#!/bin/bash
# 构建 麦格总部.app：独立 GUI 壳（本地服务 + 无地址栏窗口），全部用 macOS 自带工具，零依赖。
# 用法：bash maige-bot/ops/build-app.sh
set -euo pipefail

ROOT="${MAIGE_ROOT:-$HOME/Documents/minimax项目}"
APP="$ROOT/麦格总部.app"
ICON_SRC="$ROOT/maige-outputs/icons-v2/maige.jpg"

echo "== 清理旧构建 =="
if [ -d "$APP" ]; then
  if [ -x "$HOME/.minimax/bin/mavis-trash" ]; then
    "$HOME/.minimax/bin/mavis-trash" -- "$APP"
  else
    rm -rf "$APP"
  fi
fi

mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

echo "== Info.plist =="
VERSION=$(python3 -c "import json;print(json.load(open('$ROOT/miniapps/maige-hq/.minimax-plugin/plugin.json'))['version'])")
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>麦格总部</string>
  <key>CFBundleDisplayName</key><string>麦格总部</string>
  <key>CFBundleIdentifier</key><string>com.maige.hq</string>
  <key>CFBundleVersion</key><string>$VERSION</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>maige-hq</string>
  <key>CFBundleIconFile</key><string>maige</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST

echo "== 启动器 =="
cat > "$APP/Contents/MacOS/maige-hq" <<'LAUNCH'
#!/bin/bash
# 麦格总部.app 启动器：服务没在跑就起服务，然后开窗口（Chrome app 模式优先，否则默认浏览器）
ROOT="${MAIGE_ROOT:-$HOME/Documents/minimax项目}"
PORT=17878
URL="http://127.0.0.1:$PORT/panel"
DATA="$ROOT/maige-bot/data/standalone"

NODE_BIN="$(command -v node || true)"
for c in /opt/homebrew/bin/node /usr/local/bin/node; do
  [ -x "$c" ] && NODE_BIN="$c" && break
done
if [ -z "$NODE_BIN" ]; then
  osascript -e 'display alert "麦格总部需要 Node.js" message "未找到 node，请先安装 Node.js。"' 2>/dev/null || true
  exit 1
fi

if ! curl -s --max-time 1 "http://127.0.0.1:$PORT/api/info" >/dev/null 2>&1; then
  mkdir -p "$DATA"
  nohup "$NODE_BIN" "$ROOT/miniapps/maige-hq/miniapp/node/standalone.mjs" >> "$DATA/server.log" 2>&1 &
  for _ in $(seq 1 40); do
    curl -s --max-time 1 "http://127.0.0.1:$PORT/api/info" >/dev/null 2>&1 && break
    sleep 0.25
  done
fi

if [ -d "/Applications/Google Chrome.app" ]; then
  open -na "Google Chrome" --args --app="$URL"
else
  open "$URL"
fi
LAUNCH
chmod +x "$APP/Contents/MacOS/maige-hq"

echo "== 图标（orb → icns）=="
ICONSET="$(mktemp -d)/maige.iconset"
mkdir -p "$ICONSET"
for size in 16 32 128 256 512; do
  sips -s format png -z "$size" "$size" "$ICON_SRC" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  sips -s format png -z "$double" "$double" "$ICON_SRC" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/maige.icns"

echo "== 完成 =="
echo "$APP"
echo "双击即可启动；也可以拖进 Dock 或从 Spotlight 搜「麦格总部」。"
