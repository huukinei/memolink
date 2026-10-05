// =====================================================================
// 业务逻辑：对应 Spring Boot 版的 StudyService / LinkService / StatsService / AmlService
// 只通过 store（相当于 Repository）读写数据
// =====================================================================
import {
  normalize, newItem, EDITABLE, INTERVAL_DAYS, blank, notBlank, isWeak, accuracy, attempts, isDue, isWord,
  isQuestion, hasChoices, choice, LETTERS, dayId, time,
} from './model.js';
import { store } from './store/index.js';

// ============================ StudyService ============================

export const study = {
  all() { return store.all('items'); },
  get(id) { return store.get('items', id); },

  async save(i) {
    normalize(i);
    return store.save('items', i);
  },

  /** 编辑：只覆盖表单字段，复习记录保留 */
  async update(id, form) {
    const i = this.get(id);
    if (!i) return null;
    const copy = Object.assign({}, i);
    for (const k of EDITABLE) if (k in form) copy[k] = form[k];
    return this.save(copy);
  },

  async remove(id) {
    for (const l of store.all('links')) if (l.fromId === id || l.toId === id) store.remove('links', l.id);
    for (const c of this.linked(id)) store.save('items', Object.assign({}, c, { linkedId: null }));
    return store.remove('items', id);
  },

  async toggleFlag(id) {
    const i = this.get(id);
    if (i) await store.save('items', Object.assign({}, i, { flagged: !i.flagged }));
  },

  recent(n) {
    return this.all().slice().sort((a, b) => time(b.createdAt) - time(a.createdAt)).slice(0, n || 6);
  },
  due() {
    const now = Date.now();
    return this.all().filter((i) => isDue(i, now)).sort((a, b) => time(a.nextReview) - time(b.nextReview));
  },
  linked(id) { return this.all().filter((i) => i.linkedId === id); },

  byTypeAndSubject(type, subject) {
    return this.all().filter((i) => blank(subject) || subject === i.subject)
      .filter((i) => blank(type) || (type === 'QUIZ' && isQuestion(i)) || type === i.type);
  },

  /** 知识库：关键字 + 类型 + 科目 + 特殊筛选 + 分类，新的在前 */
  search(q, type, subject, filter, cat) {
    const kw = blank(q) ? null : q.trim().toLowerCase();
    return this.byTypeAndSubject(type, subject)
      .filter((i) => blank(cat) || cat === i.category)
      .filter((i) => kw == null || matches(i, kw))
      .filter((i) => filter === 'flagged' ? i.flagged : filter === 'weak' ? isWeak(i) : filter === 'new' ? attempts(i) === 0 : true)
      .sort((a, b) => time(b.createdAt) - time(a.createdAt));
  },

  weak(limit, subject) {
    return this.all().filter(isWeak).filter((i) => blank(subject) || i.subject === subject)
      .sort((a, b) => (accuracy(a) || 0) - (accuracy(b) || 0)).slice(0, limit);
  },

  categories() {
    return [...new Set(this.all().map((i) => i.category).filter((c) => notBlank(c) && c !== '未分类'))].sort();
  },
  categoryCounts(type, subject) {
    const m = {};
    for (const i of this.byTypeAndSubject(type, subject)) {
      const c = blank(i.category) ? '未分类' : i.category;
      m[c] = (m[c] || 0) + 1;
    }
    return Object.keys(m).sort().map((k) => [k, m[k]]);
  },
  sources() { return [...new Set(this.all().map((i) => i.source).filter(notBlank))].sort(); },
  tags() {
    const s = new Set();
    for (const i of this.all()) if (notBlank(i.tags)) i.tags.split(/[\s,，、]+/).filter(Boolean).forEach((t) => s.add(t));
    return [...s].sort();
  },

  /** 选题。mode：due / random / wrong / flagged / new */
  pick(subject, type, mode, n) {
    const now = Date.now();
    let list = this.byTypeAndSubject(type, subject);
    switch (mode) {
      case 'due': list = list.filter((i) => isDue(i, now)).sort((a, b) => time(a.nextReview) - time(b.nextReview)); break;
      case 'wrong': list = shuffle(list.filter(isWeak)); break;
      case 'flagged': list = shuffle(list.filter((i) => i.flagged)); break;
      case 'new': list = list.filter((i) => attempts(i) === 0).sort((a, b) => time(a.createdAt) - time(b.createdAt)); break;
      default: list = shuffle(list);
    }
    return list.slice(0, Math.max(1, n || 10)).map((i) => i.id);
  },

  /**
   * 记录一次作答并安排下次复习（和 Java 版一样）
   * again：熟练度 -1，10 分钟后 / hard：间隔减半（≥1 天）/ easy：熟练度 +1，3→7→14→30→60 天
   */
  async review(id, result, correct) {
    const i = this.get(id);
    if (!i) return;
    if (correct === undefined) correct = result !== 'again';
    const m = Math.max(0, Math.min(5, i.mastery || 0));
    const now = new Date();
    const u = Object.assign({}, i);
    if (result === 'again') {
      u.mastery = Math.max(0, m - 1);
      u.nextReview = new Date(now.getTime() + 10 * 60000).toISOString();
    } else if (result === 'hard') {
      u.nextReview = addDays(now, Math.max(1, Math.floor(INTERVAL_DAYS[m] / 2))).toISOString();
    } else {
      const nm = Math.min(5, m + 1);
      u.mastery = nm;
      u.nextReview = addDays(now, INTERVAL_DAYS[nm]).toISOString();
    }
    u.attempts = attempts(i) + 1;
    if (correct) u.correctCount = (i.correctCount || 0) + 1;
    u.lastResult = result;
    u.lastAnsweredAt = now.toISOString();
    await Promise.all([store.save('items', u), stats.record(correct)]);
  },

  hints(i) {
    const m = Math.max(0, Math.min(5, i.mastery || 0));
    return { again: '10分钟', hard: Math.max(1, Math.floor(INTERVAL_DAYS[m] / 2)) + '天', easy: INTERVAL_DAYS[Math.min(5, m + 1)] + '天' };
  },

  /**
   * 批量导入。每行一条，用 Tab 或逗号分隔。
   * 生词：单词, 读音, 中文意思, English, 例句, 记忆法
   * 其他：题目, 答案, 标签, 出处   或   题目, A, B, C, D, 正解, 解析, 出处
   */
  async importLines(type, subject, category, text) {
    if (blank(text)) return 0;
    const jobs = [];
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim() || line.trim().startsWith('#')) continue;
      const c = (line.includes('\t') ? line.split('\t') : line.split(/[,，]/)).map((x) => x.trim());
      if (!c[0]) continue;
      const col = (k) => (k < c.length && c[k] !== '' ? c[k] : null);
      const i = newItem({ type: type || 'KNOWLEDGE', subject, category, title: c[0], nextReview: null });
      if (type === 'WORD') {
        Object.assign(i, { reading: col(1), answer: col(2), enText: col(3), example: col(4), mnemonic: col(5) });
      } else if (c.length >= 6 && col(5) && /^[ABCD]$/i.test(col(5))) {
        Object.assign(i, { choiceA: col(1), choiceB: col(2), choiceC: col(3), choiceD: col(4), correctChoice: col(5), answer: col(6), source: col(7) });
      } else {
        Object.assign(i, { answer: col(1), tags: col(2), source: col(3) });
      }
      jobs.push(this.save(i));
    }
    await Promise.all(jobs);
    return jobs.length;
  },
};

function matches(i, kw) {
  return ['title', 'answer', 'tags', 'jaText', 'zhText', 'enText', 'reading', 'relatedKeywords', 'category',
    'choiceA', 'choiceB', 'choiceC', 'choiceD', 'wrongAnswer', 'example', 'mnemonic', 'source', 'memo',
    'customBody1', 'customBody2'].some((k) => i[k] != null && String(i[k]).toLowerCase().includes(kw));
}

export function shuffle(a) {
  a = a.slice();
  for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; }
  return a;
}
function addDays(d, n) { return new Date(d.getTime() + n * 86400000); }

// ============================ LinkService ============================

export const links = {
  /** 建立关联（自己连自己、重复的会忽略） */
  async link(fromId, toId, relation) {
    if (!fromId || !toId || fromId === toId || !study.get(fromId) || !study.get(toId)) return;
    const rel = RELATION_KEYS.includes(relation) ? relation : 'ASSOC';
    const exists = store.all('links').some((l) => l.relation === rel &&
      ((l.fromId === fromId && l.toId === toId) || (l.fromId === toId && l.toId === fromId)));
    if (!exists) await store.save('links', { id: null, fromId, toId, relation: rel, createdAt: new Date().toISOString() });
  },
  async unlink(linkId) { return store.remove('links', linkId); },

  /** 某条记录的所有关联，按种类分组（双向），标题按“对方是什么”显示 */
  grouped(id) {
    const out = [];
    const idx = {};
    const all = store.all('links').filter((l) => l.fromId === id || l.toId === id);
    for (const r of RELATION_KEYS) {
      for (const l of all) {
        if (l.relation !== r) continue;
        const o = study.get(l.fromId === id ? l.toId : l.fromId);
        if (!o) continue;
        const label = linkLabel(r, o);
        if (!(label in idx)) { idx[label] = out.length; out.push([label, []]); }
        out[idx[label]][1].push({ linkId: l.id, item: o });
      }
    }
    return out;
  },

  /** 和这条相关的所有记录 id（含同类题的原题 / 子题），用于“一起做这一组” */
  groupIds(id) {
    const ids = new Set();
    const i = study.get(id);
    if (i) { ids.add(i.id); if (i.linkedId) ids.add(i.linkedId); }
    study.linked(id).forEach((c) => ids.add(c.id));
    for (const l of store.all('links')) if (l.fromId === id || l.toId === id) { ids.add(l.fromId); ids.add(l.toId); }
    return [...ids].filter((x) => study.get(x));
  },
};
const RELATION_KEYS = ['SIMILAR', 'KNOWLEDGE', 'WORD', 'SYNONYM', 'ANTONYM', 'CONFUSE', 'ASSOC'];

function linkLabel(relation, other) {
  if (relation === 'KNOWLEDGE' || relation === 'WORD') {
    if (other.type === 'KNOWLEDGE') return '🧠 知识点';
    if (isWord(other)) return '🇯🇵 相关生词';
    return '📂 归类在这里的题';
  }
  return { SIMILAR: '🔄 同类题', SYNONYM: '≈ 近义词', ANTONYM: '⇔ 反义词', CONFUSE: '⚠️ 易混淆' }[relation] || '💡 联想';
}

// ============================ StatsService ============================
// 做题记录按“天”汇总存一条（节省云端读写次数）：days/{YYYY-MM-DD} = { count, correct }

export const stats = {
  async record(correct) {
    const id = dayId();
    const d = store.get('days', id) || { id, count: 0, correct: 0 };
    await store.save('days', { id, count: (d.count || 0) + 1, correct: (d.correct || 0) + (correct ? 1 : 0) });
  },
  day(date) { return store.get('days', dayId(date)) || { count: 0, correct: 0 }; },
  today() {
    const d = this.day(new Date());
    return { count: d.count, percent: d.count ? Math.round(d.correct * 100 / d.count) : 0, streak: this.streak() };
  },
  streak() {
    const has = new Set(store.all('days').filter((d) => d.count > 0).map((d) => d.id));
    const d = new Date();
    if (!has.has(dayId(d))) d.setDate(d.getDate() - 1);
    let n = 0;
    while (has.has(dayId(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  },
  lastDays(n) {
    const out = [];
    for (let k = n - 1; k >= 0; k--) {
      const d = new Date(); d.setDate(d.getDate() - k);
      const r = this.day(d);
      out.push({ label: (d.getMonth() + 1) + '/' + d.getDate(), count: r.count, correct: r.correct });
    }
    const max = Math.max(0, ...out.map((x) => x.count));
    out.forEach((x) => {
      x.height = max ? Math.round(x.count * 100 / max) : 0;
      x.level = x.count === 0 ? 0 : x.count <= 5 ? 1 : x.count <= 15 ? 2 : x.count <= 30 ? 3 : 4;
    });
    return out;
  },
  bySubject(subjects) {
    const now = Date.now();
    return subjects.map((s) => {
      const l = study.all().filter((i) => i.subject === s);
      const att = l.reduce((a, i) => a + attempts(i), 0);
      const cor = l.reduce((a, i) => a + (i.correctCount || 0), 0);
      return { subject: s, total: l.length, done: l.filter((i) => attempts(i) > 0).length,
        accuracy: att ? Math.round(cor * 100 / att) : null, due: l.filter((i) => isDue(i, now)).length, weak: l.filter(isWeak).length };
    });
  },
};

// ============================ AmlService ============================

export const DAY_TITLES = ['AMLの全体像', 'KYC① 本人確認', 'KYC② 顧客リスク', 'フィルタリングの基礎', 'フィルタリングの公式事例',
  'モニタリングの基礎', 'シナリオ・閾値・アラート', 'モニタリング事例① 取引金額の急増', 'モニタリング事例② 高頻度・多数相手との取引',
  'モニタリング事例③ 収入と取引内容の不一致', '海外送金・高リスク国', '資金の流れを通した総合事例', 'AMLシステムを開発の視点から理解する',
  '総合演習＋先輩への質問・確認'];
const LEVELS = ['新人', 'アシスタント', '審査担当', 'シニア審査担当', 'アナリスト'];

export const aml = {
  /** 「Day 1」「day01」→「Day1」 */
  dayKey(category) {
    if (category == null) return '';
    const m = String(category).replace(/\s/g, '').match(/^day0*(\d{1,2})$/i);
    return m ? 'Day' + m[1] : category;
  },
  items() { return study.all().filter((i) => i.subject === 'AML'); },
  hasTag: (i, t) => i.tags != null && i.tags.includes(t),

  days() {
    const by = {};
    for (const i of this.items()) (by[this.dayKey(i.category)] = by[this.dayKey(i.category)] || []).push(i);
    return DAY_TITLES.map((title, k) => {
      const items = by['Day' + (k + 1)] || [];
      const mastered = items.filter((i) => (i.correctCount || 0) > 0 && !isWeak(i)).length;
      const percent = items.length ? Math.round(mastered * 100 / items.length) : 0;
      return { no: k + 1, key: 'Day' + (k + 1), title, total: items.length, mastered, percent,
        cleared: items.length > 0 && percent >= 80, empty: items.length === 0,
        words: items.filter(isWord).length,
        classify: items.filter((i) => hasChoices(i) && this.hasTag(i, '三者分类')).length,
        rule: items.filter((i) => hasChoices(i) && this.hasTag(i, '规则判定')).length };
    });
  },
  level(days) {
    const c = days.filter((d) => d.cleared).length;
    return LEVELS[c >= 14 ? 4 : c >= 10 ? 3 : c >= 6 ? 2 : c >= 3 ? 1 : 0];
  },

  card(i) {
    return { id: i.id, title: i.title, reading: i.reading || '', answer: i.answer || '', en: i.enText || '',
      example: i.example || '', mnemonic: i.mnemonic || '', correct: i.correctChoice || '',
      choices: LETTERS.filter((L) => notBlank(choice(i, L))).map((L) => ({ k: L, v: choice(i, L) })) };
  },
  shadowText(i) {
    if (notBlank(i.example)) return i.example;
    if (isWord(i)) return i.title;
    if (this.hasTag(i, '跟读')) return i.title;
    if (notBlank(i.jaText) && i.jaText.length <= 120) return i.jaText;
    return null;
  },
  playData(day, game) {
    const key = this.dayKey(day);
    const out = [];
    for (const i of this.items().filter((x) => this.dayKey(x.category) === key)) {
      if (game === 'vocab' && isWord(i) && notBlank(i.answer)) out.push(this.card(i));
      if (game === 'classify' && hasChoices(i) && this.hasTag(i, '三者分类')) out.push(this.card(i));
      if (game === 'rule' && hasChoices(i) && this.hasTag(i, '规则判定')) out.push(this.card(i));
      if (game === 'shadow') { const t = this.shadowText(i); if (t) out.push(Object.assign(this.card(i), { text: t })); }
    }
    return game === 'shadow' ? out : shuffle(out);
  },
  wordPool() { return this.items().filter((i) => isWord(i) && notBlank(i.answer)).map((i) => this.card(i)); },

  async answer(id, correct) { return study.review(id, correct ? 'easy' : 'again', correct); },

  shadows() { return (store.get('meta', 'shadows') || { list: [] }).list || []; },
  async shadow(id, text, heard, score) {
    const list = this.shadows().concat([{ itemId: id, text: cut(text), heard: cut(heard),
      score: Math.max(0, Math.min(100, Math.round(score))), createdAt: new Date().toISOString() }]).slice(-50);
    await store.save('meta', { id: 'shadows', list });
  },

  /** 根据 Day 1 笔记生成示例（已存在的标题跳过），返回新增条数 */
  async seedDay1() {
    const exists = new Set(this.items().filter((i) => this.dayKey(i.category) === 'Day1').map((i) => i.title));
    const ids = {};
    let n = 0;
    const base = (type, title, extra) => newItem(Object.assign({ type, subject: 'AML', category: 'Day1', title, source: 'AML Day1 笔记' }, extra));
    const add = async (key, item) => { const s = await study.save(item); if (key) ids[key] = s.id; n++; };

    const words = [
      ['AML', 'エーエムエル', '反洗钱', 'Anti-Money Laundering', 'AMLとは、マネー・ローンダリングを防ぐための取り組みです。', '怪しいお金の流れを見つけて、不正な取引を防ぐ仕組み'],
      ['KYC', 'ケーワイシー', '了解你的客户（客户身份确认）', 'Know Your Customer', 'KYCは、顧客がどんな人なのかを確認するものです。', 'WHO ARE YOU? → この顧客はどんな人？（这个人是谁？）'],
      ['フィルタリング', 'ふぃるたりんぐ', '过滤（与制裁名单比对）', 'Filtering', 'フィルタリングは、取引関係者を制裁対象者などのリストと照合するものです。', 'WHO ARE YOU DEALING WITH? → この取引相手は大丈夫？（这个人和谁交易？）'],
      ['モニタリング', 'もにたりんぐ', '交易监控', 'Monitoring', '取引モニタリングでは、不自然な取引や疑わしい取引を検知します。', 'HOW ARE YOU TRANSACTING? → この取引、怪しくない？（这个人怎么交易？）'],
      ['シナリオ', 'しなりお', '检测规则', 'Scenario', 'シナリオとは、疑わしい取引を見つけるために、あらかじめ設定された条件です。', '哪种交易算可疑？'],
      ['ヒットする', 'ひっとする', '触发（检测规则）', 'to hit (a scenario)', 'この取引はシナリオにヒットしました。', 'ヒットした ≠ マネロン確定 → 只是需要进一步确认'],
      ['閾値', 'しきいち', '阈值', 'Threshold', '300万円以上を検知する場合、300万円が閾値です。', '×敷居値 ○閾値（读音一样）。到多少才触发'],
      ['照合', 'しょうごう', '对照、比对', 'matching / screening', '取引関係者を制裁リストと照合します。', '照らし合わせる'],
    ];
    for (const w of words) {
      if (exists.has(w[0])) continue;
      await add(w[0], base('WORD', w[0], { reading: w[1], answer: w[2], enText: w[3], example: w[4], mnemonic: w[5] }));
    }
    const kt = 'KYC・フィルタリング・モニタリングの違い';
    if (!exists.has(kt)) {
      await add('三者', base('KNOWLEDGE', kt, {
        answer: 'KYC：この人はどんな人？\nフィルタリング：この取引相手は大丈夫？\nモニタリング：この取引、怪しくない？',
        jaText: 'KYCは顧客を確認し、フィルタリングは取引相手をリストと照合し、モニタリングは取引の流れを監視します。',
        zhText: 'KYC → 这个人是谁？\nFiltering → 这个人和谁交易？\nMonitoring → 这个人怎么交易？',
        enText: 'KYC: Who are you?\nFiltering: Who are you dealing with?\nMonitoring: How are you transacting?' }));
    }
    const classify = [
      ['口座開設時に、本人確認書類で氏名・住所・生年月日を確認する。', 'A', '顧客本人を確認している → KYC（这个人是谁？）'],
      ['送金先の受取人が、制裁対象者リストに載っていないか照合する。', 'B', '取引相手をリストと照合 → フィルタリング（和谁交易？）'],
      ['普段は月10万円程度の口座に、急に毎日100万円の入金が続いている。', 'C', '過去のパターンと比べて不自然 → モニタリング（怎么交易？）'],
      ['顧客の職業・取引目的・収入を確認し、リスクを評価する。', 'A', '顧客がどんな人かを確認 → KYC'],
      ['海外送金の相手銀行が、制裁リストに該当しないか確認する。', 'B', '相手（銀行）をリストと照合 → フィルタリング'],
      ['短期間に多数の相手と小口の取引を繰り返している口座を検知する。', 'C', '取引の仕方が不自然 → モニタリング'],
    ];
    for (const q of classify) {
      if (exists.has(q[0])) continue;
      await add(null, base('QUESTION', q[0], { choiceA: 'KYC', choiceB: 'フィルタリング', choiceC: 'モニタリング', correctChoice: q[1], answer: q[2], tags: '#三者分类' }));
    }
    const S = 'シナリオ：1日以内・300万円以上・海外送金\n取引：';
    const rule = [
      [S + '本日、海外へ350万円を送金した。', 'A', '3つの条件をすべて満たす → ヒットする'],
      [S + '本日、海外へ250万円を送金した。', 'B', '300万円（閾値）未満 → ヒットしない'],
      [S + '本日、国内の口座へ500万円を振り込んだ。', 'B', '金額は超えているが、海外送金ではない → ヒットしない'],
      [S + '本日、海外へちょうど300万円を送金した。', 'A', '「以上」は300万円を含む → ヒットする'],
    ];
    for (const q of rule) {
      if (exists.has(q[0])) continue;
      await add(null, base('QUESTION', q[0], { choiceA: 'ヒットする', choiceB: 'ヒットしない', correctChoice: q[1], answer: q[2], tags: '#规则判定' }));
    }
    const trap = '取引がシナリオにヒットした。これはマネー・ローンダリング確定か？';
    if (!exists.has(trap)) {
      await add(null, base('QUESTION', trap, { choiceA: '確定である', choiceB: '確定ではない（追加確認が必要）', correctChoice: 'B',
        answer: 'ヒットした ≠ マネロン確定。ヒットはあくまで「要確認」のサイン。\n触发规则 ≠ 确定洗钱，只是需要进一步确认。', tags: '#规则判定' }));
    }
    const L = (a, b, r) => (ids[a] && ids[b] ? links.link(ids[a], ids[b], r) : null);
    await Promise.all([L('KYC', 'フィルタリング', 'CONFUSE'), L('フィルタリング', 'モニタリング', 'CONFUSE'), L('KYC', 'モニタリング', 'CONFUSE'),
      L('シナリオ', 'ヒットする', 'ASSOC'), L('シナリオ', '閾値', 'ASSOC'), L('フィルタリング', '照合', 'ASSOC'),
      L('三者', 'KYC', 'WORD'), L('三者', 'フィルタリング', 'WORD'), L('三者', 'モニタリング', 'WORD')]);
    return n;
  },
};
function cut(s) { return s == null ? null : String(s).slice(0, 1000); }
