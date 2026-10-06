import { study } from '../services.js';
import { SUBJECTS, TYPES } from '../model.js';
import { esc, header, back, nav, cards, chips, formData, go, takeFlash, toast } from '../ui.js';

export function libraryPage({ query }) {
  const q = query.q || '', type = query.type || '', subject = query.subject || '', f = query.f || '', cat = query.cat || '';
  const items = study.search(q, type, subject, f, cat);
  const cats = study.categoryCounts(type, subject);
  return {
    html: `<main>${header(back('#/'), '知识库', '<a href="#/import" class="muted">📥 导入</a>')}
      ${toast(takeFlash())}
      <form id="lf" class="filters">
        <div class="search"><input name="q" value="${esc(q)}" placeholder="搜索题目、答案、标签、中日英…"><button>搜索</button></div>
        ${chips('type', [['', '全部'], ...Object.entries(TYPES)], type, true)}
        ${chips('subject', [['', '全部科目'], ...SUBJECTS.map((s) => [s, s])], subject, true)}
        ${chips('f', [['', '不限'], ['flagged', '★ 标记'], ['weak', '苦手'], ['new', '没做过']], f, true)}
        ${cats.length ? `<details class="cats" ${cat ? 'open' : ''}><summary>${cat ? '📂 分类：' + esc(cat) : '📂 按分类看（' + cats.length + ' 类）'}</summary>
          ${chips('cat', [['', '全部分类'], ...cats.map(([c, n]) => [c, c + ' ' + n])], cat, true)}</details>` : ''}
      </form>
      <p class="muted">${items.length} 条</p>
      ${items.length ? cards(items) : '<div class="empty small"><p>没有找到。</p><a class="secondary" href="#/add">＋ 记一条</a></div>'}
    </main>${nav('library')}`,
    mount(root) {
      const f = root.querySelector('#lf');
      const submit = () => go('/library', formData(f));
      f.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
      f.querySelectorAll('[data-auto]').forEach((r) => r.addEventListener('change', submit));
    },
  };
}
