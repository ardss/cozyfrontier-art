/* =====================================================================
 * 1. 配置 —— 全部数值与数据表
 * ===================================================================*/
/* ---- 年历：一年 24 天 = 四季各 6 天（春/夏/秋/冬），跨年继续玩（R6 多年进程） ---- */
export const DAY_SECONDS = 50;
export const SEASON_DAYS = 6, YEAR_DAYS = 24;
export const seasonOf = day => ['春', '夏', '秋', '冬'][Math.floor(((day - 1) % YEAR_DAYS) / SEASON_DAYS)];
export const isWinterDay = day => seasonOf(day) === '冬';
export const TREE_YIELD = 2, TREE_HP = 3, BUSH_FOOD = 3, WORK_RATE = 2.2;
export const CARRY_CAP = 6;                       // 村民单次搬运上限
export const RES_INFO: any = {
  wood:  { label: '木', icon: '🪵', depotRole: 'wood',  color: 0x8a5a34 },
  food:  { label: '食', icon: '🍎', depotRole: 'food',  color: 0xc23c2e },
  stone: { label: '石', icon: '🪨', depotRole: 'wood',  color: 0x8d8d86 },  // 石料送工坊/锯木厂
  plank: { label: '板', icon: '🟫', depotRole: 'wood',  color: 0xb08850 },  // 加工材：进阶建筑消耗
  bread: { label: '包', icon: '🍞', depotRole: 'food',  color: 0xd8a04c },  // 优质食物：夜间优先食用
  know:  { label: '识', icon: '📘', depotRole: 'wood',  color: 0x6a8ac2 },   // 知识：学堂产出，研究科技消耗
};
/* ---- 配方生产：在岗村民消耗库存原料 → 产出成品（R2 生产主轴） ---- */
export const RECIPES: any = {
  sawmill: { in: { wood: 2 }, out: { plank: 3 }, time: 6 },
  bakery:  { in: { food: 2 }, out: { bread: 3 }, time: 8 },
  school:  { in: {},          out: { know: 2 },  time: 15 },   // 书院讲学：无原料，产出知识
};
/* ---- 科技树：研究消耗知识，解锁进阶建筑（R5） ---- */
export const TECHS = [
  { id: 'woodwork', name: '木工术',   cost: 2, unlock: ['sawmill'],   desc: '解锁锯木厂：2木 → 3板' },
  { id: 'baking',   name: '烘焙术',   cost: 2, unlock: ['bakery'],    desc: '解锁面包房：2食 → 3面包' },
  { id: 'masonry',  name: '石作术',   cost: 3, unlock: ['wellhouse', 'fountain', 'watchtower'], desc: '解锁水井/喷泉/瞭望塔' },
  { id: 'watch',    name: '哨戒',     cost: 2, unlock: ['watchpost'], desc: '解锁哨位（夜间防狼）' },
  { id: 'storage',  name: '仓储术',   cost: 3, unlock: ['warehouse'], desc: '解锁仓库（食物上限 +50）' },
  { id: 'glass',    name: '温室栽培', cost: 4, unlock: ['greenhouse'], desc: '解锁温室（冬天也能产食）' },
  { id: 'wellness', name: '澄心之道', cost: 4, unlock: ['bathhouse', 'clinic'], desc: '解锁澡堂/诊所' },
  { id: 'sailing',  name: '航海术',   cost: 5, unlock: ['lighthouse', 'shipyard'], desc: '解锁灯塔/造船厂' },
];
export const GRID = 26, CELL_SINK = 0.045, DRAG_TOLERANCE = 5;

export const DEFS: any[] = [
  { id:'core',      name:'村中心',   w:2,d:2, cat:'设施', cost:{wood:6},  role:'core',  cap:3, desc:'村庄的心脏：解锁全部建筑，也是资源入库点。必须第一个建。' },
  { id:'hut',       name:'窝棚',   w:1,d:1, cat:'住房', cost:{wood:4},  role:'house', cap:1, desc:'最简单的栖身之所。' },
  { id:'cottage_a', name:'村舍',   w:2,d:1, cat:'住房', cost:{wood:5},  role:'house', cap:2, desc:'温暖的小家。' },
  { id:'cottage_b', name:'猎户村舍',w:2,d:1, cat:'住房', cost:{wood:5},  role:'house', cap:2, desc:'猎户的家。' },
  { id:'home_small',name:'小民居', w:2,d:2, cat:'住房', cost:{wood:7},  role:'house', cap:3, desc:'舒适民居。' },
  { id:'home_large',name:'大民居', w:2,d:2, cat:'住房', cost:{wood:8,plank:4}, role:'house', cap:4, desc:'宽敞民居（需要木板）。' },
  { id:'farm',      name:'农田',   w:3,d:3, cat:'农牧', cost:{wood:4},  role:'farm',  desc:'开垦农田：建成自动播种，点击可切换播种/休耕。春夏秋生长，冬季冻死，来年春自动再播。成熟后空闲村民自动收割 +6 食。' },
  { id:'farmhouse', name:'农舍',   w:2,d:2, cat:'农牧', cost:{wood:9},  role:'food',  out:4, desc:'村民主产食物。' },
  { id:'sawmill',   name:'锯木厂', w:2,d:2, cat:'加工', cost:{wood:6},  role:'wood',  desc:'配方：2木 → 3板。派村民上工。', tech:"woodwork" },
  { id:'apiary',    name:'蜂箱架', w:1,d:1, cat:'农牧', cost:{wood:3},  role:'food',  out:2, desc:'产蜂蜜小屋。' },
  { id:'bakery',    name:'面包房', w:2,d:1, cat:'加工', cost:{wood:8},  role:'food',  desc:'配方：2食 → 3面包。派村民上工。', tech:"baking" },
  { id:'greenhouse',name:'温室',   w:2,d:2, cat:'农牧', cost:{wood:10}, role:'food',  out:3, desc:'冬天也能产食物。', tech:"glass" },
  { id:'granary',   name:'粮仓',   w:2,d:2, cat:'仓储', cost:{wood:5},  role:'granary',desc:'食物上限 +25。' },
  { id:'wellhouse', name:'水井',   w:1,d:1, cat:'设施', cost:{wood:3,stone:2},  role:'well',  desc:'附近民居更满意。', tech:"masonry" },
  { id:'fountain',  name:'喷泉',   w:1,d:1, cat:'设施', cost:{wood:4,stone:2},  role:'happy', add:5, desc:'快乐 +5。', tech:"masonry" },
  { id:'marketstall',name:'市集',  w:2,d:1, cat:'设施', cost:{wood:5,stone:2},  role:'market',desc:'4 木换 5 食。' },
  { id:'watchtower',name:'瞭望塔', w:2,d:2, cat:'设施', cost:{wood:7,stone:3},  role:'tower', desc:'夜间防狼。', tech:"masonry" },
  { id:'bridge',    name:'石桥',   w:3,d:1, cat:'装饰', cost:{wood:2},  role:'deco', desc:'装饰。' },
  { id:'tollgate',  name:'关卡',   w:3,d:1, cat:'装饰', cost:{wood:2},  role:'deco', desc:'装饰。' },
  { id:'stable',    name:'马厩',   w:3,d:2, cat:'农牧', cost:{wood:6},  role:'deco', desc:'牲畜畜牧的雏形（后续更新）。' },
  { id:'lighthouse',name:'灯塔',   w:2,d:2, cat:'装饰', cost:{wood:6},  role:'happy', add:4, desc:'灯塔的光让人心安。快乐加成。', tech:"sailing" },
  { id:'bathhouse', name:'澡堂',   w:2,d:2, cat:'设施', cost:{wood:8,plank:2},  role:'happy', add:6, desc:'快乐加成；冬天燃料不足时受冻减半。', tech:"wellness" },
  { id:'school',    name:'学堂',   w:2,d:2, cat:'设施', cost:{wood:8},  role:'happy', add:6, desc:'书院：派村民上工产出知识📘，兼快乐加成。' },
  { id:'clinic',    name:'诊所',   w:2,d:2, cat:'设施', cost:{wood:8},  role:'happy', add:4, desc:'快乐加成；饥荒时一半概率留住要走的村民。', tech:"wellness" },
  { id:'dovecote',  name:'鸽房',   w:1,d:1, cat:'农牧', cost:{wood:2},  role:'deco', desc:'每晚落 2 蛋换粮（冬天 1）。' },
  { id:'laundry',   name:'晾晒场', w:2,d:1, cat:'装饰', cost:{wood:2},  role:'happy', add:3, desc:'阳光的味道。快乐加成。' },
  { id:'shipyard',  name:'造船厂', w:4,d:3, cat:'装饰', cost:{wood:12}, role:'deco', desc:'航海贸易的起点（后续更新）。', tech:"sailing" },
  { id:'warehouse', name:'仓库',   w:3,d:2, cat:'仓储', cost:{wood:7,plank:4},  role:'deco', desc:'食物上限 +50。', tech:"storage" },
  { id:'watchpost', name:'哨位',   w:2,d:2, cat:'设施', cost:{wood:4},  role:'deco', desc:'和瞭望塔一样：夜间防狼。', tech:"watch" },
  // 自产小物件（prop 管线）
  { id:'fence',    name:'木栅栏', w:1,d:1, cat:'装饰', cost:{wood:1}, role:'deco', desc:'围出你的院子。' },
  { id:'barrel',   name:'木桶',   w:1,d:1, cat:'装饰', cost:{wood:1}, role:'deco', desc:'装点什么好呢。' },
  { id:'crate',    name:'木箱',   w:1,d:1, cat:'装饰', cost:{wood:1}, role:'deco', desc:'结实的储物箱。' },
  { id:'lantern',  name:'灯笼',   w:1,d:1, cat:'装饰', cost:{wood:1}, role:'deco', desc:'夜晚的暖光。' },
  { id:'signpost', name:'路牌',   w:1,d:1, cat:'装饰', cost:{wood:1}, role:'deco', desc:'指向家的方向。' },
  { id:'campfire', name:'篝火',   w:1,d:1, cat:'装饰', cost:{wood:2}, role:'deco', desc:'聚会的中心。' },
  { id:'haystack', name:'草垛',   w:1,d:1, cat:'农牧', cost:{wood:2}, role:'deco', desc:'秋收的气息。' },
  { id:'cart',     name:'手推车', w:1,d:1, cat:'装饰', cost:{wood:2}, role:'deco', desc:'运货好帮手。' },
];
const PROG_IDS = ['farm','coop','fish','hunt'];   // 程序化模型建筑：无 GLB，避免 404
DEFS.forEach(d => d.glb = d.glb || (PROG_IDS.includes(d.id) ? null : `ai3d-mirror/wc-${d.id}-paint.glb`));
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
  farm:0.16, farmhouse:1.2, sawmill:1.2, apiary:0.7, bakery:1.1, greenhouse:1.1,
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
export const SCATTER_DEFS: any = {};
export const SCATTER_COUNTS: any = {};
export const NATURE_COUNTS  = { tree: 20, tree2: 8, tree3: 6, dead: 4, bush: 12, rocks: 7, rock: 5, stump: 6, mushrooms: 8, grass_tuft: 12, flowers: 12 };
export const VNAMES = ['阿岚', '小满', '石头', '阿枣', '春妮', '大川', '阿槐', '小蝶'];
export const CATS = ['全部', '住房', '农牧', '加工', '设施', '仓储', '装饰'];

/* ---- 里程碑：声明式条件，每晚检查，达成 +8 快乐；全达成 = 繁荣终局（R6） ---- */
export const MILESTONES = [
  { id: 'home',   name: '安家', desc: '建造村中心',      type: 'place', id2: 'core' },
  { id: 'full',   name: '温饱', desc: '食物储备达到 30',  type: 'res',   key: 'food', n: 30 },
  { id: 'fire',   name: '炉火', desc: '建造篝火',        type: 'place', id2: 'campfire' },
  { id: 'craft',  name: '工坊', desc: '研究首个科技',     type: 'tech',  n: 1 },
  { id: 'plank',  name: '加工', desc: '木板储备达到 10',  type: 'res',   key: 'plank', n: 10 },
  { id: 'school', name: '书香', desc: '建造学堂',        type: 'place', id2: 'school' },
  { id: 'pop6',   name: '人丁', desc: '人口达到 6',      type: 'pop',   n: 6 },
  { id: 'year2',  name: '跨年', desc: '活过第一个冬天',   type: 'year',  n: 2 },
];

/* ---- 贸易：行商每 3 天到访，市集当日开张；卖出/买入价（R7） ---- */
export const TRADE = {
  sell: [ { res: 'plank', n: 3, silver: 4 }, { res: 'bread', n: 3, silver: 6 }, { res: 'wood', n: 6, silver: 3 }, { res: 'stone', n: 4, silver: 3 } ],
  buy:  [ { res: 'food', n: 8, silver: 3 }, { res: 'wood', n: 8, silver: 3 }, { res: 'stone', n: 5, silver: 4 } ],
};
export const isMarketDay = day => day % 3 === 0;

/* ---- 双选项事件：夜间随机弹出，fx 为资源/人口/快乐增减（R7） ---- */
export const EVENTS = [
  { id: 'drifter', name: '迷路的旅人', text: '一位旅人在林间迷了路，又冷又饿，请求借宿。', opts: [
    { label: '收留他（+1 人，-5 粮）', fx: { food: -5, pop: 1 } },
    { label: '指路送别（快乐 +3）', fx: { happy: 3 } } ] },
  { id: 'caravan', name: '远方的商队', text: '一支商队路过村口，想用石料换些木板。', opts: [
    { label: '成交（-4 板，+6 石）', fx: { plank: -4, stone: 6 } },
    { label: '婉拒', fx: {} } ] },
  { id: 'storm', name: '暴雨夜', text: '暴雨冲垮了储物棚的顶。', opts: [
    { label: '连夜抢修（-3 木）', fx: { wood: -3 } },
    { label: '先顾着人（-6 粮受潮）', fx: { food: -6 } } ] },
  { id: 'bees', name: '野蜂群', text: '一群野蜂在村边的大树上安了家。', opts: [
    { label: '冒险收蜜（+6 粮，快乐 -2）', fx: { food: 6, happy: -2 } },
    { label: '敬而远之', fx: {} } ] },
  { id: 'ballad', name: '流浪乐手', text: '一位乐手想在篝火旁办一场小演出。', opts: [
    { label: '办！（-2 木当柴，快乐 +8）', fx: { wood: -2, happy: 8 } },
    { label: '改天吧', fx: {} } ] },
];

/* ---- 村民性格特质：出生随机分配，影响效率/搬运/饭量/情绪（R8） ---- */
export const TRAITS = [
  { id: 'diligent', name: '勤劳',   desc: '干活速度 +15%',       workMul: 1.15 },
  { id: 'slow',     name: '慢性子', desc: '干活速度 -10%',       workMul: 0.9 },
  { id: 'strong',   name: '大力',   desc: '搬运上限 +2',         carryBonus: 2 },
  { id: 'sunny',    name: '乐观',   desc: '每晚给村子带来 1 快乐', sunny: 1 },
  { id: 'hungry',   name: '口馋',   desc: '每晚多吃 1 份粮',      extraFood: 1 },
];
export const traitOf = v => v.trait || {};
/* ---- 四季节日：每季第一天，全村欢聚（R8） ---- */
export const FESTIVALS = { '春': '春播节 🌱', '夏': '夏收节 ☀️', '秋': '秋酿节 🍶', '冬': '冬炉节 🔥' };

/* ---- S15 狩猎 / S16 渔业 / S17 畜牧（追加）：三个食物生产建筑 ---- */
RECIPES.fish = { in: {}, out: { food: 2 }, time: 20 };   // 渔档垂钓：无原料，复用工位配方管线
DEFS.push(
  { id:'coop', name:'鸡舍', w:2,d:1, cat:'农牧', cost:{wood:6},  role:'pasture', desc:'内置 3 只鸡：每天白天产蛋，空闲村民自动捡蛋 +3 食；冬季停产。' },
  { id:'fish', name:'渔档', w:2,d:1, cat:'农牧', cost:{wood:5,stone:2}, role:'food', desc:'临水而建（地图边缘）。派村民上工垂钓：约 20 秒 +2 食，冬季减半。' },
  { id:'hunt', name:'猎屋', w:2,d:1, cat:'农牧', cost:{wood:6},  role:'pasture', desc:'村缘出没 1-2 只野鹿。空闲村民自动狩猎：+5 食 +1 石，鹿 3 天后刷新。' },
  // S14 回收堆肥：借用木桶模型，sim.js 结算肥料状态与农田加成
  { id:'compost', name:'堆肥箱', w:1,d:1, cat:'设施', cost:{wood:3,stone:2}, role:'deco', glb:'ai3d-mirror/prop-barrel.glb', desc:'回收堆肥：每 2 天消耗 3 食沤肥（无粮则失效），肥料生效时 10 格内农田产出 +15%。' },
);

/* ---- S9 工具耐久 + S36 背篓（追加段）：新资源 tool + 锯木厂工具配方 ---- */
RES_INFO.tool = { label: '器', icon: '🪓', depotRole: 'wood', color: 0x9aa5b0 };   // 工具：采集/收割/狩猎装备，效率 ×1.25
RECIPES.toolCraft = { in: { wood: 1, plank: 1 }, out: { tool: 2 }, time: 10 };     // 锯木厂兼工具坊
const sawmillDef = DEFS.find(d => d.id === 'sawmill');
if (sawmillDef) sawmillDef.desc = '配方：2木 → 3板，另可造工具（1木+1板 → 2器）。派村民上工。';
