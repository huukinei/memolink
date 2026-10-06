// AML 多角度词汇记忆：专用编辑器 + 选择 / 半填空 / 完整填空
import { aml, study, shuffle } from '../services.js';
import { newItem, notBlank } from '../model.js';
import { esc, nl, header, back, link, flash, takeFlash, toast, go, refresh } from '../ui.js';

function termValue(t, key) {
  if (key === 'abbr') return t.title || '';
  if (key === 'en') return t.enText || '';
  if (key === 'ja') return t.jaText || '';
  if (key === 'zh') return t.zhText || t.answer || '';
  return '';
}

const LABEL = { abbr: '英文缩写', en: '英文全称', ja: '日语', zh: '中文' };
const LANG = { abbr: '缩写', en: 'English', ja: '日本語', zh: '中文' };

function cleanAnswers(s) {
  return String(s || '').split(/[\/／|｜;；]/).map((x) => normalize(x)).filter(Boolean);
}
function normalize(s) {
  return String(s == null ? '' : s).trim().toLowerCase().replace(/[\s　]+/g, ' ').replace(/[。．.、，,]/g, '');
}
function accepted(input, expected) {
  const a = normalize(input);
  if (!a) return false;
  const opts = cleanAnswers(expected);
  return opts.some((x) => a === x) || opts.some((x) => x.length >= 4 && (a.includes(x) || x.includes(a)));
}

function qPairs(term) {
  const fields = ['abbr', 'en', 'ja', 'zh'].filter((k) => notBlank(termValue(term, k)));
  const out = [];
  for (const from of fields) for (const to of fields) if (from !== to) out.push({ term, from, to });
  return out;
}

function makeChoiceQuestions(terms) {
  const all = [];
  terms.forEach((t) => all.push(...qPairs(t)));
  return shuffle(all).map((q) => {
    const right = termValue(q.term, q.to);
    const seen = new Set([normalize(right)]);
    const wrong = shuffle(terms).map((t) => termValue(t, q.to)).filter((v) => {
      const n = normalize(v);
      if (!n || seen.has(n)) return false;
      seen.add(n); return true;
    }).slice(0, 3);
    return Object.assign({}, q, { choices: shuffle([right, ...wrong]) });
  }).filter((q) => q.choices.length >= 2);
}

function blankTarget(text) {
  const s = String(text || '').trim();
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const i = words.length > 2 ? 1 : 0;
    const answer = words[i];
    const prompt = words.map((w, k) => k === i ? '______' : w).join(' ');
    return { prompt, answer };
  }
  if (/[一-龯々ぁ-んァ-ヶ]/.test(s) && s.length >= 4) {
    const n = Math.max(1, Math.floor(s.length / 2));
    return { prompt: '______' + s.slice(n), answer: s.slice(0, n) };
  }
  return { prompt: '______', answer: s };
}

export function termManagerPage({ query }) {
  const key = aml.dayKey(query.day || 'Day1');
  const terms = aml.terms(key);
  return {
    html: `<main>${header(back('#/aml/day/' + (parseInt(key.replace('Day',''),10)||1)), '✏️ 词汇内容管理')}
      ${toast(takeFlash())}
      <section class="term-help">
        <b>一条词汇，只录入一次</b>
        <p>填写「缩写 / 英文 / 日语 / 中文」，系统会自动从不同方向出题。以后加 PEP、STR、CDD 等也用同一套格式。</p>
      </section>
      <a class="primary" href="${link('/aml/term/new', { day: key })}">＋ 添加一个 AML 词汇</a>
      ${key === 'Day1' ? '<button class="secondary" id="upgrade-terms">旧版 Day1 词汇一键升级为中 / 日 / 英结构</button>' : ''}
      <h3>${esc(key)} 的词汇 <span class="more">${terms.length} 条</span></h3>
      <div class="term-list">${terms.length ? terms.map((t) => `<article class="term-row">
        <div class="term-main"><b>${esc(t.title)}</b><span>${esc(t.enText || '—')}</span></div>
        <div class="term-langs"><span>🇯🇵 ${esc(t.jaText || '未填写')}</span><span>🇨🇳 ${esc(t.zhText || t.answer || '未填写')}</span></div>
        ${t.mnemonic ? `<small>💡 ${esc(t.mnemonic)}</small>` : ''}
        <div class="term-actions"><a class="secondary" href="${link('/aml/term/' + encodeURIComponent(t.id) + '/edit', { day: key })}">编辑</a>
          <a class="secondary" href="#/item/${esc(t.id)}">详情</a></div>
      </article>`).join('') : '<div class="empty small"><p>还没有词汇。</p></div>'}</div>
    </main>`,
    mount(root) {
      const b = root.querySelector('#upgrade-terms');
      if (b) b.addEventListener('click', async () => {
        b.disabled = true;
        const n = await aml.upgradeLegacyTerms();
        flash(n ? '✓ 已升级 ' + n + ' 条 Day1 示例词汇' : '没有找到需要升级的旧版示例');
        refresh();
      });
    },
  };
}

function field(name, label, value, placeholder, required) {
  return `<label>${label}${required ? ' <em>*</em>' : ''}</label><input name="${name}" value="${esc(value || '')}" placeholder="${esc(placeholder || '')}" ${required ? 'required' : ''}>`;
}
function area(name, label, value, placeholder) {
  return `<label>${label}</label><textarea class="short" name="${name}" placeholder="${esc(placeholder || '')}">${esc(value || '')}</textarea>`;
}

export function termEditPage({ params, query }) {
  const editing = !!params.id;
  const old = editing ? study.get(params.id) : null;
  if (editing && !old) return { html: `<main>${header(back('#/aml'), '找不到词汇')}<p>这条记录不存在。</p></main>` };
  const key = aml.dayKey(query.day || (old && old.category) || 'Day1');
  const item = old || newItem({ type: 'WORD', subject: 'AML', category: key });
  return {
    html: `<main>${header(back(link('/aml/terms', { day: key })), editing ? '编辑 AML 词汇' : '添加 AML 词汇')}
      <form id="term-form" class="term-form">
        <section class="edit-section"><h3>① 基本对应</h3>
          ${field('title', '英文缩写 / 主词', item.title, '例：KYC', true)}
          ${field('enText', '英文全称', item.enText, '例：Know Your Customer', true)}
          ${field('jaText', '日语', item.jaText, '例：顧客確認', true)}
          ${field('zhText', '中文', item.zhText || item.answer, '例：客户身份识别 / 客户尽职调查', true)}
          ${field('reading', '日语读音（可选）', item.reading, '例：こきゃくかくにん')}
        </section>
        <section class="edit-section"><h3>② 帮助理解</h3>
          ${field('mnemonic', '记忆关键词 / 口诀', item.mnemonic, '例：誰？何のため？リスクは？')}
          ${area('customBody1', '一句话理解', item.customBody1, '例：确认客户是谁、为什么交易、风险程度如何。')}
          ${area('customBody2', '具体检查内容', item.customBody2, '例：本人情報 / 職業 / 取引目的 / 収入・資産 / 顧客リスク')}
          ${area('example', '例句 / 场景（可选）', item.example, '例：口座開設時に本人確認書類を確認する。')}
        </section>
        <section class="edit-section compact"><h3>③ 放到哪一天</h3>
          <label>学习日</label><select name="category">${aml.days().map((d) => `<option value="${d.key}" ${d.key === key ? 'selected' : ''}>${d.key} · ${esc(d.title)}</option>`).join('')}</select>
        </section>
        <button class="primary sticky" type="submit">保存</button>
        ${editing ? '<button class="danger secondary" type="button" id="term-delete">删除这条词汇</button>' : ''}
      </form></main>`,
    mount(root) {
      const form = root.querySelector('#term-form');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form); const v = Object.fromEntries(fd.entries());
        const payload = {
          type: 'WORD', subject: 'AML', category: v.category,
          title: v.title.trim(), enText: v.enText.trim(), jaText: v.jaText.trim(), zhText: v.zhText.trim(),
          answer: v.zhText.trim(), reading: v.reading.trim() || null,
          mnemonic: v.mnemonic.trim() || null, customBody1: v.customBody1.trim() || null,
          customBody2: v.customBody2.trim() || null, example: v.example.trim() || null,
          tags: [...new Set(((item.tags || '') + ' #AML词条').trim().split(/\s+/).filter(Boolean))].join(' '), source: item.source || 'AML 自定义词汇',
        };
        if (editing) await study.update(item.id, payload); else await study.save(Object.assign(newItem(), payload));
        flash('✓ 已保存：以后会自动生成多角度题目');
        go('/aml/terms', { day: v.category });
      });
      const del = root.querySelector('#term-delete');
      if (del) del.addEventListener('click', async () => {
        if (!confirm('确定删除这条词汇吗？')) return;
        await study.remove(item.id); flash('已删除'); go('/aml/terms', { day: key });
      });
    },
  };
}

export function termPlayPage({ query }) {
  const key = aml.dayKey(query.day || 'Day1');
  const mode = ['choice','half','full'].includes(query.mode) ? query.mode : 'choice';
  const terms = aml.terms(key).filter((t) => ['title','enText','jaText'].every((k) => notBlank(t[k])) && notBlank(t.zhText || t.answer));
  const questions = (mode === 'choice' ? makeChoiceQuestions(terms) : shuffle(terms.flatMap(qPairs))).slice(0, 24);
  const names = { choice: '选择题', half: '半填空', full: '完整填空' };
  return {
    html: `<main class="term-quiz">${header(back('#/aml/day/' + (parseInt(key.replace('Day',''),10)||1)), '① 多角度词汇 · ' + names[mode], '<span id="tq-progress"></span>')}
      <div class="bar"><i id="tq-bar" style="width:0%"></i></div><div id="tq-stage"></div></main>`,
    mount(root) {
      let idx = 0, right = 0, locked = false;
      const stage = root.querySelector('#tq-stage');
      const progress = root.querySelector('#tq-progress');
      const bar = root.querySelector('#tq-bar');
      if (!questions.length) {
        stage.innerHTML = `<div class="empty"><h2>词汇还不够</h2><p class="muted">至少添加 2 条完整的「缩写 / 英文 / 日语 / 中文」词汇后再练习。</p><a class="primary" href="${link('/aml/terms',{day:key})}">去添加内容</a></div>`;
        return;
      }
      function render() {
        locked = false;
        progress.textContent = Math.min(idx + 1, questions.length) + ' / ' + questions.length;
        bar.style.width = Math.round(idx * 100 / questions.length) + '%';
        if (idx >= questions.length) {
          bar.style.width = '100%';
          stage.innerHTML = `<section class="finish-card"><div class="finish-icon">✓</div><h2>完成</h2><p><b>${right}</b> / ${questions.length} 正确</p>
            <div class="actions"><a class="primary" href="${link('/aml/terms/play',{day:key,mode})}">再练一次</a><a class="secondary" href="#/aml/day/${parseInt(key.replace('Day',''),10)||1}">返回</a></div></section>`;
          return;
        }
        const q = questions[idx];
        const from = termValue(q.term, q.from), target = termValue(q.term, q.to);
        let body = `<section class="quiz-prompt"><span class="quiz-direction">${LANG[q.from]} → ${LANG[q.to]}</span><p class="quiz-question">${esc(from)}</p><small>${esc(LABEL[q.to])}是？</small></section>`;
        if (mode === 'choice') {
          body += `<div class="choices tq-choices">${q.choices.map((c, i) => `<button data-i="${i}"><b>${i+1}</b><span>${esc(c)}</span></button>`).join('')}</div>`;
        } else {
          const blank = mode === 'half' ? blankTarget(target) : { prompt: '请输入完整答案', answer: target };
          if (mode === 'half') body += `<section class="fill-hint"><span>${esc(blank.prompt)}</span></section>`;
          body += `<form id="tq-form" class="fill-form"><input id="tq-input" autocomplete="off" placeholder="${mode === 'half' ? '填写空缺部分' : '输入完整答案'}"><button class="primary" type="submit">确认</button></form>`;
          q._expected = mode === 'half' ? blank.answer : target;
        }
        body += '<div id="tq-feedback"></div>';
        stage.innerHTML = body;
        if (mode === 'choice') stage.querySelectorAll('.tq-choices button').forEach((b) => b.addEventListener('click', () => chooseChoice(q, +b.dataset.i)));
        else {
          const input = stage.querySelector('#tq-input'); input.focus();
          stage.querySelector('#tq-form').addEventListener('submit', (e) => { e.preventDefault(); chooseFill(q, input.value); });
        }
      }
      async function record(q, ok) { try { await aml.answer(q.term.id, ok); } catch (e) { console.error(e); } }
      function feedback(q, ok, user) {
        const target = termValue(q.term, q.to);
        const f = stage.querySelector('#tq-feedback');
        f.innerHTML = `<div class="verdict ${ok ? 'ok':'ng'}">${ok ? '○ 正解！':'× 再记一次'}</div>
          <section class="term-answer"><b>${esc(q.term.title)}</b><p>${esc(q.term.enText)}</p><p>🇯🇵 ${esc(q.term.jaText)}</p><p>🇨🇳 ${esc(q.term.zhText || q.term.answer)}</p>
          ${q.term.mnemonic ? `<small>💡 ${esc(q.term.mnemonic)}</small>` : ''}
          ${!ok && user ? `<small>你的答案：${esc(user)} / 正解：${esc(target)}</small>` : ''}</section>
          <button class="primary" id="tq-next">下一题 →</button>`;
        f.querySelector('#tq-next').addEventListener('click', () => { idx++; render(); });
      }
      function chooseChoice(q, i) {
        if (locked) return; locked = true;
        const buttons = stage.querySelectorAll('.tq-choices button');
        const target = termValue(q.term, q.to), selected = q.choices[i], ok = normalize(selected) === normalize(target);
        buttons.forEach((b, k) => { b.disabled = true; if (normalize(q.choices[k]) === normalize(target)) b.classList.add('ok'); else if (k === i) b.classList.add('ng'); });
        if (ok) right++; record(q, ok); feedback(q, ok);
      }
      function chooseFill(q, value) {
        if (locked) return; locked = true;
        const ok = accepted(value, q._expected);
        if (ok) right++; record(q, ok); feedback(q, ok, value);
      }
      render();
    },
  };
}
