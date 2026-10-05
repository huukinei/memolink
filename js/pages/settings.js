// 设置：账号 / 备份（导出）/ 恢复（导入，也可以导入 Spring Boot 版导出的文件）
import { store, COLLECTIONS } from '../store/index.js';
import { newItem, normalize, EDITABLE } from '../model.js';
import { esc, header, back, nav, toast } from '../ui.js';

let auth = null;   // app.js 设置：{ user, signOut }
export function setAuth(a) { auth = a; }

export function settingsPage({ query }) {
  const cloud = store.mode() === 'cloud';
  const n = store.all('items').length;
  return {
    html: `<main>${header(back('#/stats'), '设置')}
      ${query.msg ? toast(query.msg) : ''}
      <section>
        <b>账号</b>
        ${cloud && auth ? `<p>☁️ 已登录：${esc(auth.user.email || auth.user.displayName || '')}</p>
          <p class="muted">数据保存在云端，手机和电脑会自动同步。</p>
          <button class="secondary" id="logout">退出登录</button>`
        : `<p>💻 体验模式：数据只保存在这个浏览器里。</p>
          <p class="muted">在 js/config.js 里填好 Firebase 设置后，就能用 Google 账号登录并同步到云端。</p>`}
      </section>
      <section>
        <b>备份</b>
        <p class="muted">现在有 ${n} 条记录。导出一个 JSON 文件保存在电脑上，随时可以恢复。</p>
        <button class="secondary" id="export">⬇ 导出备份</button>
      </section>
      <section>
        <b>导入</b>
        <p class="muted">可以导入：① 这里导出的备份 ② Spring Boot 版「设置 → 导出」的文件。<br>同一个 id 的记录会被覆盖，不会重复。</p>
        <input type="file" id="file" accept=".json,application/json">
        <p id="imp-status" class="muted"></p>
      </section>
    </main>${nav('')}`,
    mount(root) {
      const lo = root.querySelector('#logout');
      if (lo) lo.addEventListener('click', () => auth.signOut());
      root.querySelector('#export').addEventListener('click', () => {
        const data = { app: 'MemoLink', version: 1, exportedAt: new Date().toISOString() };
        COLLECTIONS.forEach((c) => { data[c] = store.all(c); });
        const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'memolink-backup-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a); a.click(); a.remove();
      });
      root.querySelector('#file').addEventListener('change', async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const st = root.querySelector('#imp-status');
        try {
          const n = await importBackup(JSON.parse(await f.text()));
          st.textContent = `✓ 导入了 ${n} 条记录`;
        } catch (err) {
          st.textContent = '✗ 导入失败：' + err.message;
        }
      });
    },
  };
}

/** 导入备份。Spring Boot 版的 id 是数字，会转成字符串（关联也一起转换） */
export async function importBackup(data) {
  if (!data || !Array.isArray(data.items)) throw new Error('不是 MemoLink 的备份文件');
  const sid = (v) => (v == null ? null : String(v));
  const jobs = [];
  for (const raw of data.items) {
    const i = newItem({ id: sid(raw.id) });
    for (const k of EDITABLE) if (k in raw) i[k] = raw[k];
    for (const k of ['flagged', 'attempts', 'correctCount', 'lastResult', 'lastAnsweredAt', 'mastery', 'createdAt', 'nextReview']) {
      if (k in raw) i[k] = raw[k];
    }
    i.linkedId = sid(i.linkedId);
    i.flagged = !!i.flagged;
    jobs.push(store.save('items', normalize(i)));
  }
  for (const l of data.links || []) {
    // Spring Boot 版的关联 id 是数字：加前缀 L，避免和记录的 id 混在一起
    const lid = l.id == null ? null : typeof l.id === 'number' ? 'L' + l.id : String(l.id);
    jobs.push(store.save('links', { id: lid, fromId: sid(l.fromId), toId: sid(l.toId),
      relation: l.relation || 'ASSOC', createdAt: l.createdAt || new Date().toISOString() }));
  }
  for (const d of data.days || []) if (d.id) jobs.push(store.save('days', { id: d.id, count: d.count || 0, correct: d.correct || 0 }));
  for (const m of data.meta || []) if (m.id) jobs.push(store.save('meta', m));
  await Promise.all(jobs);
  return data.items.length;
}
