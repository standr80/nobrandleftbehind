/*!
 * NBLB Blog Embed (blog.js) — full /blog page for any website.
 * Post list with a "Browse by topic" sidebar + numbered pagination, plus
 * deep-linkable post pages, all from the Content API v1 and auto-themed from
 * the tenant's brand. Self-contained, no dependencies.
 *
 * Usage (paste once on the page you want to be /blog):
 *   <div id="nblb-blog"></div>
 *   <script src="https://www.nobrandleftbehind.com/blog.js" data-tenant="designsonprint"></script>
 *
 * Optional attributes:
 *   data-target="#my-container"   element to render into (default "#nblb-blog")
 *   data-page-size="6"            posts per page (default 6)
 *   data-api="https://..."        API origin override (default = script origin)
 *   data-accent="#00aeef"         override theme primaryColor
 */
(function () {
  'use strict';

  function init(sc) {
    var tenant = sc.getAttribute('data-tenant') || '';
    if (!tenant) { console.warn('[NBLB blog] data-tenant required'); return; }

    var targetSel = sc.getAttribute('data-target') || '#nblb-blog';
    var pageSize = parseInt(sc.getAttribute('data-page-size') || '6', 10) || 6;
    var accentOverride = sc.getAttribute('data-accent') || '';
    var apiBase = sc.getAttribute('data-api') || '';
    if (!apiBase) { try { apiBase = new URL(sc.src).origin; } catch (e) { apiBase = ''; } }

    var mount = document.querySelector(targetSel);
    if (!mount) { console.warn('[NBLB blog] target not found: ' + targetSel); return; }

    var api = apiBase + '/api/content/v1/tenants/' + encodeURIComponent(tenant);

    var shadow = mount.attachShadow ? mount.attachShadow({ mode: 'open' }) : mount;
    var root = document.createElement('div');
    root.className = 'nblb';
    var styleEl = document.createElement('style');
    shadow.appendChild(styleEl);
    shadow.appendChild(root);

    var state = {
      theme: null,
      sidebar: null,       // { top_tags:[{tag,count}], all_tags:[...], has_more_tags }
      posts: [],
      page: 1,
      totalPages: 1,
      tag: null,
      showAllTags: false,
      loading: false,
    };

    // ---- helpers --------------------------------------------------------
    function esc(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function fmtDate(d) {
      if (!d) return '';
      try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); }
      catch (e) { return ''; }
    }
    function getJSON(url) {
      return fetch(url, { headers: { Accept: 'application/json' } }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
    }
    function postHref(slug) { return location.pathname + '?post=' + encodeURIComponent(slug); }
    function listHref() { return location.pathname; }
    function currentPostParam() {
      try { return new URLSearchParams(location.search).get('post'); } catch (e) { return null; }
    }
    function scrollTop() { try { mount.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {} }

    // ---- theme / styles -------------------------------------------------
    function applyTheme() {
      var t = (state.theme && state.theme.theme) || {};
      var accent = accentOverride || t.primaryColor || '#2563eb';
      var bg = t.backgroundColor || '#ffffff';
      var tx = t.textColor || '#1a1a1a';
      var headFont = t.headingFont || 'inherit';
      var bodyFont = t.bodyFont || 'inherit';
      styleEl.textContent = [
        ':host{all:initial}',
        '.nblb{--ac:' + accent + ';--bg:' + bg + ';--tx:' + tx + ';',
        'color:var(--tx);background:var(--bg);font-family:' + bodyFont + ';',
        'max-width:1100px;margin:0 auto;padding:1.5rem 1rem;box-sizing:border-box;line-height:1.6}',
        '.nblb *{box-sizing:border-box}',
        '.nblb a{color:inherit;text-decoration:none}',
        '.nblb h1,.nblb h2,.nblb h3{font-family:' + headFont + ';line-height:1.25}',
        // two-column layout
        '.layout{display:grid;grid-template-columns:1fr 260px;gap:2.5rem;align-items:start}',
        '.main{min-width:0}',
        // grid of cards
        '.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1.5rem}',
        '.card{display:block;border:1px solid rgba(0,0,0,.08);border-radius:14px;overflow:hidden;',
        'background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.06);transition:transform .15s,box-shadow .15s}',
        '.card:hover{transform:translateY(-3px);box-shadow:0 10px 30px rgba(0,0,0,.10)}',
        '.card img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;background:#f4f4f5}',
        '.card .body{padding:1rem 1.1rem 1.2rem}',
        '.card h2{font-size:1.02rem;font-weight:700;margin:0 0 .4rem}',
        '.card p{font-size:.85rem;color:rgba(0,0,0,.62);margin:0 0 .7rem;',
        'display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}',
        '.meta{font-size:.75rem;color:rgba(0,0,0,.5);display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}',
        '.chip{font-size:.62rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;',
        'color:var(--ac);background:color-mix(in srgb,var(--ac) 10%,transparent);padding:.2em .5em;border-radius:4px}',
        // sidebar
        '.side{border:1px solid rgba(0,0,0,.08);border-radius:14px;padding:1.25rem;background:#fff;position:sticky;top:1rem}',
        '.side h3{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;opacity:.5;margin:0 0 .9rem}',
        '.side .reset{display:block;font-size:.8rem;color:var(--ac);font-weight:600;margin-bottom:.75rem;cursor:pointer}',
        '.taglist{display:flex;flex-direction:column;gap:.15rem}',
        '.tagrow{display:flex;justify-content:space-between;align-items:center;gap:.5rem;padding:.4rem .55rem;',
        'border-radius:8px;font-size:.85rem;cursor:pointer;transition:background .15s}',
        '.tagrow:hover{background:rgba(0,0,0,.05)}',
        '.tagrow.on{background:color-mix(in srgb,var(--ac) 12%,transparent);font-weight:600}',
        '.tagrow .ct{font-size:.7rem;font-weight:600;color:var(--ac);background:color-mix(in srgb,var(--ac) 14%,transparent);',
        'padding:.12em .5em;border-radius:999px}',
        '.side .more{display:block;margin-top:.9rem;padding-top:.75rem;border-top:1px solid rgba(0,0,0,.07);',
        'font-size:.8rem;color:var(--ac);font-weight:600;cursor:pointer}',
        // pagination
        '.pager{display:flex;justify-content:center;align-items:center;gap:.4rem;flex-wrap:wrap;margin-top:2.5rem}',
        '.pager a,.pager span{padding:.45rem .8rem;border-radius:8px;border:1px solid var(--ac);font-size:.85rem;cursor:pointer;color:var(--ac)}',
        '.pager .cur{background:var(--ac);color:#fff;font-weight:700}',
        '.pager .gap{border:none;cursor:default;padding:.45rem .3rem}',
        '.pager .nav{font-weight:600}',
        // single post
        '.back{display:inline-block;margin-bottom:1.25rem;font-size:.875rem;color:var(--ac);cursor:pointer}',
        '.post-hero{width:100%;max-height:420px;object-fit:cover;border-radius:14px;margin-bottom:1.5rem;background:#f4f4f5}',
        '.post{max-width:760px;margin:0 auto}',
        '.post h1{font-size:2rem;font-weight:800;margin:0 0 .75rem}',
        '.post .meta{margin-bottom:1.5rem}',
        '.content{font-size:1.05rem}',
        '.content p{margin:0 0 1.1em}',
        '.content h2{font-size:1.4rem;font-weight:700;margin:1.6em 0 .5em}',
        '.content h3{font-size:1.15rem;font-weight:700;margin:1.4em 0 .4em}',
        '.content img{max-width:100%;height:auto;border-radius:10px;margin:1em 0}',
        '.content ul,.content ol{padding-left:1.4em;margin:0 0 1.1em}',
        '.content li{margin:.3em 0}',
        '.content a{color:var(--ac);text-decoration:underline}',
        '.content blockquote{border-left:3px solid var(--ac);margin:1.2em 0;padding:.2em 1em;color:rgba(0,0,0,.7)}',
        '.content code{background:#f4f4f5;padding:.1em .35em;border-radius:4px;font-size:.9em}',
        '.content table{border-collapse:collapse;width:100%;margin:1.2em 0;font-size:.95em}',
        '.content th,.content td{border:1px solid rgba(0,0,0,.12);padding:.5em .7em;text-align:left}',
        '.authorbox{margin-top:2.5rem;padding:1.25rem 1.5rem;border:1px solid rgba(0,0,0,.1);border-left:3px solid var(--ac);border-radius:10px;background:rgba(0,0,0,.02)}',
        '.authorbox .an{margin:0 0 .35rem;font-weight:700;font-size:.95rem}',
        '.authorbox .an span{font-weight:500;opacity:.6}',
        '.authorbox .ab{margin:0 0 .5rem;font-size:.9rem;line-height:1.6;opacity:.8}',
        '.authorbox .al{margin:0;display:flex;gap:1rem;flex-wrap:wrap}',
        '.authorbox .al a{font-size:.85rem;color:var(--ac);text-decoration:underline}',
        '.footer{margin-top:3rem;padding-top:1.5rem;border-top:1px solid rgba(0,0,0,.1);font-size:.8rem;color:rgba(0,0,0,.5)}',
        '.state{padding:3rem 1rem;text-align:center;color:rgba(0,0,0,.55)}',
        '.spin{width:2rem;height:2rem;border:3px solid rgba(0,0,0,.12);border-top-color:var(--ac);',
        'border-radius:50%;animation:nblbspin .7s linear infinite;margin:3rem auto}',
        '@keyframes nblbspin{to{transform:rotate(360deg)}}',
        '@media(max-width:768px){.layout{grid-template-columns:1fr;gap:1.5rem}.grid{grid-template-columns:1fr}',
        '.side{position:static}.post h1{font-size:1.5rem}.content{font-size:1rem}}',
      ].join('');
    }

    // ---- rendering ------------------------------------------------------
    function loading() { root.innerHTML = '<div class="spin"></div>'; }
    function stateMsg(m) { root.innerHTML = '<div class="state">' + esc(m) + '</div>'; }

    function cardHTML(p) {
      var img = p.hero_image
        ? '<img src="' + esc(p.hero_image) + '" alt="' + esc(p.hero_image_alt || p.title) + '" loading="lazy">'
        : '';
      var chips = (p.tags || []).slice(0, 2).map(function (t) {
        return '<span class="chip">' + esc(t) + '</span>';
      }).join('');
      return '<a class="card" href="' + esc(postHref(p.slug)) + '" data-slug="' + esc(p.slug) + '">' +
        img + '<div class="body"><h2>' + esc(p.title) + '</h2>' +
        (p.excerpt ? '<p>' + esc(p.excerpt) + '</p>' : '') +
        '<div class="meta">' + chips + '<span>' + esc(fmtDate(p.published_at)) + '</span></div>' +
        '</div></a>';
    }

    function sidebarHTML() {
      var sb = state.sidebar;
      if (!sb || !sb.all_tags || !sb.all_tags.length) return '';
      var list = state.showAllTags ? sb.all_tags : sb.top_tags;
      var rows = list.map(function (t) {
        var on = state.tag === t.tag ? ' on' : '';
        return '<div class="tagrow' + on + '" data-tag="' + esc(t.tag) + '">' +
          '<span>' + esc(t.tag) + '</span><span class="ct">' + t.count + '</span></div>';
      }).join('');
      var reset = state.tag ? '<a class="reset" data-reset="1">&larr; All posts</a>' : '';
      var more = '';
      if (sb.has_more_tags) {
        more = '<a class="more" data-toggle="1">' +
          (state.showAllTags ? 'Show fewer' : 'All topics &rarr;') + '</a>';
      }
      return '<aside class="side"><h3>Browse by topic</h3>' + reset +
        '<div class="taglist">' + rows + '</div>' + more + '</aside>';
    }

    function pagerHTML() {
      var tp = state.totalPages;
      if (tp <= 1) return '';
      var cur = state.page;
      var parts = [];
      if (cur > 1) parts.push('<a class="nav" data-page="' + (cur - 1) + '">&larr; Prev</a>');
      // windowed page numbers
      var pages = [];
      for (var i = 1; i <= tp; i++) {
        if (i === 1 || i === tp || (i >= cur - 1 && i <= cur + 1)) pages.push(i);
      }
      var last = 0;
      pages.forEach(function (i) {
        if (last && i - last > 1) parts.push('<span class="gap">…</span>');
        parts.push(i === cur
          ? '<span class="cur">' + i + '</span>'
          : '<a data-page="' + i + '">' + i + '</a>');
        last = i;
      });
      if (cur < tp) parts.push('<a class="nav" data-page="' + (cur + 1) + '">Next &rarr;</a>');
      return '<div class="pager">' + parts.join('') + '</div>';
    }

    function footerHTML() {
      var f = state.theme && state.theme.footer;
      return f ? '<div class="footer">' + esc(f) + '</div>' : '';
    }

    function renderList() {
      var main;
      if (!state.posts.length) {
        main = '<div class="state">' + (state.tag ? 'No posts tagged “' + esc(state.tag) + '”.' : 'No posts yet.') + '</div>';
      } else {
        main = '<div class="grid">' + state.posts.map(cardHTML).join('') + '</div>' + pagerHTML();
      }
      root.innerHTML = '<div class="layout"><div class="main">' + main + '</div>' +
        sidebarHTML() + '</div>' + footerHTML();

      // card links -> SPA nav
      Array.prototype.forEach.call(root.querySelectorAll('.card'), function (a) {
        a.addEventListener('click', function (e) {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
          e.preventDefault();
          go(a.getAttribute('data-slug'));
        });
      });
      // tag rows
      Array.prototype.forEach.call(root.querySelectorAll('.tagrow'), function (r) {
        r.addEventListener('click', function () { selectTag(r.getAttribute('data-tag')); });
      });
      // reset / toggle
      var resetEl = root.querySelector('.reset');
      if (resetEl) resetEl.addEventListener('click', function () { selectTag(null); });
      var toggleEl = root.querySelector('.more');
      if (toggleEl) toggleEl.addEventListener('click', function () {
        state.showAllTags = !state.showAllTags; renderList();
      });
      // pager
      Array.prototype.forEach.call(root.querySelectorAll('.pager [data-page]'), function (a) {
        a.addEventListener('click', function () { gotoPage(parseInt(a.getAttribute('data-page'), 10)); });
      });
    }

    function renderPost(p) {
      try { document.title = p.title; } catch (e) {}
      var chips = (p.tags || []).map(function (t) { return '<span class="chip">' + esc(t) + '</span>'; }).join('');
      var hero = p.hero_image
        ? '<img class="post-hero" src="' + esc(p.hero_image) + '" alt="' + esc(p.hero_image_alt || p.title) + '">'
        : '';
      var byline = p.author
        ? '<span>By ' + esc(p.author) + (p.author_title ? ', ' + esc(p.author_title) : '') + '</span>'
        : '';
      root.innerHTML =
        '<article class="post"><a class="back">&larr; All posts</a>' + hero +
        '<h1>' + esc(p.title) + '</h1>' +
        '<div class="meta"><span>' + esc(fmtDate(p.published_at)) + '</span>' + byline + chips + '</div>' +
        '<div class="content">' + (p.body_html || '<p>No content.</p>') + '</div>' +
        authorBoxHTML(p) +
        '</article>' + footerHTML();
      root.querySelector('.back').addEventListener('click', function (e) { e.preventDefault(); goList(); });
      injectJsonLd(p);
      scrollTop();
    }

    function authorBoxHTML(p) {
      if (!p.author_bio && !(p.author_links && p.author_links.length)) return '';
      var links = (p.author_links || []).map(function (l) {
        return '<a href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer me">' +
          esc(l.label || l.url) + '</a>';
      }).join('');
      return '<div class="authorbox">' +
        '<p class="an">' + esc(p.author || '') + (p.author_title ? ' <span>· ' + esc(p.author_title) + '</span>' : '') + '</p>' +
        (p.author_bio ? '<p class="ab">' + esc(p.author_bio) + '</p>' : '') +
        (links ? '<p class="al">' + links + '</p>' : '') +
        '</div>';
    }

    // Best-effort BlogPosting + Person JSON-LD injected into the host <head>.
    // (Client-side, so weaker than server-rendered schema — the hosted blog
    // emits the authoritative version.)
    function injectJsonLd(p) {
      try {
        var prev = document.getElementById('nblb-jsonld');
        if (prev) prev.remove();
        var person = { '@type': 'Person', name: p.author || 'Author' };
        if (p.author_title) person.jobTitle = p.author_title;
        var sameAs = (p.author_links || []).map(function (l) { return l.url; }).filter(Boolean);
        if (sameAs.length) person.sameAs = sameAs;
        var ld = {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: p.title,
          datePublished: p.published_at || undefined,
          image: p.hero_image || undefined,
          author: person,
          publisher: { '@type': 'Organization', name: (state.theme && state.theme.name) || tenant },
          mainEntityOfPage: location.href,
        };
        var s = document.createElement('script');
        s.type = 'application/ld+json';
        s.id = 'nblb-jsonld';
        s.textContent = JSON.stringify(ld);
        document.head.appendChild(s);
      } catch (e) {}
    }

    // ---- data + routing -------------------------------------------------
    function loadSidebar() {
      if (state.sidebar) return Promise.resolve();
      return getJSON(api + '/tags').then(function (d) { state.sidebar = d; }).catch(function () { state.sidebar = null; });
    }

    function loadList() {
      if (state.loading) return Promise.resolve();
      state.loading = true;
      var url = api + '/posts?page=' + state.page + '&per_page=' + pageSize;
      if (state.tag) url += '&tag=' + encodeURIComponent(state.tag);
      return getJSON(url).then(function (d) {
        state.posts = d.posts || [];
        state.totalPages = d.total_pages || 1;
        state.loading = false;
      }).catch(function () { state.loading = false; state.posts = []; state.totalPages = 1; });
    }

    function showListView() {
      loading();
      Promise.all([loadList(), loadSidebar()]).then(renderList);
    }

    function selectTag(tag) {
      state.tag = tag; state.page = 1;
      showListView();
    }
    function gotoPage(n) {
      if (!n || n === state.page) return;
      state.page = n;
      loadList().then(function () { renderList(); scrollTop(); });
    }

    function showPost(slug) {
      loading();
      getJSON(api + '/posts/' + encodeURIComponent(slug))
        .then(renderPost)
        .catch(function () { stateMsg('That post could not be found.'); });
    }

    function go(slug) {
      try { history.pushState({ post: slug }, '', postHref(slug)); } catch (e) {}
      showPost(slug);
    }
    function goList() {
      try { history.pushState({}, '', listHref()); } catch (e) {}
      showListView();
    }
    function route() {
      var slug = currentPostParam();
      if (slug) showPost(slug); else showListView();
    }
    window.addEventListener('popstate', route);

    // ---- boot -----------------------------------------------------------
    loading();
    getJSON(api + '/theme')
      .then(function (t) { state.theme = t; })
      .catch(function () { state.theme = null; })
      .then(function () { applyTheme(); route(); });
  }

  var cur = document.currentScript;
  if (cur && cur.getAttribute('data-tenant') && !cur.getAttribute('data-nblb-init')) {
    cur.setAttribute('data-nblb-init', '1');
    init(cur);
  } else {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var s = scripts[i];
      if (s.src && s.src.indexOf('blog.js') !== -1 && s.getAttribute('data-tenant') && !s.getAttribute('data-nblb-init')) {
        s.setAttribute('data-nblb-init', '1');
        init(s);
      }
    }
  }
})();
