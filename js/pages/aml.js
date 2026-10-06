// 🎮 AML 审查官养成：地图 / 某一天 / 游戏
import { aml, study, stats } from '../services.js';
import { esc, header, back, nav, cards, link, flash, takeFlash, toast, go, refresh } from '../ui.js';
import { runGame } from '../aml-game.js';

export function mapPage() {
  const days = aml.days(), level = aml.level(days), cleared = days.filter((d) => d.cleared).length;
  const t = stats.today(), cal = stats.lastDays(28), shadows = aml.shadows().slice(-12), weak = study.weak(8, 'AML');
  const seed = (big) => big
    ? `<div class="seed"><p><b>📥 先导入 Day 1</b><br><span class="muted">根据 Day 1 笔记：8 个词、三者分类 6 题、规则判定 5 题（「敷居値」已改为「閾値」）</span></p>
       <button class="primary" data-seed>一键导入 Day 1</button></div>`
    : '<p class="center"><button class="link-plain" data-seed>重新补充 Day 1 示例（已有的不会重复）</button></p>';
  return {
    html: `<main>${header(back('#/'), '🧠 AML Learning', '<a class="header-edit" href="#/aml/terms?day=Day1">✏️ 编辑</a>')}
      ${toast(takeFlash())}
      <section class="hero aml-hero"><small>你的 AML 学习路线</small><h1>${level}</h1>
        <p class="muted">通关 ${cleared} / 14 天 · 今天做了 ${t.count} 题 · 连续打卡 ${t.streak} 天</p>
        <div class="bar"><i style="width:${Math.round(cleared * 100 / 14)}%"></i></div>
        <p class="muted small-note">每天掌握 80% 以上就算通关。3 天 → アシスタント，6 天 → 審査担当，10 天 → シニア，14 天 → アナリスト</p></section>
      ${days[0].empty ? seed(true) : ''}
      <h3>打卡日历（近 4 周）</h3>
      <section class="heat">${cal.map((d) => `<i class="lv${d.level}" title="${d.label}：${d.count} 题"></i>`).join('')}</section>
      <h3>关卡地图</h3>
      <div class="daymap">${days.map((d) => `<a href="#/aml/day/${d.no}" class="day-card ${d.cleared ? 'cleared' : d.empty ? 'blank' : ''}">
          <span class="day-no">Day ${d.no}</span><span class="day-title">${esc(d.title)}</span>
          <span class="day-state">${d.cleared ? '✅ 通关' : d.empty ? '未添加内容' : d.percent + '%'}</span>
          <span class="mini-bar"><i style="width:${d.percent}%"></i></span></a>`).join('')}</div>
      ${shadows.length ? `<h3>🎙 跟读分数（最近 12 次）</h3><section class="bars">${shadows.map((s) =>
        `<div class="bar-col"><span class="num">${s.score}</span><i style="height:${s.score}%" title="${esc(s.text)}"></i></div>`).join('')}</section>` : ''}
      ${weak.length ? `<h3>弱点排行 <a class="more" href="${link('/practice/start', { subject: 'AML', mode: 'wrong', n: 20 })}">全部重做 →</a></h3>${cards(weak)}` : ''}
      ${!days[0].empty ? seed(false) : ''}
    </main>${nav('home')}`,
    mount(root) {
      root.querySelectorAll('[data-seed]').forEach((b) => b.addEventListener('click', async () => {
        b.disabled = true;
        const n = await aml.seedDay1();
        flash(n === 0 ? 'Day 1 的示例已经导入过了' : '✓ 导入了 Day 1 的 ' + n + ' 条');
        refresh();
      }));
    },
  };
}

export function dayPage({ params }) {
  const no = Math.max(1, Math.min(14, parseInt(params.no, 10) || 1));
  const d = aml.days()[no - 1];
  const shadowCount = aml.playData(d.key, 'shadow').length;
  const play = (game, dir) => link('/aml/play', { day: d.key, game, dir });
  const termPlay = (mode) => link('/aml/terms/play', { day: d.key, mode });
  const add = (q) => link('/add', Object.assign({ subject: 'AML', category: d.key }, q));
  const completeTerms = aml.terms(d.key).filter((t) => t.title && t.enText && t.jaText && (t.zhText || t.answer)).length;
  return {
    html: `<main>${header(back('#/aml'), 'Day ' + no, `<a class="header-edit" href="${link('/aml/terms',{day:d.key})}">✏️ 内容</a>`)}
      <h2>${esc(d.title)}</h2>
      <p class="muted">掌握 ${d.mastered} / ${d.total}（${d.percent}%）${d.cleared ? ' · ✅ 已通关' : ''}</p>
      <div class="bar"><i style="width:${d.percent}%"></i></div>

      <section class="learning-path"><span class="path-on">① 记忆</span><span>② 理解</span><span>③ 判断</span><span>④ 流程</span><span>⑤ 输出</span></section>

      <div class="games learning-modules">
        <div class="game-card learning-card ${completeTerms ? '' : 'off'}">
          <div class="module-head"><span class="module-no">01</span><div><b>多角度词汇记忆</b><small>缩写 ↔ 英文 ↔ 日语 ↔ 中文，同一个词从多个方向反复记忆</small></div></div>
          <div class="term-example"><span>KYC</span><i>→</i><span>Know Your Customer</span><i>↔</i><span>顧客確認</span><i>↔</i><span>客户身份识别</span></div>
          ${completeTerms ? `<div class="actions three"><a class="primary" href="${termPlay('choice')}">选择题</a><a class="secondary" href="${termPlay('half')}">半填空</a><a class="secondary" href="${termPlay('full')}">完整填空</a></div>` : '<p class="toast warn">先补全至少 2 条词汇的中 / 日 / 英信息。</p>'}
          <a class="add-link" href="${link('/aml/terms',{day:d.key})}">✏️ 管理词汇内容（${d.words} 条）</a>
        </div>

        <div class="game-card learning-card concept-card">
          <div class="module-head"><span class="module-no">02</span><div><b>概念理解</b><small>不是背翻译，而是理解“它到底在检查什么”</small></div></div>
          <div class="memory-hooks"><span><b>KYC</b>誰？何のため？リスクは？</span><span><b>Filtering</b>誰と取引する？</span><span><b>Monitoring</b>どう取引している？</span></div>
          <a class="secondary" href="${link('/library',{subject:'AML',cat:d.key,type:'KNOWLEDGE'})}">查看这一天的知识点</a>
          <a class="add-link" href="${add({type:'KNOWLEDGE'})}">＋ 添加概念说明</a>
        </div>

        <div class="game-card learning-card ${d.classify ? '' : 'off'}">
          <div class="module-head"><span class="module-no">03</span><div><b>分类判断</b><small>关键词 → 句子 → 场景：判断属于 KYC / Filtering / Monitoring</small></div></div>
          ${d.classify ? `<a class="primary" href="${play('classify')}">开始判断（${d.classify} 题）</a>` : ''}
          <a class="add-link" href="${add({ type: 'QUESTION', tags: '#三者分类' })}">＋ 添加分类题</a>
        </div>

        <div class="game-card learning-card ${d.rule ? '' : 'off'}">
          <div class="module-head"><span class="module-no">04</span><div><b>业务流程理解</b><small>Scenario → Threshold → Hit → Alert → 人工确认</small></div></div>
          <div class="flow-mini"><span>取引</span><i>→</i><span>Scenario</span><i>→</i><span>閾値</span><i>→</i><span>Hit</span><i>→</i><span>Alert</span></div>
          ${d.rule ? `<a class="primary" href="${play('rule')}">规则判定（${d.rule} 题）</a>` : ''}
          <a class="add-link" href="${add({ type: 'QUESTION', tags: '#规则判定' })}">＋ 添加流程 / 判定题</a>
        </div>

        <div class="game-card learning-card ${shadowCount ? '' : 'off'}">
          <div class="module-head"><span class="module-no">05</span><div><b>案例与日语输出</b><small>先理解 → 自己说明 → 听标准音 → 跟读</small></div></div>
          ${shadowCount ? `<a class="primary" href="${play('shadow')}">日语输出 / 跟读（${shadowCount} 句）</a>` : ''}
          <span class="add-link muted">句子来自：例句 / 生词 / 标签 #跟读</span>
        </div>
      </div>
      <div class="actions"><a class="secondary" href="${link('/library', { subject: 'AML', cat: d.key })}">📚 全部内容</a>
        <a class="secondary" href="#/import">📥 批量导入</a></div>
      <p class="muted small-note">推荐：先把 ① 多角度词汇记忆 的内容补齐，再逐步增加理解、判断和案例。内容都可以自己编辑。</p>
    </main>`,
  };
}

export function playPage({ query }) {
  const key = aml.dayKey(query.day || 'Day1');
  const no = Math.max(1, Math.min(14, parseInt(String(key).replace('Day', ''), 10) || 1));
  const game = query.game || 'vocab';
  const dir = query.dir === 'zh' || query.dir === 'listen' ? query.dir : 'ja';
  return {
    html: `<main id="game">
      ${header(`<a href="#/aml/day/${no}">✕</a>`, '<span id="g-title">AML</span>', '<span id="g-progress"></span>')}
      <div class="bar"><i id="g-bar" style="width:0%"></i></div>
      <div class="hud"><span id="g-score">0 分</span><span id="g-combo"></span><span id="g-time">0s</span></div>
      <div id="g-voice-bar"></div><div id="g-stage"></div></main>`,
    mount() {
      return runGame({ game, dir, day: key, dayNo: no, data: aml.playData(key, game), pool: game === 'vocab' ? aml.wordPool() : [] }, {
        answer: (id, ok) => aml.answer(id, ok),
        shadow: (id, score, text, heard) => aml.shadow(id, text, heard, score),
        retry: () => refresh(),
      });
    },
  };
}
