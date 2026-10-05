// 快速记录 / 编辑 / 详情 / 关联
import { study, links } from '../services.js';
import {
  SUBJECTS, TYPES, RELATIONS, LETTERS, newItem, typeLabel, hasChoices, choice, accuracy, masteryStars,
  nextReviewLabel, isWord, isQuestion, hasTri, notBlank, attempts,
} from '../model.js';
import {
  esc, nl, header, back, card, cards, link, go, refresh, flash, takeFlash, toast, trilingual, bindTri, modules, chips, formData,
} from '../ui.js';

// ============================ 快速记录 / 编辑 ============================

export function addPage({ query }) {
  const i = newItem({ type: query.type || 'MISTAKE', category: query.category || '' });
  if (query.subject) i.subject = query.subject;
  if (query.tags) i.tags = query.tags;
  let parent = null, linkFrom = null;
  if (query.linkedId) {
    parent = study.get(query.linkedId);
    if (parent) Object.assign(i, { linkedId: parent.id, subject: parent.subject, category: parent.category, tags: parent.tags });
  }
  if (query.linkFrom) {
    linkFrom = study.get(query.linkFrom);
    if (linkFrom) {
      i.subject = linkFrom.subject;
      if (!i.category && linkFrom.category !== '未分类') i.category = linkFrom.category;
    }
  }
  return form(i, { parent, linkFrom, relation: query.relation || 'ASSOC', saved: !!query.saved });
}

export function editPage({ params }) {
  const i = study.get(params.id);
  if (!i) return notFound();
  return form(Object.assign({}, i), {});
}

function form(item, opt) {
  const editing = !!item.id;
  const v = (k) => esc(item[k] == null ? '' : item[k]);
  const cat = item.category === '未分类' ? '' : item.category;
  const ta = (k, ph, cls) => `<textarea name="${k}" class="${cls || ''}" placeholder="${esc(ph || '')}">${v(k)}</textarea>`;
  const inp = (k, ph, extra) => `<input name="${k}" value="${v(k)}" placeholder="${esc(ph || '')}" ${extra || ''}>`;
  const choiceRow = (L) => `<div class="choice-edit"><label class="radio"><input type="radio" name="correctChoice" value="${L}"
    ${item.correctChoice === L ? 'checked' : ''}>${L}</label>${inp('choice' + L, '选项 ' + L)}</div>`;
  const tags = study.tags();
  const anyBackup = ['memo', 'customBody1', 'customBody2', 'refUrl'].some((k) => notBlank(item[k]));

  const html = `<main class="t-${esc(item.type)}" id="form-root">
    ${header(back(editing ? '#/item/' + item.id : '#/'), editing ? '编辑' : '快速记录')}
    ${opt.saved ? toast('✓ 已保存，继续记下一条') : ''}
    ${opt.parent ? `<p class="muted">🔄 同类题 ← 原题：${esc(opt.parent.title)}</p>` : ''}
    <form id="f">
      ${opt.linkFrom ? `<div class="from-box"><span>保存后关联到：${esc(opt.linkFrom.title)}</span>
        <select name="relation">${Object.entries(RELATIONS).map(([k, l]) => `<option value="${k}" ${k === opt.relation ? 'selected' : ''}>${l}</option>`).join('')}</select></div>` : ''}
      <div class="seg">${Object.entries(TYPES).map(([k, l]) => `<button type="button" data-type="${k}" class="${item.type === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <input type="hidden" name="type" value="${v('type')}">

      <label><span class="for-word">单词（日语）*</span><span class="not-word">题目 / 内容 *</span></label>
      <textarea name="title" required placeholder="先记下来就行…">${v('title')}</textarea>
      <div class="for-word"><label>读音</label>${inp('reading', 'わりあてる')}</div>

      <details class="for-q box" ${hasChoices(item) ? 'open' : ''}>
        <summary>🔘 选项（四选一，做题时直接点选）</summary>
        <p class="muted">点左边的圆圈选择正确答案。只填 A、B 两个也可以。</p>
        ${LETTERS.map(choiceRow).join('')}
      </details>

      <label><span class="for-word">中文意思</span><span class="not-word">正确答案 / 解析</span></label>
      ${ta('answer', '可以之后再补')}

      <div class="row">
        <select name="subject">${SUBJECTS.map((s) => `<option value="${s}" ${item.subject === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
        <input name="category" value="${esc(cat || '')}" list="cats" placeholder="分类 / 知识点（可选）">
      </div>
      <datalist id="cats">${study.categories().map((c) => `<option value="${esc(c)}">`).join('')}</datalist>

      <details class="box tri-edit" open>
        <summary>🌐 中日英（帮助理解，可之后填）</summary>
        <label><span class="for-word">🇯🇵 日语解释（辞典的说明）</span><span class="not-word">🇯🇵 日本語（原文・用語）</span></label>
        ${ta('jaText', '例：経路制御 / ネットワーク上でパケットの転送経路を決めること', 'short')}
        <label><span class="for-word">🇨🇳 中文解释</span><span class="not-word">🇨🇳 中文（翻译・理解）</span></label>
        ${ta('zhText', '例：路由 / 路由控制', 'short')}
        <label>🇬🇧 English</label>${ta('enText', '例：Routing', 'short')}
      </details>

      <details class="for-q box" ${item.type === 'MISTAKE' || editing ? 'open' : ''}>
        <summary>📌 出处 / 错因</summary>
        <label>出处（过去问、题库）</label>${inp('source', '例：R5秋 午前 問12 / Ping-t / 自作', 'list="srcs"')}
        <datalist id="srcs">${study.sources().map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
        <div class="for-mistake"><label>我当时的答案（错的）</label>${inp('wrongAnswer', '例：选了 ウ')}</div>
        <label>为什么错</label>
        <select name="mistakeReason">${['', '知识点不会', '记混了', '日语没看懂', '粗心'].map((r) =>
          `<option value="${r}" ${(item.mistakeReason || '') === r ? 'selected' : ''}>${r || '未选择'}</option>`).join('')}</select>
      </details>

      <details class="box" ${isWord(item) || editing ? 'open' : ''}>
        <summary>💡 记忆（例句 / 记忆法 / 联想）</summary>
        <div class="for-word"><label>📖 例句</label>${ta('example', 'メモリを各プロセスに割り当てる。', 'short')}</div>
        <label>💡 记忆法 / 口诀 / 联想故事</label>${ta('mnemonic', '例：割（わり）+ 当てる → 切开再分给每个人', 'short')}
        <label>🔗 联想关键词</label>${inp('relatedKeywords', '例：割り振る, 配分, allocate')}
        <p class="muted">想把两条记录真正连起来（近义词、易混词、同类题），保存后在详情页点「＋ 关联已有的」。</p>
      </details>

      <details class="box" ${editing && anyBackup ? 'open' : ''}>
        <summary>🧩 备用模块（笔记 / 链接 / 自定义）</summary>
        <label>📝 笔记</label>${ta('memo', '', 'short')}
        <label>🌐 参考链接</label>${inp('refUrl', 'https://…')}
        <label>🧩 自定义模块 1</label>${inp('customTitle1', '模块名称（例：图解 / 计算步骤 / 公式）')}${ta('customBody1', '', 'short')}
        <label>🧩 自定义模块 2</label>${inp('customTitle2', '模块名称（例：AML 业务场景）')}${ta('customBody2', '', 'short')}
      </details>

      <label>🏷 标签</label>${inp('tags', '#Network #苦手')}
      ${tags.length ? `<div class="chips small">${tags.map((t) => `<button type="button" class="chip-btn" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}</div>` : ''}

      <div class="actions">
        <button class="primary" type="submit">保存</button>
        ${!editing && !opt.linkFrom ? '<button class="secondary" type="submit" data-again="1">保存并再记一条</button>' : ''}
      </div>
    </form></main>`;

  return {
    html,
    mount(root) {
      const f = root.querySelector('#f'), main = root.querySelector('#form-root');
      root.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => {
        f.type.value = b.dataset.type;
        main.className = 't-' + b.dataset.type;
        root.querySelectorAll('.seg button').forEach((x) => x.classList.toggle('on', x === b));
      }));
      root.querySelectorAll('[data-tag]').forEach((b) => b.addEventListener('click', () => {
        const t = b.dataset.tag, cur = f.tags.value.trim();
        if ((' ' + cur + ' ').indexOf(' ' + t + ' ') < 0) f.tags.value = (cur ? cur + ' ' : '') + t;
      }));
      let again = false;
      root.querySelectorAll('[data-again]').forEach((b) => b.addEventListener('click', () => { again = true; }));
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const d = formData(f);
        d.correctChoice = d.correctChoice || null;
        if (editing) {
          await study.update(item.id, d);
          flash('✓ 已更新');
          go('/item/' + item.id);
          return;
        }
        const relation = d.relation; delete d.relation;
        const saved = await study.save(Object.assign(newItem(), d, { linkedId: item.linkedId || null }));
        if (opt.linkFrom) {
          await links.link(opt.linkFrom.id, saved.id, relation);
          flash('✓ 已保存并关联');
          go('/item/' + opt.linkFrom.id);
        } else if (again) {
          go('/add', { type: saved.type, subject: saved.subject, category: saved.category === '未分类' ? '' : saved.category, saved: 1 });
        } else {
          flash('✓ 已保存');
          go('/');
        }
      });
    },
  };
}

// ============================ 详情 ============================

export function detailPage({ params }) {
  const i = study.get(params.id);
  if (!i) return notFound();
  const children = study.linked(i.id), groups = links.grouped(i.id);
  const parent = i.linkedId ? study.get(i.linkedId) : null;
  const acc = accuracy(i);
  const add = (q, label) => `<a class="chip-link" href="${link('/add', q)}">${label}</a>`;

  const html = `<main>
    ${header(back('#/library'), '详情', `<button class="star-btn ${i.flagged ? 'on' : ''}" id="flag" title="标记">${i.flagged ? '★' : '☆'}</button>`)}
    ${toast(takeFlash())}
    <span class="pill">${esc(typeLabel(i.type) + ' · ' + i.subject + ' · ' + i.category)}</span>
    ${notBlank(i.source) ? `<span class="pill src">📌 ${esc(i.source)}</span>` : ''}
    <h2 class="pre">${nl(i.title)}</h2>
    ${notBlank(i.reading) ? `<p class="reading">${esc(i.reading)}</p>` : ''}
    ${hasChoices(i) ? `<ol class="choices static">${LETTERS.filter((L) => notBlank(choice(i, L))).map((L) =>
      `<li class="${L === i.correctChoice ? 'ok' : ''}"><b>${L}</b><span>${esc(choice(i, L))}</span></li>`).join('')}</ol>` : ''}
    ${notBlank(i.answer) ? `<section class="answer"><small>${isWord(i) ? '中文意思' : '答案 / 解析'}</small><p class="pre">${nl(i.answer)}</p></section>` : ''}
    ${notBlank(i.wrongAnswer) || notBlank(i.mistakeReason) ? `<section class="wrong">
      ${notBlank(i.wrongAnswer) ? `<p>我当时的答案：${esc(i.wrongAnswer)}</p>` : ''}
      ${notBlank(i.mistakeReason) ? `<p>为什么错：${esc(i.mistakeReason)}</p>` : ''}</section>` : ''}
    ${trilingual(i)}
    ${!hasTri(i) ? `<a class="add-tri" href="#/item/${esc(i.id)}/edit">🌐 ＋ 添加中日英说明</a>` : ''}
    ${modules(i)}
    ${notBlank(i.tags) ? `<p class="muted">🏷 ${esc(i.tags)}</p>` : ''}

    <div class="stat-line"><span>做过 ${attempts(i)} 次</span><span>${acc == null ? '正确率 —' : '正确率 ' + acc + '%'}</span>
      <span>熟练度 ${masteryStars(i)}</span><span>下次复习：${esc(nextReviewLabel(i))}</span></div>

    <h3>🔗 关联 <a class="more" href="#/item/${esc(i.id)}/link">＋ 关联已有的</a></h3>
    ${parent ? `<h4>🔄 原题</h4>${card(parent)}` : ''}
    ${children.length ? `<h4>🔄 同类题（${children.length}）</h4>${cards(children)}` : ''}
    ${groups.map(([label, list]) => `<h4>${esc(label)}</h4>${list.map((v) => `<div class="link-row">${card(v.item)}
      <button class="x" data-unlink="${esc(v.linkId)}" title="取消关联">✕</button></div>`).join('')}`).join('')}
    ${!parent && !children.length && !groups.length ? '<p class="muted">还没有关联。可以用下面的按钮新建，或点右上「＋ 关联已有的」。</p>' : ''}

    <div class="chips">
      ${isWord(i) ? add({ type: 'WORD', linkFrom: i.id, relation: 'ASSOC' }, '＋ 💡 联想词') + add({ type: 'WORD', linkFrom: i.id, relation: 'SYNONYM' }, '＋ ≈ 近义词')
        + add({ type: 'WORD', linkFrom: i.id, relation: 'ANTONYM' }, '＋ ⇔ 反义词') + add({ type: 'WORD', linkFrom: i.id, relation: 'CONFUSE' }, '＋ ⚠️ 易混词')
        + add({ type: 'KNOWLEDGE', linkFrom: i.id, relation: 'KNOWLEDGE' }, '＋ 🧠 知识点') : ''}
      ${isQuestion(i) ? add({ type: 'QUESTION', linkedId: i.id }, '＋ 🔄 同类题') + add({ type: 'KNOWLEDGE', linkFrom: i.id, relation: 'KNOWLEDGE' }, '＋ 🧠 知识点')
        + add({ type: 'WORD', linkFrom: i.id, relation: 'WORD' }, '＋ 🇯🇵 题里的生词') : ''}
      ${i.type === 'KNOWLEDGE' ? add({ type: 'QUESTION', linkFrom: i.id, relation: 'KNOWLEDGE' }, '＋ 📂 归类一道题')
        + add({ type: 'WORD', linkFrom: i.id, relation: 'WORD' }, '＋ 🇯🇵 相关生词') + add({ type: 'KNOWLEDGE', linkFrom: i.id, relation: 'ASSOC' }, '＋ 💡 相关知识点') : ''}
    </div>
    ${parent || children.length || groups.length ? `<a class="primary" href="${link('/practice/start', { about: i.id })}">▶ 把这一组一起做（像过去问一样）</a>` : ''}

    <div class="actions three">
      <a class="secondary" href="#/item/${esc(i.id)}/edit">✏️ 编辑</a>
      <a class="secondary" href="${link('/library', { subject: i.subject, cat: i.category })}">📂 同分类</a>
      <a class="secondary" href="${link('/practice/start', { subject: i.subject, mode: 'random', n: 10 })}">✏️ 练同科目</a>
    </div>
    <div class="delete"><button type="button" id="del">🗑 删除</button></div>
  </main>`;

  return {
    html,
    mount(root) {
      bindTri(root);
      root.querySelector('#flag').addEventListener('click', async () => { await study.toggleFlag(i.id); refresh(); });
      root.querySelector('#del').addEventListener('click', async () => {
        if (!confirm('确定删除这条记录吗？删除后无法恢复。')) return;
        await study.remove(i.id);
        flash('✓ 已删除');
        go('/library');
      });
      root.querySelectorAll('[data-unlink]').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm('取消这个关联？（两条记录都不会被删除）')) return;
        await links.unlink(b.dataset.unlink);
        refresh();
      }));
    },
  };
}

// ============================ 关联已有的 ============================

export function linkPage({ params, query }) {
  const i = study.get(params.id);
  if (!i) return notFound();
  const rel = query.relation || (isWord(i) ? 'ASSOC' : isQuestion(i) ? 'SIMILAR' : 'KNOWLEDGE');
  const q = query.q || '';
  const found = (q ? study.search(q) : study.search(null, null, i.subject)).filter((x) => x.id !== i.id).slice(0, 30);
  const newType = { SIMILAR: 'QUESTION', KNOWLEDGE: i.type === 'KNOWLEDGE' ? 'QUESTION' : 'KNOWLEDGE', WORD: 'WORD',
    SYNONYM: 'WORD', ANTONYM: 'WORD', CONFUSE: 'WORD' }[rel] || i.type;

  return {
    html: `<main>
      ${header(back('#/item/' + i.id), '添加关联')}
      <p class="muted">给「${esc(i.title)}」添加关联</p>
      <form id="lf"><h3>关系</h3>${chips('relation', Object.entries(RELATIONS), rel, true)}
        <div class="search"><input name="q" value="${esc(q)}" placeholder="搜索要关联的题、知识点、生词…"><button>搜索</button></div></form>
      ${!q ? `<p class="muted">先列出 ${esc(i.subject)} 的记录，也可以搜索全部</p>` : ''}
      ${!found.length ? '<p class="muted">没有找到。</p>' : ''}
      ${found.map((r) => `<div class="link-row">${card(r)}<button class="link-btn" data-target="${esc(r.id)}">＋ 关联</button></div>`).join('')}
      <a class="secondary" href="${link('/add', { type: newType, linkFrom: i.id, relation: rel })}">没找到？新建一条并关联</a>
    </main>`,
    mount(root) {
      const f = root.querySelector('#lf');
      const submit = () => { const d = formData(f); go('/item/' + i.id + '/link', { relation: d.relation, q: d.q }); };
      f.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
      f.querySelectorAll('[data-auto]').forEach((r) => r.addEventListener('change', submit));
      root.querySelectorAll('[data-target]').forEach((b) => b.addEventListener('click', async () => {
        await links.link(i.id, b.dataset.target, rel);
        flash('✓ 已关联');
        go('/item/' + i.id);
      }));
    },
  };
}

export function notFound() {
  return { html: `<main>${header(back('#/'), '找不到')}<div class="empty"><h2>这条记录不存在</h2>
    <p class="muted">可能已经被删除了。</p><a class="primary" href="#/">回首页</a></div></main>` };
}
