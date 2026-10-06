// =====================================================================
// 数据模型：和 Spring Boot 版的 StudyItem.java 字段名完全一致
// （以后改回 Spring Boot 时，JSON 可以直接对应）
// =====================================================================

export const SUBJECTS = ['FE', 'AML', 'Japanese', 'AWS', 'Java'];

export const TYPES = { MISTAKE: '错题', QUESTION: '同类题', KNOWLEDGE: '知识点', WORD: '生词' };

export const LETTERS = ['A', 'B', 'C', 'D'];

export const RELATIONS = {
  SIMILAR: '🔄 同类题', KNOWLEDGE: '🧠 归类到知识点', WORD: '🇯🇵 相关生词',
  SYNONYM: '≈ 近义词', ANTONYM: '⇔ 反义词', CONFUSE: '⚠️ 易混淆', ASSOC: '💡 联想',
};

/** 编辑时可以改的字段（复习记录不在这里） */
export const EDITABLE = ['type', 'subject', 'category', 'title', 'jaText', 'zhText', 'enText', 'answer',
  'mistakeReason', 'tags', 'relatedKeywords', 'reading', 'wrongAnswer', 'choiceA', 'choiceB', 'choiceC',
  'choiceD', 'correctChoice', 'linkedId', 'example', 'mnemonic', 'source', 'memo', 'refUrl',
  'customTitle1', 'customBody1', 'customTitle2', 'customBody2'];

/** 熟练度 0〜5 对应的复习间隔（天） */
export const INTERVAL_DAYS = [1, 3, 7, 14, 30, 60];

export function newItem(over) {
  const now = new Date().toISOString();
  return Object.assign({
    id: null, type: 'KNOWLEDGE', subject: 'FE', category: '未分类', title: '',
    jaText: null, zhText: null, enText: null, answer: null, mistakeReason: null, tags: null, relatedKeywords: null,
    reading: null, wrongAnswer: null, choiceA: null, choiceB: null, choiceC: null, choiceD: null,
    correctChoice: null, linkedId: null, flagged: false, attempts: 0, correctCount: 0, lastResult: null,
    lastAnsweredAt: null, example: null, mnemonic: null, source: null, memo: null, refUrl: null,
    customTitle1: null, customBody1: null, customTitle2: null, customBody2: null,
    mastery: 0, createdAt: now, nextReview: now,
  }, over || {});
}

export const blank = (s) => s == null || String(s).trim() === '';
export const notBlank = (s) => !blank(s);

export function typeLabel(t) { return TYPES[t] || '知识点'; }
export const isWord = (i) => i.type === 'WORD';
export const isQuestion = (i) => i.type === 'MISTAKE' || i.type === 'QUESTION';
export const hasChoices = (i) => notBlank(i.choiceA) && notBlank(i.choiceB) && notBlank(i.correctChoice);
export const choice = (i, L) => i['choice' + L];
export const hasTri = (i) => notBlank(i.jaText) || notBlank(i.zhText) || notBlank(i.enText);
export const attempts = (i) => i.attempts || 0;
export const correctCount = (i) => i.correctCount || 0;

/** 正确率（%），没做过返回 null */
export function accuracy(i) {
  const a = attempts(i);
  return a === 0 ? null : Math.round(correctCount(i) * 100 / a);
}

/** 苦手：上次不会，或做过 2 次以上且正确率低于 60% */
export function isWeak(i) {
  const acc = accuracy(i);
  return i.lastResult === 'again' || (attempts(i) >= 2 && acc != null && acc < 60);
}

export function masteryStars(i) {
  const m = Math.max(0, Math.min(5, i.mastery || 0));
  return '★'.repeat(m) + '☆'.repeat(5 - m);
}

export function time(s) { return s ? new Date(s).getTime() : null; }

export function isDue(i, now) {
  const t = time(i.nextReview);
  return t != null && t <= (now || Date.now());
}

export function nextReviewLabel(i) {
  if (!i.nextReview) return '未开始';
  const nr = new Date(i.nextReview), now = new Date();
  if (nr <= now) return '现在';
  const day = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(nr) - day(now)) / 86400000);
  const hm = String(nr.getHours()).padStart(2, '0') + ':' + String(nr.getMinutes()).padStart(2, '0');
  if (days === 0) return '今天 ' + hm;
  if (days === 1) return '明天';
  return days + ' 天后（' + (nr.getMonth() + 1) + '/' + nr.getDate() + '）';
}

/** 保存前整理（和 StudyService.normalize 一样） */
export function normalize(i) {
  if (blank(i.type)) i.type = 'KNOWLEDGE';
  if (blank(i.subject)) i.subject = 'FE';
  if (blank(i.category)) i.category = '未分类';
  i.category = String(i.category).trim();
  i.correctChoice = blank(i.correctChoice) ? null : String(i.correctChoice).trim().toUpperCase();
  for (const k of EDITABLE) if (typeof i[k] === 'string' && i[k].trim() === '' && k !== 'category') i[k] = null;
  return i;
}

/** 日期 key：本地时间的 YYYY-MM-DD */
export function dayId(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
