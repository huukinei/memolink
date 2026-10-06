import { study, stats } from '../services.js';
import { SUBJECTS } from '../model.js';
import { esc, header, back, nav, cards, link } from '../ui.js';

export function statsPage() {
  const t = stats.today(), days = stats.lastDays(7), rows = stats.bySubject(SUBJECTS), weak = study.weak(10);
  return {
    html: `<main>${header(back('#/'), '统计', '<a href="#/settings" title="设置">⚙️</a>')}
      <div class="tiles"><div><small>今天做题</small><b>${t.count}</b></div><div><small>今天正确率</small><b>${t.percent}%</b></div>
        <div><small>连续学习</small><b>${t.streak} 天</b></div></div>
      <h3>近 7 天</h3>
      <section class="bars">${days.map((d) => `<div class="bar-col"><span class="num">${d.count}</span>
        <i style="height:${d.height}%"></i><small>${d.label}</small></div>`).join('')}</section>
      <h3>各科目</h3>
      <section class="table-wrap"><table>
        <tr><th>科目</th><th>条目</th><th>做过</th><th>正确率</th><th>到期</th><th>苦手</th></tr>
        ${rows.map((r) => `<tr><td><a href="${link('/library', { subject: r.subject })}">${esc(r.subject)}</a></td>
          <td>${r.total}</td><td>${r.done}</td><td>${r.accuracy == null ? '—' : r.accuracy + '%'}</td><td>${r.due}</td>
          <td>${r.weak > 0 ? `<a href="${link('/practice/start', { subject: r.subject, mode: 'wrong', n: 20 })}">${r.weak} ▶</a>` : '0'}</td></tr>`).join('')}
      </table></section>
      <h3>薄弱题 TOP 10</h3>
      ${weak.length ? cards(weak) : '<p class="muted">还没有薄弱题。</p>'}
    </main>${nav('stats')}`,
  };
}
