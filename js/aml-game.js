// 🎮 AML 审查官养成 —— 词卡速记 / 三者分类 / 规则判定 / 影子跟读
// 和 Spring Boot 版的 aml-game.js 相同，只是改成模块：
//   runGame(G, hooks) 开始游戏，返回 cleanup()（离开页面时停止计时、录音、朗读）
//   hooks.answer(id, correct) / hooks.shadow(id, score, text, heard) / hooks.retry()
export function runGame(G, hooks) {
  hooks = hooks || {};
  var alive = true;
  var data = G.data || [];
  var stage = document.getElementById('g-stage');
  var NAMES = { vocab: '🃏 词卡速记', classify: '🗂 三者分类', rule: '⚖️ 规则判定', shadow: '🎙 影子跟读' };
  var LISTEN = G.game === 'vocab' && G.dir === 'listen';
  if (LISTEN) NAMES.vocab = '👂 听音速答';

  var FAST = LISTEN ? 3 : 5;   // 几秒内答对算“速答”
  var idx = 0, score = 0, combo = 0, maxCombo = 0, right = 0, wrongList = [], shadowScores = [];
  var startAt = Date.now(), qStart = Date.now(), timer = null;

  document.getElementById('g-title').textContent = NAMES[G.game] || 'AML';

  // ---------- 工具 ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function nl(s) { return esc(s).replace(/\n/g, '<br>'); }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function call(fn) {
    try { var p = fn(); if (p && p.catch) p.catch(function (e) { console.error(e); }); } catch (e) { console.error(e); }
  }
  function hud() {
    if (!alive) return;
    document.getElementById('g-score').textContent = score + ' 分';
    document.getElementById('g-combo').textContent = combo >= 2 ? '🔥 ' + combo + ' 连击' : '';
    document.getElementById('g-progress').textContent = Math.min(idx + 1, data.length) + ' / ' + data.length;
    document.getElementById('g-bar').style.width = Math.round(idx * 100 / Math.max(1, data.length)) + '%';
  }
  timer = setInterval(function () {
    document.getElementById('g-time').textContent = Math.round((Date.now() - startAt) / 1000) + 's';
  }, 1000);

  // ---------- 没有题 ----------
  if (!data.length) {
    clearInterval(timer);
    stage.innerHTML = '<div class="empty small"><h2>这一天还没有这类内容</h2>' +
      '<p class="muted">回到上一页，用「＋ 添加」记几条就能玩了。</p></div>';
    return function () { };
  }

  // =====================================================================
  // ① ② ③ 选择类游戏
  // =====================================================================
  function buildOptions(item) {
    if (G.game !== 'vocab') {
      return item.choices.map(function (c) { return { label: c.v, key: c.k, ok: c.k === item.correct }; });
    }
    // 词卡：正确答案 + 从同科目生词里抽 3 个干扰项
    var ja = G.dir !== 'zh';
    var rightText = ja ? item.answer : item.title;
    var seen = {}; seen[rightText] = true;
    var others = shuffle(G.pool || []).filter(function (p) {
      var t = ja ? p.answer : p.title;
      if (p.id === item.id || !t || seen[t]) return false;
      seen[t] = true; return true;
    }).slice(0, 3).map(function (p) { return { label: ja ? p.answer : p.title, ok: false }; });
    return shuffle([{ label: rightText, ok: true }].concat(others));
  }

  function showQuestion() {
    if (!alive) return;
    hud();
    if (idx >= data.length) return finish();
    var item = data[idx];
    qStart = Date.now();
    var prompt;
    if (LISTEN) {
      prompt = '<p class="muted">听到的词是什么意思？</p>' +
        '<button class="listen-big" id="g-replay" title="再听一次（空格键）">🔊</button>' +
        '<p class="muted center small-note">没听清？点喇叭或按空格再听</p>';
    } else if (G.game === 'vocab') {
      prompt = G.dir === 'zh'
        ? '<p class="muted">这个意思的日语是？</p><h2 class="big">' + esc(item.answer) + '</h2>' +
          (item.en ? '<p class="muted center">' + esc(item.en) + '</p>' : '')
        : '<p class="muted">意思是？</p><h2 class="big">' + esc(item.title) + '</h2>';
    } else {
      prompt = '<p class="muted">' + (G.game === 'classify' ? '这是哪一个？' : '会不会ヒット？') + '</p>' +
        '<h2 class="pre q-text">' + nl(item.title) + '</h2>';
    }
    var opts = buildOptions(item);
    var html = '<div class="reviewcard short">' + prompt + '</div><div class="choices g-opts">';
    opts.forEach(function (o, k) {
      html += '<button data-k="' + k + '"><b>' + (k + 1) + '</b><span>' + esc(o.label) + '</span></button>';
    });
    html += '</div><div id="g-feedback"></div>';
    stage.innerHTML = html;
    stage.querySelectorAll('.g-opts button').forEach(function (b) {
      b.addEventListener('click', function () { choose(item, opts, +b.getAttribute('data-k')); });
    });
    if (LISTEN) {
      document.getElementById('g-replay').addEventListener('click', function () { say(item); });
      say(item, function () { qStart = Date.now(); });   // 从读完开始计时
    }
  }

  // 听音模式：有读音就读读音（避免汉字读错），去掉 ⓪① 之类的重音标记
  function say(item, onend) {
    speak(clean(item.reading || item.title), onend);
  }

  function choose(item, opts, k) {
    var buttons = stage.querySelectorAll('.g-opts button');
    if (buttons[0].disabled) return;
    buttons.forEach(function (b, i) {
      b.disabled = true;
      if (opts[i].ok) b.classList.add('ok');
      else if (i === k) b.classList.add('ng');
    });
    var ok = opts[k].ok;
    var secs = (Date.now() - qStart) / 1000;
    if (ok) {
      right++; combo++; maxCombo = Math.max(maxCombo, combo);
      score += 10 + Math.min(combo, 10) * 2 + (secs < FAST ? 5 : 0);
    } else {
      combo = 0;
      wrongList.push(item);
    }
    call(function () { return hooks.answer && hooks.answer(item.id, ok); });
    hud();

    var fb = '<div class="verdict ' + (ok ? 'ok' : 'ng') + '">' +
      (ok ? '○ 正解！' + (secs < FAST ? ' ⚡速答 +5' : '') : '× 不正解') + '</div>';
    if (G.game === 'vocab') {
      fb += '<section class="answer"><b>' + esc(item.title) + '</b>' +
        (item.reading ? '（' + esc(item.reading) + '）' : '') + ' = ' + esc(item.answer) +
        (item.en ? ' · ' + esc(item.en) : '') +
        (item.example ? '<p class="example">' + esc(item.example) + '</p>' : '') +
        (item.mnemonic ? '<p class="muted">💡 ' + esc(item.mnemonic) + '</p>' : '') + '</section>';
    } else if (item.answer) {
      fb += '<section class="answer"><small>解说</small><p class="pre">' + nl(item.answer) + '</p></section>';
    }
    fb += '<button class="primary" id="g-next">下一题 →</button>';
    var box = document.getElementById('g-feedback');
    box.innerHTML = fb;
    document.getElementById('g-next').addEventListener('click', next);
    // 词卡答对：自动下一题，保持节奏
    if (ok && G.game === 'vocab') setTimeout(function () { if (data[idx] === item) next(); }, 900);
  }

  function next() { if (!alive) return; idx++; showQuestion(); }

  // 键盘 1〜4 选择，回车下一题
  document.addEventListener('keydown', onKey);
  function onKey(e) {
    var n = parseInt(e.key, 10);
    var btns = stage.querySelectorAll('.g-opts button');
    if (n >= 1 && n <= btns.length && !btns[0].disabled) btns[n - 1].click();
    if (e.key === 'Enter' && document.getElementById('g-next')) document.getElementById('g-next').click();
    if (e.key === ' ' && LISTEN && document.getElementById('g-replay')) {
      e.preventDefault();
      document.getElementById('g-replay').click();
    }
  }

  // =====================================================================
  // ④ 影子跟读
  // =====================================================================
  var Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  var rate = 0.9, mediaRec = null, chunks = [], audioUrl = null, recog = null, heard = '';

  // ---------- 语音：优先选自然的日语语音，也可以自己选（会记住） ----------
  var VOICE_KEY = 'memolink.voice';
  // 本机的高品质语音优先（不需要网络）；Google 日本語 是在线语音，没网时可能没声音
  var PREFER = [/kyoko.*(enhanced|premium|拡張|高品質|增强|優化)/i, /otoya.*(enhanced|premium|拡張|高品質|增强|優化)/i,
    /o-?ren/i, /google.*(日本語|japanese)/i, /nanami/i, /kyoko/i, /otoya/i, /hattori/i, /keita/i];

  function jaVoices() {
    if (!window.speechSynthesis) return [];
    return speechSynthesis.getVoices().filter(function (v) { return /^ja|japan/i.test(v.lang); });
  }
  function savedVoiceName() { try { return localStorage.getItem(VOICE_KEY); } catch (e) { return null; } }
  function jaVoice() {
    var vs = jaVoices();
    if (!vs.length) return null;
    var saved = savedVoiceName();
    for (var i = 0; i < vs.length; i++) if (vs[i].name === saved) return vs[i];
    for (var p = 0; p < PREFER.length; p++) {
      for (var j = 0; j < vs.length; j++) if (PREFER[p].test(vs[j].name)) return vs[j];
    }
    return vs[0];
  }
  // Chrome 的语音列表是异步加载的：还没加载完就先等一下（最多 1 秒），避免用到默认的低质量语音
  function withVoices(cb) {
    if (!window.speechSynthesis || speechSynthesis.getVoices().length) return cb();
    var done = false;
    var go = function () { if (!done) { done = true; cb(); } };
    if (speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', go);
    setTimeout(go, 1000);
  }
  function speak(text, onend) {
    if (!window.speechSynthesis) { if (onend) onend(); return; }
    withVoices(function () {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'ja-JP'; u.rate = rate;
      var v = jaVoice(); if (v) u.voice = v;
      if (onend) u.onend = onend;
      // 在线语音失败（没网 / VPN 断开）→ 自动改用本机语音再读一次
      u.onerror = function () {
        var local = jaVoices().filter(function (x) { return x.localService; })[0];
        if (v && !v.localService && local) {
          var r = new SpeechSynthesisUtterance(text);
          r.lang = 'ja-JP'; r.rate = rate; r.voice = local;
          if (onend) r.onend = onend;
          speechSynthesis.speak(r);
        } else if (onend) onend();
      };
      speechSynthesis.speak(u);
    });
  }
  // 去掉读音里的重音标记 ⓪① 和括号
  function clean(s) { return String(s || '').replace(/[⓪①②③④⑤⑥⑦⑧⑨\[\]［］]/g, ''); }

  // 语音选择栏（听音速答、影子跟读时显示）
  function voiceBar() {
    var bar = document.getElementById('g-voice-bar');
    if (!bar || !window.speechSynthesis) return;
    var render = function () {
      var vs = jaVoices(), cur = jaVoice();
      if (!vs.length) { bar.innerHTML = '<p class="muted small-note">没有找到日语语音（见下方说明）</p>'; return; }
      var html = '<div class="voice-bar">🗣 <select id="g-voice">';
      vs.forEach(function (v) {
        html += '<option value="' + esc(v.name) + '"' + (cur && v.name === cur.name ? ' selected' : '') + '>' +
          esc(v.name) + (v.localService ? '' : '（在线）') + '</option>';
      });
      html += '</select><button class="chip-btn" id="g-voice-test" type="button">试听</button></div>';
      bar.innerHTML = html;
      document.getElementById('g-voice').onchange = function () {
        try { localStorage.setItem(VOICE_KEY, this.value); } catch (e) { /* 不能保存也没关系 */ }
        speak('閾値を設定します。');
      };
      document.getElementById('g-voice-test').onclick = function () { speak('閾値を設定します。'); };
    };
    render();
    if (speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', render);
  }

  // 比较用：去掉空格和标点，片假名 → 平假名
  function norm(s) {
    return String(s || '').replace(/[\s、。，,．.！!？?「」『』（）()・：:\-ー〜~]/g, '')
      .replace(/[ァ-ヶ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); })
      .toLowerCase();
  }
  function similarity(a, b) {
    a = norm(a); b = norm(b);
    if (!a.length && !b.length) return 100;
    var m = a.length, n = b.length, d = [];
    for (var i = 0; i <= m; i++) { d[i] = [i]; }
    for (var j = 0; j <= n; j++) { d[0][j] = j; }
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    return Math.max(0, Math.round((1 - d[m][n] / Math.max(m, n)) * 100));
  }

  // 跟读：如果句子就是生词本身而且有读音，就读读音（避免汉字读错）
  function spoken(item) {
    return item.reading && item.text === item.title ? clean(item.reading) : item.text;
  }

  function showShadow() {
    if (!alive) return;
    hud();
    if (idx >= data.length) return finish();
    var item = data[idx];
    heard = ''; audioUrl = null;
    var hint = [item.reading, item.answer].filter(Boolean).join(' · ');
    stage.innerHTML =
      '<div class="reviewcard short">' +
        '<h2 class="pre shadow-text">' + nl(item.text) + '</h2>' +
        (hint ? '<p class="muted center">' + esc(hint) + '</p>' : '') +
      '</div>' +
      '<div class="shadow-ctl">' +
        '<button class="secondary" id="s-listen">🔊 听标准音</button>' +
        '<button class="primary" id="s-auto">🔁 听完自动跟读</button>' +
        '<button class="secondary" id="s-rec">🎙 直接跟读</button>' +
      '</div>' +
      '<div class="chips speed">语速 ' +
        '<button class="chip-btn" data-r="0.7">慢</button><button class="chip-btn" data-r="0.9">标准</button>' +
        '<button class="chip-btn" data-r="1.1">快</button></div>' +
      '<div id="s-status" class="muted center"></div>' +
      '<div id="s-result"></div>' +
      (Rec ? '' : '<p class="toast warn">这个浏览器不支持语音识别（推荐用 Chrome）。可以录音回放，然后自己打分。</p>');

    document.getElementById('s-listen').onclick = function () { speak(spoken(item)); };
    document.getElementById('s-auto').onclick = function () {
      status('🔊 先听…');
      speak(spoken(item), function () { startRecord(item); });
    };
    document.getElementById('s-rec').onclick = function () { startRecord(item); };
    stage.querySelectorAll('.speed button').forEach(function (b) {
      if (+b.getAttribute('data-r') === rate) b.classList.add('on');
      b.onclick = function () {
        rate = +b.getAttribute('data-r');
        stage.querySelectorAll('.speed button').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
      };
    });
  }

  function status(t) { var s = document.getElementById('s-status'); if (s) s.textContent = t; }

  function startRecord(item) {
    if (!alive) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      status('无法使用麦克风（请用 http://localhost:8081 打开，并允许麦克风）');
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      chunks = [];
      mediaRec = new MediaRecorder(stream);
      mediaRec.ondataavailable = function (e) { chunks.push(e.data); };
      mediaRec.onstop = function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        audioUrl = URL.createObjectURL(new Blob(chunks, { type: mediaRec.mimeType || 'audio/webm' }));
        showResult(item);
      };
      mediaRec.start();
      status('🎙 正在录音… 读完点「停止」');
      document.getElementById('s-result').innerHTML = '<button class="primary rec-stop" id="s-stop">■ 停止</button>';
      document.getElementById('s-stop').onclick = stopRecord;

      if (Rec) {
        recog = new Rec();
        recog.lang = 'ja-JP';
        recog.interimResults = true;
        recog.continuous = true;
        recog.onresult = function (e) {
          var t = '';
          for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
          heard = t;
          status('🎙 听到：' + t);
        };
        recog.onerror = function () { /* 没听到也可以继续，用录音回放 */ };
        try { recog.start(); } catch (e) { /* ignore */ }
      }
      // 最长：句子长度的 2.5 倍秒数（至少 6 秒）
      var limit = Math.max(6, Math.round(norm(item.text).length * 0.35 * 2.5)) * 1000;
      setTimeout(function () { if (mediaRec && mediaRec.state === 'recording') stopRecord(); }, limit);
    }).catch(function () {
      status('没有拿到麦克风权限。请在浏览器地址栏左边允许麦克风。');
    });
  }

  function stopRecord() {
    if (recog) { try { recog.stop(); } catch (e) { } recog = null; }
    if (mediaRec && mediaRec.state === 'recording') mediaRec.stop();
  }

  function showResult(item) {
    var box = document.getElementById('s-result');
    var html = '';
    if (Rec && heard) {
      // 汉字 / 假名 写法不同也能得分：同时和读音比较，取高的
      var sc = similarity(item.text, heard);
      if (item.reading && item.text === item.title) sc = Math.max(sc, similarity(item.reading, heard));
      html += scoreHtml(sc) + '<p class="muted">识别结果：' + esc(heard) + '</p>';
      record(item, sc);
      html += buttons(true);
    } else {
      html += '<p class="muted">' + (Rec ? '没有识别到声音，可以再读一次，或者自己打分：' : '自己打分：') + '</p>' +
        '<div class="ratings"><button data-s="40">😭 不太好</button><button data-s="70">🤔 还行</button>' +
        '<button data-s="95">😎 很好</button></div>' + buttons(false);
    }
    box.innerHTML = html;
    status('');
    box.querySelectorAll('.ratings button').forEach(function (b) {
      b.onclick = function () {
        var sc = +b.getAttribute('data-s');
        record(item, sc);
        box.querySelector('.ratings').outerHTML = scoreHtml(sc);
        document.getElementById('s-next').disabled = false;
      };
    });
    document.getElementById('s-play').onclick = function () { if (audioUrl) new Audio(audioUrl).play(); };
    document.getElementById('s-std').onclick = function () { speak(spoken(item)); };
    document.getElementById('s-again').onclick = function () { startRecord(item); };
    document.getElementById('s-next').onclick = function () { idx++; showShadow(); };
  }

  var recorded = {};
  function record(item, sc) {
    if (recorded[idx]) { shadowScores[shadowScores.length - 1] = sc; return; }  // 同一句重读：记最后一次
    recorded[idx] = true;
    shadowScores.push(sc);
    score += sc;
    call(function () { return hooks.shadow && hooks.shadow(item.id, sc, item.text, heard); });
    hud();
  }

  function scoreHtml(sc) {
    var cls = sc >= 85 ? 'ok' : sc >= 60 ? '' : 'ng';
    var word = sc >= 85 ? '很标准！' : sc >= 60 ? '不错，再听一遍对比一下' : '多听几遍标准音再试试';
    return '<div class="verdict ' + cls + '">' + sc + ' 分 · ' + word + '</div>';
  }
  function buttons(enabled) {
    return '<div class="actions three">' +
      '<button class="secondary" id="s-play">▶ 我的录音</button>' +
      '<button class="secondary" id="s-std">🔊 标准音</button>' +
      '<button class="secondary" id="s-again">🔁 再读一次</button></div>' +
      '<button class="primary" id="s-next"' + (enabled ? '' : ' disabled') + '>下一句 →</button>';
  }

  // =====================================================================
  // 结果
  // =====================================================================
  function finish() {
    clearInterval(timer);
    document.getElementById('g-bar').style.width = '100%';
    var secs = Math.round((Date.now() - startAt) / 1000);
    var html = '<section class="hero center"><small>' + esc(NAMES[G.game]) + ' · ' + esc(G.day) + '</small>';
    if (G.game === 'shadow') {
      var avg = shadowScores.length ? Math.round(shadowScores.reduce(function (a, b) { return a + b; }, 0) / shadowScores.length) : 0;
      html += '<h1>' + avg + ' 分</h1><p class="score">平均分 · ' + shadowScores.length + ' 句 · ' + secs + ' 秒</p></section>';
    } else {
      var pct = Math.round(right * 100 / data.length);
      var rank = pct === 100 ? '🏆 完美通关！' : pct >= 80 ? '🎉 合格！' : '💪 再来一次';
      html += '<h1>' + score + ' 分</h1><p class="score">' + rank + ' 正确率 ' + pct + '% · 最高 ' + maxCombo + ' 连击 · ' + secs + ' 秒</p></section>';
      if (wrongList.length) {
        html += '<h3>错的（已加入复习，10 分钟后再出）</h3>';
        wrongList.forEach(function (w) {
          html += '<a class="card" href="#/item/' + esc(w.id) + '"><b>' + esc(w.title) + '</b><small>' +
            esc(G.game === 'vocab' ? w.answer : (w.choices.filter(function (c) { return c.k === w.correct; })[0] || {}).v) +
            '</small></a>';
        });
      }
    }
    html += '<div class="actions"><button class="primary" id="g-retry">🔁 再玩一次</button>' +
      '<a class="secondary" href="#/aml/day/' + (G.dayNo || 1) + '">回到 ' + esc(G.day) + '</a></div>';
    stage.innerHTML = html;
    document.getElementById('g-retry').onclick = function () { if (hooks.retry) hooks.retry(); else location.reload(); };
  }

  // ---------- 开始 ----------
  if (window.speechSynthesis) speechSynthesis.getVoices();  // 预加载语音
  if (G.game === 'shadow' || LISTEN) voiceBar();
  if (G.game === 'shadow') showShadow();
  else if (LISTEN) {
    // 浏览器规定：必须先点一下，页面才能自动播放声音
    stage.innerHTML = '<div class="reviewcard short center"><h2>👂 听音速答</h2>' +
      '<p class="muted">每题会自动读一个词。<br>不看字，听到后尽快选出意思。<br>读完 3 秒内答对 ⚡ +5 分。</p>' +
      '<p class="muted small-note">键盘：1〜4 选择 · 空格 再听一次 · 回车 下一题</p></div>' +
      '<button class="primary" id="g-start">▶ 开始</button>';
    document.getElementById('g-start').onclick = function () { startAt = Date.now(); showQuestion(); };
  } else showQuestion();

  // 离开页面时调用
  return function cleanup() {
    alive = false;
    clearInterval(timer);
    document.removeEventListener('keydown', onKey);
    try { stopRecord(); } catch (e) { /* ignore */ }
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) { /* ignore */ }
  };
}
