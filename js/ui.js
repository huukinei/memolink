// 共用的画面部件（对应 Spring Boot 版的 fragments.html）
import { typeLabel, accuracy, isWeak, isWord, notBlank, blank, hasTri } from './model.js';

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
/** 换行保留 */
export const nl = (s) => esc(s).replace(/\n/g, '<br>');

/** 生成 #/path?query 链接（空值省略） */
export function link(path, params) {
  const q = Object.entries(params || {}).filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
  return '#' + path + (q ? '?' + q : '');
}

export function go(path, params) {
  const h = link(path, params);
  if (location.hash === h) refresh(); else location.hash = h.slice(1);
}
/** 重新显示当前页面（数据变了之后） */
export function refresh() { window.dispatchEvent(new HashChangeEvent('hashchange')); }

// 一次性提示（跳转后显示一次）
let flashMsg = null;
export function flash(m) { flashMsg = m; }
export function takeFlash() { const m = flashMsg; flashMsg = null; return m; }
export const toast = (m, cls) => (m ? `<div class="toast ${cls || ''}">${esc(m)}</div>` : '');

export function header(left, title, right) {
  return `<header>${left || '<span></span>'}<b>${title}</b>${right || '<span></span>'}</header>`;
}
export const back = (href, label) => `<a href="${href}">${label || '←'}</a>`;

export function nav(active) {
  const a = (k, href, icon, label) => `<a href="${href}" class="${active === k ? 'on' : ''}">${icon}<small>${label}</small></a>`;
  return `<nav>${a('home', '#/', '🏠', '首页')}${a('practice', '#/practice', '✏️', '做题')}
    <a class="plus" href="#/add" aria-label="快速记录">＋</a>${a('library', '#/library', '📚', '知识库')}${a('stats', '#/stats', '📊', '统计')}</nav>`;
}

/** 列表里的一张卡片 */
export function card(x) {
  const acc = accuracy(x);
  const sub = [x.subject, x.category, notBlank(x.source) ? x.source : null, isWord(x) && x.answer ? x.answer : null]
    .filter(Boolean).join(' · ');
  return `<a class="card" href="#/item/${esc(x.id)}">
    <div class="card-top"><span class="tag tag-${esc(x.type)}">${typeLabel(x.type)}</span>
      ${x.flagged ? '<span class="star">★</span>' : ''}
      ${acc != null ? `<span class="acc ${isWeak(x) ? 'bad' : ''}">${acc}%</span>` : ''}</div>
    <b>${esc(x.title)}</b><small>${esc(sub)}</small></a>`;
}
export const cards = (list) => list.map(card).join('');

/** 🌐 中日英板块 */
export function trilingual(x) {
  if (!hasTri(x)) return '';
  const lang = (cls, label, v) => `<div class="lang ${cls} ${blank(v) ? 'blank' : ''}"><b>${label}</b>
    <p class="pre">${blank(v) ? '（未填写）' : nl(v)}</p></div>`;
  return `<section class="tri"><div class="tri-tabs">
      <button type="button" class="on" data-tri="all">三语对照</button><button type="button" data-tri="ja">🇯🇵 日</button>
      <button type="button" data-tri="zh">🇨🇳 中</button><button type="button" data-tri="en">🇬🇧 英</button></div>
    <div class="tri-body" data-show="all">
      ${lang('ja', isWord(x) ? '🇯🇵 日语解释' : '🇯🇵 日本語（原文・用語）', x.jaText)}
      ${lang('zh', isWord(x) ? '🇨🇳 中文解释' : '🇨🇳 中文（翻译・理解）', x.zhText)}
      ${lang('en', '🇬🇧 English', x.enText)}</div></section>`;
}
/** 中日英切换（页面渲染后调用一次） */
export function bindTri(root) {
  root.querySelectorAll('.tri-tabs button').forEach((b) => b.addEventListener('click', () => {
    const box = b.closest('.tri');
    box.querySelector('.tri-body').setAttribute('data-show', b.dataset.tri);
    box.querySelectorAll('.tri-tabs button').forEach((x) => x.classList.toggle('on', x === b));
  }));
}

/** 🧩 备用模块 */
export function modules(x) {
  const sec = (cond, cls, title, body) => (cond ? `<section class="mod ${cls}"><b>${title}</b>${body}</section>` : '');
  const safeUrl = notBlank(x.refUrl) && /^https?:\/\//i.test(x.refUrl);
  return sec(notBlank(x.example), '', '📖 例句', `<p class="pre">${nl(x.example)}</p>`)
    + sec(notBlank(x.mnemonic), 'memo-box', '💡 记忆法 / 口诀', `<p class="pre">${nl(x.mnemonic)}</p>`)
    + sec(notBlank(x.relatedKeywords), '', '🔗 联想关键词', `<p>${esc(x.relatedKeywords)}</p>`)
    + sec(notBlank(x.memo), '', '📝 笔记', `<p class="pre">${nl(x.memo)}</p>`)
    + sec(notBlank(x.customBody1), '', '🧩 ' + esc(blank(x.customTitle1) ? '自定义模块 1' : x.customTitle1), `<p class="pre">${nl(x.customBody1)}</p>`)
    + sec(notBlank(x.customBody2), '', '🧩 ' + esc(blank(x.customTitle2) ? '自定义模块 2' : x.customTitle2), `<p class="pre">${nl(x.customBody2)}</p>`)
    + sec(notBlank(x.refUrl), '', '🌐 参考链接', safeUrl
      ? `<p><a class="url" href="${esc(x.refUrl)}" target="_blank" rel="noopener">${esc(x.refUrl)}</a></p>`
      : `<p>${esc(x.refUrl)}</p>`);
}

/** 做题时简洁显示关联 */
export function linksCompact(groups) {
  if (!groups || !groups.length) return '';
  return `<section class="links-compact">${groups.map(([label, list]) => `<div><b>${esc(label)}</b>${list.map((v) =>
    `<a href="#/item/${esc(v.item.id)}">${esc(v.item.title)}${isWord(v.item) && v.item.answer ? '（' + esc(v.item.answer) + '）' : ''}</a>`).join('')}</div>`).join('')}</section>`;
}

/** 单选“胶囊”按钮组：[[value,label],...] */
export function chips(name, options, current, auto) {
  return `<div class="chips">${options.map(([v, l]) => `<label class="chip"><input type="radio" name="${name}" value="${esc(v)}"
    ${String(current == null ? '' : current) === String(v) ? 'checked' : ''} ${auto ? 'data-auto' : ''}><span>${esc(l)}</span></label>`).join('')}</div>`;
}

/** 读取表单为对象 */
export function formData(form) {
  const o = {};
  new FormData(form).forEach((v, k) => { o[k] = typeof v === 'string' ? v : v; });
  return o;
}
