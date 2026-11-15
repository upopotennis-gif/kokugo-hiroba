import { firebaseConfig } from './firebase-config.js';

/* ---------- 決まっている選択肢 ---------- */
const SCHOOLS = ['川崎', '川崎総合科学', '橘', '高津', '幸', 'その他'];
const SUBJECTS = ['現代の国語', '言語文化', '論理国語', '文学国語', '国語表現', '古典探究', 'その他'];
const KINDS = ['指導案', '教材・ワークシート', '考査・評価', '実践報告', '参考リンク', 'その他'];
const CATS = ['授業づくり', '評価・考査', '教材・本', 'ICT', '研究会', '相談・雑談'];
const ATT = ['出席', '欠席', '未定'];
const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

/* ---------- 小道具 ---------- */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const linkify = (s) => esc(s).replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);
const school = (s) => (s === 'その他' || !s ? s || '' : s + '高校');
const who = (x) => `${esc(x.name)}（${esc(school(x.school))}）`;
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
function when(ms) {
  if (!ms) return '';
  const d = new Date(ms), y = d.getFullYear() === new Date().getFullYear() ? '' : d.getFullYear() + '年';
  return `${y}${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}:${pad(d.getMinutes())}`;
}
function dayParts(str) {
  const [y, m, d] = String(str || '').split('-').map(Number);
  if (!y) return { m: '', d: '?', w: '' };
  return { y, m, d, w: WEEK[new Date(y, m - 1, d).getDay()] };
}
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* 保存できない環境でも動かす */ } };
const lsDel = (k) => { try { localStorage.removeItem(k); } catch { /* 同上 */ } };
const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- 保存先その1：お試しモード（このブラウザの中だけ） ---------- */
function demoStore() {
  const KEY = 'kokugo-hiroba-demo';
  let db;
  try { db = JSON.parse(lsGet(KEY)); } catch { db = null; }
  if (!db) db = demoSeed();
  const ls = new Map();
  const save = () => lsSet(KEY, JSON.stringify(db));
  const emit = (p) => (ls.get(p) || []).forEach((cb) => cb((db[p] || []).map((x) => ({ ...x }))));
  let uid = lsGet(KEY + '-uid');
  if (!uid) { uid = 'demo-' + rid(); lsSet(KEY + '-uid', uid); }
  let inFlag = lsGet(KEY + '-in') === '1', adminFlag = lsGet(KEY + '-admin') === '1';
  return {
    demo: true,
    async start() { return uid; },
    async join(code) { if (code !== 'こくご') return false; inFlag = true; lsSet(KEY + '-in', '1'); return true; },
    async isMember() { return inFlag; },
    async joinAdmin(code) { if (code !== 'かんり') return false; adminFlag = true; lsSet(KEY + '-admin', '1'); return true; },
    async isAdmin() { return adminFlag; },
    async leave() { inFlag = adminFlag = false; lsDel(KEY + '-in'); lsDel(KEY + '-admin'); },
    async touch(info) {
      const list = (db.members ||= []); let m = list.find((x) => x.id === uid);
      if (!m) { m = { id: uid, joinedAt: info.now, days: [] }; list.push(m); }
      Object.assign(m, { name: info.name, school: info.school, lastSeenAt: info.now, days: [...new Set([...(m.days || []), info.day])].sort().slice(-120) });
      save(); emit('members');
    },
    watch(path, cb) {
      if (!ls.has(path)) ls.set(path, []);
      ls.get(path).push(cb);
      queueMicrotask(() => emit(path));
      return () => ls.set(path, (ls.get(path) || []).filter((f) => f !== cb));
    },
    async add(path, data) { const id = rid(); (db[path] ||= []).push({ id, ...data }); save(); emit(path); return id; },
    async set(path, id, data) {
      const list = (db[path] ||= []), i = list.findIndex((x) => x.id === id);
      if (i >= 0) list[i] = { id, ...data }; else list.push({ id, ...data });
      save(); emit(path);
    },
    async update(path, id, data) { const x = (db[path] || []).find((y) => y.id === id); if (x) Object.assign(x, data); save(); emit(path); },
    async remove(path, id) { db[path] = (db[path] || []).filter((x) => x.id !== id); save(); emit(path); },
    async bump(path, id, field, n, extra) {
      const x = (db[path] || []).find((y) => y.id === id);
      if (x) { x[field] = Math.max(0, (x[field] || 0) + n); Object.assign(x, extra || {}); }
      save(); emit(path);
    },
  };
}
function demoSeed() {
  const now = Date.now(), day = 86400000, a = { uid: 'sample', name: '見本 太郎', school: '橘' };
  const d = (off) => { const t = new Date(now + off * day); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; };
  return {
    news: [{ id: 'n1', ...a, title: '（見本）国語科ひろばを始めました', body: '五校の国語科で、お知らせ・相談・研究会の予定・資料を持ち寄る場所です。\nまずは掲示板に一言どうぞ。', pinned: true, createdAt: now - day }],
    posts: [{ id: 'p1', ...a, cat: '授業づくり', title: '（見本）「山月記」の導入、どうしていますか', body: '2年の文学国語で扱います。初回の入り方で工夫していることがあれば教えてください。', replyCount: 1, lastReplyAt: now - 3600000, createdAt: now - 2 * day }],
    'posts/p1/replies': [{ id: 'r1', uid: 'sample2', name: '見本 花子', school: '高津', body: '（見本）漢文の「人虎伝」の一節を先に読ませています。', createdAt: now - 3600000 }],
    events: [{ id: 'e1', ...a, title: '（見本）第1回 五校国語科研究会', date: d(20), time: '15:30〜17:00', place: '市立川崎高校 会議室', body: '各校の「論理国語」の年間計画を持ち寄って話します。', record: '', createdAt: now - day }],
    resources: [{ id: 's1', ...a, title: '（見本）意見文の評価ルーブリック', desc: '現代の国語・意見文の単元で使った4観点の表です。', url: 'https://example.com/', subject: '現代の国語', kind: '考査・評価', createdAt: now - day }],
  };
}

/* ---------- 保存先その2：Firebase ---------- */
async function firebaseStore(cfg) {
  const base = 'https://www.gstatic.com/firebasejs/10.14.1/';
  const [{ initializeApp }, A, F] = await Promise.all([
    import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-firestore.js'),
  ]);
  const app = initializeApp(cfg), auth = A.getAuth(app), db = F.getFirestore(app);
  let uid;
  const denied = (e) => e && e.code === 'permission-denied';
  return {
    demo: false,
    async start() {
      await auth.authStateReady();
      if (!auth.currentUser) await A.signInAnonymously(auth);
      uid = auth.currentUser.uid; return uid;
    },
    async join(code) {
      try { await F.setDoc(F.doc(db, 'members', uid), { code, joinedAt: Date.now() }); return true; }
      catch (e) { if (denied(e)) return false; throw e; }
    },
    async isMember() {
      try { await F.getDocs(F.query(F.collection(db, 'news'), F.limit(1))); return true; }
      catch (e) { if (denied(e)) return false; throw e; }
    },
    async joinAdmin(code) {
      try { await F.setDoc(F.doc(db, 'admins', uid), { code, joinedAt: Date.now() }); return true; }
      catch (e) { if (denied(e)) return false; throw e; }
    },
    async isAdmin() {
      try { return (await F.getDoc(F.doc(db, 'admins', uid))).exists(); } catch { return false; }
    },
    async touch(info) {
      const ref = F.doc(db, 'members', uid), cur = (await F.getDoc(ref)).data() || {};
      const days = [...new Set([...(cur.days || []), info.day])].sort().slice(-120);
      await F.updateDoc(ref, { name: info.name, school: info.school, lastSeenAt: info.now, days });
    },
    async leave() {
      await Promise.allSettled([F.deleteDoc(F.doc(db, 'admins', uid)), F.deleteDoc(F.doc(db, 'members', uid))]);
    },
    watch(path, cb, onErr) {
      return F.onSnapshot(F.collection(db, path), (snap) => cb(snap.docs.map((x) => ({ ...x.data(), id: x.id }))), (e) => onErr && onErr(e));
    },
    async add(path, data) { return (await F.addDoc(F.collection(db, path), data)).id; },
    async set(path, id, data) { await F.setDoc(F.doc(db, path, id), data); },
    async update(path, id, data) { await F.updateDoc(F.doc(db, path, id), data); },
    async remove(path, id) { await F.deleteDoc(F.doc(db, path, id)); },
    async bump(path, id, field, n, extra) { await F.updateDoc(F.doc(db, path, id), { [field]: F.increment(n), ...(extra || {}) }); },
  };
}

/* ---------- 状態 ---------- */
const S = {
  store: null, uid: null, admin: false, joined: false,
  me: (() => { try { return JSON.parse(lsGet('kokugo-hiroba-me')) || {}; } catch { return {}; } })(),
  data: { news: [], posts: [], events: [], resources: [] },
  ready: { news: false, posts: false, events: false, resources: false },
  detail: { path: null, items: [], stop: null },
  f: { cat: '', q: '', rq: '', rSchool: '', rSubject: '', rKind: '' },
  gakkai: { state: 'loading', items: [], all: false },
  composing: false, pending: false,
};
const author = () => ({ uid: S.uid, name: S.me.name, school: S.me.school });
const mine = (x) => x && (x.uid === S.uid || S.admin);
const route = () => { const [page = 'home', id] = location.hash.replace(/^#\/?/, '').split('/'); return { page: page || 'home', id }; };

/* ---------- 入口 ---------- */
function gateView(err = '') {
  return `<form class="gate" id="gateForm">
    <h1>国語科ひろば</h1>
    <p>川崎市立高校五校の国語科の先生のためのページです。</p>
    <label for="g-code">合言葉</label>
    <input id="g-code" name="code" type="password" required autocomplete="off">
    <label for="g-name">お名前</label>
    <input id="g-name" name="name" required maxlength="20" value="${esc(S.me.name || '')}" placeholder="例：川崎">
    <label for="g-school">学校</label>
    <select id="g-school" name="school" required>
      <option value="">選んでください</option>
      ${SCHOOLS.map((s) => `<option ${S.me.school === s ? 'selected' : ''} value="${s}">${school(s)}</option>`).join('')}
    </select>
    <div class="hint">お名前・学校と、このページを開いた日は、管理者が確認できます。</div>
    <div class="err" id="gateErr">${esc(err)}</div>
    <button class="btn">入る</button>
  </form>`;
}
async function onGate(form) {
  const v = Object.fromEntries(new FormData(form)), btn = form.querySelector('button');
  btn.disabled = true;
  try {
    if (!(await S.store.join(v.code.trim()))) { $('#gateErr').textContent = '合言葉が違うようです。'; return; }
    S.me = { name: v.name.trim(), school: v.school }; lsSet('kokugo-hiroba-me', JSON.stringify(S.me));
    await enter();
  } catch (e) { console.error(e); $('#gateErr').textContent = 'つながりませんでした。少し待ってもう一度お試しください。'; }
  finally { btn.disabled = false; }
}
async function enter() {
  S.joined = true; S.admin = await S.store.isAdmin();
  for (const col of Object.keys(S.data)) {
    S.store.watch(col, (items) => { S.data[col] = items; S.ready[col] = true; render(); }, (e) => { console.error(e); if (e.code === 'permission-denied') location.reload(); });
  }
  loadGakkai();
  touch();
  onRoute();
}
// 開いた記録（名前・学校・開いた日）を自分の登録に残す。管理者の一覧で使う
function touch() {
  S.store.touch({ name: S.me.name, school: S.me.school, now: Date.now(), day: today() }).catch((e) => console.error(e));
}

/* ---------- 学会・研究会カレンダー（別サイトで毎日自動更新）を読み込む ---------- */
const GAKKAI = 'https://upopotennis-gif.github.io/kokugo-kenkyukai-info/';
async function loadGakkai() {
  try {
    const get = (f) => fetch(GAKKAI + f, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(f + ' ' + r.status))));
    const [events, hidden] = await Promise.all([get('events.json'), get('hidden.json').catch(() => [])]);
    const t = today();
    S.gakkai.items = events
      .filter((e) => e && e.name && e.eventDate && !hidden.includes(e.name))
      .map((e) => { const [start, end] = String(e.eventDate).split('〜'); return { ...e, start, end: end || start }; })
      .filter((e) => e.end >= t)
      .sort((a, b) => a.start.localeCompare(b.start));
    S.gakkai.state = 'ok';
  } catch (e) { console.error(e); S.gakkai.state = 'ng'; }
  render();
}
function gakkaiCard(e) {
  const d = dayParts(e.start), d2 = e.end !== e.start ? dayParts(e.end) : null, t = today();
  const dl = e.deadline ? dayParts(e.deadline) : null;
  const src = /^https?:\/\//.test(e.source || '') ? e.source : null;   // メールが出どころのものは出さない
  return `<article class="card ev">
    <div class="ev-date"><span class="m">${d.m}月</span><span class="d">${d.d}</span><span class="w">${d.w}${d2 ? `〜${d2.d}日` : ''}</span></div>
    <div><h3>${esc(e.name)}</h3>
      <div class="meta">${esc(e.time || '時間は未定')}${dl ? `　<span class="tag ${e.deadline < t ? 'shu' : ''}">申込 ${dl.m}/${dl.d}まで${e.deadline < t ? '（過ぎています）' : ''}</span>` : ''}</div>
      ${e.apply ? `<p class="body">${linkify(e.apply)}</p>` : ''}
      ${src ? `<a class="src" href="${esc(src)}" target="_blank" rel="noopener noreferrer">もとの案内を開く ↗</a>` : ''}
    </div></article>`;
}
function gakkaiSection() {
  const g = S.gakkai, n = 5, list = g.all ? g.items : g.items.slice(0, n);
  const body = g.state === 'loading' ? '<p class="loading">読み込んでいます…</p>'
    : g.state === 'ng' ? `<p class="empty">いまは読み込めませんでした。<a href="${GAKKAI}" target="_blank" rel="noopener noreferrer">学会・研究会カレンダー</a>で直接ご覧ください。</p>`
    : !g.items.length ? '<p class="empty">これからの予定はありません。</p>'
    : list.map(gakkaiCard).join('') + (g.items.length > n ? `<div class="acts"><button class="btn ghost" data-act="gakkai-all">${g.all ? '近い5件だけにする' : `残り${g.items.length - n}件も見る`}</button></div>` : '');
  return `<section class="sec"><div class="sec-head"><h2>学会・研究会カレンダーから</h2><a href="${GAKKAI}" target="_blank" rel="noopener noreferrer">開く ↗</a></div>
    <p class="meta" style="margin:0 0 12px">外部の学会・研究会の予定です。毎日自動で集めたものなので、参加の前に必ずもとの案内で日時と申込方法を確かめてください。</p>${body}</section>`;
}

/* ---------- 画面 ---------- */
function render() {
  if (S.composing) { S.pending = true; return; }   // 日本語の変換中は描き直さない
  S.pending = false;
  const main = $('#main'), r = route();
  $('#meBtn').hidden = !S.joined;
  $('#tabs').hidden = !S.joined;
  if (!S.joined) { main.innerHTML = gateView(); return; }
  $('#meBtn').textContent = `${S.me.name}・${school(S.me.school)}${S.admin ? '（管理者）' : ''}`;
  document.querySelectorAll('#tabs a').forEach((a) => a.classList.toggle('on', a.dataset.tab === r.page));

  const keep = {}; let focus = null, sel = null;
  main.querySelectorAll('[data-keep]').forEach((el) => {
    keep[el.dataset.keep] = el.value;
    if (el === document.activeElement) { focus = el.dataset.keep; try { sel = [el.selectionStart, el.selectionEnd]; } catch { sel = null; } }
  });
  const view = { home: homeView, news: newsView, board: r.id ? threadView : boardView, events: r.id ? eventView : eventsView, resources: resourcesView, admin: adminView }[r.page] || homeView;
  main.innerHTML = view(r.id);
  main.querySelectorAll('[data-keep]').forEach((el) => {
    if (el.dataset.keep in keep) el.value = keep[el.dataset.keep];
    if (focus === el.dataset.keep) { el.focus(); if (sel && sel[0] != null) { try { el.setSelectionRange(sel[0], sel[1]); } catch { /* select など */ } } }
  });
}
const loadingOr = (col, html) => (S.ready[col] ? html : '<p class="loading">読み込んでいます…</p>');
const editBtns = (col, x) => (mine(x) ? `<div class="acts"><button class="btn ghost small" data-act="edit" data-col="${col}" data-id="${x.id}">直す</button><button class="btn danger small" data-act="del" data-col="${col}" data-id="${x.id}">消す</button></div>` : '');

const sortNews = () => [...S.data.news].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.createdAt - a.createdAt);
const sortPosts = () => [...S.data.posts].sort((a, b) => (b.lastReplyAt || b.createdAt) - (a.lastReplyAt || a.createdAt));
const upcoming = () => S.data.events.filter((e) => e.date >= today()).sort((a, b) => a.date.localeCompare(b.date));
const past = () => S.data.events.filter((e) => e.date < today()).sort((a, b) => b.date.localeCompare(a.date));

function newsCard(n) {
  return `<article class="card ${n.pinned ? 'pin' : ''}">
    <h3>${n.pinned ? '<span class="tag shu">固定</span>' : ''}${esc(n.title)}</h3>
    <div class="meta">${who(n)}　${when(n.createdAt)}</div>
    <p class="body">${linkify(n.body)}</p>${editBtns('news', n)}
  </article>`;
}
function postRow(p) {
  return `<a class="row" href="#/board/${p.id}"><span class="tag">${esc(p.cat)}</span><b>${esc(p.title)}</b>
    <span class="meta">${who(p)}　返信 ${p.replyCount || 0}件　${when(p.lastReplyAt || p.createdAt)}</span></a>`;
}
function eventCard(e, isPast) {
  const d = dayParts(e.date);
  return `<article class="card ev ${isPast ? 'past' : ''}">
    <div class="ev-date"><span class="m">${d.m}月</span><span class="d">${d.d}</span><span class="w">${d.w}</span></div>
    <div><h3><a href="#/events/${e.id}">${esc(e.title)}</a></h3>
      <div class="meta">${esc(e.time || '')}　${esc(e.place || '')}</div>
      ${isPast ? `<span class="tag ${e.record ? '' : 'shu'}">${e.record ? '記録あり' : '記録はまだ'}</span>` : ''}
    </div></article>`;
}
function resCard(x) {
  return `<article class="card">
    <h3><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.title)} ↗</a></h3>
    <div><span class="tag">${esc(x.subject)}</span><span class="tag">${esc(x.kind)}</span></div>
    ${x.desc ? `<p class="body">${linkify(x.desc)}</p>` : ''}
    <div class="meta" style="margin-top:6px">${who(x)}　${when(x.createdAt)}</div>${editBtns('resources', x)}
  </article>`;
}

function homeView() {
  const news = sortNews().slice(0, 3), ev = upcoming().slice(0, 3), posts = sortPosts().slice(0, 5);
  const res = [...S.data.resources].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3);
  const sec = (title, href, col, list, html) => `<section class="sec"><div class="sec-head"><h2>${title}</h2><a href="${href}">すべて見る</a></div>
    ${loadingOr(col, list.length ? html : '<p class="empty">まだありません。</p>')}</section>`;
  return `<div class="head"><div><h1>${esc(S.me.name)}先生、こんにちは</h1><p>五校の国語科の「いま」をここに集めます。</p></div></div>
    ${sec('お知らせ', '#/news', 'news', news, news.map(newsCard).join(''))}
    ${sec('これからの研究会', '#/events', 'events', ev, ev.map((e) => eventCard(e)).join(''))}
    ${sec('掲示板の新しい話題', '#/board', 'posts', posts, `<div class="rows">${posts.map(postRow).join('')}</div>`)}
    ${sec('新しく入った資料', '#/resources', 'resources', res, res.map(resCard).join(''))}`;
}
function newsView() {
  const list = sortNews();
  return `<div class="head"><div><h1>お知らせ</h1><p>各校・研究会からの連絡です。</p></div><button class="btn" data-act="new" data-col="news">お知らせを書く</button></div>
    ${loadingOr('news', list.length ? list.map(newsCard).join('') : '<p class="empty">お知らせはまだありません。</p>')}`;
}
function boardView() {
  const q = S.f.q.trim().toLowerCase();
  const list = sortPosts().filter((p) => (!S.f.cat || p.cat === S.f.cat) && (!q || (p.title + p.body + p.name).toLowerCase().includes(q)));
  return `<div class="head"><div><h1>掲示板</h1><p>授業の相談、教材の話、ちょっとした質問など。</p></div><button class="btn" data-act="new" data-col="posts">話題を立てる</button></div>
    <div class="chips">${['', ...CATS].map((c) => `<button class="chip ${S.f.cat === c ? 'on' : ''}" data-act="cat" data-cat="${c}">${c || 'すべて'}</button>`).join('')}</div>
    <div class="tools"><input type="search" placeholder="ことばで探す" data-keep="q" data-f="q" value="${esc(S.f.q)}" aria-label="掲示板をことばで探す"></div>
    ${loadingOr('posts', list.length ? `<div class="rows">${list.map(postRow).join('')}</div>` : '<p class="empty">当てはまる話題はありません。</p>')}`;
}
function threadView(id) {
  const p = S.data.posts.find((x) => x.id === id);
  if (!p) return S.ready.posts ? '<a class="back" href="#/board">← 掲示板へ</a><p class="empty">この話題は見つかりません。</p>' : '<p class="loading">読み込んでいます…</p>';
  const replies = [...S.detail.items].sort((a, b) => a.createdAt - b.createdAt);
  return `<a class="back" href="#/board">← 掲示板へ</a>
    <article class="card"><span class="tag">${esc(p.cat)}</span><h1 style="font-size:22px;margin-top:6px">${esc(p.title)}</h1>
      <div class="meta">${who(p)}　${when(p.createdAt)}</div><p class="body">${linkify(p.body)}</p>${editBtns('posts', p)}</article>
    <section class="sec"><div class="sec-head"><h2>返信 ${replies.length}件</h2></div>
      <div class="card">${replies.length ? replies.map((r) => `<div class="reply"><div class="meta">${who(r)}　${when(r.createdAt)}</div><p class="body">${linkify(r.body)}</p>
        ${mine(r) ? `<div class="acts"><button class="btn danger small" data-act="reply-del" data-id="${r.id}">消す</button></div>` : ''}</div>`).join('') : '<p class="meta">まだ返信はありません。</p>'}</div>
      <label for="replyBox">返信を書く</label>
      <textarea id="replyBox" data-keep="reply-${id}" maxlength="4000"></textarea>
      <div class="acts"><button class="btn" data-act="reply-send">返信する</button></div>
    </section>`;
}
function eventsView() {
  const up = upcoming(), pa = past();
  return `<div class="head"><div><h1>研究会</h1><p>予定の確認、出欠、終わった会の記録。</p></div><button class="btn" data-act="new" data-col="events">研究会を登録する</button></div>
    ${loadingOr('events', `<section><div class="sec-head"><h2>五校の研究会（これから）</h2></div>${up.length ? up.map((e) => eventCard(e)).join('') : '<p class="empty">予定されている研究会はありません。</p>'}</section>
    ${gakkaiSection()}
    <section class="sec"><div class="sec-head"><h2>五校の研究会（これまで）</h2></div>${pa.length ? pa.map((e) => eventCard(e, true)).join('') : '<p class="empty">まだありません。</p>'}</section>`)}`;
}
function eventView(id) {
  const e = S.data.events.find((x) => x.id === id);
  if (!e) return S.ready.events ? '<a class="back" href="#/events">← 研究会へ</a><p class="empty">この研究会は見つかりません。</p>' : '<p class="loading">読み込んでいます…</p>';
  const d = dayParts(e.date), att = S.detail.items, my = att.find((a) => a.id === S.uid);
  const group = (st) => att.filter((a) => a.status === st);
  return `<a class="back" href="#/events">← 研究会へ</a>
    <article class="card"><h1 style="font-size:22px">${esc(e.title)}</h1>
      <dl class="info"><dt>日にち</dt><dd>${d.y}年${d.m}月${d.d}日（${d.w}）</dd><dt>時間</dt><dd>${esc(e.time || '未定')}</dd><dt>会場</dt><dd>${esc(e.place || '未定')}</dd><dt>登録</dt><dd>${who(e)}</dd></dl>
      ${e.body ? `<p class="body">${linkify(e.body)}</p>` : ''}${editBtns('events', e)}</article>
    <section class="sec"><div class="sec-head"><h2>出欠</h2><span class="meta">出席 ${group('出席').length}名</span></div>
      <div class="att-btns">${ATT.map((s) => `<button class="chip ${my && my.status === s ? 'on' : ''}" data-act="att" data-st="${s}">${s}</button>`).join('')}</div>
      <ul class="att-list">${ATT.map((s) => { const g = group(s); return g.length ? `<li><span class="tag ${s === '出席' ? '' : 'shu'}">${s}</span>${g.map(who).join('、')}</li>` : ''; }).join('') || '<li class="meta">まだ誰も入力していません。</li>'}</ul>
    </section>
    <section class="sec"><div class="sec-head"><h2>記録・配付資料</h2></div>
      ${e.record ? `<div class="card"><p class="body" style="margin:0">${linkify(e.record)}</p></div>` : '<p class="meta">記録はまだありません。</p>'}
      <div class="acts"><button class="btn ghost" data-act="record" data-id="${e.id}">${e.record ? '記録を直す' : '記録を書く'}</button></div>
    </section>`;
}
function resourcesView() {
  const f = S.f, q = f.rq.trim().toLowerCase();
  const list = [...S.data.resources].sort((a, b) => b.createdAt - a.createdAt).filter((x) =>
    (!f.rSchool || x.school === f.rSchool) && (!f.rSubject || x.subject === f.rSubject) && (!f.rKind || x.kind === f.rKind) &&
    (!q || (x.title + (x.desc || '') + x.name).toLowerCase().includes(q)));
  const sel = (key, label, opts, fmt = (s) => s) => `<select data-keep="${key}" data-f="${key}" aria-label="${label}"><option value="">${label}：すべて</option>${opts.map((o) => `<option value="${o}" ${f[key] === o ? 'selected' : ''}>${fmt(o)}</option>`).join('')}</select>`;
  return `<div class="head"><div><h1>資料棚</h1><p>指導案・教材・考査などのリンクを持ち寄る棚です。</p></div><button class="btn" data-act="new" data-col="resources">資料を登録する</button></div>
    <div class="tools">${sel('rSchool', '学校', SCHOOLS, school)}${sel('rSubject', '科目', SUBJECTS)}${sel('rKind', '種類', KINDS)}
      <input type="search" placeholder="ことばで探す" data-keep="rq" data-f="rq" value="${esc(f.rq)}" aria-label="資料をことばで探す"></div>
    ${loadingOr('resources', list.length ? list.map(resCard).join('') : '<p class="empty">当てはまる資料はありません。</p>')}`;
}

function adminView() {
  if (!S.admin) return '<p class="empty">このページは、管理者として入ると見られます（右上の名前 →「管理者として入る」）。</p>';
  const from = ymd(new Date(Date.now() - 29 * 86400000)), people = new Map();
  for (const m of S.detail.items) {
    const key = m.name ? m.name + '\u0000' + m.school : m.id;       // 同じ人のスマホとパソコンは1人にまとめる
    const g = people.get(key) || { name: m.name, school: m.school, joinedAt: Infinity, lastSeenAt: 0, days: new Set(), devices: 0 };
    g.devices++; g.joinedAt = Math.min(g.joinedAt, m.joinedAt || Infinity); g.lastSeenAt = Math.max(g.lastSeenAt, m.lastSeenAt || 0);
    (m.days || []).forEach((d) => g.days.add(d)); people.set(key, g);
  }
  const list = [...people.values()].sort((a, b) => b.lastSeenAt - a.lastSeenAt), named = list.filter((g) => g.name);
  const bySchool = SCHOOLS.map((sc) => [sc, named.filter((g) => g.school === sc).length]).filter(([, n]) => n);
  const row = (g) => { const recent = [...g.days].filter((d) => d >= from).length;
    return `<div class="row"><b>${g.name ? who(g) : '（名前の記録がまだない端末）'}</b>
      <span class="meta">直近30日で開いた日 <strong>${recent}日</strong>　／　最後に開いた日 ${g.lastSeenAt ? when(g.lastSeenAt) : '記録なし'}</span>
      <span class="meta">登録 ${isFinite(g.joinedAt) ? when(g.joinedAt) : '不明'}　／　これまでに開いた日 ${g.days.size}日　／　端末 ${g.devices}台</span></div>`; };
  return `<div class="head"><div><h1>登録している人</h1><p>合言葉で入った人の名前と、このページを開いた頻度です（管理者だけが見られます）。</p></div></div>
    <div class="chips"><span class="tag">合わせて ${named.length}人</span>${bySchool.map(([sc, n]) => `<span class="tag">${esc(school(sc))} ${n}人</span>`).join('')}</div>
    ${list.length ? `<div class="rows">${list.map(row).join('')}</div>` : '<p class="empty">まだ誰も登録していません。</p>'}
    <p class="hint" style="margin-top:14px">名前と学校は本人が入口で入れたものです。同じ名前・学校の端末は1人にまとめています。開いた日は、この機能を入れた日（2026年11月15日）より後の分から数えます。「名前の記録がまだない端末」は、それ以前に入ってからまだ開いていない端末です。</p>`;
}

/* ---------- 入力ダイアログ ---------- */
const FORMS = {
  news: { name: 'お知らせ', fields: (x) => [
    { name: 'title', label: '題', required: true, max: 80, value: x?.title },
    { name: 'body', label: '本文', type: 'textarea', required: true, max: 4000, value: x?.body },
    { name: 'pinned', label: 'いちばん上に固定する', type: 'checkbox', value: x?.pinned },
  ] },
  posts: { name: '話題', fields: (x) => [
    { name: 'cat', label: '分類', type: 'select', options: CATS, required: true, value: x?.cat },
    { name: 'title', label: '題', required: true, max: 80, value: x?.title },
    { name: 'body', label: '本文', type: 'textarea', required: true, max: 4000, value: x?.body },
  ] },
  events: { name: '研究会', fields: (x) => [
    { name: 'title', label: '会の名前', required: true, max: 80, value: x?.title },
    { name: 'date', label: '日にち', type: 'date', required: true, value: x?.date },
    { name: 'time', label: '時間', max: 40, value: x?.time, placeholder: '例：15:30〜17:00' },
    { name: 'place', label: '会場', max: 80, value: x?.place, placeholder: '例：市立川崎高校 会議室 / オンライン' },
    { name: 'body', label: '内容・テーマ', type: 'textarea', max: 4000, value: x?.body },
  ] },
  resources: { name: '資料', fields: (x) => [
    { name: 'title', label: '資料の名前', required: true, max: 80, value: x?.title },
    { name: 'url', label: 'リンク（Googleドライブなどの共有リンク）', type: 'url', required: true, max: 500, value: x?.url, placeholder: 'https://', hint: 'リンク先の共有設定（見られる人）も確かめてください。生徒の名前や成績が入った資料は載せません。' },
    { name: 'subject', label: '科目', type: 'select', options: SUBJECTS, required: true, value: x?.subject },
    { name: 'kind', label: '種類', type: 'select', options: KINDS, required: true, value: x?.kind },
    { name: 'desc', label: '説明', type: 'textarea', max: 1000, value: x?.desc },
  ] },
};
function openForm({ title, fields, submit = '保存する', extra = '', onSubmit }) {
  const dlg = $('#dlg');
  const field = (f) => {
    const id = 'f-' + f.name, req = f.required ? 'required' : '', max = f.max ? `maxlength="${f.max}"` : '', ph = f.placeholder ? `placeholder="${esc(f.placeholder)}"` : '';
    const hint = f.hint ? `<div class="hint">${esc(f.hint)}</div>` : '';
    if (f.type === 'checkbox') return `<label class="check"><input type="checkbox" name="${f.name}" ${f.value ? 'checked' : ''}>${f.label}</label>`;
    if (f.type === 'textarea') return `<label for="${id}">${f.label}</label><textarea id="${id}" name="${f.name}" ${req} ${max} ${ph}>${esc(f.value || '')}</textarea>${hint}`;
    if (f.type === 'select') return `<label for="${id}">${f.label}</label><select id="${id}" name="${f.name}" ${req}><option value="">選んでください</option>${f.options.map((o) => `<option value="${o}" ${f.value === o ? 'selected' : ''}>${f.fmt ? f.fmt(o) : o}</option>`).join('')}</select>${hint}`;
    return `<label for="${id}">${f.label}</label><input id="${id}" name="${f.name}" type="${f.type || 'text'}" ${f.type === 'url' ? 'pattern="https?://.+"' : ''} ${req} ${max} ${ph} value="${esc(f.value || '')}">${hint}`;
  };
  dlg.innerHTML = `<form><h2>${title}</h2>${fields.map(field).join('')}${extra}
    <div class="acts"><button type="button" class="btn ghost" data-act="dlg-close">やめる</button><button class="btn">${submit}</button></div></form>`;
  dlg.querySelector('form').onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target), v = {};
    for (const f of fields) v[f.name] = f.type === 'checkbox' ? fd.get(f.name) === 'on' : String(fd.get(f.name) || '').trim();
    const btn = ev.target.querySelector('button:not([type])'); btn.disabled = true;
    try { if ((await onSubmit(v)) !== false) dlg.close(); }
    catch (e) { console.error(e); toast('保存できませんでした。'); }
    finally { btn.disabled = false; }
  };
  dlg.showModal();
}
function openItem(col, id) {
  const x = id ? S.data[col].find((y) => y.id === id) : null, F = FORMS[col];
  openForm({
    title: `${F.name}を${x ? '直す' : (col === 'posts' ? '立てる' : col === 'news' ? '書く' : '登録する')}`,
    fields: F.fields(x),
    onSubmit: async (v) => {
      if (x) await S.store.update(col, id, v);
      else {
        const extra = col === 'posts' ? { replyCount: 0, lastReplyAt: 0 } : col === 'events' ? { record: '' } : {};
        const newId = await S.store.add(col, { ...v, ...extra, ...author(), createdAt: Date.now() });
        if (col === 'posts') location.hash = '#/board/' + newId;
      }
      toast(x ? '直しました。' : '登録しました。');
    },
  });
}
function openProfile() {
  openForm({
    title: '自分の名前と学校',
    fields: [
      { name: 'name', label: 'お名前', required: true, max: 20, value: S.me.name },
      { name: 'school', label: '学校', type: 'select', options: SCHOOLS, fmt: school, required: true, value: S.me.school },
    ],
    extra: `<div class="acts" style="margin-top:18px">${S.admin ? '<a class="btn ghost small" href="#/admin" data-act="dlg-close">登録している人を見る</a>' : '<button type="button" class="btn ghost small" data-act="admin">管理者として入る</button>'}<button type="button" class="btn danger small" data-act="leave">このページから出る</button></div>
      <div class="hint">名前を変えても、これまでの書き込みの名前はそのままです。</div>`,
    onSubmit: async (v) => { S.me = v; lsSet('kokugo-hiroba-me', JSON.stringify(v)); touch(); render(); },
  });
}

/* ---------- 操作 ---------- */
const ACT = {
  profile: openProfile,
  'dlg-close': () => $('#dlg').close(),
  new: (el) => openItem(el.dataset.col),
  edit: (el) => openItem(el.dataset.col, el.dataset.id),
  async del(el) {
    const { col, id } = el.dataset;
    if (!confirm('消すと元に戻せません。消しますか？')) return;
    await S.store.remove(col, id); toast('消しました。');
    if (route().id === id) location.hash = col === 'posts' ? '#/board' : '#/' + col;
  },
  cat(el) { S.f.cat = el.dataset.cat; render(); },
  'gakkai-all'() { S.gakkai.all = !S.gakkai.all; render(); },
  async 'reply-send'(el) {
    const { id } = route(), box = $('#replyBox'), body = box.value.trim();
    if (!body) { box.focus(); return; }
    el.disabled = true;
    const now = Date.now();
    await S.store.add(`posts/${id}/replies`, { body, ...author(), createdAt: now });
    await S.store.bump('posts', id, 'replyCount', 1, { lastReplyAt: now });
    const fresh = $('#replyBox'); if (fresh) fresh.value = '';   // 描き直された後の入力欄を空にする
    toast('返信しました。');
  },
  async 'reply-del'(el) {
    if (!confirm('この返信を消しますか？')) return;
    const { id } = route();
    await S.store.remove(`posts/${id}/replies`, el.dataset.id);
    await S.store.bump('posts', id, 'replyCount', -1);
  },
  async att(el) {
    const { id } = route();
    await S.store.set(`events/${id}/attendance`, S.uid, { status: el.dataset.st, ...author(), updatedAt: Date.now() });
    toast(`「${el.dataset.st}」で入れました。`);
  },
  record(el) {
    const e = S.data.events.find((x) => x.id === el.dataset.id);
    openForm({
      title: '記録・配付資料',
      fields: [{ name: 'record', label: '話し合ったこと、配付資料のリンクなど', type: 'textarea', max: 8000, value: e.record, hint: 'リンク（https://〜）はそのまま押せるようになります。' }],
      onSubmit: async (v) => { await S.store.update('events', e.id, v); toast('記録を保存しました。'); },
    });
  },
  admin() {
    openForm({
      title: '管理者として入る', submit: '入る',
      fields: [{ name: 'code', label: '管理者用の合言葉', type: 'password', required: true }],
      onSubmit: async (v) => {
        if (!(await S.store.joinAdmin(v.code))) { toast('合言葉が違うようです。'); return false; }
        S.admin = true; onRoute(); toast('管理者として入りました。');
      },
    });
  },
  async leave() {
    if (!confirm('このページから出ますか？（次に入るとき、また合言葉が要ります）')) return;
    await S.store.leave(); location.hash = ''; location.reload();
  },
};
document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el || !ACT[el.dataset.act]) return;
  try { await ACT[el.dataset.act](el); }
  catch (e) { console.error(e); toast('うまくいきませんでした。もう一度お試しください。'); if (el.disabled) el.disabled = false; }
});
document.addEventListener('submit', (ev) => { if (ev.target.id === 'gateForm') { ev.preventDefault(); onGate(ev.target); } });
document.addEventListener('input', (ev) => { const k = ev.target.dataset && ev.target.dataset.f; if (k) { S.f[k] = ev.target.value; render(); } });
document.addEventListener('compositionstart', () => { S.composing = true; });
document.addEventListener('compositionend', () => { S.composing = false; if (S.pending) render(); });

function onRoute() {
  if (!S.joined) { render(); return; }
  const r = route();
  const path = r.id && r.page === 'board' ? `posts/${r.id}/replies` : r.id && r.page === 'events' ? `events/${r.id}/attendance` : r.page === 'admin' && S.admin ? 'members' : null;
  if (path !== S.detail.path) {
    if (S.detail.stop) S.detail.stop();
    S.detail = { path, items: [], stop: null };
    if (path) S.detail.stop = S.store.watch(path, (items) => { if (S.detail.path === path) { S.detail.items = items; render(); } }, console.error);
    window.scrollTo(0, 0);
  }
  render();
}
window.addEventListener('hashchange', onRoute);

/* ---------- はじまり ---------- */
(async () => {
  try {
    S.store = firebaseConfig ? await firebaseStore(firebaseConfig) : demoStore();
    $('#demoBar').hidden = !S.store.demo;
    S.uid = await S.store.start();
    if (S.me.name && S.me.school && (await S.store.isMember())) await enter(); else render();
  } catch (e) {
    console.error(e);
    $('#main').innerHTML = '<p class="empty">つながりませんでした。電波のよいところで、もう一度開いてみてください。</p>';
  }
})();
