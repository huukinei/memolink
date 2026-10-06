// 做题 / 复习（Ping-t 式选择题 + 卡片自评）
import { study, links } from '../services.js';
import { SUBJECTS, LETTERS, typeLabel, hasChoices, choice, isWord, notBlank } from '../model.js';
import { esc, nl, header, back, nav, cards, link, chips, formData, toast, trilingual, bindTri, modules, linksCompact, go, refresh } from '../ui.js';

// ---------- 做题进度（存在这个浏览器标签页里） ----------
const KEY = 'memolink.practice';

class Session {
  constructor(o) {
    Object.assign(this, { ids: [], dir: 'ja', index: 0, correct: 0, wrongIds: [], answered: false, chosen: null, lastCorrect: false }, o);
  }
  save() { try { sessionStorage.setItem(KEY, JSON.stringify(this)); } catch (e) { /* ignore */ } return this; }
  finished() { return this.index >= this.ids.length; }
  currentId() { return this.finished() ? null : this.ids[this.index]; }
  total() { return this.ids.length; }
  number() { return Math.min(this.index + 1, this.ids.length); }
  done() { return this.correct + this.wrongIds.length; }
  percent() { return this.done() ? Math.round(this.correct * 100 / this.done()) : 0; }
  progress() { return this.ids.length ? Math.round(this.index * 100 / this.ids.length) : 0; }
  answer(ch, ok) { this.answered = true; this.chosen = ch; this.lastCorrect = ok; return this.save(); }
  next(ok) { if (ok) this.correct++; else this.wrongIds.push(this.currentId()); return this.skip(); }
  skip() { this.index++; this.answered = false; this.chosen = null; return this.save(); }
}

export function currentSession() {
  try { const o = JSON.parse(sessionStorage.getItem(KEY)); return o ? new Session(o) : null; } catch (e) { return null; }
}
function startSession(ids, dir) { return new Session({ ids, dir: dir === 'zh' ? 'zh' : 'ja' }).save(); }

// ---------- 出题菜单 ----------
export function menuPage({ query }) {
  const ps = currentSession();
  const dueCount = study.due().length;
  return {
    html: `<main>${header(back('#/'), '做题')}
      ${ps && !ps.finished() ? `<a class="primary" href="#/practice/q">▶ 继续上次（${ps.number()} / ${ps.total()}）</a>` : ''}
      ${query.empty ? toast('没有符合条件的题，换个条件试试。', 'warn') : ''}
      <form id="pf">
        <h3>科目</h3>${chips('subject', [['', '全部'], ...SUBJECTS.map((s) => [s, s])], '')}
        <h3>类型</h3>${chips('type', [['', '全部'], ['QUIZ', '题目（错题＋同类题）'], ['KNOWLEDGE', '知识点'], ['WORD', '生词']], '')}
        <h3>题数</h3>${chips('n', [['10', '10'], ['20', '20'], ['50', '50']], '10')}
        <h3>生词方向</h3>${chips('dir', [['ja', '看日语 → 想意思'], ['zh', '看意思 → 想日语']], 'ja')}
        <h3>开始</h3>
        <div class="modes">
          <button type="button" data-mode="due">📅 今日复习<small>${dueCount} 题到期</small></button>
          <button type="button" data-mode="random">🎲 随机出题<small>从选中的范围里随机</small></button>
          <button type="button" data-mode="wrong">❌ 错题・苦手<small>上次不会 / 正确率低于 60%</small></button>
          <button type="button" data-mode="flagged">★ 标记的题<small>自己标了★的</small></button>
          <button type="button" data-mode="new">🆕 没做过的<small>新记录和导入的题</small></button>
        </div>
      </form></main>${nav('practice')}`,
    mount(root) {
      root.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
        const d = formData(root.querySelector('#pf'));
        go('/practice/start', Object.assign(d, { mode: b.dataset.mode }));
      }));
    },
  };
}

/** 开始一组：选题后跳到第一题 */
export function startAction({ query }) {
  const ids = query.about ? links.groupIds(query.about)
    : study.pick(query.subject, query.type, query.mode || 'random', parseInt(query.n || '10', 10));
  if (!ids.length) {
    location.replace(query.mode === 'due' ? '#/practice/done' : '#/practice?empty=1');
    return null;
  }
  startSession(ids, query.dir);
  location.replace('#/practice/q');
  return null;
}

// ---------- 一题 ----------
export function questionPage() {
  const ps = currentSession();
  if (!ps) { location.replace('#/practice'); return null; }
  let item;
  while (!ps.finished() && !(item = study.get(ps.currentId()))) ps.skip();   // 题被删了就跳过
  if (ps.finished()) { location.replace('#/practice/result'); return null; }

  const hints = study.hints(item), groups = links.grouped(item.id);
  const extras = trilingual(item) + modules(item) + linksCompact(groups);
  const word = isWord(item), choiceQ = !word && hasChoices(item);
  const opts = LETTERS.filter((L) => notBlank(choice(item, L)));
  let body = '';

  if (word) {
    const front = ps.dir === 'zh' ? (item.answer || item.enText || '') : item.title;
    body = `<div class="reviewcard"><h2 class="big">${esc(front)}</h2><details><summary>显示答案</summary>
      ${ps.dir === 'zh' ? `<p class="big">${esc(item.title)}</p>` : ''}
      ${notBlank(item.reading) ? `<p class="reading">${esc(item.reading)}</p>` : ''}
      ${ps.dir !== 'zh' ? `<p>${esc(item.answer || '')}</p>` : ''}${extras}</details></div>`;
  } else if (choiceQ) {
    body = `<div class="reviewcard short"><h2 class="pre">${nl(item.title)}</h2></div>`;
    if (!ps.answered) {
      body += `<div class="choices">${opts.map((L) => `<button data-choice="${L}"><b>${L}</b><span>${esc(choice(item, L))}</span></button>`).join('')}</div>`;
    } else {
      body += `<ol class="choices static">${opts.map((L) => `<li class="${L === item.correctChoice ? 'ok' : L === ps.chosen ? 'ng' : ''}">
          <b>${L}</b><span>${esc(choice(item, L))}</span></li>`).join('')}</ol>
        <div class="verdict ${ps.lastCorrect ? 'ok' : 'ng'}">${ps.lastCorrect ? '○ 正解！' : '× 不正解（正解是 ' + esc(item.correctChoice) + '）'}</div>
        ${notBlank(item.answer) ? `<section class="answer"><small>解说</small><p class="pre">${nl(item.answer)}</p></section>` : ''}
        ${notBlank(item.mistakeReason) ? `<section class="wrong"><p>上次错的原因：${esc(item.mistakeReason)}</p></section>` : ''}
        ${extras}
        <div class="next">${ps.lastCorrect
          ? `<button class="primary" data-rate="easy">下一题 →<small>${hints.easy}后再出</small></button>
             <button class="secondary" data-rate="hard">🤔 其实是蒙对的<small>${hints.hard}后再出</small></button>`
          : '<button class="primary" data-rate="again">下一题 →<small>10分钟后再出这题</small></button>'}</div>`;
    }
  } else {
    body = `<div class="reviewcard"><h2 class="pre">${nl(item.title)}</h2><details><summary>显示答案</summary>
      <p class="pre">${nl(item.answer || '')}</p>${trilingual(item)}
      ${notBlank(item.wrongAnswer) ? `<p class="muted">我当时的答案：${esc(item.wrongAnswer)}</p>` : ''}
      ${notBlank(item.mistakeReason) ? `<p class="muted">上次错的原因：${esc(item.mistakeReason)}</p>` : ''}
      ${modules(item)}${linksCompact(groups)}</details></div>`;
  }
  const ratings = word || !choiceQ ? `<div class="ratings">
      <button data-rate="again">😭 不会<small>${hints.again}</small></button>
      <button data-rate="hard">🤔 模糊<small>${hints.hard}</small></button>
      <button data-rate="easy">😎 会了<small>${hints.easy}</small></button></div>` : '';

  return {
    html: `<main>
      ${header('<a href="#/practice/result" title="结束">✕</a>', `${ps.number()} / ${ps.total()}`,
        `<button class="star-btn ${item.flagged ? 'on' : ''}" id="flag" title="标记">${item.flagged ? '★' : '☆'}</button>`)}
      <div class="bar"><i style="width:${ps.progress()}%"></i></div>
      <span class="pill">${esc(typeLabel(item.type) + ' · ' + item.subject + ' · ' + item.category)}</span>
      ${notBlank(item.source) ? `<span class="pill src">📌 ${esc(item.source)}</span>` : ''}
      ${body}${ratings}
      <p class="center"><a class="muted" href="#/item/${esc(item.id)}">查看详情 / 编辑</a></p></main>`,
    mount(root) {
      bindTri(root);
      root.querySelector('#flag').addEventListener('click', async () => { await study.toggleFlag(item.id); refresh(); });
      root.querySelectorAll('[data-choice]').forEach((b) => b.addEventListener('click', () => {
        if (ps.answered) return;
        const ch = b.dataset.choice;
        ps.answer(ch, ch.toUpperCase() === String(item.correctChoice).toUpperCase());
        refresh();
      }));
      root.querySelectorAll('[data-rate]').forEach((b) => b.addEventListener('click', async () => {
        let result = b.dataset.rate, correct;
        if (ps.answered) { correct = ps.lastCorrect; if (!correct) result = 'again'; }   // 选错了一定算“不会”
        else correct = result !== 'again';
        await study.review(item.id, result, correct);
        ps.next(correct);
        if (ps.finished()) go('/practice/result'); else refresh();
      }));
    },
  };
}

// ---------- 结果 ----------
export function resultPage() {
  const ps = currentSession();
  if (!ps) { location.replace('#/practice'); return null; }
  const wrong = ps.wrongIds.map((id) => study.get(id)).filter(Boolean);
  return {
    html: `<main>${header('<a href="#/">✕</a>', '结果')}
      <section class="hero center"><small>${ps.finished() ? '全部完成' : '中途结束'}</small>
        <h1>${ps.correct} / ${ps.done()}</h1><p class="score">${ps.percent()}%</p></section>
      ${wrong.length ? `<button class="primary" id="retry">❌ 只重做错的 ${wrong.length} 题</button>` : ''}
      <div class="actions">
        ${!ps.finished() ? '<a class="secondary" href="#/practice/q">继续做</a>' : ''}
        <a class="secondary" href="#/practice">再来一组</a><a class="secondary" href="#/">回首页</a></div>
      ${wrong.length ? '<h3>错的题</h3>' + cards(wrong) : ''}</main>`,
    mount(root) {
      const r = root.querySelector('#retry');
      if (r) r.addEventListener('click', () => { startSession(ps.wrongIds, ps.dir); go('/practice/q'); });
    },
  };
}

export function donePage() {
  return {
    html: `<main>${header('<a href="#/">✕</a>', '今日复习')}<div class="empty"><h2>🎉 今天完成了</h2>
      <p class="muted">今天到期的题都复习完了。</p>
      <a class="primary" href="${link('/practice/start', { mode: 'random' })}">🎲 再随机练 10 题</a>
      <a class="secondary" href="#/">回首页</a></div></main>`,
  };
}
