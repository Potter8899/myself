/* Potter Personal Space — public site. No innerHTML anywhere: all dynamic text goes through textContent. */
(function () {
  'use strict';
  var API = ((window.PS_CONFIG && window.PS_CONFIG.API_URL) || '').replace(/\/$/, '');
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
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
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  // ------------------------------------------------------------------ i18n
  var lang = store.get('ps_lang') || ((navigator.language || '').toLowerCase().indexOf('th') === 0 ? 'th' : 'en');
  function t(k, v) { var s = (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k; if (v) Object.keys(v).forEach(function (x) { s = s.replace('{' + x + '}', v[x]); }); return s; }
  function L(o) { return (o && (o[lang] || o[lang === 'th' ? 'en' : 'th'])) || ''; }
  function fmtDate(iso) { try { return new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-GB', { dateStyle: 'medium' }).format(new Date(iso)); } catch (e) { return ''; } }
  function applyI18n() {
    document.documentElement.lang = lang;
    $$('[data-i18n]').forEach(function (n) { n.textContent = t(n.dataset.i18n); });
    $$('[data-i18n-ph]').forEach(function (n) { n.placeholder = t(n.dataset.i18nPh); });
    $$('[data-i18n-aria]').forEach(function (n) { n.setAttribute('aria-label', t(n.dataset.i18nAria)); });
    $('#langBtn').textContent = lang === 'th' ? 'EN' : 'TH';
  }

  // ------------------------------------------------------------------ toast + api
  function toast(msg, bad) {
    var n = el('div', { class: 'toast' + (bad ? ' bad' : ''), text: msg }); $('#toasts').appendChild(n); setTimeout(function () { n.remove(); }, 4200);
  }
  var wakeShown = false;
  function api(path, opt) {
    opt = opt || {}; var h = { 'Content-Type': 'application/json' }, tok = store.get('ps_token'); if (tok) h.Authorization = 'Bearer ' + tok;
    var ctl = new AbortController(), kill = setTimeout(function () { ctl.abort(); }, 75000);
    var wake = setTimeout(function () { if (!wakeShown) { wakeShown = true; toast(t('waking')); } }, 4000); // Render free tier cold start
    return fetch(API + path, { method: opt.method || 'GET', headers: h, body: opt.body ? JSON.stringify(opt.body) : undefined, signal: ctl.signal })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) { var e = new Error(d.error || 'http_' + r.status); e.code = d.error || 'generic'; e.status = r.status; throw e; } return d; }); })
      .catch(function (e) { if (!e.code) { e.code = 'network'; } throw e; })
      .finally(function () { clearTimeout(kill); clearTimeout(wake); });
  }
  function errText(e) { var k = 'err.' + (e && e.code); return (I18N[lang][k] ? t(k) : t('err.generic')); }

  // ------------------------------------------------------------------ Cloudflare Turnstile wrapper (frontend states; real validation is on the backend)
  var tsReady = null, siteKey = null;
  function loadTurnstile() {
    if (tsReady) return tsReady;
    tsReady = api('/api/config').then(function (c) { siteKey = c.sitekey; if (!siteKey) throw new Error('nokey'); return new Promise(function (ok, no) {
      if (window.turnstile) return ok(); var s = document.createElement('script'); s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.async = true; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); });
    tsReady.catch(function () { tsReady = null; });
    return tsReady;
  }
  function Captcha(box) {
    var w = $('.cap-widget', box), st = $('.cap-status', box), txt = $('.txt', st), retry = $('.retry', st), id = null, token = '', started = false, key = 'cap.idle';
    function set(state, k) { st.dataset.s = state; key = k; txt.textContent = t(k); retry.hidden = !(state === 'failed' || state === 'expired' || state === 'error'); }
    var self = {
      token: function () { return token; },
      refresh: function () { txt.textContent = t(key); },
      ensure: function () {
        if (started) return; started = true; set('loading', 'cap.loading');
        loadTurnstile().then(function () {
          id = turnstile.render(w, { sitekey: siteKey, theme: 'dark', language: lang === 'th' ? 'th' : 'en',
            callback: function (tk) { token = tk; set('verified', 'cap.ok'); },
            'before-interactive-callback': function () { set('verifying', 'cap.checking'); },
            'error-callback': function () { token = ''; set('failed', 'cap.fail'); },
            'expired-callback': function () { token = ''; set('expired', 'cap.exp'); },
            'timeout-callback': function () { token = ''; set('expired', 'cap.exp'); } });
          set('verifying', 'cap.checking');
        }).catch(function (e) { started = false; set('error', e && e.message === 'nokey' ? 'cap.nokey' : 'cap.noload'); });
      },
      reset: function () { token = ''; if (id !== null && window.turnstile) { try { turnstile.reset(id); set('verifying', 'cap.checking'); } catch (e) {} } },
      isReady: function () { return !!token; }
    };
    retry.addEventListener('click', function () { if (id === null) { started = false; self.ensure(); } else self.reset(); });
    set('idle', 'cap.idle'); return self;
  }
  var caps = [];
  function cap(box) { var c = Captcha(box); caps.push(c); return c; }

  // ------------------------------------------------------------------ modals / focus
  var lastFocus = null;
  function openModal(m) {
    lastFocus = document.activeElement; m.hidden = false; document.body.style.overflow = 'hidden';
    var f = $('input:not(.hp),button,a[href]', m); if (f) setTimeout(function () { f.focus(); }, 30);
  }
  function closeModal(m) {
    if (m.hidden) return; m.hidden = true; if (!$$('.modal').some(function (x) { return !x.hidden; })) document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {}
  }
  function topModal() { var o = $$('.modal').filter(function (x) { return !x.hidden; }); return o[o.length - 1]; }
  document.addEventListener('keydown', function (e) {
    var m = topModal(); if (!m) return;
    if (e.key === 'Escape') { e.preventDefault(); closeAny(m); }
    else if (m.id === 'lightbox' && e.key === 'ArrowRight') lbStep(1); else if (m.id === 'lightbox' && e.key === 'ArrowLeft') lbStep(-1);
    else if (e.key === 'Tab') { var f = $$('button,input:not(.hp),a[href],select,textarea', m).filter(function (x) { return !x.disabled && x.offsetParent !== null; }); if (!f.length) return;
      var a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
  });
  function closeAny(m) {
    if (m.id === 'projModal') { closeModal(m); history.replaceState(null, '', '#projects'); document.title = pageTitle(); }
    else if (m.id === 'reader') { closeModal(m); history.replaceState(null, '', '#blog'); document.title = pageTitle(); }
    else closeModal(m);
  }
  $$('.modal').forEach(function (m) {
    m.addEventListener('click', function (e) { if (e.target === m || (m.id === 'lightbox' && e.target.tagName === 'FIGURE')) closeAny(m); });
    $$('[data-close]', m).forEach(function (b) { b.addEventListener('click', function () { closeAny(m); }); });
  });

  // ------------------------------------------------------------------ lightbox (zoom, prev/next)
  var lb = { items: [], i: 0 };
  function openLightbox(items, i) { lb.items = items; lb.i = i; lbShow(); openModal($('#lightbox')); }
  function lbShow() {
    var it = lb.items[lb.i], img = $('#lbImg'); img.classList.remove('zoomed'); img.style.transformOrigin = ''; img.style.animation = 'none'; void img.offsetWidth; img.style.animation = '';
    img.src = it.src; img.alt = it.alt || ''; $('#lbCap').textContent = it.caption || ''; $('#lbPrev').hidden = $('#lbNext').hidden = lb.items.length < 2;
  }
  function lbStep(d) { if (lb.items.length < 2) return; lb.i = (lb.i + d + lb.items.length) % lb.items.length; lbShow(); }
  $('#lbPrev').addEventListener('click', function () { lbStep(-1); }); $('#lbNext').addEventListener('click', function () { lbStep(1); });
  $('#lbImg').addEventListener('click', function (e) { var r = this.getBoundingClientRect(); this.style.transformOrigin = ((e.clientX - r.left) / r.width * 100) + '% ' + ((e.clientY - r.top) / r.height * 100) + '%'; this.classList.toggle('zoomed'); });

  // ------------------------------------------------------------------ interactive 3D profile card (spring physics)
  (function () {
    var card = $('#profileCard'), img = $('#profileImg'), fb = $('#fallback'); if (!card) return;
    var rx = 0, ry = 0, vx = 0, vy = 0, tx = 0, ty = 0, raf = 0, touchTimer = 0;
    function frame() {
      vx = (vx + (tx - rx) * .14) * .76; vy = (vy + (ty - ry) * .14) * .76; rx += vx; ry += vy;
      card.style.transform = 'rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) scale(' + (1 + (card.classList.contains('hot') ? .035 : 0)) + ')';
      if (Math.abs(vx) + Math.abs(vy) + Math.abs(tx - rx) + Math.abs(ty - ry) > .02) raf = requestAnimationFrame(frame); else { raf = 0; if (!card.classList.contains('hot')) card.style.transform = ''; }
    }
    function kick() { if (!raf) raf = requestAnimationFrame(frame); }
    function point(e) {
      var r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      if (!FX.reduce) { ty = (x - .5) * 22; tx = (.5 - y) * 22; kick(); }
      card.style.setProperty('--mx', x * 100 + '%'); card.style.setProperty('--my', y * 100 + '%');
    }
    function rest() { tx = ty = 0; card.classList.remove('hot'); card.style.removeProperty('--mx'); card.style.removeProperty('--my'); kick(); } // reset position, rotation, blur, brightness, light
    card.addEventListener('pointerenter', function (e) { clearTimeout(touchTimer); card.classList.add('hot'); point(e); });
    card.addEventListener('pointermove', point);
    card.addEventListener('pointerleave', rest);
    card.addEventListener('pointerdown', function (e) { if (e.pointerType === 'touch') { clearTimeout(touchTimer); card.classList.add('hot'); point(e); } });
    ['pointerup', 'pointercancel'].forEach(function (ev) { card.addEventListener(ev, function (e) { if (e.pointerType === 'touch') { touchTimer = setTimeout(rest, 700); } }); });
    card.addEventListener('focus', function () { card.classList.add('hot'); }); card.addEventListener('blur', rest);
    card.addEventListener('click', function () { if (fb.hidden) openLightbox([{ src: img.currentSrc || img.src, alt: img.alt }], 0); });
    img.addEventListener('error', function () { img.hidden = true; fb.hidden = false; });
    img.addEventListener('load', function () { img.hidden = false; fb.hidden = true; });
  })();

  // ------------------------------------------------------------------ data + rendering
  var S = { site: null, projects: [], projTotal: 0, projPage: 1, projCat: '', projQ: '', skillCat: '', gal: [], galTotal: 0, galPage: 1, galCat: '',
    blog: [], blogTotal: 0, blogPage: 1, blogCat: '', blogQ: '', blogCats: [], blogSize: 9, gb: [], gbTotal: 0, gbPage: 1, latest: null, proj: null, post: null, role: store.get('ps_role') || '' };
  var PCATS = ['website', 'application', 'discord_bot', 'minecraft', 'ai', 'experiment'], GCATS = ['personal', 'projects', 'screenshots', 'workspace', 'models', 'creative'], SCATS = ['programming', 'development', 'tools', 'other'];
  function pageTitle() { return ((S.site && S.site.profile && S.site.profile.name) || 'Potter') + ' — Personal Space'; }
  function skeleton(box, n) { clear(box); for (var i = 0; i < n; i++) box.appendChild(el('div', { class: 'sk' })); }
  function state(box, msg, retry) { clear(box); box.appendChild(el('div', { class: 'state' }, [el('p', { text: msg }), retry ? el('button', { class: 'btn', type: 'button', text: t('retry'), on: { click: retry } }) : null])); }
  function chipRow(box, items, current, onPick) {
    clear(box); items.forEach(function (it) { box.appendChild(el('button', { type: 'button', class: it.v === current ? 'on' : '', 'aria-pressed': it.v === current ? 'true' : 'false', text: it.label, on: { click: function () { onPick(it.v); } } })); });
  }
  function md(text) { var d = el('div', { class: 'md' }); d.appendChild(MD.render(document, text)); return d; }
  function linkChip(l) { return el('a', { class: 'chip', href: l.url, target: '_blank', rel: 'noopener noreferrer', text: l.label }); }

  // ---- hero / strip / about
  function renderHero() {
    var p = (S.site && S.site.profile) || {}, name = p.name || 'Potter';
    if ($('#heroName').getAttribute('aria-label') !== name) FX.split($('#heroName'), name.toUpperCase());
    $('#intro').textContent = L(p.intro) || t('hero.sub'); $('#tagline').textContent = L(p.tagline) || '';
    var img = $('#profileImg'), src = p.photo_url || 'img/profile.jpg'; if (img.getAttribute('src') !== src) { img.src = src; } img.alt = t('hero.cardAlt') + ' ' + name;
    document.title = pageTitle();
  }
  function renderStrip() {
    var p = (S.site && S.site.profile) || {}, ints = clear($('#stripInterests')), soc = clear($('#stripSocial')), lt = clear($('#stripLatest'));
    (p.interests || []).slice(0, 8).forEach(function (x) { ints.appendChild(el('span', { class: 'chip', text: x })); });
    (p.socials || []).forEach(function (l) { soc.appendChild(linkChip(l)); });
    if (S.latest) lt.appendChild(el('div', {}, [el('a', { class: 'post', href: '#/blog/' + S.latest.slug, text: L(S.latest.title) }), el('small', { text: fmtDate(S.latest.published_at) })]));
    else lt.appendChild(el('span', { class: 'hint', text: t('strip.none') }));
    var cl = clear($('#contactLinks')); (p.socials || []).forEach(function (l) { cl.appendChild(linkChip(l)); });
    if (p.contact_email) cl.appendChild(el('a', { class: 'chip', href: 'mailto:' + p.contact_email, text: p.contact_email }));
  }
  function renderAbout() {
    var p = (S.site && S.site.profile) || {}, box = clear($('#aboutBody')), any = false;
    [['who', 'about.who'], ['story', 'about.story'], ['journey', 'about.journey'], ['goals', 'about.goals'], ['building', 'about.building']].forEach(function (f) {
      var v = L(p[f[0]]); if (!v) return; any = true; box.appendChild(el('div', { class: 'glass fxi' + (f[0] === 'who' || f[0] === 'story' ? ' wide' : '') }, [el('h3', { text: t(f[1]) }), md(v)]));
    });
    [['interests', 'about.interests'], ['learning', 'about.learning']].forEach(function (f) {
      var a = p[f[0]] || []; if (!a.length) return; any = true;
      box.appendChild(el('div', { class: 'glass fxi' }, [el('h3', { text: t(f[1]) }), el('div', { class: 'chips' }, a.map(function (x) { return el('span', { class: 'chip', text: x }); }))]));
    });
    if (!any) box.appendChild(el('div', { class: 'state', text: t('empty') }));
    var tl = clear($('#timelineList')), ev = (S.site && S.site.timeline) || [];
    if (!ev.length) tl.appendChild(el('li', { class: 'state', text: t('empty') }));
    ev.forEach(function (e) {
      tl.appendChild(el('li', { class: 'glass fxi', data: { k: e.kind } }, [el('time', { text: e.when_label }), el('small', { text: ' · ' + t('tl.' + e.kind) }), el('h4', { text: L(e.title) }), L(e.body) ? el('p', { text: L(e.body) }) : null]));
    });
    FX.reveal(box); FX.reveal(tl);
  }

  // ---- skills (group by category, filter, click -> related projects)
  function renderSkills() {
    var all = (S.site && S.site.skills) || [], filt = $('#skillFilter'), list = clear($('#skillList'));
    var present = SCATS.filter(function (c) { return all.some(function (s) { return s.category === c; }); });
    chipRow(filt, [{ v: '', label: t('all') }].concat(present.map(function (c) { return { v: c, label: t('cat.' + c) }; })), S.skillCat, function (v) { S.skillCat = v; renderSkills(); });
    if (!all.length) return state(list, t('empty'));
    present.filter(function (c) { return !S.skillCat || c === S.skillCat; }).forEach(function (c) {
      var sec = el('section', { class: 'glass fxi' }, [el('h3', { text: t('cat.' + c) })]);
      all.filter(function (s) { return s.category === c; }).forEach(function (s) {
        sec.appendChild(el('button', { type: 'button', class: 'skill', title: t('nav.projects') + ': ' + s.name, on: { click: function () { $('#projQ').value = s.name; S.projQ = s.name; loadProjects(true); $('#projects').scrollIntoView({ behavior: FX.reduce ? 'auto' : 'smooth' }); } } },
          [el('span', { class: 'ic', 'aria-hidden': 'true', text: s.icon || '•' }), el('span', {}, [s.name, L(s.note) ? el('small', { text: L(s.note) }) : null])]));
      });
      list.appendChild(sec);
    });
    FX.reveal(list);
  }

  // ---- projects
  function renderProjects() {
    var box = clear($('#projList'));
    chipRow($('#projCats'), [{ v: '', label: t('all') }].concat(PCATS.map(function (c) { return { v: c, label: t('pcat.' + c) }; })), S.projCat, function (v) { S.projCat = v; loadProjects(true); });
    if (!S.projects.length) state(box, S.projQ || S.projCat ? t('noResult') : t('empty'));
    S.projects.forEach(function (p) {
      var title = L(p.title), cover = el('div', { class: 'cover' }, p.cover_url ? [el('img', { src: p.cover_url, alt: '', loading: 'lazy', decoding: 'async' })] : [title.charAt(0).toUpperCase()]);
      var acts = [el('a', { class: 'btn small', href: '#/project/' + p.slug, text: t('details') })];
      if (p.github_url) acts.push(el('a', { class: 'btn small', href: p.github_url, target: '_blank', rel: 'noopener noreferrer', text: t('github') }));
      if (p.demo_url) acts.push(el('a', { class: 'btn small', href: p.demo_url, target: '_blank', rel: 'noopener noreferrer', text: t('demo') }));
      box.appendChild(el('article', { class: 'proj fxi' + (p.featured ? ' feat' : '') }, [cover, el('div', { class: 'body' }, [
        el('div', { class: 'meta' }, [el('span', { class: 'st', data: { s: p.status }, text: t('status.' + p.status) }), el('span', { class: 'chip', text: t('pcat.' + p.category) })]),
        el('h3', { text: title }), el('p', { text: L(p.summary) }), el('div', { class: 'chips' }, (p.tags || []).map(function (x) { return el('span', { class: 'chip', text: x }); })), el('div', { class: 'acts' }, acts)])]));
    });
    $('#projMore').hidden = S.projects.length >= S.projTotal; FX.reveal(box);
  }
  function loadProjects(reset) {
    if (reset) { S.projPage = 1; S.projects = []; skeleton($('#projList'), 3); }
    return api('/api/projects?page=' + S.projPage + '&size=12&cat=' + encodeURIComponent(S.projCat) + '&q=' + encodeURIComponent(S.projQ))
      .then(function (d) { S.projects = S.projects.concat(d.items); S.projTotal = d.total; renderProjects(); })
      .catch(function (e) { state($('#projList'), errText(e), function () { loadProjects(true); }); });
  }
  function showProject(slug) {
    return api('/api/projects/' + encodeURIComponent(slug)).then(function (p) { S.proj = p; renderProjectSheet(); openModal($('#projModal')); document.title = L(p.title) + ' — ' + pageTitle(); })
      .catch(function (e) { toast(errText(e), true); history.replaceState(null, '', '#projects'); });
  }
  function renderProjectSheet() {
    var p = S.proj, sh = clear($('#projSheet')); if (!p) return;
    var shots = (p.images || []).map(function (im, i) { return el('img', { src: im.image_url, alt: L(im.caption), loading: 'lazy', decoding: 'async', on: { click: function () { openLightbox((p.images || []).map(function (x) { return { src: x.image_url, alt: L(x.caption), caption: L(x.caption) }; }), i); } } }); });
    var links = []; if (p.github_url) links.push(el('a', { class: 'btn small', href: p.github_url, target: '_blank', rel: 'noopener noreferrer', text: t('github') })); if (p.demo_url) links.push(el('a', { class: 'btn small primary', href: p.demo_url, target: '_blank', rel: 'noopener noreferrer', text: t('demo') }));
    sh.appendChild(el('button', { type: 'button', class: 'x', 'aria-label': t('close'), text: '✕', on: { click: function () { closeAny($('#projModal')); } } }));
    if (p.cover_url) sh.appendChild(el('img', { class: 'hero-img', src: p.cover_url, alt: '' }));
    sh.appendChild(el('h2', { id: 'pmTitle', text: L(p.title) }));
    sh.appendChild(el('div', { class: 'meta chips' }, [el('span', { class: 'st', data: { s: p.status }, text: t('status.' + p.status) }), el('span', { class: 'chip', text: t('pcat.' + p.category) })].concat((p.tags || []).map(function (x) { return el('span', { class: 'chip', text: x }); }))));
    if (L(p.summary)) sh.appendChild(el('p', { class: 'lead', text: L(p.summary) }));
    if (L(p.body)) sh.appendChild(md(L(p.body)));
    if (shots.length) { sh.appendChild(el('h3', { text: t('gallery') })); sh.appendChild(el('div', { class: 'shots' }, shots)); }
    if (links.length) sh.appendChild(el('div', { class: 'cta' }, links));
  }

  // ---- gallery
  function renderGallery() {
    var box = clear($('#galList'));
    chipRow($('#galCats'), [{ v: '', label: t('all') }].concat(GCATS.map(function (c) { return { v: c, label: t('gcat.' + c) }; })), S.galCat, function (v) { S.galCat = v; loadGallery(true); });
    if (!S.gal.length) { box.style.columns = '1'; state(box, S.galCat ? t('noResult') : t('empty')); $('#galMore').hidden = true; return; } box.style.columns = '';
    S.gal.forEach(function (g, i) {
      box.appendChild(el('figure', { class: 'fxi', tabindex: '0', role: 'button', 'aria-label': L(g.caption) || t('gcat.' + g.category), on: {
        click: function () { openLightbox(S.gal.map(function (x) { return { src: x.image_url, alt: L(x.caption), caption: L(x.caption) }; }), i); },
        keydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.click(); } } } },
        [el('img', { src: g.image_url, alt: L(g.caption), loading: 'lazy', decoding: 'async' }), L(g.caption) ? el('figcaption', { text: L(g.caption) }) : null]));
    });
    $('#galMore').hidden = S.gal.length >= S.galTotal; FX.reveal(box, 30);
  }
  function loadGallery(reset) {
    if (reset) { S.galPage = 1; S.gal = []; skeleton($('#galList'), 3); $('#galList').style.columns = ''; }
    return api('/api/gallery?page=' + S.galPage + '&size=18&cat=' + encodeURIComponent(S.galCat)).then(function (d) { S.gal = S.gal.concat(d.items); S.galTotal = d.total; renderGallery(); })
      .catch(function (e) { state($('#galList'), errText(e), function () { loadGallery(true); }); });
  }

  // ---- blog
  function renderBlog() {
    var box = clear($('#blogList'));
    chipRow($('#blogCats'), [{ v: '', label: t('blogAll') }].concat(S.blogCats.map(function (c) { return { v: c, label: c }; })), S.blogCat, function (v) { S.blogCat = v; loadBlog(1); });
    if (!S.blog.length) state(box, S.blogQ || S.blogCat ? t('noResult') : t('empty'));
    S.blog.forEach(function (b) {
      box.appendChild(el('a', { class: 'post glass fxi', href: '#/blog/' + b.slug }, [
        el('div', { class: 'th' }, b.cover_url ? [el('img', { src: b.cover_url, alt: '', loading: 'lazy', decoding: 'async' })] : []),
        el('div', {}, [el('small', { text: [fmtDate(b.published_at), b.category, b.read_min + ' ' + t('readMin')].filter(Boolean).join(' · ') }), el('h3', { text: L(b.title) }), el('p', { text: L(b.excerpt) }),
          el('div', { class: 'chips' }, (b.tags || []).map(function (x) { return el('span', { class: 'chip', text: x }); }))])]));
    });
    var pg = clear($('#blogPager')), pages = Math.max(1, Math.ceil(S.blogTotal / S.blogSize));
    if (pages > 1) pg.appendChild(el('button', { class: 'btn small', type: 'button', text: t('prev'), disabled: S.blogPage <= 1, on: { click: function () { loadBlog(S.blogPage - 1); } } })),
      pg.appendChild(el('span', { text: S.blogPage + ' / ' + pages })), pg.appendChild(el('button', { class: 'btn small', type: 'button', text: t('next'), disabled: S.blogPage >= pages, on: { click: function () { loadBlog(S.blogPage + 1); } } }));
    FX.reveal(box);
  }
  function loadBlog(page) {
    S.blogPage = page || 1; skeleton($('#blogList'), 2);
    return api('/api/blog?page=' + S.blogPage + '&size=' + S.blogSize + '&cat=' + encodeURIComponent(S.blogCat) + '&q=' + encodeURIComponent(S.blogQ))
      .then(function (d) { S.blog = d.items; S.blogTotal = d.total; S.blogCats = d.categories || []; if (!S.latest && S.blogPage === 1 && !S.blogCat && !S.blogQ) { S.latest = d.items[0] || null; renderStrip(); } renderBlog(); })
      .catch(function (e) { state($('#blogList'), errText(e), function () { loadBlog(S.blogPage); }); });
  }
  function showPost(slug) {
    return api('/api/blog/' + encodeURIComponent(slug)).then(function (p) { S.post = p; renderPost(); openModal($('#reader')); document.title = L(p.title) + ' — ' + pageTitle(); })
      .catch(function (e) { toast(errText(e), true); history.replaceState(null, '', '#blog'); });
  }
  function renderPost() {
    var p = S.post, sh = clear($('#readerSheet')); if (!p) return;
    sh.appendChild(el('button', { type: 'button', class: 'x', 'aria-label': t('close'), text: '✕', on: { click: function () { closeAny($('#reader')); } } }));
    if (p.cover_url) sh.appendChild(el('img', { class: 'hero-img', src: p.cover_url, alt: '' }));
    sh.appendChild(el('h2', { id: 'rdTitle', text: L(p.title) }));
    sh.appendChild(el('p', { class: 'hint', text: [fmtDate(p.published_at), p.category, p.read_min + ' ' + t('readMin')].filter(Boolean).join(' · ') }));
    sh.appendChild(md(L(p.body) || L(p.excerpt)));
    sh.appendChild(el('div', { class: 'chips' }, (p.tags || []).map(function (x) { return el('span', { class: 'chip', text: x }); })));
  }

  // ---- guestbook
  function renderGuestbook() {
    var box = clear($('#gbList')), flags = (S.site && S.site.flags) || { guestbook: true };
    $('#gbForm').hidden = !flags.guestbook;
    if (!S.gb.length) box.appendChild(el('div', { class: 'state', text: flags.guestbook ? t('empty') : t('gb.off') }));
    S.gb.forEach(function (g) {
      box.appendChild(el('div', { class: 'gb glass fxi' }, [el('div', {}, [el('b', { text: g.display_name }), el('small', { text: fmtDate(g.created_at) })]), el('p', { text: g.message }),
        el('button', { type: 'button', text: '⚑ ' + t('gb.report'), on: { click: function () { if (!confirm(t('gb.confirm'))) return; api('/api/guestbook/' + g.id + '/report', { method: 'POST' }).then(function () { toast(t('gb.reported')); }).catch(function (e) { toast(errText(e), true); }); } } })]));
    });
    $('#gbMore').hidden = S.gb.length >= S.gbTotal; FX.reveal(box, 40);
  }
  function loadGuestbook(reset) {
    if (reset) { S.gbPage = 1; S.gb = []; skeleton($('#gbList'), 2); }
    return api('/api/guestbook?page=' + S.gbPage + '&size=10').then(function (d) { S.gb = S.gb.concat(d.items); S.gbTotal = d.total; renderGuestbook(); })
      .catch(function (e) { state($('#gbList'), errText(e), function () { loadGuestbook(true); }); });
  }

  // ------------------------------------------------------------------ forms (guestbook, contact)
  function wireForm(form, path, mapBody, onOk) {
    var c = cap($('.cap', form)), err = $('.err', form), btn = $('button[type=submit]', form);
    form.addEventListener('focusin', function () { c.ensure(); });
    form.addEventListener('submit', function (e) {
      e.preventDefault(); err.className = 'err'; err.textContent = '';
      if (!form.checkValidity()) { err.textContent = t('err.bad_input'); form.reportValidity(); return; }
      if (!c.isReady()) { c.ensure(); err.textContent = t('err.captcha_required'); return; }
      var body = mapBody(new FormData(form)); body.captcha = c.token(); body.website = form.elements.website.value; btn.disabled = true;
      api(path, { method: 'POST', body: body }).then(function (d) { form.reset(); onOk(d); }).catch(function (e2) { err.textContent = errText(e2); })
        .finally(function () { btn.disabled = false; c.reset(); });
    });
  }
  wireForm($('#gbForm'), '/api/guestbook', function (f) { return { name: f.get('name'), message: f.get('message') }; }, function (d) { toast(t(d.status === 'pending' ? 'gb.pending' : 'gb.ok')); if (d.status !== 'pending') loadGuestbook(true); });
  wireForm($('#ctForm'), '/api/contact', function (f) { return { name: f.get('name'), subject: f.get('subject'), email: f.get('email'), message: f.get('message') }; }, function () { toast(t('ct.ok')); });
  $('#gbMore').addEventListener('click', function () { S.gbPage++; loadGuestbook(false); });
  $('#projMore').addEventListener('click', function () { S.projPage++; loadProjects(false); });
  $('#galMore').addEventListener('click', function () { S.galPage++; loadGallery(false); });
  var debounce = function (fn) { var h; return function () { clearTimeout(h); h = setTimeout(fn, 300); }; };
  $('#projQ').addEventListener('input', debounce(function () { S.projQ = $('#projQ').value.trim(); loadProjects(true); }));
  $('#blogQ').addEventListener('input', debounce(function () { S.blogQ = $('#blogQ').value.trim(); loadBlog(1); }));

  // ------------------------------------------------------------------ auth / account
  var authMode = 'login', authCap = null;
  function me() { return store.get('ps_user') || ''; }
  function canDash() { return S.role === 'moderator' || S.role === 'admin' || S.role === 'owner'; }
  function renderAuthBtn() { $('#authBtn').textContent = me() ? '👤 ' + me() : t('login'); $('#dashLink').hidden = !(me() && canDash()); }
  function setSession(d) { store.set('ps_token', d.token); if (d.username) { store.set('ps_user', d.username); store.set('ps_role', d.role || 'user'); S.role = d.role || 'user'; } renderAuthBtn(); }
  function clearSession() { ['ps_token', 'ps_user', 'ps_role'].forEach(store.del); S.role = ''; renderAuthBtn(); resetChat(); }
  function setAuthMode(m) {
    authMode = m; var f = $('#authForm');
    $$('[data-only]', f).forEach(function (n) { n.hidden = n.dataset.only !== m; });
    $$('[data-tab]', f).forEach(function (b) { b.classList.toggle('on', b.dataset.tab === m); });
    $('#authTitle').textContent = t(m === 'reset' ? 'auth.reset' : m === 'register' ? 'register' : 'login'); $('.tabs', f).hidden = m === 'reset'; $('#forgotBtn').hidden = m !== 'login';
    var pw = f.elements.password; pw.autocomplete = m === 'login' ? 'current-password' : 'new-password'; $('[data-pass]', f).textContent = t(m === 'reset' ? 'auth.newpass' : 'auth.pass');
    f.elements.email.required = m === 'register'; f.elements.code.required = m === 'reset'; $('#authErr').textContent = '';
  }
  $$('#authForm [data-tab]').forEach(function (b) { b.addEventListener('click', function () { setAuthMode(b.dataset.tab); }); });
  $('#forgotBtn').addEventListener('click', function () { setAuthMode('reset'); });
  function openAuth() { setAuthMode('login'); if (!authCap) authCap = cap($('#authCap')); openModal($('#authModal')); authCap.ensure(); }
  $('#authForm').addEventListener('submit', function (e) {
    e.preventDefault(); var f = e.target, err = $('#authErr'), btn = $('#authSubmit'); err.className = 'err'; err.textContent = '';
    if (!f.checkValidity()) { err.textContent = t('err.bad_input'); f.reportValidity(); return; }
    if (!authCap.isReady()) { authCap.ensure(); err.textContent = t('err.captcha_required'); return; }
    var b = { username: f.elements.username.value.trim(), password: f.elements.password.value, captcha: authCap.token(), website: f.elements.website.value }, path = '/api/login';
    if (authMode === 'register') { path = '/api/register'; b.email = f.elements.email.value.trim(); } else if (authMode === 'reset') { path = '/api/password/reset'; b.code = f.elements.code.value.trim(); }
    btn.disabled = true;
    api(path, { method: 'POST', body: b }).then(function (d) {
      if (authMode === 'reset') { toast(t('auth.resetOk')); setAuthMode('login'); f.elements.password.value = ''; return; }
      setSession(d); closeModal($('#authModal')); f.reset(); toast(t('welcome') + ' ' + d.username);
    }).catch(function (e2) { err.textContent = errText(e2); }).finally(function () { btn.disabled = false; authCap.reset(); });
  });
  $('#authBtn').addEventListener('click', function () { if (me()) openModal($('#accountModal')); else openAuth(); });
  $('#logoutBtn').addEventListener('click', function () { clearSession(); closeModal($('#accountModal')); toast(t('loggedOut')); });
  $('#logoutAll').addEventListener('click', function () { api('/api/account/logout-all', { method: 'POST' }).then(function (d) { setSession({ token: d.token }); toast(t('acct.allDone')); }).catch(function (e) { toast(errText(e), true); }); });
  $('#acctForm').addEventListener('submit', function (e) {
    e.preventDefault(); var f = e.target, m = $('#acctMsg'); m.className = 'err'; m.textContent = ''; if (!f.checkValidity()) { m.textContent = t('err.bad_input'); return; }
    api('/api/account/password', { method: 'POST', body: { current: f.elements.current.value, new: f.elements.new.value } })
      .then(function (d) { setSession({ token: d.token }); f.reset(); m.className = 'err ok'; m.textContent = t('acct.changed'); }).catch(function (e2) { m.textContent = errText(e2); });
  });
  function verifySession() {
    if (!store.get('ps_token')) return;
    api('/api/me').then(function (d) { store.set('ps_user', d.username); store.set('ps_role', d.role); S.role = d.role; renderAuthBtn(); }).catch(function (e) { if (e.status === 401) clearSession(); });
  }

  // ------------------------------------------------------------------ chat with Potter (website <-> Discord ticket)
  var chat = { open: false, tid: 0, last: 0, timer: 0, status: '', cap: null };
  function resetChat() { chat.tid = 0; chat.last = 0; chat.status = ''; clear($('#msgs')); $('#chat').hidden = true; chat.open = false; clearInterval(chat.timer); }
  function pill() { var p = $('#ticketPill'), s = chat.status; p.dataset.s = s === 'open' || s === 'claimed' ? 'on' : 'off'; p.textContent = s ? t('chat.' + s) : t('chat.none'); }
  function pollChat() {
    if (document.hidden || !store.get('ps_token')) return;
    api('/api/messages?tid=' + chat.tid + '&after=' + chat.last).then(function (d) {
      var box = $('#msgs'); if (d.ticket && d.ticket.id !== chat.tid) { chat.tid = d.ticket.id; chat.last = 0; clear(box); }
      chat.status = d.ticket ? d.ticket.status : ''; pill(); $('#chatCap').hidden = !(chat.status === '' || chat.status === 'closed') ;
      if (!$('#chatCap').hidden && !chat.cap) { chat.cap = cap($('#chatCap')); }
      var stick = box.scrollTop + box.clientHeight >= box.scrollHeight - 40;
      d.messages.forEach(function (m) { chat.last = Math.max(chat.last, m.id); box.appendChild(el('div', { class: 'm ' + (m.sender === 'web' ? 'me' : m.sender === 'system' ? 'sys' : '') }, [m.sender === 'admin' ? el('small', { text: m.author }) : null, m.body])); });
      if (stick || d.messages.length) box.scrollTop = box.scrollHeight;
    }).catch(function (e) { if (e.status === 401) { clearSession(); } });
  }
  $('#chatFab').addEventListener('click', function () {
    if (!me()) return openAuth();
    chat.open = !chat.open; $('#chat').hidden = !chat.open; clearInterval(chat.timer);
    if (chat.open) { pollChat(); chat.timer = setInterval(pollChat, 4000); $('#chatInput').focus(); } // polls only while the panel is open
  });
  $('#chatClose').addEventListener('click', function () { chat.open = false; $('#chat').hidden = true; clearInterval(chat.timer); });
  $('#chatForm').addEventListener('submit', function (e) {
    e.preventDefault(); var inp = $('#chatInput'), body = inp.value.trim(); if (!body) return;
    var needCap = chat.status === '' || chat.status === 'closed';
    if (needCap) { if (!chat.cap) chat.cap = cap($('#chatCap')); chat.cap.ensure(); if (!chat.cap.isReady()) { toast(t('err.captcha_required'), true); return; } }
    api('/api/messages', { method: 'POST', body: { body: body, captcha: needCap ? chat.cap.token() : '' } }).then(function () { inp.value = ''; pollChat(); })
      .catch(function (e2) { toast(errText(e2), true); }).finally(function () { if (needCap && chat.cap) chat.cap.reset(); });
  });

  // ------------------------------------------------------------------ nav / routing / language
  var menu = $('#navLinks'), burger = $('#menuBtn');
  burger.addEventListener('click', function () { var o = menu.classList.toggle('open'); burger.setAttribute('aria-expanded', o); });
  $$('[data-nav]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.dataset.nav, tgt = document.getElementById(id); if (!tgt) return; e.preventDefault();
      menu.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); tgt.scrollIntoView({ behavior: FX.reduce ? 'auto' : 'smooth' }); history.replaceState(null, '', '#' + id);
    });
  });
  if ('IntersectionObserver' in window) {
    var secIO = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) $$('#navLinks a').forEach(function (a) { var on = a.dataset.nav === en.target.id; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); }); }); }, { rootMargin: '-40% 0px -55% 0px' });
    $$('main > section[id]').forEach(function (s) { secIO.observe(s); });
  }
  function route() {
    var h = decodeURIComponent(location.hash || ''), m;
    if ((m = /^#\/project\/([a-z0-9-]+)$/.exec(h))) { closeModal($('#reader')); showProject(m[1]); }
    else if ((m = /^#\/blog\/([a-z0-9-]+)$/.exec(h))) { closeModal($('#projModal')); showPost(m[1]); }
    else { closeModal($('#projModal')); closeModal($('#reader')); document.title = pageTitle(); }
  }
  addEventListener('hashchange', route);
  $('#langBtn').addEventListener('click', function () { lang = lang === 'th' ? 'en' : 'th'; store.set('ps_lang', lang); rerender(); });
  function rerender() {
    applyI18n(); renderHero(); renderStrip(); renderAbout(); renderSkills(); renderProjects(); renderGallery(); renderBlog(); renderGuestbook(); renderAuthBtn(); pill(); setAuthMode(authMode);
    caps.forEach(function (c) { c.refresh(); }); renderProjectSheet(); renderPost(); renderBot();
  }
  var botData = null;
  function renderBot() {
    var b = $('#botStatus'); if (!botData) { b.textContent = ''; return; }
    b.dataset.s = botData.bot_online ? 'on' : 'off'; b.textContent = t(botData.bot_online ? 'bot.on' : 'bot.off') + ' · ' + t('bot.stats', { t: botData.tickets, u: botData.users, m: botData.messages });
  }

  // ------------------------------------------------------------------ boot
  function boot() {
    $('#year').textContent = new Date().getFullYear(); applyI18n(); renderAuthBtn(); renderHero();
    [$('#aboutBody'), $('#skillList')].forEach(function (b) { skeleton(b, 3); }); skeleton($('#timelineList'), 1);
    var siteP = api('/api/site').then(function (d) { S.site = d; renderHero(); renderAbout(); renderSkills(); renderStrip(); renderGuestbook();
      var flags = d.flags || {}; if (!flags.contact) { $('#ctForm').hidden = true; $('#contactLinks').before(el('p', { class: 'hint', text: t('ct.off') })); } })
      .catch(function (e) { [$('#aboutBody'), $('#skillList')].forEach(function (b) { state(b, errText(e), boot); }); clear($('#timelineList')); });
    siteP.finally(FX.hideLoader);
    loadProjects(true); loadGallery(true); loadBlog(1); loadGuestbook(true);
    api('/api/stats').then(function (d) { botData = d; renderBot(); }).catch(function () {});
    verifySession(); route();
  }
  boot();
})();
