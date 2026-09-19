# 开发宪法（DEV_CONSTITUTION.md）— 2026-09-18 起生效

> 本文件是开发流程的唯一规则源。任何改动（包括子代理任务书）必须引用并遵守。

## 1. 数据源唯一性
- **官网（F:\CozyFrontier\website\）= 唯一数据源**：系统状态、数值、机制描述以官网为准；改了游戏必须同步官网（同一次提交内）。
- **数值真源 = art-deploy/src/config.ts**；官网数据文件由它对码。

## 2. 构建与源码
- 源码只存在于 **src/*.ts**（TypeScript）。js/ 目录只有构建产物 **js/bundle.js** 与 **js/vendor/**（第三方库）。
- **禁止**在 js/ 下手写源码、禁止复制模块成 *v2/*new 等并行副本、禁止保留死文件。
- 改源码后必须 `npm run build`；提交由 pre-commit hook 强制执行 typecheck + build。

## 3. 提交门槛（pre-commit hook 自动执行）
1. `src/*.ts` 单文件 ≤600 行
2. `npx tsc --noEmit` 零错误
3. `npm run build` 成功，bundle 随提交更新
4. 提交前人工/自动跑 `bash scripts/smoke.sh`（7 项不变量：零报错/零真外网请求/零404/世界生成/3村民/点空地/存档）

## 4. 架构规则
- 跨模块通知一律走 **src/events.ts** 事件总线（on/emit），禁止闭包包装链。
- "扫描+派工"类逻辑一律注册到 **src/jobs.ts** 的 JobSource，禁止各系统自起 setInterval。
- DOM 引用集中且元素被删时必须同步删引用（ui 层元素 id 清单见 mvp.html）。
- 程序化模型建筑不设 glb 字段（见 config.ts PROG_IDS）。

## 5. 资产与视觉
- 图标/视觉 DNA：website/ICONS-STYLE.md（watercolor storybook · moss green + wheat gold · pure flat cream），UI 与新资产不得漂移。
- 3D 资产规范：docs/ART_PIPELINE.md。
- UI 采纳方向：ui-kit.html 中 G1+H1（待实现换装）。

## 6. 测试
- 任何"我测过了"必须附带 `bash scripts/smoke.sh` 全过的输出。
- 数值/机制改动后同步官网，并在提交信息中注明"官网已同步"。

## 7. 质量台账（ISSUES.md）
- 任何新发现的问题（审查/玩家反馈/自查）**必须先登记到 ISSUES.md 再修**，禁止只在对话里口头记录。
- 修复后必须勾销台账条目并注明提交号；未登记的问题视同不存在，不接受"顺手修了没记录"。
- **台账 P0 未清零时，禁止开新功能**；P1 累计 ≥5 条时，下一轮必须先做清理轮。
- 每轮开发结束的标准三审：代码架构审查 / 玩法数值实测审查 / 官网一致性审查（可并行子代理），新发现全部进台账。

## 8. 违例处置
- hook 拦截 = 提交被拒，不允许 --no-verify 绕过；确需豁免单文件行数时写入 .git/HOOK_EXEMPT（仅限第三方 vendored 代码）。
