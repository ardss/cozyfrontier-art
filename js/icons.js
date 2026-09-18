/* =====================================================================
 * 图标 —— 手绘风 SVG 图标集（替代 emoji，游戏化 HUD 用）
 * 风格：扁平双色，主色 currentColor，辅色 #c9a227（金）/固定暗部
 * ===================================================================*/
const wrap = (inner, vb = '0 0 24 24') => `<svg class="ic" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;

export const ICONS = {
  // 木头：斜放圆木
  wood: wrap(`<g transform="rotate(-20 12 12)"><rect x="3" y="9" width="18" height="6" rx="3" fill="#8a5a34"/><ellipse cx="20" cy="12" rx="2.2" ry="3" fill="#c99b62"/><ellipse cx="20" cy="12" rx="1" ry="1.4" fill="#8a5a34"/></g>`),
  // 食物：红苹果
  food: wrap(`<circle cx="12" cy="13.5" r="7" fill="#c23c2e"/><path d="M12 6.5 Q13 3.5 15.5 3.5" stroke="#6a4a2a" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M12 6 Q15 4 17 6 Q14 7.5 12 6" fill="#7aa04a"/>`),
  // 石头：多面石块
  stone: wrap(`<path d="M5 16 L8 8 L15 6.5 L19 11 L17.5 17 L8 18 Z" fill="#8d8d86"/><path d="M8 8 L15 6.5 L19 11 L12 12 Z" fill="#a8a8a0"/>`),
  // 木板：三层叠板
  plank: wrap(`<rect x="3" y="6" width="18" height="3.6" rx="1" fill="#b08850"/><rect x="4.5" y="10.6" width="15" height="3.6" rx="1" fill="#9a7442"/><rect x="3" y="15.2" width="18" height="3.6" rx="1" fill="#b08850"/>`),
  // 面包
  bread: wrap(`<path d="M4 15 Q4 9 12 9 Q20 9 20 15 L20 16.5 Q20 18 18.5 18 L5.5 18 Q4 18 4 16.5 Z" fill="#d8a04c"/><path d="M7.5 12 L8.5 14 M12 11.5 L12 13.8 M16.5 12 L15.5 14" stroke="#a8702a" stroke-width="1.4" stroke-linecap="round"/>`),
  // 知识：书
  know: wrap(`<path d="M4 5.5 Q8 4 12 5.5 Q16 4 20 5.5 L20 18 Q16 16.5 12 18 Q8 16.5 4 18 Z" fill="#6a8ac2"/><path d="M12 5.5 L12 18" stroke="#4a6390" stroke-width="1.4"/><path d="M6.5 8.5 Q9 7.5 11 8.3 M6.5 11.5 Q9 10.5 11 11.3 M13 8.3 Q15 7.5 17.5 8.5 M13 11.3 Q15 10.5 17.5 11.5" stroke="#dbe6f4" stroke-width="1.1" fill="none" stroke-linecap="round"/>`),
  // 银币
  silver: wrap(`<circle cx="12" cy="12" r="7.5" fill="#c9c9d0"/><circle cx="12" cy="12" r="5.2" fill="none" stroke="#8f8f9a" stroke-width="1.4"/><path d="M12 8.5 L13 11 L15.5 12 L13 13 L12 15.5 L11 13 L8.5 12 L11 11 Z" fill="#8f8f9a"/>`),
  // 快乐：笑脸
  happy: wrap(`<circle cx="12" cy="12" r="8" fill="#e8b84a"/><circle cx="9" cy="10" r="1.3" fill="#6a4a1a"/><circle cx="15" cy="10" r="1.3" fill="#6a4a1a"/><path d="M8 14.5 Q12 17.5 16 14.5" stroke="#6a4a1a" stroke-width="1.7" fill="none" stroke-linecap="round"/>`),
  // 人口
  pop: wrap(`<circle cx="12" cy="8" r="3.6" fill="#9ab0d0"/><path d="M5 19 Q5 13.5 12 13.5 Q19 13.5 19 19 Z" fill="#9ab0d0"/>`),
  // 锤子（建造/工位）
  hammer: wrap(`<rect x="10.6" y="8" width="2.8" height="12" rx="1.2" transform="rotate(35 12 14)" fill="#8a6a48"/><path d="M7 4.5 L15 4.5 L16.5 7.5 L14 10 L8.5 10 L6 7.5 Z" fill="#7a7a85"/><path d="M15 4.5 L16.5 7.5 L14 10 L12.6 8.2 Z" fill="#5f5f6a"/>`),
  // 箱子（搬运）
  box: wrap(`<rect x="4" y="8" width="16" height="12" rx="1.5" fill="#a87848"/><rect x="4" y="8" width="16" height="3.5" fill="#8a5f36"/><rect x="10.5" y="7" width="3" height="5" rx="1" fill="#6a8ac2"/>`),
  // 斧头（采集）
  axe: wrap(`<rect x="11" y="6" width="2.4" height="14.5" rx="1.1" transform="rotate(-18 12 13)" fill="#8a6a48"/><path d="M13.5 3.5 Q18.5 4 19.5 8.5 Q16 9.5 13 8 Z" fill="#9a9aa5"/><path d="M13.5 3.5 Q16 3.8 17.5 5.5 L13 8 Z" fill="#7c7c88"/>`),
  // 齿轮（科技）
  gear: wrap(`<path d="M12 3.5 L13.4 6.2 L16.3 5.3 L16.6 8.3 L19.5 9 L18.2 11.7 L20.5 13.7 L18.2 15.7 L19.5 18.4 L16.6 19.1 L16.3 22.1 L13.4 21.2 L12 23 L10.6 21.2 L7.7 22.1 L7.4 19.1 L4.5 18.4 L5.8 15.7 L3.5 13.7 L5.8 11.7 L4.5 9 L7.4 8.3 L7.7 5.3 L10.6 6.2 Z" fill="#9ab08a" transform="translate(0 -1.5) scale(.92) translate(1 1)"/><circle cx="12" cy="12" r="3.1" fill="#2b2420"/>`),
  // 旗（里程碑）
  flag: wrap(`<rect x="5.5" y="3.5" width="1.8" height="17" rx=".9" fill="#8a6a48"/><path d="M7.3 4.5 L18.5 4.5 L15.5 8 L18.5 11.5 L7.3 11.5 Z" fill="#c23c2e"/>`),
  // 行商钱袋（贸易）
  trade: wrap(`<path d="M9 7 Q9 4 12 4 Q15 4 15 7 L15.5 8.5 Q19.5 10 19.5 15 Q19.5 20.5 12 20.5 Q4.5 20.5 4.5 15 Q4.5 10 8.5 8.5 Z" fill="#b08850"/><path d="M9 7 L15 7" stroke="#8a5f36" stroke-width="1.6"/><circle cx="12" cy="14.5" r="2.6" fill="#8a5f36"/><path d="M12 13 L12.5 14.3 L13.8 14.8 L12.5 15.4 L12 16.7 L11.5 15.4 L10.2 14.8 L11.5 14.3 Z" fill="#e8d8a8"/>`),
  // 剑（防狼）
  sword: wrap(`<rect x="5" y="16.5" width="7" height="2.4" rx="1.1" transform="rotate(-45 8.5 17.7)" fill="#8a6a48"/><path d="M9.5 13.5 L17.5 4 L20.5 3.5 L20 6.5 L11.5 14.5 Z" fill="#b8b8c4"/><path d="M8 15 L9 16 L11 14 L10 13 Z" fill="#c9a227"/>`),
};

// 顶栏/面板用的带框资源徽章
export function resBadge(iconSvg) {
  return `<span class="rb">${iconSvg}</span>`;
}
