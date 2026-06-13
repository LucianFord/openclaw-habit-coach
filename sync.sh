#!/bin/bash
# sync.sh — 构建并同步插件到 OpenClaw
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🔨 构建..."
cd "$PROJECT_DIR" && npx tsc

echo "✅ 构建完成"
echo "   入口文件: $PROJECT_DIR/dist/index.js"
echo "   OpenClaw 会自动从 Projects 目录加载插件"
