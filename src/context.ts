/* =====================================================================
 * 跨模块运行时引用（主模块 main.js 注入，避免循环依赖）
 * ===================================================================*/
export const ctx = {
  UI: null,           // ui.js 的 UI 对象
  Input: null,        // input.js 的 Input 对象
  toast: null,        // ui.js 的 toast()
  startPlacing: null, // input.js 的 startPlacing()
};
