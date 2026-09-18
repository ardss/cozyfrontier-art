#!/bin/bash
# 不变量冒烟测试：零报错/零真外网请求/零404/世界生成/点选/存档
# 用法: bash scripts/smoke.sh  (需 localhost:8777 已启动)
set -u
BASE=${1:-http://localhost:8777/mvp.html}
FAIL=0
agent-browser close --all >/dev/null 2>&1; sleep 1
agent-browser open "$BASE?v=smoke-$(date +%s)" >/dev/null && sleep 8
agent-browser find text "开 始 新 生 活" click >/dev/null && sleep 5
num() { agent-browser eval "$1" | tr -d '"' | tr -d '\r' | tr -cd '0-9-'; }
check() { if [ "$2" = "$3" ]; then echo "PASS $1 = $2"; else echo "FAIL $1 = $2 (期望 $3)"; FAIL=1; fi; }
check "运行时JS错误数" "$(num '(window.__errs||[]).length')" "0"
EXT=$(agent-browser network requests 2>/dev/null | grep "GET http" | grep -vc "http://localhost")
check "真外网请求数" "$EXT" "0"
N404=$(agent-browser network requests 2>/dev/null | grep -cE "\) 404")
check "404请求数" "$N404" "0"
NAT=$(num "window.__G?window.__G.nature.length:0")
if [ "$NAT" -gt 50 ] 2>/dev/null; then echo "PASS 自然物生成 = $NAT (>50)"; else echo "FAIL 自然物生成 = $NAT (期望 >50)"; FAIL=1; fi
check "开局村民数" "$(num "window.__G?window.__G.villagers.length:0")" "3"
agent-browser mouse move 400 200 >/dev/null; agent-browser mouse down >/dev/null; agent-browser mouse up >/dev/null; sleep 0.5
check "点空地后错误数" "$(num '(window.__errs||[]).length')" "0"
SV=$(agent-browser eval "(()=>{document.getElementById('btn-save').click(); return localStorage.getItem('cf_save_v1')?1:0})()" | tr -d '"')
check "存档写入" "$SV" "1"
if [ "$FAIL" = "0" ]; then echo "—— 冒烟全过 ——"; else echo "—— 冒烟失败 ——"; exit 1; fi
