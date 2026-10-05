// 体验模式 / 没设置 Firebase 时：数据存在这个浏览器的 localStorage 里
import { COLLECTIONS, genId } from './index.js';

const KEY = 'memolink.local.v1';

export function createLocalStore() {
  let data = {};
  try { data = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { data = {}; }
  COLLECTIONS.forEach((c) => { data[c] = data[c] || {}; });

  const persist = () => {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { console.warn('localStorage 保存失败', e); }
  };

  return {
    mode: 'local',
    all: (col) => Object.values(data[col]),
    get: (col, id) => data[col][id],
    async save(col, obj) {
      const o = Object.assign({}, obj);
      if (!o.id) o.id = genId();
      data[col][o.id] = o;
      persist();
      return o;
    },
    async remove(col, id) {
      delete data[col][id];
      persist();
    },
  };
}
