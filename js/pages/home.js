import { study, stats } from '../services.js';
import { SUBJECTS } from '../model.js';
import { esc, header, nav, cards, link, takeFlash, toast } from '../ui.js';
import { currentSession } from './practice.js';

export function home() {
  const due = study.due(), recent = study.recent(6), weak = study.weak(5), t = stats.today();
  const ps = currentSession();
  const live = ps && !ps.finished();
  return {
    html: `<main>
      ${header('<b>MemoLink 🧠</b>', '', '<a href="#/library" aria-label="搜索">🔍</a>').replace('<b></b>', '')}
      ${toast(takeFlash())}
      <section class="hero">
        <small>今天需要复习</small><h1>${due.length} 个</h1>
        <p class="muted">今天已做 ${t.count} 题 · 正确率 ${t.percent}% · 连续学习 ${t.streak} 天</p>
        ${live ? `<a class="primary" href="#/practice/q">▶ 继续上次做题（${ps.number()} / ${ps.total()}）</a>` : ''}
        ${!live && due.length ? `<a class="primary" href="${link('/practice/start', { mode: 'due', n: 100 })}">▶ 开始今日复习</a>` : ''}
        ${!live && !due.length ? `<a class="primary" href="${link('/practice/start', { mode: 'random', n: 10 })}">🎉 今天复习完了 · 随机练 10 题</a>` : ''}
        ${live && due.length ? `<a class="secondary" href="${link('/practice/start', { mode: 'due', n: 100 })}">开始今日复习</a>` : ''}
      </section>

      <a class="aml-entry" href="#/aml"><span>🎮</span>
        <div><b>AML 审查官养成</b><small>词卡速记 · 三者分类 · 规则判定 · 影子跟读</small></div><span class="more">→</span></a>

      <h3>快速记录</h3>
      <div class="quick">
        <a href="#/add?type=MISTAKE">❌<span>错题</span></a><a href="#/add?type=WORD">🇯🇵<span>生词</span></a>
        <a href="#/add?type=KNOWLEDGE">🧠<span>知识点</span></a><a href="#/add?type=QUESTION">🔄<span>同类题</span></a>
      </div>

      <h3>按科目练 10 题</h3>
      <div class="chips">
        ${SUBJECTS.map((s) => `<a class="chip-link" href="${link('/practice/start', { subject: s, mode: 'random', n: 10 })}">${esc(s)}</a>`).join('')}
        <a class="chip-link" href="${link('/practice/start', { type: 'WORD', mode: 'random', n: 20 })}">🇯🇵 背生词</a>
      </div>

      ${weak.length ? `<h3>薄弱题 <a class="more" href="${link('/practice/start', { mode: 'wrong', n: 20 })}">全部重做 →</a></h3>${cards(weak)}` : ''}

      <h3>最近记录 <a class="more" href="#/library">全部 →</a></h3>
      ${recent.length ? cards(recent) : '<p class="muted">还没有记录。做题时遇到错题，点上面的「❌ 错题」先记下来。也可以先去「🎮 AML 审查官养成」一键导入 Day 1。</p>'}
    </main>${nav('home')}`,
  };
}
