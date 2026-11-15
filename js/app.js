/* Potter Personal Space — static site. Content comes from js/content.js. No innerHTML: all text goes through textContent. */
(function () {
  'use strict';
  var C = window.SITE_CONTENT || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  function el(tag, props, kids) {
    var e = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k]; if (v == null || v === false) return;
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k === 'on') Object.keys(v).forEach(function (ev) { e.addEventListener(ev, v[ev]); });
      else if (k === 'data') Object.keys(v).forEach(function (d) { e.dataset[d] = v[d]; }); else e.setAttribute(k, v === true ? '' : v);
    });
    [].concat(kids || []).forEach(function (c) { if (c != null && c !== false) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  var httpsOnly = function (u) { return /^https:\/\/[^\s<>"']+$/.test(u || '') ? u : ''; };
  var imgSrc = function (u) { return /^(https:\/\/[^\s<>"']+|img\/[A-Za-z0-9_./-]+)$/.test(u || '') ? u : ''; };

  // ---- i18n
  var lang = store.get('ps_lang') || ((navigator.language || '').toLowerCase().indexOf('th') === 0 ? 'th' : 'en');
  function t(k) { return (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k; }
  function L(o) { return (o && (o[lang] || o[lang === 'th' ? 'en' : 'th'])) || ''; }
  function fmtDate(s) { try { return new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-GB', { dateStyle: 'medium' }).format(new Date(s)); } catch (e) { return ''; } }
  function applyI18n() {
    document.documentElement.lang = lang;
    $$('[data-i18n]').forEach(function (n) { n.textContent = t(n.dataset.i18n); });
    $$('[data-i18n-ph]').forEach(function (n) { n.placeholder = t(n.dataset.i18nPh); });
    $$('[data-i18n-aria]').forEach(function (n) { n.setAttribute('aria-label', t(n.dataset.i18nAria)); });
    $('#langBtn').textContent = lang === 'th' ? 'EN' : 'TH';
  }

  // ---- modals + lightbox
  var lastFocus = null;
  function openModal(m) { lastFocus = document.activeElement; m.hidden = false; document.body.style.overflow = 'hidden'; var f = $('button,a[href]', m); if (f) setTimeout(function () { f.focus(); }, 30); }
  function closeModal(m) { if (m.hidden) return; m.hidden = true; if (!$$('.modal').some(function (x) { return !x.hidden; })) document.body.style.overflow = ''; if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {} }
  function closeAny(m) {
    closeModal(m);
    if (m.id === 'projModal') { history.replaceState(null, '', '#projects'); document.title = pageTitle(); }
    if (m.id === 'reader') { history.replaceState(null, '', '#blog'); document.title = pageTitle(); }
  }
  document.addEventListener('keydown', function (e) {
    var o = $$('.modal').filter(function (x) { return !x.hidden; }), m = o[o.length - 1]; if (!m) return;
    if (e.key === 'Escape') { e.preventDefault(); closeAny(m); }
    else if (m.id === 'lightbox' && e.key === 'ArrowRight') lbStep(1); else if (m.id === 'lightbox' && e.key === 'ArrowLeft') lbStep(-1);
    else if (e.key === 'Tab') { var f = $$('button,a[href]', m).filter(function (x) { return !x.disabled && x.offsetParent !== null; }); if (!f.length) return; var a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
  });
  $$('.modal').forEach(function (m) {
    m.addEventListener('click', function (e) { if (e.target === m || (m.id === 'lightbox' && e.target.tagName === 'FIGURE')) closeAny(m); });
    $$('[data-close]', m).forEach(function (b) { b.addEventListener('click', function () { closeAny(m); }); });
  });
  var lb = { items: [], i: 0 };
  function openLightbox(items, i) { lb.items = items; lb.i = i; lbShow(); openModal($('#lightbox')); }
  function lbShow() { var it = lb.items[lb.i], img = $('#lbImg'); img.classList.remove('zoomed'); img.style.transformOrigin = ''; img.style.animation = 'none'; void img.offsetWidth; img.style.animation = '';
    img.src = it.src; img.alt = it.alt || ''; $('#lbCap').textContent = it.caption || ''; $('#lbPrev').hidden = $('#lbNext').hidden = lb.items.length < 2; }
  function lbStep(d) { if (lb.items.length < 2) return; lb.i = (lb.i + d + lb.items.length) % lb.items.length; lbShow(); }
  $('#lbPrev').addEventListener('click', function () { lbStep(-1); }); $('#lbNext').addEventListener('click', function () { lbStep(1); });
  $('#lbImg').addEventListener('click', function (e) { var r = this.getBoundingClientRect(); this.style.transformOrigin = ((e.clientX - r.left) / r.width * 100) + '% ' + ((e.clientY - r.top) / r.height * 100) + '%'; this.classList.toggle('zoomed'); });

  // ---- interactive 3D profile card (spring physics)
  (function () {
    var card = $('#profileCard'), img = $('#profileImg'), fb = $('#fallback'), rx = 0, ry = 0, vx = 0, vy = 0, tx = 0, ty = 0, raf = 0, tt = 0;
    function frame() {
      vx = (vx + (tx - rx) * .14) * .76; vy = (vy + (ty - ry) * .14) * .76; rx += vx; ry += vy;
      card.style.transform = 'rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) scale(' + (1 + (card.classList.contains('hot') ? .035 : 0)) + ')';
      if (Math.abs(vx) + Math.abs(vy) + Math.abs(tx - rx) + Math.abs(ty - ry) > .02) raf = requestAnimationFrame(frame); else { raf = 0; if (!card.classList.contains('hot')) card.style.transform = ''; }
    }
    function kick() { if (!raf) raf = requestAnimationFrame(frame); }
    function point(e) { var r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      if (!FX.reduce) { ty = (x - .5) * 22; tx = (.5 - y) * 22; kick(); } card.style.setProperty('--mx', x * 100 + '%'); card.style.setProperty('--my', y * 100 + '%'); }
    function rest() { tx = ty = 0; card.classList.remove('hot'); card.style.removeProperty('--mx'); card.style.removeProperty('--my'); kick(); }
    card.addEventListener('pointerenter', function (e) { clearTimeout(tt); card.classList.add('hot'); point(e); });
    card.addEventListener('pointermove', point); card.addEventListener('pointerleave', rest);
    card.addEventListener('pointerdown', function (e) { if (e.pointerType === 'touch') { clearTimeout(tt); card.classList.add('hot'); point(e); } });
    ['pointerup', 'pointercancel'].forEach(function (ev) { card.addEventListener(ev, function (e) { if (e.pointerType === 'touch') tt = setTimeout(rest, 700); }); });
    card.addEventListener('focus', function () { card.classList.add('hot'); }); card.addEventListener('blur', rest);
    card.addEventListener('click', function () { if (fb.hidden) openLightbox([{ src: img.currentSrc || img.src, alt: img.alt }], 0); });
    img.addEventListener('error', function () { img.hidden = true; fb.hidden = false; }); img.addEventListener('load', function () { img.hidden = false; fb.hidden = true; });
    function sync() { if (!img.complete) return; var bad = img.naturalWidth === 0; img.hidden = bad; fb.hidden = !bad; } sync(); // the image may have failed/finished before this script ran
  })();

  // ---- state / helpers
  var P = C.profile || {}, PAGE = { proj: 12, gal: 18, blog: 9 };
  var S = { skillCat: '', projCat: '', projQ: '', projShown: PAGE.proj, galCat: '', galShown: PAGE.gal, blogCat: '', blogQ: '', blogPage: 1, proj: null, post: null };
  var PCATS = ['website', 'application', 'discord_bot', 'minecraft', 'ai', 'experiment'], GCATS = ['personal', 'projects', 'screenshots', 'workspace', 'models', 'creative'], SCATS = ['programming', 'development', 'tools', 'other'];
  var posts = (C.blog || []).filter(function (b) { return b.status !== 'draft'; }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
  var projects = (C.projects || []).slice().sort(function (a, b) { return (b.featured ? 1 : 0) - (a.featured ? 1 : 0); });
  function pageTitle() { return (P.name || 'Potter') + ' — Personal Space'; }
  function state(box, msg) { clear(box).appendChild(el('div', { class: 'state' }, [el('p', { text: msg })])); }
  function chipRow(box, items, cur, pick) { clear(box); items.forEach(function (it) { box.appendChild(el('button', { type: 'button', class: it.v === cur ? 'on' : '', 'aria-pressed': it.v === cur ? 'true' : 'false', text: it.label, on: { click: function () { pick(it.v); } } })); }); }
  function md(text) { var d = el('div', { class: 'md' }); d.appendChild(MD.render(document, text)); return d; }
  function chips(a) { return el('div', { class: 'chips' }, (a || []).map(function (x) { return el('span', { class: 'chip', text: x }); })); }
  function linkChip(l) { var u = httpsOnly(l.url); return u ? el('a', { class: 'chip', href: u, target: '_blank', rel: 'noopener noreferrer', text: l.label }) : null; }
  function words(s) { return (s || '').toLowerCase(); }
  function readMin(b) { var s = L(b.body); return Math.max(1, Math.round(((s.match(/[\u0E00-\u0E7F]/g) || []).length) / 900 + ((s.match(/[A-Za-z0-9_]+/g) || []).length) / 200)); }

  function renderHero() {
    var name = P.name || 'Potter'; if ($('#heroName').getAttribute('aria-label') !== name.toUpperCase()) FX.split($('#heroName'), name.toUpperCase());
    $('#intro').textContent = L(P.intro) || t('hero.sub'); $('#tagline').textContent = L(P.tagline);
    var img = $('#profileImg'), src = imgSrc(P.photo) || 'img/profile.jpg'; if (img.getAttribute('src') !== src) img.src = src; img.alt = t('hero.cardAlt') + ' ' + name; document.title = pageTitle();
  }
  function renderStrip() {
    var ints = clear($('#stripInterests')), soc = clear($('#stripSocial')), lt = clear($('#stripLatest'));
    (P.interests || []).slice(0, 8).forEach(function (x) { ints.appendChild(el('span', { class: 'chip', text: x })); });
    (P.socials || []).forEach(function (l) { var c = linkChip(l); if (c) soc.appendChild(c); });
    if (posts[0]) lt.appendChild(el('div', {}, [el('a', { class: 'post', href: '#/blog/' + posts[0].slug, text: L(posts[0].title) }), el('small', { text: fmtDate(posts[0].date) })]));
    else lt.appendChild(el('span', { class: 'hint', text: t('strip.none') }));
    var cl = clear($('#contactLinks')); (P.socials || []).forEach(function (l) { var c = linkChip(l); if (c) cl.appendChild(c); });
    if (P.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(P.email)) cl.appendChild(el('a', { class: 'chip', href: 'mailto:' + P.email, text: P.email }));
    if (!cl.firstChild) cl.appendChild(el('span', { class: 'hint', text: t('empty') }));
  }
  function renderAbout() {
    var box = clear($('#aboutBody')), any = false;
    [['who', 'about.who'], ['story', 'about.story'], ['journey', 'about.journey'], ['goals', 'about.goals'], ['building', 'about.building']].forEach(function (f) {
      var v = L(P[f[0]]); if (!v) return; any = true; box.appendChild(el('div', { class: 'glass fxi' + (f[0] === 'who' || f[0] === 'story' ? ' wide' : '') }, [el('h3', { text: t(f[1]) }), md(v)]));
    });
    [['interests', 'about.interests'], ['learning', 'about.learning']].forEach(function (f) { var a = P[f[0]] || []; if (!a.length) return; any = true; box.appendChild(el('div', { class: 'glass fxi' }, [el('h3', { text: t(f[1]) }), chips(a)])); });
    if (!any) box.appendChild(el('div', { class: 'state', text: t('empty') }));
    var tl = clear($('#timelineList')), ev = C.timeline || [];
    if (!ev.length) tl.appendChild(el('li', { class: 'state', text: t('empty') }));
    ev.forEach(function (e) { tl.appendChild(el('li', { class: 'glass fxi', data: { k: e.kind } }, [el('time', { text: e.when }), el('small', { text: ' · ' + t('tl.' + e.kind) }), el('h4', { text: L(e.title) }), L(e.body) ? el('p', { text: L(e.body) }) : null])); });
    FX.reveal(box); FX.reveal(tl);
  }
  function renderSkills() {
    var all = C.skills || [], list = clear($('#skillList')), present = SCATS.filter(function (c) { return all.some(function (s) { return s.category === c; }); });
    chipRow($('#skillFilter'), [{ v: '', label: t('all') }].concat(present.map(function (c) { return { v: c, label: t('cat.' + c) }; })), S.skillCat, function (v) { S.skillCat = v; renderSkills(); });
    if (!all.length) return state(list, t('empty'));
    present.filter(function (c) { return !S.skillCat || c === S.skillCat; }).forEach(function (c) {
      var sec = el('section', { class: 'glass fxi' }, [el('h3', { text: t('cat.' + c) })]);
      all.filter(function (s) { return s.category === c; }).forEach(function (s) {
        sec.appendChild(el('button', { type: 'button', class: 'skill', title: t('nav.projects') + ': ' + s.name, on: { click: function () { S.projQ = s.name; $('#projQ').value = s.name; S.projShown = PAGE.proj; renderProjects(); $('#projects').scrollIntoView({ behavior: FX.reduce ? 'auto' : 'smooth' }); } } },
          [el('span', { class: 'ic', 'aria-hidden': 'true', text: s.icon || '•' }), el('span', {}, [s.name, L(s.note) ? el('small', { text: L(s.note) }) : null])]));
      });
      list.appendChild(sec);
    });
    FX.reveal(list);
  }
  function renderProjects() {
    var box = clear($('#projList')), q = words(S.projQ);
    chipRow($('#projCats'), [{ v: '', label: t('all') }].concat(PCATS.map(function (c) { return { v: c, label: t('pcat.' + c) }; })), S.projCat, function (v) { S.projCat = v; S.projShown = PAGE.proj; renderProjects(); });
    var rows = projects.filter(function (p) { return (!S.projCat || p.category === S.projCat) && (!q || words(L(p.title) + ' ' + L(p.summary) + ' ' + (p.tags || []).join(' ')).indexOf(q) >= 0); });
    if (!rows.length) state(box, q || S.projCat ? t('noResult') : t('empty'));
    rows.slice(0, S.projShown).forEach(function (p) {
      var title = L(p.title), cv = imgSrc(p.cover), cover = el('div', { class: 'cover' }, cv ? [el('img', { src: cv, alt: '', loading: 'lazy', decoding: 'async' })] : [title.charAt(0).toUpperCase()]);
      var acts = [el('a', { class: 'btn small', href: '#/project/' + p.slug, text: t('details') })];
      if (httpsOnly(p.github)) acts.push(el('a', { class: 'btn small', href: p.github, target: '_blank', rel: 'noopener noreferrer', text: t('github') }));
      if (httpsOnly(p.demo)) acts.push(el('a', { class: 'btn small', href: p.demo, target: '_blank', rel: 'noopener noreferrer', text: t('demo') }));
      box.appendChild(el('article', { class: 'proj fxi' + (p.featured ? ' feat' : '') }, [cover, el('div', { class: 'body' }, [
        el('div', { class: 'meta' }, [el('span', { class: 'st', data: { s: p.status }, text: t('status.' + p.status) }), el('span', { class: 'chip', text: t('pcat.' + p.category) })]),
        el('h3', { text: title }), el('p', { text: L(p.summary) }), chips(p.tags), el('div', { class: 'acts' }, acts)])]));
    });
    $('#projMore').hidden = rows.length <= S.projShown; FX.reveal(box);
  }
  function showProject(slug) {
    var p = projects.filter(function (x) { return x.slug === slug; })[0]; if (!p) { history.replaceState(null, '', '#projects'); return; }
    S.proj = p; renderProjectSheet(); openModal($('#projModal')); document.title = L(p.title) + ' — ' + pageTitle();
  }
  function renderProjectSheet() {
    var p = S.proj, sh = clear($('#projSheet')); if (!p) return;
    var imgs = (p.images || []).filter(function (x) { return imgSrc(x.src); }), list = imgs.map(function (x) { return { src: x.src, alt: L(x.caption), caption: L(x.caption) }; });
    sh.appendChild(el('button', { type: 'button', class: 'x', 'aria-label': t('close'), text: '✕', on: { click: function () { closeAny($('#projModal')); } } }));
    if (imgSrc(p.cover)) sh.appendChild(el('img', { class: 'hero-img', src: p.cover, alt: '' }));
    sh.appendChild(el('h2', { id: 'pmTitle', text: L(p.title) }));
    sh.appendChild(el('div', { class: 'meta chips' }, [el('span', { class: 'st', data: { s: p.status }, text: t('status.' + p.status) }), el('span', { class: 'chip', text: t('pcat.' + p.category) })].concat((p.tags || []).map(function (x) { return el('span', { class: 'chip', text: x }); }))));
    if (L(p.summary)) sh.appendChild(el('p', { class: 'lead', text: L(p.summary) }));
    if (L(p.body)) sh.appendChild(md(L(p.body)));
    if (imgs.length) { sh.appendChild(el('h3', { text: t('gallery') })); sh.appendChild(el('div', { class: 'shots' }, imgs.map(function (x, i) { return el('img', { src: x.src, alt: L(x.caption), loading: 'lazy', decoding: 'async', on: { click: function () { openLightbox(list, i); } } }); }))); }
    var links = []; if (httpsOnly(p.github)) links.push(el('a', { class: 'btn small', href: p.github, target: '_blank', rel: 'noopener noreferrer', text: t('github') })); if (httpsOnly(p.demo)) links.push(el('a', { class: 'btn small primary', href: p.demo, target: '_blank', rel: 'noopener noreferrer', text: t('demo') }));
    if (links.length) sh.appendChild(el('div', { class: 'cta' }, links));
  }
  function renderGallery() {
    var box = clear($('#galList')), all = (C.gallery || []).filter(function (g) { return imgSrc(g.src) && (!S.galCat || g.category === S.galCat); });
    chipRow($('#galCats'), [{ v: '', label: t('all') }].concat(GCATS.map(function (c) { return { v: c, label: t('gcat.' + c) }; })), S.galCat, function (v) { S.galCat = v; S.galShown = PAGE.gal; renderGallery(); });
    if (!all.length) { box.style.columns = '1'; state(box, S.galCat ? t('noResult') : t('empty')); $('#galMore').hidden = true; return; } box.style.columns = '';
    var lbItems = all.map(function (x) { return { src: x.src, alt: L(x.caption), caption: L(x.caption) }; });
    all.slice(0, S.galShown).forEach(function (g, i) {
      box.appendChild(el('figure', { class: 'fxi', tabindex: '0', role: 'button', 'aria-label': L(g.caption) || t('gcat.' + g.category), on: { click: function () { openLightbox(lbItems, i); }, keydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.click(); } } } },
        [el('img', { src: g.src, alt: L(g.caption), loading: 'lazy', decoding: 'async' }), L(g.caption) ? el('figcaption', { text: L(g.caption) }) : null]));
    });
    $('#galMore').hidden = all.length <= S.galShown; FX.reveal(box, 30);
  }
  function renderBlog() {
    var box = clear($('#blogList')), q = words(S.blogQ), cats = [];
    posts.forEach(function (b) { if (b.category && cats.indexOf(b.category) < 0) cats.push(b.category); });
    chipRow($('#blogCats'), [{ v: '', label: t('blogAll') }].concat(cats.map(function (c) { return { v: c, label: c }; })), S.blogCat, function (v) { S.blogCat = v; S.blogPage = 1; renderBlog(); });
    var rows = posts.filter(function (b) { return (!S.blogCat || b.category === S.blogCat) && (!q || words(L(b.title) + ' ' + L(b.excerpt) + ' ' + (b.tags || []).join(' ')).indexOf(q) >= 0); });
    if (!rows.length) state(box, q || S.blogCat ? t('noResult') : t('empty'));
    rows.slice((S.blogPage - 1) * PAGE.blog, S.blogPage * PAGE.blog).forEach(function (b) {
      box.appendChild(el('a', { class: 'post glass fxi', href: '#/blog/' + b.slug }, [el('div', { class: 'th' }, imgSrc(b.cover) ? [el('img', { src: b.cover, alt: '', loading: 'lazy', decoding: 'async' })] : []),
        el('div', {}, [el('small', { text: [fmtDate(b.date), b.category, readMin(b) + ' ' + t('readMin')].filter(Boolean).join(' · ') }), el('h3', { text: L(b.title) }), el('p', { text: L(b.excerpt) }), chips(b.tags)])]));
    });
    var pg = clear($('#blogPager')), pages = Math.max(1, Math.ceil(rows.length / PAGE.blog));
    if (pages > 1) { pg.appendChild(el('button', { class: 'btn small', type: 'button', text: t('prev'), disabled: S.blogPage <= 1, on: { click: function () { S.blogPage--; renderBlog(); } } })); pg.appendChild(el('span', { text: S.blogPage + ' / ' + pages })); pg.appendChild(el('button', { class: 'btn small', type: 'button', text: t('next'), disabled: S.blogPage >= pages, on: { click: function () { S.blogPage++; renderBlog(); } } })); }
    FX.reveal(box);
  }
  function showPost(slug) {
    var p = posts.filter(function (x) { return x.slug === slug; })[0]; if (!p) { history.replaceState(null, '', '#blog'); return; }
    S.post = p; renderPost(); openModal($('#reader')); document.title = L(p.title) + ' — ' + pageTitle();
  }
  function renderPost() {
    var p = S.post, sh = clear($('#readerSheet')); if (!p) return;
    sh.appendChild(el('button', { type: 'button', class: 'x', 'aria-label': t('close'), text: '✕', on: { click: function () { closeAny($('#reader')); } } }));
    if (imgSrc(p.cover)) sh.appendChild(el('img', { class: 'hero-img', src: p.cover, alt: '' }));
    sh.appendChild(el('h2', { id: 'rdTitle', text: L(p.title) }));
    sh.appendChild(el('p', { class: 'hint', text: [fmtDate(p.date), p.category, readMin(p) + ' ' + t('readMin')].filter(Boolean).join(' · ') }));
    sh.appendChild(md(L(p.body) || L(p.excerpt))); sh.appendChild(chips(p.tags));
  }

  // ---- nav / routing / language
  var menu = $('#navLinks'), burger = $('#menuBtn');
  burger.addEventListener('click', function () { var o = menu.classList.toggle('open'); burger.setAttribute('aria-expanded', o); });
  $$('[data-nav]').forEach(function (a) { a.addEventListener('click', function (e) { var id = a.dataset.nav, tg = document.getElementById(id); if (!tg) return; e.preventDefault();
    menu.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); tg.scrollIntoView({ behavior: FX.reduce ? 'auto' : 'smooth' }); history.replaceState(null, '', '#' + id); }); });
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) $$('#navLinks a').forEach(function (a) { var on = a.dataset.nav === en.target.id; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); }); }); }, { rootMargin: '-40% 0px -55% 0px' });
    $$('main > section[id]').forEach(function (s) { io.observe(s); });
  }
  function route() {
    var h = decodeURIComponent(location.hash || ''), m;
    if ((m = /^#\/project\/([a-z0-9-]+)$/.exec(h))) { closeModal($('#reader')); showProject(m[1]); }
    else if ((m = /^#\/blog\/([a-z0-9-]+)$/.exec(h))) { closeModal($('#projModal')); showPost(m[1]); }
    else { closeModal($('#projModal')); closeModal($('#reader')); document.title = pageTitle(); }
  }
  addEventListener('hashchange', route);
  $('#projQ').addEventListener('input', function () { S.projQ = this.value.trim(); S.projShown = PAGE.proj; renderProjects(); });
  $('#blogQ').addEventListener('input', function () { S.blogQ = this.value.trim(); S.blogPage = 1; renderBlog(); });
  $('#projMore').addEventListener('click', function () { S.projShown += PAGE.proj; renderProjects(); });
  $('#galMore').addEventListener('click', function () { S.galShown += PAGE.gal; renderGallery(); });
  $('#langBtn').addEventListener('click', function () { lang = lang === 'th' ? 'en' : 'th'; store.set('ps_lang', lang); rerender(); });
  function rerender() { applyI18n(); renderHero(); renderStrip(); renderAbout(); renderSkills(); renderProjects(); renderGallery(); renderBlog(); renderProjectSheet(); renderPost(); }
  $('#year').textContent = new Date().getFullYear(); rerender(); route(); FX.hideLoader();
})();
