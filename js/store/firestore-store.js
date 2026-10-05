// 云端：Firestore。数据放在 users/{uid}/{items|links|days|meta}/{id}，每个人只能读写自己的数据。
// 启动时把自己的数据全部读进内存（onSnapshot），之后读取不再消耗云端次数；别的设备改了也会自动同步。
import { COLLECTIONS, genId, store } from './index.js';

/**
 * @param fs  Firestore 函数：{ collection, doc, setDoc, deleteDoc, onSnapshot }
 * @param db  Firestore 实例
 * @param uid 登录用户的 uid
 * @param onError 出错时的提示
 */
export function createFirestoreStore(fs, db, uid, onError) {
  const cache = {};
  COLLECTIONS.forEach((c) => { cache[c] = new Map(); });
  const ref = (col, id) => fs.doc(db, 'users', uid, col, id);
  const clean = (o) => {
    const x = {};
    for (const k of Object.keys(o)) if (o[k] !== undefined) x[k] = o[k];
    return x;
  };

  const unsubs = [];
  const ready = Promise.all(COLLECTIONS.map((col) => new Promise((resolve) => {
    let first = true;
    const un = fs.onSnapshot(fs.collection(db, 'users', uid, col), (snap) => {
      const remote = !snap.metadata.hasPendingWrites;   // 自己刚写的不算
      snap.docChanges().forEach((ch) => {
        if (ch.type === 'removed') cache[col].delete(ch.doc.id);
        else cache[col].set(ch.doc.id, Object.assign({}, ch.doc.data(), { id: ch.doc.id }));
      });
      if (first) { first = false; resolve(); } else if (remote) store.notify();
    }, (err) => {
      onError && onError(err);
      if (first) { first = false; resolve(); }
    });
    if (typeof un === 'function') unsubs.push(un);
  })));

  return {
    mode: 'cloud',
    ready,
    /** 退出登录时停止同步 */
    close() { unsubs.forEach((u) => { try { u(); } catch (e) { /* ignore */ } }); },
    all: (col) => [...cache[col].values()],
    get: (col, id) => cache[col].get(id),
    // 先更新内存（画面马上反应），再写云端；不等云端回应，离线时也不会卡住
    async save(col, obj) {
      const o = clean(Object.assign({}, obj));
      if (!o.id) o.id = genId();
      cache[col].set(o.id, o);
      fs.setDoc(ref(col, o.id), o).catch((e) => onError && onError(e));
      return o;
    },
    async remove(col, id) {
      cache[col].delete(id);
      fs.deleteDoc(ref(col, id)).catch((e) => onError && onError(e));
    },
  };
}
