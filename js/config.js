/* =====================================================================
 * 1. 配置 —— 全部数值与数据表
 * ===================================================================*/
export const DAY_SECONDS = 50, WINTER_DAY = 8, END_DAY = 11;
export const SEASONS = d => d < 4 ? '秋' : d < WINTER_DAY ? '深秋' : d < END_DAY ? '冬 ❄' : '春';
export const TREE_YIELD = 2, TREE_HP = 3, BUSH_FOOD = 3, WORK_RATE = 2.2;
export const CARRY_CAP = 6;                       // 村民单次搬运上限
export const RES_INFO = {
  wood:  { label: '木', icon: '🪵', depotRole: 'wood',  color: 0x8a5a34 },
  food:  { label: '食', icon: '🍎', depotRole: 'food',  color: 0xc23c2e },
  stone: { label: '石', icon: '🪨', depotRole: 'wood',  color: 0x8d8d86 },  // 石料送工坊/锯木厂
  plank: { label: '板', icon: '🟫', depotRole: 'wood',  color: 0xb08850 },  // 加工材：进阶建筑消耗
  bread: { label: '包', icon: '🍞', depotRole: 'food',  color: 0xd8a04c },  // 优质食物：夜间优先食用
};
/* ---- 配方生产：在岗村民消耗库存原料 → 产出成品（R2 生产主轴） ---- */
export const RECIPES = {
  sawmill: { in: { wood: 2 }, out: { plank: 3 }, time: 6 },
  bakery:  { in: { food: 2 }, out: { bread: 3 }, time: 8 },
};
export const GRID = 26, CELL_SINK = 0.045, DRAG_TOLERANCE = 5;

export const DEFS = [
  { id:'core',      name:'村中心',   w:2,d:2, cat:'设施', cost:{wood:6},  role:'core',  cap:3, desc:'村庄的心脏：解锁全部建筑，也是资源入库点。必须第一个建。' },
  { id:'hut',       name:'窝棚',   w:1,d:1, cat:'住房', cost:{wood:4},  role:'house', cap:1, desc:'最简单的栖身之所。' },
  { id:'cottage_a', name:'村舍',   w:2,d:1, cat:'住房', cost:{wood:5},  role:'house', cap:2, desc:'温暖的小家。' },
  { id:'cottage_b', name:'猎户村舍',w:2,d:1, cat:'住房', cost:{wood:5},  role:'house', cap:2, desc:'猎户的家。' },
  { id:'home_small',name:'小民居', w:2,d:2, cat:'住房', cost:{wood:7},  role:'house', cap:3, desc:'舒适民居。' },
  { id:'home_large',name:'大民居', w:2,d:2, cat:'住房', cost:{wood:8,plank:4}, role:'house', cap:4, desc:'宽敞民居（需要木板）。' },
  { id:'farmhouse', name:'农舍',   w:2,d:2, cat:'生产', cost:{wood:9},  role:'food',  out:4, desc:'村民主产食物。' },
  { id:'sawmill',   name:'锯木厂', w:2,d:2, cat:'生产', cost:{wood:6},  role:'wood',  desc:'配方：2木 → 3板。派村民上工。' },
  { id:'apiary',    name:'蜂箱架', w:1,d:1, cat:'生产', cost:{wood:3},  role:'food',  out:2, desc:'产蜂蜜小屋。' },
  { id:'bakery',    name:'面包房', w:2,d:1, cat:'生产', cost:{wood:8},  role:'food',  desc:'配方：2食 → 3面包。派村民上工。' },
  { id:'greenhouse',name:'温室',   w:2,d:2, cat:'生产', cost:{wood:10}, role:'food',  out:3, desc:'冬天也能产食物。' },
  { id:'granary',   name:'粮仓',   w:2,d:2, cat:'设施', cost:{wood:5},  role:'granary',desc:'食物上限 +25。' },
  { id:'wellhouse', name:'水井',   w:1,d:1, cat:'设施', cost:{wood:3,stone:2},  role:'well',  desc:'附近民居更满意。' },
  { id:'fountain',  name:'喷泉',   w:1,d:1, cat:'设施', cost:{wood:4,stone:2},  role:'happy', add:5, desc:'快乐 +5。' },
  { id:'marketstall',name:'市集',  w:2,d:1, cat:'设施', cost:{wood:5,stone:2},  role:'market',desc:'4 木换 5 食。' },
  { id:'watchtower',name:'瞭望塔', w:2,d:2, cat:'设施', cost:{wood:7,stone:3},  role:'tower', desc:'夜间防狼。' },
  { id:'bridge',    name:'石桥',   w:3,d:1, cat:'装饰', cost:{wood:2},  role:'deco', desc:'装饰。' },
  { id:'tollgate',  name:'关卡',   w:3,d:1, cat:'装饰', cost:{wood:2},  role:'deco', desc:'装饰。' },
  { id:'stable',    name:'马厩',   w:3,d:2, cat:'装饰', cost:{wood:6},  role:'deco', desc:'牲畜畜牧的雏形（后续更新）。' },
  { id:'lighthouse',name:'灯塔',   w:2,d:2, cat:'装饰', cost:{wood:6},  role:'happy', add:4, desc:'灯塔的光让人心安。快乐加成。' },
  { id:'bathhouse', name:'澡堂',   w:2,d:2, cat:'设施', cost:{wood:8,plank:2},  role:'happy', add:6, desc:'快乐加成；冬天燃料不足时受冻减半。' },
  { id:'school',    name:'学堂',   w:2,d:2, cat:'设施', cost:{wood:8},  role:'happy', add:6, desc:'书声琅琅。快乐加成（科技系统后续更新）。' },
  { id:'clinic',    name:'诊所',   w:2,d:2, cat:'设施', cost:{wood:8},  role:'happy', add:4, desc:'快乐加成；饥荒时一半概率留住要走的村民。' },
  { id:'dovecote',  name:'鸽房',   w:1,d:1, cat:'生产', cost:{wood:2},  role:'deco', desc:'每晚落 2 蛋换粮（冬天 1）。' },
  { id:'laundry',   name:'晾晒场', w:2,d:1, cat:'装饰', cost:{wood:2},  role:'happy', add:3, desc:'阳光的味道。快乐加成。' },
  { id:'shipyard',  name:'造船厂', w:4,d:3, cat:'装饰', cost:{wood:12}, role:'deco', desc:'航海贸易的起点（后续更新）。' },
  { id:'warehouse', name:'仓库',   w:3,d:2, cat:'设施', cost:{wood:7,plank:4},  role:'deco', desc:'食物上限 +50。' },
  { id:'watchpost', name:'哨位',   w:2,d:2, cat:'设施', cost:{wood:4},  role:'deco', desc:'和瞭望塔一样：夜间防狼。' },
  // 自产小物件（prop 管线）
  { id:'fence',    name:'木栅栏', w:1,d:1, cat:'装饰', cost:{wood:1}, role:'deco', desc:'围出你的院子。' },
  { id:'barrel',   name:'木桶',   w:1,d:1, cat:'装饰', cost:{wood:1}, role:'deco', desc:'装点什么好呢。' },
  { id:'crate',    name:'木箱',   w:1,d:1, cat:'装饰', cost:{wood:1}, role:'deco', desc:'结实的储物箱。' },
  { id:'lantern',  name:'灯笼',   w:1,d:1, cat:'装饰', cost:{wood:1}, role:'deco', desc:'夜晚的暖光。' },
  { id:'signpost', name:'路牌',   w:1,d:1, cat:'装饰', cost:{wood:1}, role:'deco', desc:'指向家的方向。' },
  { id:'campfire', name:'篝火',   w:1,d:1, cat:'装饰', cost:{wood:2}, role:'deco', desc:'聚会的中心。' },
  { id:'haystack', name:'草垛',   w:1,d:1, cat:'装饰', cost:{wood:2}, role:'deco', desc:'秋收的气息。' },
  { id:'cart',     name:'手推车', w:1,d:1, cat:'装饰', cost:{wood:2}, role:'deco', desc:'运货好帮手。' },
];
DEFS.forEach(d => d.glb = d.glb || `ai3d-mirror/wc-${d.id}-paint.glb`);
// 文件名与 id 不一致的特例
const wellDef = DEFS.find(d => d.id === 'wellhouse');
if (wellDef) wellDef.glb = 'ai3d-mirror/wc-well-paint.glb';
const coreDef = DEFS.find(d => d.id === 'core');
if (coreDef) coreDef.glb = 'ai3d-mirror/wc-warehouse-paint.glb';   // 村中心借用仓库大模型

/* ---- 全局比例设计 ----
 * 村民身高 0.55。建筑按"目标高度"缩放（脚印只允许少量超出），
 * 自然物按高度定标：树比人高得多，石块齐膝，草花贴地 */
const HEIGHTS = {
  hut:1.0, cottage_a:1.1, cottage_b:1.1, home_small:1.25, home_large:1.45,
  farmhouse:1.2, sawmill:1.2, apiary:0.7, bakery:1.1, greenhouse:1.1,
  granary:1.35, wellhouse:0.7, fountain:0.8, marketstall:0.9, watchtower:1.9,
  bridge:0.5, tollgate:0.8, stable:1.0, lighthouse:1.8, bathhouse:1.0,
  school:1.1, clinic:1.1, dovecote:0.9, laundry:0.6, shipyard:1.2,
  warehouse:1.35, watchpost:1.2, core:1.6,
  fence:0.5, barrel:0.5, crate:0.45, lantern:0.6, signpost:0.7,
  campfire:0.4, haystack:0.8, cart:0.5,
};
DEFS.forEach(d => d.h = HEIGHTS[d.id] || 1.0);
// 自产小物件改用 prop 管线的模型
['fence','barrel','crate','lantern','signpost','campfire','haystack','cart'].forEach(id => {
  const d = DEFS.find(x => x.id === id);
  if (d) d.glb = `ai3d-mirror/prop-${id}.glb`;
});

export const NATURE_DEFS = {
  tree:  { glb: 'ai3d-mirror/prop-tree_oak.glb',  name: '橡树', yield: 'wood', amt: TREE_YIELD, hp: TREE_HP, work: WORK_RATE, h: 1.8 },
  tree2: { glb: 'ai3d-mirror/prop-tree_pine.glb', name: '松树', yield: 'wood', amt: TREE_YIELD, hp: TREE_HP, work: WORK_RATE, h: 1.9 },
  tree3: { glb: 'ai3d-mirror/prop-tree_blossom.glb', name: '花树', yield: 'wood', amt: TREE_YIELD, hp: TREE_HP, work: WORK_RATE, h: 1.7 },
  dead:  { glb: 'ai3d-mirror/prop-tree_dead.glb', name: '枯木', yield: 'wood', amt: 2, hp: 2, work: WORK_RATE, h: 1.5 },
  bush:  { glb: 'ai3d-mirror/prop-berry_bush.glb', name: '浆果丛', yield: 'food', amt: BUSH_FOOD, hp: 3, work: WORK_RATE, regrow: 3, h: 0.9 },
  rocks: { glb: 'ai3d-mirror/prop-rocks_small.glb', name: '碎石堆', yield: 'stone', amt: 1, hp: 2, work: WORK_RATE, h: 0.45 },
  rock:  { glb: 'ai3d-mirror/prop-rock_big.glb', name: '巨石', yield: 'stone', amt: 2, hp: 3, work: WORK_RATE, h: 0.65 },
  // 地表小物：不占格，玩家看到就能采集/清理
  stump:      { glb: 'ai3d-mirror/prop-stump.glb', name: '树桩', yield: 'wood', amt: 1, hp: 1, work: WORK_RATE, h: 0.4, free: true },
  mushrooms:  { glb: 'ai3d-mirror/prop-mushrooms.glb', name: '蘑菇', yield: 'food', amt: 1, hp: 1, work: WORK_RATE, regrow: 4, h: 0.3, free: true },
  grass_tuft: { glb: 'ai3d-mirror/prop-grass_tuft.glb', name: '草丛', yield: 'wood', amt: 1, hp: 1, work: 1.2, h: 0.35, free: true },
  flowers:    { glb: 'ai3d-mirror/prop-flowers.glb', name: '野花', yield: 'food', amt: 1, hp: 1, work: 1.2, regrow: 4, h: 0.35, free: true },
};
export const SCATTER_DEFS = {};
export const SCATTER_COUNTS = {};
export const NATURE_COUNTS  = { tree: 20, tree2: 8, tree3: 6, dead: 4, bush: 12, rocks: 7, rock: 5, stump: 6, mushrooms: 8, grass_tuft: 12, flowers: 12 };
export const VNAMES = ['阿岚', '小满', '石头', '阿枣', '春妮', '大川', '阿槐', '小蝶'];
export const CATS = ['全部', '住房', '生产', '设施', '装饰'];
