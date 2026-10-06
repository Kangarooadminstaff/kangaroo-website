/* groupkangaroo.com: menu, dispatch board, and forms that post to /api/contact. */
(function () {
  var L = document.documentElement.lang === 'fr' ? 'fr' : 'en';
  var T = window.KG_T || {};
  // mobile menu
  var mb = document.getElementById('menuBtn'), nav = document.getElementById('nav');
  if (mb) mb.addEventListener('click', function () { var o = nav.classList.toggle('open'); mb.setAttribute('aria-expanded', o ? 'true' : 'false'); });
  if (nav) nav.addEventListener('click', function (e) { if (e.target.tagName === 'A') { nav.classList.remove('open'); mb && mb.setAttribute('aria-expanded', 'false'); } });

  // dispatch board: statuses advance every few seconds (sample lanes)
  var lanes = document.querySelectorAll('.lane'), order = ['ld', 'go', 'ok'];
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (lanes.length && !reduce && T.status) {
    var i = 0;
    setInterval(function () {
      var ln = lanes[i % lanes.length], st = ln.querySelector('.st'), cur = st.getAttribute('data-s'), nx = order[(order.indexOf(cur) + 1) % order.length];
      st.setAttribute('data-s', nx); st.className = 'st ' + nx; st.textContent = T.status[nx];
      ln.classList.remove('flip'); void ln.offsetWidth; ln.classList.add('flip'); i++;
    }, 3200);
  }

  // cold chain: reefer setpoint slider
  document.querySelectorAll('.dial').forEach(function (d) {
    var D; try { D = JSON.parse(d.getAttribute('data-cc')); } catch (e) { return; }
    var r = d.querySelector('input[type=range]'), out = d.querySelector('.dial-out'), cur = null;
    var q = function (s) { return d.querySelector(s); };
    var fmt = function (v) { return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v); };
    var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    function fill(b) {
      q('.dial-ic').innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + b.ic + '</svg>';
      q('.dial-name').textContent = b.name; q('.dial-range').textContent = b.range;
      q('.dial-items').innerHTML = b.items.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
      q('.dial-note').textContent = b.note;
    }
    // keep the card the same height whichever band is showing
    function lock() {
      if (!d.offsetWidth) return; out.style.minHeight = ''; var m = 0;
      D.bands.forEach(function (b) { fill(b); m = Math.max(m, out.offsetHeight); });
      fill(cur); out.style.minHeight = m + 'px';
    }
    function set(v) {
      var b = D.bands.filter(function (x) { return v >= x.lo && v <= x.hi; })[0] || D.bands[0], i = D.bands.indexOf(b);
      q('.dial-c').firstChild.nodeValue = fmt(v);
      var f = Math.round(v * 9 / 5 + 32); q('.dial-f').textContent = (f < 0 ? '\u2212' : '') + Math.abs(f) + ' \u00b0F';
      r.setAttribute('aria-valuetext', fmt(v) + ' °C, ' + b.name);
      if (b === cur) return; cur = b;
      d.style.setProperty('--dc', b.c);
      q('.dial-mode').innerHTML = esc(D.modeLabel) + ': <b>' + esc(b.mode) + '</b>';
      fill(b);
      d.querySelectorAll('.dial-segs i').forEach(function (s, k) { s.classList.toggle('on', k === i); });
      out.classList.remove('swap'); void out.offsetWidth; out.classList.add('swap');
    }
    r.addEventListener('input', function () { set(parseInt(r.value, 10)); });
    cur = D.bands.filter(function (x) { return +r.value >= x.lo && +r.value <= x.hi; })[0];
    lock(); var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(lock, 150); });
    if (window.ResizeObserver) { var lw = 0; new ResizeObserver(function () { if (d.offsetWidth !== lw) { lw = d.offsetWidth; lock(); } }).observe(d); }
  });

  // job cards: "Apply" picks that position in the application form
  document.querySelectorAll('.job-apply').forEach(function (b) {
    b.addEventListener('click', function () {
      var sec = b.closest('section'), f = sec && sec.querySelector('form[data-kind=career]'); if (!f) return;
      var sel = f.querySelector('select'); if (sel) sel.value = b.getAttribute('data-role');
      f.scrollIntoView({ behavior: 'smooth', block: 'start' });
      var first = f.querySelector('input:not([type=hidden]):not([tabindex="-1"])'); if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 400);
    });
  });

  // language: remember the visitor's choice; the bottom picker shows only on a first visit
  var LS = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  var lang2 = (document.documentElement.lang || 'fr').slice(0, 2);
  document.querySelectorAll('a[hreflang]').forEach(function (a) { a.addEventListener('click', function () { LS.set('kg-lang', a.getAttribute('hreflang').slice(0, 2)); }); });
  var lp = document.getElementById('langPick');
  if (lp && !window.KG_PREVIEW && !LS.get('kg-lang')) {
    lp.hidden = false;
    var nav2 = (navigator.language || '').slice(0, 2), sug = lp.querySelector('a[hreflang^="' + nav2 + '"]');
    if (sug && nav2 !== lang2) { lp.querySelectorAll('a[aria-current]').forEach(function (x) { x.removeAttribute('aria-current'); }); sug.setAttribute('aria-current', 'true'); }
    lp.querySelector('.lp-x').addEventListener('click', function () { LS.set('kg-lang', lang2); lp.classList.add('bye'); setTimeout(function () { lp.hidden = true; }, 260); });
    lp.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function (ev) { if (a.getAttribute('hreflang').slice(0, 2) === lang2) { ev.preventDefault(); lp.querySelector('.lp-x').click(); } }); });
  }

  // forms
  var started = Date.now();
  function b64(file) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result).split(',')[1]); }; r.onerror = rej; r.readAsDataURL(file); }); }
  document.querySelectorAll('form[data-kind]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var st = f.querySelector('.status'), btn = f.querySelector('button[type=submit]');
      if (!f.checkValidity()) { st.className = 'status err'; st.textContent = T.missing; f.reportValidity && f.reportValidity(); return; }
      var data = { kind: f.getAttribute('data-kind'), lang: (document.documentElement.lang || L).slice(0, 2), t: Date.now() - started, fields: {} };
      [].forEach.call(f.elements, function (el) { if (el.name && el.type !== 'file') data.fields[el.name] = el.value.trim(); });
      var file = f.querySelector('input[type=file]'), p = Promise.resolve();
      if (file && file.files[0]) {
        if (file.files[0].size > 4 * 1024 * 1024) { st.className = 'status err'; st.textContent = T.cvBig; return; }
        p = b64(file.files[0]).then(function (c) { data.file = { name: file.files[0].name, type: file.files[0].type || 'application/octet-stream', b64: c }; });
      }
      btn.disabled = true; st.className = 'status'; st.textContent = T.sending;
      if (window.KG_PREVIEW) { setTimeout(function () { btn.disabled = false; st.className = 'status ok'; st.textContent = T.preview; }, 500); return; }
      p.then(function () { return fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); })
        .then(function (r) { if (!r.ok) throw new Error(r.status); st.className = 'status ok'; st.textContent = T.sent; f.reset(); })
        .catch(function () { st.className = 'status err'; st.textContent = T.failed; })
        .then(function () { btn.disabled = false; });
    });
  });
  var y = document.getElementById('year'); if (y) y.textContent = new Date().getFullYear();
})();

/* hero backdrop: our lanes across North America and the Atlantic. Trucks run the highways, a ship heads down the St. Lawrence to Europe, a plane crosses to London. */
(function () {
  var cv = document.querySelector('.hero-map'); if (!cv || !cv.getContext) return;
  var inHero = !!(cv.closest && cv.closest('.hero')); // behind the hero: fit the width and put Laval HQ in the open space between the headline and the dispatch board
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var g = cv.getContext('2d'), bin; try { bin = atob(cv.getAttribute('data-mask')); } catch (e) { return; }
  var LON0 = -128, LON1 = 22, LAT0 = 8, LAT1 = 66, HQ = [45.57, -73.69];
  var DEST = [[43.65, -79.38, 't'], [41.88, -87.63, 't'], [32.78, -96.8, 't'], [19.43, -99.13, 't'], [49.28, -123.12, 't'], [34.05, -118.24, 't'], [25.76, -80.19, 't'], [41.65, -83.54, 't'], [44.65, -63.57, 't'],
    [51.92, 4.48, 's'], [51.5, -0.12, 'p'], [48.86, 2.35, 'p']];
  var LABELS = [[45.57, -73.69, 'LAVAL HQ', 1, 'right'], [51.5, -0.12, 'LONDON', 0, 'right'], [51.92, 4.48, 'ROTTERDAM'], [19.43, -99.13, 'MEXICO CITY'], [34.05, -118.24, 'LOS ANGELES'], [49.28, -123.12, 'VANCOUVER'], [32.78, -96.8, 'DALLAS'], [25.76, -80.19, 'MIAMI']];
  // Toledo, Ohio: new branch, opening soon (hollow dashed dot, its own label)
  var SOON = [41.65, -83.54], SOONTXT = 'TOLEDO, OH · ' + ({ fr: 'BIENTÔT', en: 'OPENING SOON', es: 'PRÓXIMAMENTE', it: 'PROSSIMAMENTE', pa: 'ਜਲਦੀ', zh: '即将开业' }[(document.documentElement.lang || 'fr').slice(0, 2)] || 'OPENING SOON');
  var W = 0, H = 0, dpr = 1, dots = null, sx, sy, ox, oy, routes = [], vis = true, raf = 0, t0 = performance.now();
  function proj(lat, lon) { return [ox + (lon - LON0) * sx, oy + (LAT1 - lat) * sy]; }
  function size() {
    var r = cv.getBoundingClientRect(); if (!r.width) return false;
    dpr = Math.min(2, window.devicePixelRatio || 1); W = r.width; H = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    // cover the hero, keeping the map's shape; lean it right so the lanes sit beside the headline
    // fit the whole span across the hero, centred on the lanes; taller screens (phones) zoom in a little
    sx = inHero ? W / (LON1 - LON0) * (W < 920 ? 1.35 : 1.15) : Math.max(W / (LON1 - LON0), W < 700 ? 0 : H / 40 / 1.2); sy = sx * 1.2;
    ox = inHero ? W * (W < 920 ? .62 : .54) - (HQ[1] - LON0) * sx : (W - (LON1 - LON0) * sx) * .5; oy = inHero ? H * (W < 920 ? .5 : .34) - (LAT1 - HQ[0]) * sy : H / 2 - (LAT1 - 40) * sy;
    dots = document.createElement('canvas'); dots.width = cv.width; dots.height = cv.height; var q = dots.getContext('2d'); q.scale(dpr, dpr);
    q.fillStyle = 'rgba(245,244,240,.2)'; var rr = Math.max(1, Math.min(2.6, sx * .26));
    for (var i = 0; i < 180 * 90; i++) {
      if (!(bin.charCodeAt(i >> 3) & (128 >> (i & 7)))) continue;
      var lat = 90 - (Math.floor(i / 180) + .5) * 2, lon = -180 + (i % 180 + .5) * 2; if (lat < LAT0 - 4 || lat > LAT1 + 4 || lon < LON0 - 4 || lon > LON1 + 4) continue;
      var p = proj(lat, lon); q.beginPath(); q.arc(p[0], p[1], rr, 0, 6.2832); q.fill();
    }
    var h = proj(HQ[0], HQ[1]);
    routes = DEST.map(function (d, i) { var b = proj(d[0], d[1]), dx = b[0] - h[0], dy = b[1] - h[1], len = Math.hypot(dx, dy), bend = d[2] === 'p' ? .2 : d[2] === 's' ? .1 : .18;
      return { a: h, b: b, c: [h[0] + dx / 2 + dy * bend * (i % 2 ? 1 : -1) * (d[2] === 't' ? 1 : -1), h[1] + dy / 2 - Math.abs(dx) * bend], k: d[2], sp: (d[2] === 'p' ? 5.5 : d[2] === 's' ? 16 : 7 + (i % 4)) * Math.max(1, len / 260), ph: i * .37 }; });
    // ships crossing the Atlantic both ways (not tied to Laval): Halifax > Rotterdam, New York > Le Havre, Antwerp > Quebec City, Southampton > Boston
    [[44.65, -63.57, 51.92, 4.48], [40.6, -73.9, 49.49, 0.11], [51.22, 4.4, 46.81, -71.21], [50.9, -1.4, 42.36, -71.05]].forEach(function (o, i) {
      var a = proj(o[0], o[1]), b = proj(o[2], o[3]), dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
      routes.push({ a: a, b: b, c: [a[0] + dx / 2, a[1] + dy / 2 - Math.abs(dx) * (inHero ? .3 : .09)], k: 's', sp: (17 + i * 3) * Math.max(1, len / 260), ph: .12 + i * .29 });
    });
    return true;
  }
  function at(r, u) { var m = 1 - u; return [m * m * r.a[0] + 2 * m * u * r.c[0] + u * u * r.b[0], m * m * r.a[1] + 2 * m * u * r.c[1] + u * u * r.b[1]]; }
  function icon(k, x, y, ang) {
    g.save(); g.translate(x, y); g.rotate(ang);
    if (k === 'p') { g.fillStyle = '#f5f4f0'; g.beginPath(); g.moveTo(8, 0); g.lineTo(-6, -2); g.lineTo(-7, -7); g.lineTo(-4, -7); g.lineTo(-1, -2); g.lineTo(-1, 2); g.lineTo(-4, 7); g.lineTo(-7, 7); g.lineTo(-6, 2); g.closePath(); g.fill(); }
    else if (k === 's') { g.fillStyle = '#7fc0f5'; g.beginPath(); g.moveTo(-8, -3); g.lineTo(7, -3); g.lineTo(9, 0); g.lineTo(7, 3); g.lineTo(-8, 3); g.closePath(); g.fill(); g.fillStyle = '#ffac19'; g.fillRect(-5, -2, 3, 4); g.fillRect(-1, -2, 3, 4); }
    else { g.fillStyle = '#ffac19'; g.fillRect(-6, -2.5, 8, 5); g.fillStyle = '#f5f4f0'; g.fillRect(2.5, -2.5, 3.5, 5); }
    g.restore();
  }
  function frame(now) {
    if (!dots) return; var tt = (now - t0) / 1000;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); g.drawImage(dots, 0, 0); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    routes.forEach(function (r) {
      g.strokeStyle = r.k === 'p' ? 'rgba(245,244,240,.28)' : r.k === 's' ? 'rgba(127,192,245,.35)' : 'rgba(255,172,25,.32)'; g.lineWidth = r.k === 't' ? 1.4 : 1.2;
      g.setLineDash(r.k === 'p' ? [2, 5] : r.k === 's' ? [6, 4] : []); g.beginPath(); g.moveTo(r.a[0], r.a[1]); g.quadraticCurveTo(r.c[0], r.c[1], r.b[0], r.b[1]); g.stroke(); g.setLineDash([]);
      g.fillStyle = 'rgba(245,244,240,.55)'; g.beginPath(); g.arc(r.b[0], r.b[1], 2.2, 0, 6.2832); g.fill();
      var u = reduce ? .62 : ((tt / r.sp + r.ph) % 1), p = at(r, u), p2 = at(r, Math.min(1, u + .01));
      if (!reduce) { for (var k = 1; k < 7; k++) { var tp = at(r, Math.max(0, u - k * .012)); g.fillStyle = (r.k === 's' ? 'rgba(127,192,245,' : r.k === 'p' ? 'rgba(245,244,240,' : 'rgba(255,172,25,') + (.35 - k * .05) + ')'; g.beginPath(); g.arc(tp[0], tp[1], 1.6, 0, 6.2832); g.fill(); } }
      icon(r.k, p[0], p[1], Math.atan2(p2[1] - p[1], p2[0] - p[0]));
    });
    g.font = '600 10px ui-monospace, Menlo, Consolas, monospace'; g.textBaseline = 'middle';
    LABELS.forEach(function (l) { if (W < 700 && /DALLAS|LOS|ROTT/.test(l[2])) return; var p = proj(l[0], l[1]); g.fillStyle = l[3] ? '#ffac19' : 'rgba(245,244,240,.6)'; g.textAlign = l[4] || 'left'; g.fillText(l[2], p[0] + (l[4] === 'right' ? -8 : 8), p[1]); });
    var so = proj(SOON[0], SOON[1]), sp = reduce ? .5 : (tt % 3) / 3;
    g.strokeStyle = 'rgba(255,172,25,' + (1 - sp) * .55 + ')'; g.lineWidth = 1.5; g.beginPath(); g.arc(so[0], so[1], 4 + sp * 12, 0, 6.2832); g.stroke();
    g.setLineDash([2, 2]); g.strokeStyle = '#ffac19'; g.lineWidth = 1.5; g.beginPath(); g.arc(so[0], so[1], 5, 0, 6.2832); g.stroke(); g.setLineDash([]);
    g.fillStyle = 'rgba(255,172,25,.35)'; g.beginPath(); g.arc(so[0], so[1], 2.5, 0, 6.2832); g.fill();
    g.fillStyle = '#ffac19'; g.textAlign = 'right'; g.fillText(SOONTXT, so[0] - 10, so[1] + 12);
    var h = proj(HQ[0], HQ[1]), pulse = reduce ? .5 : (tt % 2) / 2;
    g.strokeStyle = 'rgba(255,172,25,' + (1 - pulse) * .8 + ')'; g.lineWidth = 2; g.beginPath(); g.arc(h[0], h[1], 4 + pulse * 18, 0, 6.2832); g.stroke();
    g.fillStyle = '#ffac19'; g.beginPath(); g.arc(h[0], h[1], 4.5, 0, 6.2832); g.fill();
    if (!reduce && vis) raf = requestAnimationFrame(frame);
  }
  function start() { cancelAnimationFrame(raf); if (size()) raf = requestAnimationFrame(frame); }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { vis = es[0].isIntersecting; if (vis && !reduce) { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); } }).observe(cv);
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(start, 150); });
  start();
})();

/* quote form: a temperature slider for reefer loads (fills the hidden "temp" field) */
(function () {
  document.querySelectorAll('.tslide').forEach(function (box) {
    var r = box.querySelector('input[type=range]'), hid = box.querySelector('input[type=hidden]'), big = box.querySelector('.ts-o b'), small = box.querySelector('.ts-o span'), Z;
    try { Z = JSON.parse(box.getAttribute('data-z')); } catch (e) { return; }
    var form = box.closest('form'), eq = form && form.querySelector('select[name=equipment]');
    function zone(v) { return v <= -15 ? Z[0] : v < 0 ? Z[1] : v <= 8 ? Z[2] : Z[3]; }
    function upd() {
      var v = +r.value, s = (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + ' °C', f = Math.round(v * 9 / 5 + 32), fs = (f < 0 ? '−' : '') + Math.abs(f) + ' °F';
      big.textContent = s; small.textContent = fs + ' · ' + zone(v); hid.value = box.hidden ? '' : s + ' / ' + fs + ' (' + zone(v) + ')';
      var k = (v - +r.min) / (+r.max - +r.min); box.style.setProperty('--k', k);
      box.setAttribute('data-band', v <= -15 ? 'deep' : v < 0 ? 'frozen' : v <= 8 ? 'chill' : 'amb');
    }
    function showFor() { if (!eq) return; box.hidden = eq.selectedIndex !== 0; upd(); }
    r.addEventListener('input', upd); if (eq) eq.addEventListener('change', showFor);
    if (form) form.addEventListener('reset', function () { setTimeout(function () { r.value = r.defaultValue; showFor(); }, 0); });
    showFor();
  });
})();
