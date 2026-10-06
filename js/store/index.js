// =====================================================================
// 数据存取层（相当于 Spring Boot 的 Repository）
// 页面和业务逻辑只通过这里的 store 读写数据。
// 以后改回 Spring Boot：新增一个 rest-store.js（用 fetch 调 API），在这里换掉即可。
//
// 接口：
//   all(col)            → 数组（从内存缓存同步读取）
//   get(col, id)        → 对象 或 undefined
//   save(col, obj)      → Promise<obj>（没有 id 会自动生成）
//   remove(col, id)     → Promise
//   onChange(fn)        → 数据变化（例如别的设备改了）时通知
// col：items（错题/生词…） / links（关联） / days（每天做题数） / meta（跟读记录等）
// =====================================================================

let impl = null;
const listeners = new Set();

export const store = {
  use(s) { impl = s; },
  ready() { return impl != null; },
  mode() { return impl ? impl.mode : 'none'; },
  all(col) { return impl.all(col); },
  get(col, id) { return impl.get(col, id); },
  save(col, obj) { return impl.save(col, obj); },
  remove(col, id) { return impl.remove(col, id); },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  notify() { listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); },
};

export const COLLECTIONS = ['items', 'links', 'days', 'meta'];

export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
