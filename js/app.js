// =====================================================================
// MemoLink 网页版：启动 → （云端模式）Google 登录 → 读取数据 → 显示页面
// =====================================================================
import { firebaseConfig, FIREBASE_SDK } from './config.js';
import { store } from './store/index.js';
import { createLocalStore } from './store/local-store.js';
import { createFirestoreStore } from './store/firestore-store.js';
import { esc } from './ui.js';
import { home } from './pages/home.js';
import { addPage, editPage, detailPage, linkPage } from './pages/item.js';
import { libraryPage } from './pages/library.js';
import { menuPage, startAction, questionPage, resultPage, donePage } from './pages/practice.js';
import { statsPage } from './pages/stats.js';
import { importPage } from './pages/importer.js';
import { settingsPage, setAuth } from './pages/settings.js';
import { mapPage, dayPage, playPage } from './pages/aml.js';
import { termManagerPage, termEditPage, termPlayPage } from './pages/aml-terms.js';

const app = document.getElementById('app');

// ---------------------------- 路由 ----------------------------
const routes = [
  [/^\/$/, home],
  [/^\/add$/, addPage],
  [/^\/item\/([^/]+)$/, detailPage, ['id']],
  [/^\/item\/([^/]+)\/edit$/, editPage, ['id']],
  [/^\/item\/([^/]+)\/link$/, linkPage, ['id']],
  [/^\/library$/, libraryPage],
  [/^\/practice$/, menuPage],
  [/^\/practice\/start$/, startAction],
  [/^\/practice\/q$/, questionPage],
  [/^\/practice\/result$/, resultPage],
  [/^\/practice\/done$/, donePage],
  [/^\/review$/, () => { location.replace('#/practice/start?mode=due&n=100'); return null; }],
  [/^\/stats$/, statsPage],
  [/^\/import$/, importPage],
  [/^\/settings$/, settingsPage],
  [/^\/aml$/, mapPage],
  [/^\/aml\/day\/(\d+)$/, dayPage, ['no']],
  [/^\/aml\/play$/, playPage],
  [/^\/aml\/terms$/, termManagerPage],
  [/^\/aml\/term\/new$/, termEditPage],
  [/^\/aml\/term\/([^/]+)\/edit$/, termEditPage, ['id']],
  [/^\/aml\/terms\/play$/, termPlayPage],
];
// 别的设备改了数据时，这些页面自动刷新（输入中的页面不刷新）
const LIVE = new Set(['/', '/library', '/stats', '/aml']);

let cleanup = null, currentPath = null, lastHash = null;

function parse() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = h.split('?');
  const query = {};
  new URLSearchParams(qs || '').forEach((v, k) => { query[k] = v; });
  return { path: path || '/', query };
}

function render() {
  if (!store.ready()) return;
  if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
  const { path, query } = parse();
  currentPath = path;
  let page = null;
  try {
    for (const [re, fn, names] of routes) {
      const m = path.match(re);
      if (!m) continue;
      const params = {};
      (names || []).forEach((n, k) => { params[n] = decodeURIComponent(m[k + 1]); });
      page = fn({ path, params, query });
      if (page === null) return;        // 页面自己跳转了
      break;
    }
    if (!page) page = { html: `<main><div class="empty"><h2>页面不存在</h2><a class="primary" href="#/">回首页</a></div></main>` };
    const banner = store.mode() === 'local' && path === '/'
      ? '<a class="mode-banner" href="#/settings">💻 体验模式：数据只存在这个浏览器（还没设置 Firebase）</a>' : '';
    app.innerHTML = banner + page.html;
    if (location.hash !== lastHash) window.scrollTo(0, 0);
    lastHash = location.hash;
    const c = page.mount && page.mount(app);
    cleanup = typeof c === 'function' ? c : null;
  } catch (e) {
    console.error(e);
    app.innerHTML = `<main><div class="empty"><h2>这个页面刚刚出错了</h2><p class="muted">${esc(e.message)}</p>
      <a class="primary" href="#/">回首页</a></div></main>`;
  }
}

let liveTimer = null;
function onDataChange() {
  if (!LIVE.has(currentPath)) return;
  clearTimeout(liveTimer);
  liveTimer = setTimeout(render, 300);
}

function start() {
  store.onChange(onDataChange);
  window.addEventListener('hashchange', render);
  render();
}

// ---------------------------- 画面：读取中 / 登录 ----------------------------
function showLoading(msg) {
  app.innerHTML = `<main><div class="empty"><div class="spinner"></div><p class="muted">${esc(msg || '读取中…')}</p></div></main>`;
}
function showLogin(onLogin, err) {
  app.innerHTML = `<main class="login"><div class="login-box">
      <div class="logo">🧠</div><h1>MemoLink</h1>
      <p class="muted">错题 · 生词 · 知识点 · AML 审查官养成<br>手机和电脑自动同步</p>
      <button class="primary" id="login">用 Google 账号登录</button>
      ${err ? `<p class="toast warn">${esc(err)}</p>` : ''}
      <p class="muted small-note">数据保存在你自己的账号下，别人看不到。</p></div></main>`;
  document.getElementById('login').addEventListener('click', onLogin);
}
function showError(msg) {
  const t = document.createElement('div');
  t.className = 'toast warn float';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 6000);
}

// ---------------------------- 启动 ----------------------------
async function boot() {
  if (!firebaseConfig) {               // 体验模式
    store.use(createLocalStore());
    start();
    return;
  }
  showLoading('连接中…');
  let A, F, auth, db;
  try {
    const [appMod, authMod, fsMod] = await Promise.all([
      import(FIREBASE_SDK + '/firebase-app.js'),
      import(FIREBASE_SDK + '/firebase-auth.js'),
      import(FIREBASE_SDK + '/firebase-firestore.js'),
    ]);
    A = authMod; F = fsMod;
    const fbApp = appMod.initializeApp(firebaseConfig);
    auth = A.getAuth(fbApp);
    try {
      // 开启本地缓存：离线也能看，读取次数也更少
      db = F.initializeFirestore(fbApp, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });
    } catch (e) {
      db = F.getFirestore(fbApp);
    }
  } catch (e) {
    console.error(e);
    app.innerHTML = `<main><div class="empty"><h2>连接不上 Firebase</h2><p class="muted">${esc(e.message)}</p>
      <p class="muted">请检查网络，或 js/config.js 的设置。</p></div></main>`;
    return;
  }

  const login = async () => {
    const provider = new A.GoogleAuthProvider();
    try {
      await A.signInWithPopup(auth, provider);
    } catch (e) {
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
        await A.signInWithRedirect(auth, provider);
      } else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        showLogin(login, '登录失败：' + (e.code === 'auth/unauthorized-domain'
          ? '这个网址还没加进 Firebase 的「承認済みドメイン」' : e.message));
      }
    }
  };

  let started = false, current = null;
  A.onAuthStateChanged(auth, async (user) => {
    if (current) { current.close(); current = null; }   // 换账号 / 退出：停止上一个账号的同步
    if (!user) {
      store.use(null);
      showLogin(login);
      return;
    }
    showLoading('读取数据中…');
    const s = createFirestoreStore(F, db, user.uid, (e) => {
      console.error(e);
      showError(e.code === 'permission-denied' ? '没有权限：请确认 Firestore 安全规则已设置' : '同步出错：' + e.message);
    });
    current = s;
    await s.ready;
    store.use(s);
    setAuth({ user, signOut: () => A.signOut(auth) });
    if (!started) { started = true; start(); } else render();
  });
}

boot();
