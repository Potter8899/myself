const assert = require('assert'); const MD = require('../../frontend/js/md.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const flat = b => JSON.stringify(b);
t('headings/paragraph/list', () => {
  const b = MD.parse('# Title\n\nHello **bold** and *it* `c`\n\n- a\n- b\n\n1. x\n2. y');
  assert.deepStrictEqual(b.map(x => x.t), ['h', 'p', 'list', 'list']); assert.strictEqual(b[0].n, 2); assert.strictEqual(b[2].ord, false); assert.strictEqual(b[3].ord, true);
});
t('code fence keeps raw text', () => { const b = MD.parse('```js\n<script>alert(1)</script>\n```'); assert.strictEqual(b[0].t, 'pre'); assert.ok(b[0].v.includes('<script>')); });
t('https links ok, others become plain text', () => {
  const s = flat(MD.parse('[ok](https://a.io/x) [bad](javascript:alert(1)) [h](http://x.io) [d](data:text/html,1)'));
  assert.ok(s.includes('"t":"a"') && s.includes('https://a.io/x')); assert.ok(!/"href":"javascript/.test(s)); assert.ok(!/"href":"http:/.test(s)); assert.ok(!/"href":"data/.test(s));
});
t('images need https', () => { const s = flat(MD.parse('![x](https://i.io/a.png) ![y](javascript:1) ![z](http://i.io/a.png)')); assert.strictEqual((s.match(/"t":"img"/g) || []).length, 1); });
t('raw HTML stays as text (no tag nodes)', () => {
  const s = flat(MD.parse('<img src=x onerror=alert(1)> <script>x</script>')); assert.ok(!/"t":"(img|a|script)"/.test(s));
});
t('empty / null input', () => { assert.deepStrictEqual(MD.parse(''), []); assert.deepStrictEqual(MD.parse(null), []); });
t('quote + hr', () => { const b = MD.parse('> hi\n\n---'); assert.deepStrictEqual(b.map(x => x.t), ['quote', 'hr']); });
t('thai text passes through', () => { assert.ok(flat(MD.parse('สวัสดี **โลก**')).includes('สวัสดี')); });
console.log(n + ' tests passed');
