/* groupkangaroo.com: menu, dispatch board, and forms that post to /api/contact. */
(function () {
  var L = document.documentElement.lang === 'fr' ? 'fr' : 'en';
  var T = window.KG_T || {};
  // mobile menu
  var mb = document.getElementById('menuBtn'), nav = document.getElementById('nav');
  if (mb) mb.addEventListener('click', function () { var o = nav.classList.toggle('open'); mb.setAttribute('aria-expanded', o ? 'true' : 'false'); });
  if (nav) nav.addEventListener('click', function (e) { if (e.target.tagName === 'A') { nav.classList.remove('open'); mb && mb.setAttribute('aria-expanded', 'false'); } });

  // dispatch board: statuses advance every few seconds (sample lanes)
  var lanes = document.querySelectorAll('.lane'), order = ['go', 'at', 'ok'];
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
