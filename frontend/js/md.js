/* Tiny, safe Markdown renderer. It never uses innerHTML: it builds DOM nodes with textContent,
   so scripts / event handlers in the source text can never execute. Links and images must be https://. */
(function (root) {
  'use strict';
  var SAFE = /^https:\/\/[^\s<>"']+$/;
  var INLINE = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|!\[[^\]\n]*\]\([^)\s]+\)|\[[^\]\n]+\]\([^)\s]+\))/;

  function inline(text) {
    var out = [];
    String(text).split(INLINE).forEach(function (p) {
      if (!p) return;
      var m;
      if ((m = /^\*\*([^*]+)\*\*$/.exec(p))) out.push({ t: 'b', c: inline(m[1]) });
      else if ((m = /^\*([^*]+)\*$/.exec(p))) out.push({ t: 'i', c: inline(m[1]) });
      else if ((m = /^`([^`]+)`$/.exec(p))) out.push({ t: 'code', v: m[1] });
      else if ((m = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(p))) out.push(SAFE.test(m[2]) ? { t: 'img', alt: m[1], src: m[2] } : { t: 'text', v: p });
      else if ((m = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(p))) out.push(SAFE.test(m[2]) ? { t: 'a', href: m[2], c: inline(m[1]) } : { t: 'text', v: m[1] });
      else out.push({ t: 'text', v: p });
    });
    return out;
  }

  function parse(src) {
    var lines = String(src || '').replace(/\r\n?/g, '\n').split('\n'), blocks = [], i = 0, m;
    while (i < lines.length) {
      var l = lines[i];
      if (!l.trim()) { i++; continue; }
      if (/^```/.test(l)) {                       // fenced code
        var buf = []; i++;
        while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
        i++; blocks.push({ t: 'pre', v: buf.join('\n') }); continue;
      }
      if ((m = /^(#{1,3})\s+(.+)$/.exec(l))) { blocks.push({ t: 'h', n: m[1].length + 1, c: inline(m[2]) }); i++; continue; }
      if (/^(-{3,}|\*{3,})\s*$/.test(l)) { blocks.push({ t: 'hr' }); i++; continue; }
      if (/^>\s?/.test(l)) {
        var q = []; while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''));
        blocks.push({ t: 'quote', c: inline(q.join(' ')) }); continue;
      }
      if (/^[-*]\s+/.test(l) || /^\d+\.\s+/.test(l)) {
        var ord = /^\d+\./.test(l), items = [], re = ord ? /^\d+\.\s+/ : /^[-*]\s+/;
        while (i < lines.length && re.test(lines[i])) items.push(inline(lines[i++].replace(re, '')));
        blocks.push({ t: 'list', ord: ord, items: items }); continue;
      }
      var p = [];
      while (i < lines.length && lines[i].trim() && !/^(```|#{1,3}\s|>\s?|[-*]\s+|\d+\.\s+)/.test(lines[i])) p.push(lines[i++]);
      blocks.push({ t: 'p', c: inline(p.join('\n')) });
    }
    return blocks;
  }

  function nodes(doc, list) {
    var f = doc.createDocumentFragment();
    list.forEach(function (n) {
      var e;
      if (n.t === 'text') { f.appendChild(doc.createTextNode(n.v)); return; }
      if (n.t === 'code') { e = doc.createElement('code'); e.textContent = n.v; }
      else if (n.t === 'img') { e = doc.createElement('img'); e.src = n.src; e.alt = n.alt; e.loading = 'lazy'; e.decoding = 'async'; }
      else if (n.t === 'a') { e = doc.createElement('a'); e.href = n.href; e.target = '_blank'; e.rel = 'noopener noreferrer nofollow'; e.appendChild(nodes(doc, n.c)); }
      else { e = doc.createElement(n.t); e.appendChild(nodes(doc, n.c)); }
      f.appendChild(e);
    });
    return f;
  }

  function render(doc, src) {
    var f = doc.createDocumentFragment();
    parse(src).forEach(function (b) {
      var e;
      if (b.t === 'h') { e = doc.createElement('h' + b.n); e.appendChild(nodes(doc, b.c)); }
      else if (b.t === 'p') { e = doc.createElement('p'); e.appendChild(nodes(doc, b.c)); }
      else if (b.t === 'quote') { e = doc.createElement('blockquote'); e.appendChild(nodes(doc, b.c)); }
      else if (b.t === 'hr') e = doc.createElement('hr');
      else if (b.t === 'pre') { e = doc.createElement('pre'); var c = doc.createElement('code'); c.textContent = b.v; e.appendChild(c); }
      else { e = doc.createElement(b.ord ? 'ol' : 'ul'); b.items.forEach(function (it) { var li = doc.createElement('li'); li.appendChild(nodes(doc, it)); e.appendChild(li); }); }
      f.appendChild(e);
    });
    return f;
  }

  var api = { parse: parse, render: render };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MD = api;
})(typeof window !== 'undefined' ? window : this);
