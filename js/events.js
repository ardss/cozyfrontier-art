/* =====================================================================
 * 事件总线 —— 极简 on/off/emit（零依赖，避免循环导入）
 * emit 按「订阅序号 order」升序同步调用订阅者，序号相同按注册先后。
 * 约定事件：
 *   'night'           —— 每日夜间结算后（nightSettlement 已跑完，G.day 已 +1）
 *                        订阅顺序：声望(10) → 音效(20)
 *   'day'             —— 新一天开始（紧跟 night 的所有订阅者之后）
 *                        订阅顺序：村志故事(10) → 远方来信(20)；远航归航与存档由 main.js 在 emit 之后顺序调用
 *   'season'          —— 季节切换（payload = '春'|'夏'|'秋'|'冬'）
 *   'manual-dispatch' —— 玩家手动派工（input.js Input.issueCommand 发出）
 * ===================================================================*/
const subs = new Map();                                 // event -> [{fn, order, seq}]

export const Events = {
  /* 订阅：order 越小越先被调用；返回 fn 便于 off */
  on(event, fn, order = 100) {
    if (!subs.has(event)) subs.set(event, []);
    subs.get(event).push({ fn, order, seq: subs.get(event).length });
    return fn;
  },
  off(event, fn) {
    const list = subs.get(event);
    if (!list) return;
    const i = list.findIndex(s => s.fn === fn);
    if (i >= 0) list.splice(i, 1);
  },
  emit(event, payload) {
    const list = subs.get(event);
    if (!list || !list.length) return;
    for (const { fn } of [...list].sort((a, b) => a.order - b.order || a.seq - b.seq)) fn(payload);
  },
};
