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
    html: `<main>${header(back('#/'), '🎮 AML 审查官养成')}
      ${toast(takeFlash())}
      <section class="hero aml-hero"><small>现在的等级</small><h1>${level}</h1>
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
  const add = (q) => link('/add', Object.assign({ subject: 'AML', category: d.key }, q));
  return {
    html: `<main>${header(back('#/aml'), 'Day ' + no)}
      <h2>${esc(d.title)}</h2>
      <p class="muted">掌握 ${d.mastered} / ${d.total}（${d.percent}%）${d.cleared ? ' · ✅ 已通关' : ''}</p>
      <div class="bar"><i style="width:${d.percent}%"></i></div>
      <div class="games">
        <div class="game-card ${d.words ? '' : 'off'}"><b>🃏 ① 词卡速记</b><small>${d.words} 个词 · 4 选 1 抢答，连击加分</small>
          ${d.words ? `<div class="actions"><a class="primary" href="${play('vocab', 'ja')}">日 → 中</a><a class="secondary" href="${play('vocab', 'zh')}">中 → 日</a></div>
          <a class="primary listen-btn" href="${play('vocab', 'listen')}">👂 听音速答（只听发音，选意思）</a>` : ''}
          <a class="add-link" href="${add({ type: 'WORD' })}">＋ 添加生词</a></div>
        <div class="game-card ${d.classify ? '' : 'off'}"><b>🗂 ② 三者分类</b><small>${d.classify} 题 · 这是 KYC、フィルタリング 还是 モニタリング？</small>
          ${d.classify ? `<a class="primary" href="${play('classify')}">开始</a>` : ''}
          <a class="add-link" href="${add({ type: 'QUESTION', tags: '#三者分类' })}">＋ 添加分类题</a></div>
        <div class="game-card ${d.rule ? '' : 'off'}"><b>⚖️ ③ 规则判定</b><small>${d.rule} 题 · 这笔交易会不会ヒット？</small>
          ${d.rule ? `<a class="primary" href="${play('rule')}">开始</a>` : ''}
          <a class="add-link" href="${add({ type: 'QUESTION', tags: '#规则判定' })}">＋ 添加判定题</a></div>
        <div class="game-card ${shadowCount ? '' : 'off'}"><b>🎙 ④ 影子跟读</b><small>${shadowCount} 句 · 听标准音 → 跟读录音 → 自动打分</small>
          ${shadowCount ? `<a class="primary" href="${play('shadow')}">开始</a>` : ''}
          <span class="add-link muted">句子来自：例句 / 生词 / 标签 #跟读</span></div>
      </div>
      <div class="actions"><a class="secondary" href="${link('/library', { subject: 'AML', cat: d.key })}">📚 这一天的全部记录</a>
        <a class="secondary" href="#/import">📥 批量导入</a></div>
      <p class="muted small-note">提示：分类填 <b>${d.key}</b>、科目选 AML，记录就会出现在这一天。</p>
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
