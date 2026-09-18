/* =====================================================================
 * 18. 村民小故事（S25 村志）—— 每天白天随机 12% 概率弹一条温暖小故事，
 *     并给当事村民 +1 个人开心值（个人开心值系统简化：直接 G.happy +0.5，
 *     注释保留语义，后续拆分 v.happy 时改这里即可）。故事写入 G.storyLog
 *     （≤8 条，最新在前），人口面板底部展示「村志」。
 * ===================================================================*/
import { G } from './world';
import { toast } from './ui';
import { Events } from './events';

/* 故事池：{名}=村民名，{特质}=村民特质名；温暖治愈向，20+ 条 */
const POOL = [
  '{名}在河边捡到一块心形石头，偷偷放进了口袋。',
  '{名}想起家乡的桂花，笑了一下。',
  '{名}清晨听见屋檐下麻雀吵架，忍不住乐出了声。',
  '{名}把最好的浆果留了一颗在窗台上，说是给路过的鸟。',
  '{名}午睡时梦见麦子长得比人还高，醒来嘴角还翘着。',
  '{名}在柴堆后发现一窝小猫，轻手轻脚地盖上了干草。',
  '{名}今天烤的面包格外香，路过的风都慢了下来。',
  '{名}把野花别在耳后，被{特质}的自己逗笑了。',
  '{名}数星星数到一半睡着了，梦里全是萤火虫。',
  '{名}教村里的小狗握手，其实它早就会了，只是配合。',
  '{名}在旧木箱里翻出一张地图，画的是小时候的家。',
  '{名}给菜园里的南瓜起了名字，每天都要打招呼。',
  '{名}雨天坐在屋檐下听雨，说这是免费的歌。',
  '{名}把捡来的羽毛插在帽檐上，觉得自己精神极了。',
  '{名}帮邻居修好了篱笆，回来路上一直哼着小调。',
  '{名}在溪边看见自己的倒影，做了个鬼脸。',
  '{名}藏了一罐蜂蜜在床底下，打算冬天犒劳自己。',
  '{名}今天格外想家，但炉火的温度让心里暖了起来。',
  '{名}追着一片落叶跑了半个院子，笑得直不起腰。',
  '{名}把心愿写在纸船上，放进小溪看着它漂远。',
  '{名}傍晚缝补衣裳，针脚里缝进了对明天的期待。',
  '{名}发现地里第一颗破土的新芽，蹲着看了好久。',
];

function fill(tpl, v) {
  return tpl.replace('{名}', v ? v.name : '有人').replace('{特质}', v && v.trait ? v.trait.name : '平凡');
}

export const Stories = {
  /* 每天一次（main.js nightTick 包装处调用，此时 G.time 刚归零 = 新一天白天开始） */
  dayTick() {
    if (Math.random() >= 0.12) return;                 // 12% 概率出故事
    const vs = G.villagers || [];
    if (!vs.length) return;
    const v = vs[Math.floor(Math.random() * vs.length)];
    const story = fill(POOL[Math.floor(Math.random() * POOL.length)], v);
    const text = '📖 ' + story;
    // 个人开心值简化实现：直接加全局开心值（拆分 v.happy 时改此处）
    G.happy = Math.min(100, (G.happy || 0) + 0.5);
    if (!Array.isArray(G.storyLog)) G.storyLog = [];   // 旧存档兜底
    G.storyLog.unshift({ d: G.day || 1, name: v.name, text: story });
    if (G.storyLog.length > 8) G.storyLog.length = 8;
    try { toast(text); } catch { }                      // toast 失败不影响主循环
  },
};

/* ---- 新一天白天开始（原 main.js nightTick 包装平移；先于远方来信） ---- */
Events.on('day', () => Stories.dayTick(), 10);
