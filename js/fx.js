/* Visual effects. Everything here is optional decoration: honours prefers-reduced-motion, pauses when the tab is hidden. */
(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FX = window.FX = { reduce: reduce };

  // ---- starfield: 3 parallax layers + occasional shooting star
  var cv = document.getElementById('space'), ctx = cv && cv.getContext('2d'), stars = [], shoot = null, W = 0, H = 0, my = 0, scrollY = 0, mx = 0, running = true;
  function size() {
    var d = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0);
    var n = Math.round(Math.min(220, W * H / 9000)); stars = [];
    for (var i = 0; i < n; i++) { var z = Math.random(); stars.push({ x: Math.random() * W, y: Math.random() * H, z: z < .6 ? 1 : z < .9 ? 2 : 3, p: Math.random() * 6.28, c: Math.random() < .15 ? '#ff7a8c' : Math.random() < .3 ? '#7fe9ff' : '#fff' }); }
    draw(0);
  }
  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i], k = s.z * .012, ox = (mx - W / 2) * k * -1, oy = (my - H / 2) * k * -1 - scrollY * s.z * .02;
      var y = ((s.y + oy) % H + H) % H, tw = reduce ? 1 : .55 + .45 * Math.sin(t / 700 + s.p);
      ctx.globalAlpha = (.25 + s.z * .22) * tw; ctx.fillStyle = s.c; ctx.fillRect(s.x + ox, y, s.z * .8 + .4, s.z * .8 + .4);
    }
    if (shoot) {
      shoot.x += shoot.vx; shoot.y += shoot.vy; shoot.l--;
      var g = ctx.createLinearGradient(shoot.x, shoot.y, shoot.x - shoot.vx * 9, shoot.y - shoot.vy * 9);
      g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(0,217,255,0)'); ctx.globalAlpha = 1; ctx.strokeStyle = g; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(shoot.x, shoot.y); ctx.lineTo(shoot.x - shoot.vx * 9, shoot.y - shoot.vy * 9); ctx.stroke();
      if (shoot.l <= 0) shoot = null;
    } else if (!reduce && Math.random() < .0025) shoot = { x: Math.random() * W, y: Math.random() * H * .5, vx: 9 + Math.random() * 5, vy: 3 + Math.random() * 3, l: 50 };
  }
  if (cv && ctx) {
    size(); addEventListener('resize', size);
    if (!reduce) {
      addEventListener('pointermove', function (e) { mx = e.clientX; my = e.clientY; }, { passive: true });
      addEventListener('scroll', function () { scrollY = pageYOffset; }, { passive: true });
      document.addEventListener('visibilitychange', function () { running = !document.hidden; if (running) loop(); });
      (function loop(t) { if (!running) return; draw(t || 0); requestAnimationFrame(loop); window._loop = loop; })();
    }
  }

  // ---- split headline into letters (text reveal)
  FX.split = function (el, text) {
    el.textContent = ''; el.setAttribute('aria-label', text);
    Array.from(text).forEach(function (ch, i) { var s = document.createElement('span'); s.textContent = ch === ' ' ? '\u00a0' : ch; s.style.setProperty('--i', i); s.setAttribute('aria-hidden', 'true'); el.appendChild(s); });
  };

  // ---- scroll reveal (fade only; sections stay readable without JS)
  var io = 'IntersectionObserver' in window && !reduce ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: .08 }) : null;
  FX.reveal = function (root, stagger) {
    (root.querySelectorAll ? root.querySelectorAll('.fxi') : []).forEach(function (el, i) {
      if (!io) { el.classList.add('in'); return; }
      el.classList.add('fx'); el.style.transitionDelay = Math.min(i, 8) * (stagger || 60) + 'ms'; io.observe(el);
    });
  };

  // ---- custom cursor glow + magnetic buttons (mouse only)
  if (!reduce && matchMedia('(pointer:fine)').matches) {
    var cur = document.getElementById('cursor'), cx = 0, cy = 0, tx = 0, ty = 0;
    addEventListener('pointermove', function (e) { tx = e.clientX; ty = e.clientY; cur.classList.add('on'); });
    (function f() { cx += (tx - cx) * .2; cy += (ty - cy) * .2; cur.style.transform = 'translate(' + cx + 'px,' + cy + 'px)'; requestAnimationFrame(f); })();
    document.addEventListener('pointerover', function (e) { cur.classList.toggle('big', !!e.target.closest('a,button,.proj,.post,figure')); });
    document.addEventListener('pointermove', function (e) {
      var b = e.target.closest && e.target.closest('.mag'); if (!b) return;
      var r = b.getBoundingClientRect(); b.style.transform = 'translate(' + (e.clientX - r.left - r.width / 2) * .18 + 'px,' + (e.clientY - r.top - r.height / 2) * .28 + 'px)';
    });
    document.addEventListener('pointerout', function (e) { var b = e.target.closest && e.target.closest('.mag'); if (b) b.style.transform = ''; });
  }

  // ---- scroll progress
  var pr = document.getElementById('progress'), nav = document.getElementById('nav');
  function onScroll() { var h = document.documentElement.scrollHeight - innerHeight; pr.style.transform = 'scaleX(' + (h > 0 ? pageYOffset / h : 0) + ')'; nav.classList.toggle('solid', pageYOffset > 30); }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // ---- loading screen
  FX.hideLoader = function () { var l = document.getElementById('loader'); if (l) { l.classList.add('done'); setTimeout(function () { l.remove(); }, 800); } };
  setTimeout(FX.hideLoader, 2500); // never block the page if the API is slow
})();
