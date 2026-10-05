import { study } from '../services.js';
import { SUBJECTS } from '../model.js';
import { esc, header, back, formData, go, toast } from '../ui.js';

export function importPage({ query }) {
  return {
    html: `<main>${header(back('#/library'), '批量导入')}
      ${query.done != null ? toast(`✓ 导入了 ${query.done} 条，可以在「做题 → 没做过的」里练`) : ''}
      <form id="imf">
        <div class="row">
          <select name="type"><option value="WORD">生词</option><option value="QUESTION">题目</option><option value="KNOWLEDGE">知识点</option></select>
          <select name="subject">${SUBJECTS.map((s) => `<option value="${s}">${s}</option>`).join('')}</select>
        </div>
        <label>分类（可选，全部导入到这个分类）</label><input name="category" placeholder="例：ネットワーク / Day2">
        <label>内容（从 Excel 直接复制粘贴，一行一条）</label>
        <textarea name="text" class="tall" required placeholder="割り当てる	わりあてる	分配	assign"></textarea>
        <button class="primary sticky" type="submit">导入</button>
      </form>
      <details open><summary>格式说明</summary>
        <p class="muted">每列用 Tab（Excel 复制时自动是 Tab）或逗号分开。空行和 # 开头的行会跳过。只有第一列必填。</p>
        <p><b>生词</b>：单词 ｜ 读音 ｜ 中文意思 ｜ English ｜ 例句 ｜ 记忆法</p>
        <p><b>问答</b>：题目 ｜ 答案/解析 ｜ 标签 ｜ 出处</p>
        <p><b>四选一</b>：题目 ｜ A ｜ B ｜ C ｜ D ｜ 正解(A〜D) ｜ 解说 ｜ 出处（例：R5秋 問12）</p>
        <p class="muted">AML 的分类题 / 判定题：科目选 AML、分类填 Day2，标签列写 #三者分类 或 #规则判定。</p>
        <p class="muted">导入的新题不会一下子塞满“今日复习”，在「做题 → 🆕 没做过的」里练。</p>
      </details>
      <p class="center"><a class="muted" href="#/settings">从 Spring Boot 版搬数据 / 备份 → 设置</a></p>
    </main>`,
    mount(root) {
      const f = root.querySelector('#imf');
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const d = formData(f);
        const n = await study.importLines(d.type, d.subject, d.category, d.text);
        go('/import', { done: n });
      });
    },
  };
}
