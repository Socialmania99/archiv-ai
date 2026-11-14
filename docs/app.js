(function () {
  var repo = window.ARCHIV_AI_REPO || 'socialmania99/archiv-ai';
  var base = 'https://github.com/' + repo;
  document.querySelectorAll('[data-gh]').forEach(function (a) { a.href = base + a.getAttribute('data-gh'); a.target = '_blank'; a.rel = 'noopener'; });
  document.querySelectorAll('[data-repo]').forEach(function (s) { s.textContent = repo; });
  var yr = document.getElementById('yr'); if (yr) yr.textContent = new Date().getFullYear();


  // click-to-load YouTube video (no outside request until the visitor presses play)
  var vp = document.getElementById('vplay');
  if (vp) {
    vp.addEventListener('click', function () {
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + vp.getAttribute('data-yt') + '?autoplay=1&rel=0&modestbranding=1';
      f.title = 'Archiv AI walkthrough video';
      f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
      f.setAttribute('allowfullscreen', '');
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      vp.parentNode.replaceChild(f, vp);
    });
  }

  // mobile menu
  var menu = document.getElementById('menu'), nav = document.getElementById('nav');
  if (menu) {
    menu.addEventListener('click', function () { var o = nav.classList.toggle('open'); menu.setAttribute('aria-expanded', String(o)); });
    nav.addEventListener('click', function (e) { if (e.target.tagName === 'A') { nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); } });
  }

  // screenshot tabs
  var shots = [
    ['assets/shot-dashboard-light.webp', 'Totals with hover count-ups per day, an activity chart, recent chats, quick find, folders and the new light/dark switch.'],
    ['assets/shot-inbox.webp', 'The Inbox: each export arrives as a recent copy with suggested tags and Save to vault, Preview, Export and Discard.'],
    ['assets/shot-library.webp', 'The library: search every saved chat, filter by site, folder or tag, and find text inside a chat.'],
    ['assets/shot-export.webp', 'The export page: one format menu, message selection, redaction, themes and a scrollable preview.'],
    ['assets/shot-sites.webp', 'The Supported sites directory: 239 tools with logos, status and filters.'],
    ['assets/shot-dashboard-dark.webp', 'The same dashboard in dark mode: navy track, blue moon knob.']
  ];
  var tabs = document.querySelectorAll('.tab'), img = document.getElementById('shot'), cap = document.getElementById('cap');
  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      var i = Number(t.dataset.i);
      tabs.forEach(function (x) { x.setAttribute('aria-selected', String(x === t)); });
      img.src = shots[i][0]; img.alt = t.textContent + ' screenshot'; cap.textContent = shots[i][1];
    });
  });

  // reveal on scroll
  var els = document.querySelectorAll('.rv');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: .12 });
    els.forEach(function (e) { io.observe(e); });
  } else els.forEach(function (e) { e.classList.add('in'); });
})();
