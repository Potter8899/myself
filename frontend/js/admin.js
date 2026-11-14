/* Admin dashboard. Every request is authorised again on the server by role; hiding menu items here is only UX. */
(function () {
  'use strict';
  var API = ((window.PS_CONFIG && window.PS_CONFIG.API_URL) || '').replace(/\/$/, '');
  var $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  function el(tag, props, kids) {
    var e = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) { var v = props[k]; if (v == null || v === false) return; if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k === 'on') Object.keys(v).forEach(function (ev) { e.addEventListener(ev, v[ev]); }); else e.setAttribute(k, v === true ? '' : v); });
    [].concat(kids || []).forEach(function (c) { if (c != null && c !== false) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }); return e;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }, del: function (k) { try { localStorage.removeItem(k); } catch (e) {} } };
  function toast(m, bad) { var n = el('div', { class: 'toast' + (bad ? ' bad' : ''), text: m }); $('#toasts').appendChild(n); setTimeout(function () { n.remove(); }, 4200); }
  function api(path, opt) {
    opt = opt || {}; var h = {}, tok = store.get('ps_token'); if (tok) h.Authorization = 'Bearer ' + tok; var raw = opt.raw;
    if (!raw) h['Content-Type'] = 'application/json'; else h['Content-Type'] = raw.type || 'application/octet-stream';
    return fetch(API + path, { method: opt.method || 'GET', headers: h, body: raw || (opt.body ? JSON.stringify(opt.body) : undefined) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) { var e = new Error(d.error || 'http_' + r.status); e.code = d.error || 'generic'; e.status = r.status; e.field = d.field; throw e; } return d; }); });
  }
  function why(e) { var m = { forbidden: 'You do not have permission', unauthorized: 'Please log in again', bad_input: 'Invalid input' + (e.field ? ' (' + e.field + ')' : ''), conflict_or_invalid: 'Duplicate or invalid value (is the slug already used?)', too_large: 'File too large (max 3 MB)', bad_file_type: 'Only JPG, PNG, WebP or GIF images', rate_limited: 'Too many requests', customer_has_active_ticket: 'This customer already has another active ticket', ticket_closed: 'Ticket is closed', bad_state: 'Not possible in the current state', captcha_required: 'Complete the verification', captcha_failed: 'Verification failed', bad_credentials: 'Wrong username or password' }; return m[e.code] || ('Error: ' + (e.code || 'network')); }
  function L(o) { return (o && (o.en || o.th)) || ''; }
  function when(s) { return s ? new Date(s).toLocaleString() : ''; }
  var ME = null;
  var LV = { user: 0, moderator: 1, admin: 2, owner: 3 };

  // ---------------------------------------------------------------- resource definitions (mirrors backend/core.py SPECS)
  var PC = ['website', 'application', 'discord_bot', 'minecraft', 'ai', 'experiment'], SC = ['programming', 'development', 'tools', 'other'], GC = ['personal', 'projects', 'screenshots', 'workspace', 'models', 'creative'], TK = ['milestone', 'project', 'learning', 'tech', 'future'];
  var RES = {
    skills: { title: 'Skills', role: 'admin', cols: [['name'], ['category'], ['icon'], ['note', L], ['sort']], fields: [
      { k: 'name', kind: 'text', req: 1, max: 60 }, { k: 'category', kind: 'select', req: 1, opts: SC }, { k: 'icon', kind: 'text', max: 8, hint: 'emoji' }, { k: 'sort', kind: 'int', def: 100 }, { k: 'note', kind: 'bi', max: 200, full: 1 }] },
    projects: { title: 'Projects', role: 'admin', cols: [['title', L], ['slug'], ['category'], ['status'], ['featured'], ['visible']], fields: [
      { k: 'slug', kind: 'text', req: 1, max: 60, hint: 'a-z 0-9 and dashes' }, { k: 'category', kind: 'select', req: 1, opts: PC }, { k: 'status', kind: 'select', req: 1, opts: ['live', 'wip', 'planned', 'archived'] }, { k: 'sort', kind: 'int', def: 100 },
      { k: 'featured', kind: 'bool' }, { k: 'visible', kind: 'bool', def: true }, { k: 'title', kind: 'bi', req: 1, max: 120, full: 1 }, { k: 'summary', kind: 'bi', max: 400, full: 1 },
      { k: 'cover_url', kind: 'image', full: 1 }, { k: 'github_url', kind: 'text', max: 600, hint: 'https:// (shown only when filled)' }, { k: 'demo_url', kind: 'text', max: 600 }, { k: 'tags', kind: 'tags', full: 1 }, { k: 'body', kind: 'md', max: 20000, full: 1 }] },
    project_images: { title: 'Project images', role: 'admin', cols: [['project_id'], ['image_url'], ['caption', L], ['sort']], fields: [
      { k: 'project_id', kind: 'ref', src: 'projects', req: 1 }, { k: 'sort', kind: 'int', def: 100 }, { k: 'image_url', kind: 'image', req: 1, full: 1 }, { k: 'caption', kind: 'bi', max: 200, full: 1 }] },
    timeline_events: { title: 'Timeline', role: 'admin', cols: [['when_label'], ['kind'], ['title', L], ['visible'], ['sort']], fields: [
      { k: 'when_label', kind: 'text', req: 1, max: 30, hint: 'e.g. 2025 or 2025-06' }, { k: 'kind', kind: 'select', req: 1, opts: TK }, { k: 'sort', kind: 'int', def: 100 }, { k: 'visible', kind: 'bool', def: true },
      { k: 'title', kind: 'bi', req: 1, max: 140, full: 1 }, { k: 'body', kind: 'bi', max: 800, area: 1, full: 1 }] },
    gallery_items: { title: 'Gallery', role: 'admin', cols: [['image_url'], ['category'], ['caption', L], ['visible'], ['sort']], fields: [
      { k: 'category', kind: 'select', req: 1, opts: GC }, { k: 'sort', kind: 'int', def: 100 }, { k: 'visible', kind: 'bool', def: true }, { k: 'image_url', kind: 'image', req: 1, full: 1 }, { k: 'caption', kind: 'bi', max: 300, full: 1 }] },
    blog_posts: { title: 'Blog', role: 'admin', cols: [['title', L], ['slug'], ['status'], ['category'], ['read_min'], ['published_at', when]], fields: [
      { k: 'slug', kind: 'text', req: 1, max: 60 }, { k: 'status', kind: 'select', req: 1, opts: ['draft', 'published'] }, { k: 'category', kind: 'text', max: 40 }, { k: 'tags', kind: 'tags' },
      { k: 'title', kind: 'bi', req: 1, max: 140, full: 1 }, { k: 'excerpt', kind: 'bi', max: 400, area: 1, full: 1 }, { k: 'cover_url', kind: 'image', full: 1 }, { k: 'body', kind: 'md', max: 50000, full: 1 }] }
  };
  var PROFILE_FIELDS = [
    { k: 'name', kind: 'text', req: 1, max: 60 }, { k: 'contact_email', kind: 'text', max: 254, hint: 'shown publicly if filled' }, { k: 'photo_url', kind: 'image', full: 1 },
    { k: 'tagline', kind: 'bi', max: 140, full: 1 }, { k: 'intro', kind: 'bi', max: 500, area: 1, full: 1 }, { k: 'who', kind: 'bi', max: 4000, area: 1, full: 1 }, { k: 'story', kind: 'bi', max: 6000, area: 1, full: 1 },
    { k: 'journey', kind: 'bi', max: 6000, area: 1, full: 1 }, { k: 'goals', kind: 'bi', max: 3000, area: 1, full: 1 }, { k: 'building', kind: 'bi', max: 3000, area: 1, full: 1 },
    { k: 'interests', kind: 'tags', full: 1 }, { k: 'learning', kind: 'tags', full: 1 }, { k: 'socials', kind: 'links', full: 1 }];

  // ---------------------------------------------------------------- generic form builder
  function label(f) { return f.k.replace(/_/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); }) + (f.req ? ' *' : ''); }
  function uploadInto(input, prev) {
    return el('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif', on: { change: function () {
      var f = this.files[0]; if (!f) return; if (f.size > 3 * 1024 * 1024) return toast('File too large (max 3 MB)', true);
      api('/api/admin/upload', { method: 'POST', raw: f }).then(function (d) { input.value = d.url; prev.src = d.url; prev.hidden = false; toast('Uploaded'); }).catch(function (e) { toast(why(e), true); });
    } } });
  }
  function buildField(f, val, refs) {
    var wrap = el('div', { class: 'f' + (f.full ? ' full' : '') + (f.kind === 'md' ? ' tall' : '') }), get;
    var lab = el('span', { text: label(f) + (f.hint ? ' — ' + f.hint : '') });
    if (f.kind === 'text') { var i = el('input', { type: 'text', maxlength: f.max || 200, value: val == null ? '' : val }); wrap.append(lab, i); get = function () { return i.value.trim(); }; }
    else if (f.kind === 'int') { var n = el('input', { type: 'number', value: val == null ? (f.def == null ? 0 : f.def) : val }); wrap.append(lab, n); get = function () { return parseInt(n.value, 10) || 0; }; }
    else if (f.kind === 'select') { var s = el('select', {}, f.opts.map(function (o) { return el('option', { value: o, text: o }); })); s.value = val || f.opts[0]; wrap.append(lab, s); get = function () { return s.value; }; }
    else if (f.kind === 'ref') { var r = el('select', {}, (refs[f.src] || []).map(function (o) { return el('option', { value: o.id, text: '#' + o.id + ' ' + L(o.title) }); })); if (val) r.value = val; wrap.append(lab, r); get = function () { return parseInt(r.value, 10); }; }
    else if (f.kind === 'bool') { var c = el('input', { type: 'checkbox' }); c.checked = val == null ? !!f.def : !!val; wrap.className += ' chk'; wrap.append(c, lab); get = function () { return c.checked; }; }
    else if (f.kind === 'tags') { var t = el('input', { type: 'text', value: (val || []).join(', '), placeholder: 'comma, separated' }); wrap.append(lab, t); get = function () { return t.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean); }; }
    else if (f.kind === 'image') { var u = el('input', { type: 'text', maxlength: 600, value: val || '', placeholder: 'https://… or upload' }), pv = el('img', { alt: '', src: val || '' }); pv.hidden = !val; u.addEventListener('input', function () { pv.src = u.value; pv.hidden = !u.value; }); wrap.append(lab, el('div', { class: 'imgf' }, [u, uploadInto(u, pv), pv])); get = function () { return u.value.trim(); }; }
    else if (f.kind === 'bi' || f.kind === 'md') {
      var a = (val || {}), mk = function () { return (f.area || f.kind === 'md') ? el('textarea', { maxlength: f.max || 200 }) : el('input', { type: 'text', maxlength: f.max || 200 }); };
      var th = mk(), en = mk(); th.value = a.th || ''; en.value = a.en || ''; th.lang = 'th'; wrap.append(lab, el('div', { class: 'bi' }, [el('div', {}, [el('small', { text: 'ไทย' }), th]), el('div', {}, [el('small', { text: 'English' }), en])]));
      if (f.kind === 'md') { var pv2 = el('div', { class: 'md preview', 'aria-live': 'polite' }), cur = th; var up = function () { clear(pv2).appendChild(MD.render(document, cur.value)); }; [th, en].forEach(function (x) { x.addEventListener('input', up); x.addEventListener('focus', function () { cur = x; up(); }); }); wrap.append(el('small', { text: 'Markdown preview (the field you are editing) — **bold**, *italic*, # heading, - list, [text](https://…), ![alt](https://…), ``` code ```' }), pv2); up(); }
      get = function () { return { th: th.value.trim(), en: en.value.trim() }; };
    }
    else if (f.kind === 'links') {
      var rows = el('div'), add = function (x) { var l = el('input', { type: 'text', placeholder: 'Label', maxlength: 40, value: x.label || '' }), u2 = el('input', { type: 'text', placeholder: 'https://…', maxlength: 600, value: x.url || '' }), row = el('div', { class: 'linkrow' }, [l, u2, el('button', { type: 'button', class: 'btn small', text: '✕', on: { click: function () { row.remove(); } } })]); rows.appendChild(row); };
      (val || []).forEach(add); wrap.append(lab, rows, el('button', { type: 'button', class: 'btn small', text: '+ Add link', on: { click: function () { add({}); } } }));
      get = function () { return $$('.linkrow', rows).map(function (r) { var i2 = $$('input', r); return { label: i2[0].value.trim(), url: i2[1].value.trim() }; }).filter(function (x) { return x.label || x.url; }); };
    }
    return { node: wrap, get: get };
  }
  function openEditor(title, fields, row, onSave) {
    var box = clear($('#editFields')), parts = {}, refsNeeded = fields.filter(function (f) { return f.kind === 'ref'; }), refs = {};
    $('#editTitle').textContent = title; $('#editErr').textContent = '';
    Promise.all(refsNeeded.map(function (f) { return api('/api/admin/' + f.src + '?size=100').then(function (d) { refs[f.src] = d.items; }); })).then(function () {
      fields.forEach(function (f) { var p = buildField(f, row ? row[f.k] : null, refs); parts[f.k] = p; box.appendChild(p.node); });
      $('#editor').hidden = false; document.body.style.overflow = 'hidden';
    }).catch(function (e) { toast(why(e), true); });
    $('#editForm').onsubmit = function (ev) {
      ev.preventDefault(); var body = {}; fields.forEach(function (f) { body[f.k] = parts[f.k].get(); });
      onSave(body).then(function () { closeEditor(); }).catch(function (e) { $('#editErr').textContent = why(e); });
    };
  }
  function closeEditor() { $('#editor').hidden = true; document.body.style.overflow = ''; }
  $('#editX').onclick = $('#editCancel').onclick = closeEditor; $('#editor').addEventListener('click', function (e) { if (e.target === this) closeEditor(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('#editor').hidden) closeEditor(); });

  // ---------------------------------------------------------------- tables / views
  var view = $('#view'), tools = $('#viewTools'), pollT = 0;
  function table(cols, rows, actions) {
    var head = el('tr', {}, cols.map(function (c) { return el('th', { text: c[0].replace(/_/g, ' ') }); }).concat(actions ? [el('th')] : [])), body = rows.map(function (r) {
      return el('tr', {}, cols.map(function (c) { var v = r[c[0]]; if (c[1]) v = c[1](v); else if (typeof v === 'boolean') v = v ? '✓' : '–'; else if (c[0].slice(-3) === '_at') v = when(v); else if (c[0] === 'image_url' && v) return el('td', {}, [el('img', { src: v, alt: '', height: 40, loading: 'lazy' })]); return el('td', { text: v == null ? '' : String(v) }); }).concat(actions ? [el('td', { class: 'act' }, actions(r))] : []));
    });
    return el('div', { class: 'glass tblwrap' }, [el('table', { class: 'tbl' }, [el('thead', {}, [head]), el('tbody', {}, body)])]);
  }
  function btn(text, fn, cls) { return el('button', { type: 'button', class: 'btn small ' + (cls || ''), text: text, on: { click: fn } }); }
  function pager(box, d, go) {
    clear(box); var pages = Math.max(1, Math.ceil(d.total / d.size)); if (pages < 2) return box.appendChild(el('small', { class: 'hint', text: d.total + ' total' }));
    box.append(btn('‹', function () { go(d.page - 1); }), ' ' + d.page + ' / ' + pages + ' (' + d.total + ') ', btn('›', function () { go(d.page + 1); }));
    box.firstChild.disabled = d.page <= 1; box.lastChild.disabled = d.page >= pages;
  }
  function crudView(name, page) {
    var def = RES[name]; page = Math.max(1, page || 1); clear(tools).appendChild(btn('+ New', function () {
      openEditor('New — ' + def.title, def.fields, null, function (b) { return api('/api/admin/' + name, { method: 'POST', body: b }).then(function () { toast('Created'); crudView(name, page); }); }); }, 'primary'));
    api('/api/admin/' + name + '?page=' + page + '&size=25').then(function (d) {
      clear(view).appendChild(table(def.cols, d.items, function (r) { return [btn('Edit', function () {
        openEditor('Edit — ' + def.title + ' #' + r.id, def.fields, r, function (b) { return api('/api/admin/' + name + '/' + r.id, { method: 'PUT', body: b }).then(function () { toast('Saved'); crudView(name, page); }); }); }),
        btn('Delete', function () { if (confirm('Delete #' + r.id + '?')) api('/api/admin/' + name + '/' + r.id, { method: 'DELETE' }).then(function () { toast('Deleted'); crudView(name, page); }).catch(function (e) { toast(why(e), true); }); }, 'danger')]; }));
      var pg = el('div', { class: 'pager' }); view.appendChild(pg); pager(pg, d, function (p) { crudView(name, p); });
    }).catch(function (e) { clear(view).appendChild(el('p', { class: 'err', text: why(e) })); });
  }
  var VIEWS = {
    overview: function () {
      api('/api/admin/overview').then(function (o) {
        var cards = [['Total users', o.users], ['Projects', o.projects], ['Total tickets', o.tickets], ['Open tickets', o.tickets_open], ['Closed tickets', o.tickets_closed], ['Messages', o.messages], ['New contact', o.contact_new], ['Guestbook pending', o.guestbook_pending], ['Blog published', o.blog_published], ['Blog drafts', o.blog_draft], ['Gallery', o.gallery], ['Skills', o.skills]];
        clear(view).append(el('div', { class: 'cards' }, cards.map(function (c) { return el('div', { class: 'glass stat' }, [el('b', { text: String(c[1]) }), el('span', { text: c[0] })]); })),
          el('h3', { text: 'Recent activity' }), table([['kind'], ['detail'], ['created_at']], o.recent));
      }).catch(function (e) { clear(view).appendChild(el('p', { class: 'err', text: why(e) })); });
    },
    profile: function () {
      api('/api/admin/profile').then(function (p) { clear(view).appendChild(el('div', { class: 'glass pad' }, [el('p', { class: 'hint', text: 'Public text is never invented: empty fields are simply hidden on the site.' }), btn('Edit profile', function () {
        openEditor('Profile', PROFILE_FIELDS, p, function (b) { return api('/api/admin/profile', { method: 'PUT', body: b }).then(function () { toast('Saved'); VIEWS.profile(); }); }); }, 'primary'), el('div', { class: 'imgf', style: 'margin-top:14px' }, [p.photo_url ? el('img', { src: p.photo_url, alt: '', height: 120 }) : el('span', { class: 'hint', text: 'No profile photo yet — upload your real photo in the editor.' })])])); })
        .catch(function (e) { clear(view).appendChild(el('p', { class: 'err', text: why(e) })); });
    },
    guestbook_entries: function (page, status) {
      page = page || 1; status = status || ''; clear(tools).appendChild(el('select', { 'aria-label': 'Filter', on: { change: function () { VIEWS.guestbook_entries(1, this.value); } } }, ['', 'approved', 'pending', 'hidden'].map(function (s) { return el('option', { value: s, text: s || 'all', selected: s === status }); })));
      api('/api/admin/guestbook_entries?page=' + page + '&status=' + status).then(function (d) {
        var act = function (id, st) { return api('/api/admin/guestbook_entries/' + id, { method: 'PATCH', body: { status: st } }).then(function () { VIEWS.guestbook_entries(page, status); }).catch(function (e) { toast(why(e), true); }); };
        clear(view).appendChild(table([['display_name'], ['message'], ['status'], ['reports'], ['created_at']], d.items, function (r) { return [btn('Approve', function () { act(r.id, 'approved'); }), btn('Hide', function () { act(r.id, 'hidden'); }), btn('Delete', function () { if (confirm('Delete?')) api('/api/admin/guestbook_entries/' + r.id, { method: 'DELETE' }).then(function () { VIEWS.guestbook_entries(page, status); }); }, 'danger')]; }));
        var pg = el('div', { class: 'pager' }); view.appendChild(pg); pager(pg, d, function (p) { VIEWS.guestbook_entries(p, status); });
      }).catch(function (e) { clear(view).appendChild(el('p', { class: 'err', text: why(e) })); });
    },
    contact_messages: function (page) {
      page = page || 1; clear(tools);
      api('/api/admin/contact_messages?page=' + page).then(function (d) {
        clear(view).appendChild(table([['name'], ['subject'], ['message'], ['email'], ['status'], ['created_at']], d.items, function (r) { return [btn(r.status === 'new' ? 'Mark read' : 'Mark new', function () { api('/api/admin/contact_messages/' + r.id, { method: 'PATCH', body: { status: r.status === 'new' ? 'read' : 'new' } }).then(function () { VIEWS.contact_messages(page); }); }),
          btn('Delete', function () { if (confirm('Delete?')) api('/api/admin/contact_messages/' + r.id, { method: 'DELETE' }).then(function () { VIEWS.contact_messages(page); }); }, 'danger')]; }));
        var pg = el('div', { class: 'pager' }); view.appendChild(pg); pager(pg, d, VIEWS.contact_messages);
      }).catch(function (e) { clear(view).appendChild(el('p', { class: 'err', text: why(e) })); });
    },
    tickets: function (page, status) {
      page = page || 1; status = status || ''; clear(tools).appendChild(el('select', { 'aria-label': 'Filter', on: { change: function () { VIEWS.tickets(1, this.value); } } }, ['', 'open', 'claimed', 'closed'].map(function (s) { return el('option', { value: s, text: s || 'all', selected: s === status }); })));
      api('/api/admin/tickets?page=' + page + '&status=' + status).then(function (d) {
        clear(view).appendChild(table([['id'], ['customer'], ['status'], ['claimed_by'], ['assigned_to'], ['created_at']], d.items.map(function (r) { return Object.assign({}, r, { customer: (r.users && r.users.username) || '' }); }), function (r) { return [btn('Open', function () { openTicket(r); })]; }));
        var pg = el('div', { class: 'pager' }); view.appendChild(pg); pager(pg, d, function (p) { VIEWS.tickets(p, status); });
      }).catch(function (e) { clear(view).appendChild(el('p', { class: 'err', text: why(e) })); });
    },
    users: function (page) {
      page = page || 1; clear(tools); var isOwner = ME.role === 'owner';
      api('/api/admin/users?page=' + page).then(function (d) {
        clear(view).appendChild(table([['id'], ['username'], ['email'], ['role'], ['created_at']], d.items, function (r) {
          var a = [btn('Reset code', function () { api('/api/admin/users/' + r.id + '/reset-code', { method: 'POST' }).then(function (c) { showCode(r.username, c); }).catch(function (e) { toast(why(e), true); }); })];
          if (isOwner && r.username !== ME.username) { var sel = el('select', { 'aria-label': 'Role', on: { change: function () { api('/api/admin/users/' + r.id, { method: 'PATCH', body: { role: this.value } }).then(function () { toast('Role updated'); }).catch(function (e) { toast(why(e), true); VIEWS.users(page); }); } } }, ['user', 'moderator', 'admin', 'owner'].map(function (x) { return el('option', { value: x, text: x, selected: x === r.role }); })); a.push(sel, btn('Delete', function () { if (confirm('Delete user ' + r.username + '?')) api('/api/admin/users/' + r.id, { method: 'DELETE' }).then(function () { VIEWS.users(page); }).catch(function (e) { toast(why(e), true); }); }, 'danger')); }
          return a; }));
        view.prepend(el('p', { class: 'hint', text: 'No email service: "Reset code" creates a one-time code (30 min) that you give to the user. Only the owner can change roles.' }));
        var pg = el('div', { class: 'pager' }); view.appendChild(pg); pager(pg, d, VIEWS.users);
      }).catch(function (e) { clear(view).appendChild(el('p', { class: 'err', text: why(e) })); });
    },
    discord: function () {
      clear(tools); Promise.all([api('/api/admin/overview'), ME.level >= 2 ? api('/api/admin/settings') : Promise.resolve({ discord: {} })]).then(function (r) {
        var o = r[0], dc = r[1].discord || {};
        clear(view).append(el('div', { class: 'cards' }, [['Bot', o.bot_online ? 'online' : 'offline'], ['Open tickets', o.tickets_open], ['Closed tickets', o.tickets_closed], ['Unread contact', o.contact_new]].map(function (c) { return el('div', { class: 'glass stat' }, [el('b', { text: String(c[1]) }), el('span', { text: c[0] })]); })),
          el('div', { class: 'glass pad' }, [el('p', { text: 'Ticket category: ' + (dc.category || 'not set (run /setup in Discord)') }), el('p', { text: 'Log channel: ' + (dc.log_channel || 'not set') }), el('p', { class: 'hint', text: 'Replies written in Ticket → Open are queued in the database and posted by the bot; the queue survives bot restarts. The bot runs on bot-hosting.net, so "offline" means no heartbeat in the last 30 s.' })]));
      }).catch(function (e) { clear(view).appendChild(el('p', { class: 'err', text: why(e) })); });
    },
    security: function (page) { logsView('/api/admin/logs?security=1&page=', page, VIEWS.security, 'Security events: failed CAPTCHAs, honeypot hits, replayed tokens, failed logins, reports and role changes.'); },
    logs: function (page) { logsView('/api/admin/logs?page=', page, VIEWS.logs, ''); },
    settings: function () {
      clear(tools); api('/api/admin/settings').then(function (d) {
        var s = d.settings, row = function (key, text) { var sel = el('select', { 'aria-label': text, on: { change: function () { var b = {}; b[key] = this.value; api('/api/admin/settings', { method: 'PUT', body: b }).then(function () { toast('Saved'); }).catch(function (e) { toast(why(e), true); }); } } }, [el('option', { value: '1', text: 'On' }), el('option', { value: '0', text: 'Off' })]); sel.value = s[key]; return el('div', { class: 'switch' }, [el('span', { text: text }), sel]); };
        clear(view).appendChild(el('div', { class: 'glass pad' }, [row('guestbook_enabled', 'Guestbook accepts new messages'), row('guestbook_require_approval', 'Hold new guestbook messages for approval'), row('contact_enabled', 'Contact form enabled')]));
      }).catch(function (e) { clear(view).appendChild(el('p', { class: 'err', text: why(e) })); });
    }
  };
  function logsView(url, page, self, hint) {
    page = page || 1; clear(tools);
    api(url + page).then(function (d) { clear(view); if (hint) view.appendChild(el('p', { class: 'hint', text: hint })); view.appendChild(table([['id'], ['kind'], ['detail'], ['created_at']], d.items)); var pg = el('div', { class: 'pager' }); view.appendChild(pg); pager(pg, d, self); })
      .catch(function (e) { clear(view).appendChild(el('p', { class: 'err', text: why(e) })); });
  }
  function showCode(user, c) { var box = el('div', { class: 'glass pad' }, [el('p', { text: 'One-time reset code for ' + user + ' (valid ' + c.expires_minutes + ' min). It is shown only once:' }), el('div', { class: 'codebox', text: c.code }), btn('Close', function () { box.remove(); })]); view.prepend(box); }

  // ---- ticket conversation panel
  function openTicket(t) {
    clearInterval(pollT); var last = 0; var msgs = el('div', { class: 'msgs' }), inp = el('textarea', { maxlength: 1500, rows: 2, placeholder: 'Reply (posted to the Discord ticket channel by the bot)…' });
    var act = function (a) { return api('/api/admin/tickets/' + t.id + '/action', { method: 'POST', body: { action: a } }).then(function () { toast('Done'); load(); }).catch(function (e) { toast(why(e), true); }); };
    function load() { api('/api/admin/tickets/' + t.id + '/messages').then(function (d) { clear(msgs); d.items.forEach(function (m) { msgs.appendChild(el('div', { class: 'm ' + (m.sender === 'web' ? '' : m.sender === 'system' ? 'sys' : 'me') }, [el('small', { text: m.author + ' · ' + when(m.created_at) + (m.pushed ? '' : ' · queued') }), m.body])); }); msgs.scrollTop = msgs.scrollHeight; }); }
    clear(view).appendChild(el('div', { class: 'convo' }, [el('div', { class: 'row' }, [btn('← Tickets', function () { clearInterval(pollT); VIEWS.tickets(); }), el('b', { text: 'Ticket #' + t.id + ' · ' + ((t.users && t.users.username) || '') + ' · ' + t.status }), btn('Claim', function () { act('claim'); }), btn('Close', function () { act('close'); }, 'danger'), btn('Reopen', function () { act('reopen'); })]), msgs, inp,
      el('div', { class: 'row' }, [btn('Send reply', function () { var b = inp.value.trim(); if (!b) return; api('/api/admin/tickets/' + t.id + '/reply', { method: 'POST', body: { body: b } }).then(function () { inp.value = ''; load(); }).catch(function (e) { toast(why(e), true); }); }, 'primary')])]));
    load(); pollT = setInterval(function () { if (!document.hidden) load(); }, 5000);
  }

  // ---------------------------------------------------------------- shell
  var NAV = [['overview', 'Overview', 'moderator'], ['profile', 'Profile & About', 'admin'], ['skills', 'Skills', 'admin'], ['projects', 'Projects', 'admin'], ['project_images', 'Project images', 'admin'], ['timeline_events', 'Timeline', 'admin'], ['gallery_items', 'Gallery', 'admin'], ['blog_posts', 'Blog', 'admin'], ['guestbook_entries', 'Guestbook', 'moderator'], ['contact_messages', 'Contact', 'moderator'], ['tickets', 'Tickets', 'moderator'], ['users', 'Users', 'admin'], ['discord', 'Discord', 'moderator'], ['security', 'Security', 'moderator'], ['settings', 'Settings', 'admin'], ['logs', 'Activity logs', 'moderator']];
  function show(id) {
    clearInterval(pollT); var n = NAV.filter(function (x) { return x[0] === id; })[0] || NAV[0]; id = n[0]; $('#viewTitle').textContent = n[1]; clear(tools); clear(view);
    $$('#sideNav a').forEach(function (a) { a.classList.toggle('on', a.dataset.id === id); }); history.replaceState(null, '', '#' + id);
    if (RES[id]) crudView(id); else VIEWS[id]();
  }
  function startApp() {
    $('#gate').hidden = true; $('#app').hidden = false; $('#whoName').textContent = ME.username; $('#whoRole').textContent = ME.role;
    clear($('#sideNav')); NAV.filter(function (x) { return ME.level >= LV[x[2]]; }).forEach(function (x) { $('#sideNav').appendChild(el('a', { 'data-id': x[0], text: x[1], role: 'button', tabindex: '0', on: { click: function () { show(x[0]); }, keydown: function (e) { if (e.key === 'Enter') show(x[0]); } } })); });
    show(location.hash.slice(1) || 'overview');
  }
  function gate(msg) { $('#app').hidden = true; $('#gate').hidden = false; if (msg) $('#gateMsg').textContent = msg; setupCaptcha(); }
  $('#outBtn').onclick = function () { ['ps_token', 'ps_user', 'ps_role'].forEach(store.del); location.href = 'index.html'; };

  // ---- login (Turnstile)
  var cap = null;
  function setupCaptcha() {
    if (cap) return; var box = $('#loginCap'), w = $('.cap-widget', box), st = $('.cap-status', box), txt = $('.txt', st), retry = $('.retry', st), id = null, token = '';
    var set = function (s, m) { st.dataset.s = s; txt.textContent = m; retry.hidden = !(s === 'failed' || s === 'expired' || s === 'error'); };
    cap = { token: function () { return token; }, reset: function () { token = ''; if (id !== null && window.turnstile) try { turnstile.reset(id); set('verifying', 'Checking…'); } catch (e) {} } };
    set('loading', 'Loading…');
    api('/api/config').then(function (c) { if (!c.sitekey) throw new Error('nokey'); return new Promise(function (ok, no) { if (window.turnstile) return ok(c.sitekey); var s = document.createElement('script'); s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.onload = function () { ok(c.sitekey); }; s.onerror = no; document.head.appendChild(s); }); })
      .then(function (k) { id = turnstile.render(w, { sitekey: k, theme: 'dark', callback: function (tk) { token = tk; set('verified', 'Verified'); }, 'error-callback': function () { token = ''; set('failed', 'Verification failed'); }, 'expired-callback': function () { token = ''; set('expired', 'Expired'); } }); set('verifying', 'Checking…'); })
      .catch(function (e) { set('error', e.message === 'nokey' ? 'Verification is not configured' : 'Could not load verification'); });
    retry.onclick = function () { if (id === null) { cap = null; setupCaptcha(); } else cap.reset(); };
  }
  $('#loginForm').addEventListener('submit', function (e) {
    e.preventDefault(); var f = e.target, err = $('#loginErr'); err.textContent = ''; if (!f.checkValidity()) return f.reportValidity(); if (!cap.token()) { err.textContent = 'Complete the verification'; return; }
    api('/api/login', { method: 'POST', body: { username: f.elements.username.value.trim(), password: f.elements.password.value, captcha: cap.token(), website: f.elements.website.value } })
      .then(function (d) { store.set('ps_token', d.token); store.set('ps_user', d.username); store.set('ps_role', d.role); f.reset(); init(); }).catch(function (e2) { err.textContent = why(e2); }).finally(function () { cap.reset(); });
  });
  function init() {
    if (!store.get('ps_token')) return gate();
    api('/api/me').then(function (d) { ME = { username: d.username, role: d.role, level: LV[d.role] || 0 }; if (ME.level < 1) { ['ps_token'].forEach(store.del); return gate('This account is not staff. Sign in with an admin or moderator account.'); } startApp(); })
      .catch(function (e) { if (e.status === 401) { store.del('ps_token'); gate('Session expired. Please sign in again.'); } else gate('Cannot reach the server: ' + why(e)); });
  }
  init();
})();
