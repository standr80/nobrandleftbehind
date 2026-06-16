/*!
 * NBLB Blog Embed (blog.js) — full /blog page for any website.
 * Renders a post list + deep-linkable post pages from the Content API v1,
 * auto-themed from the tenant's brand tokens. Self-contained, no deps.
 *
 * Usage (paste once on the page you want to be /blog):
 *   <div id="nblb-blog"></div>
 *   <script src="https://www.nobrandleftbehind.com/blog.js" data-tenant="designsonprint"></script>
 *
 * Optional attributes:
 *   data-target="#my-container"   element to render into (default "#nblb-blog")
 *   data-page-size="12"           posts per page (default 12)
 *   data-api="https://..."        API origin override (default = script origin)
 *   data-accent="#00aeef"         override theme primaryColor
 */
(function () {
  'use strict';

  function init(sc) {
    var tenant = sc.getAttribute('data-tenant') || '';
    if (!tenant) { console.warn('[NBLB blog] data-tenant required'); return; }

    var targetSel = sc.getAttribute('data-target') || '#nblb-blog';
    var pageSize = parseInt(sc.getAttribute('data-page-size') || '12', 10) || 12;
    var accentOverride = sc.getAttribute('data-accent') || '';
    var apiBase = sc.getAttribute('data-api') || '';
    if (!apiBase) { try { apiBase = new URL(sc.src).origin; } catch (e) { apiBase = ''; } }

    var mount = document.querySelector(targetSel);
    if (!mount) { console.warn('[NBLB blog] target not found: ' + targetSel); return; }

    var api = apiBase + '/api/content/v1/tenants/' + encodeURIComponent(tenant);

    // Shadow DOM isolates our styles from the host page (and vice versa).
    var shadow = mount.attachShadow ? mount.attachShadow({ mode: 'open' }) : mount;
    var root = document.createElement('div');
    root.className = 'nblb';
    var styleEl = document.createElement('style');
    shadow.appendChild(styleEl);
    shadow.appendChild(root);

    var state = {
      theme: null,
      posts: [],
      cursor: null,
      tag: null,
      loading: false,
      allTags: {},
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
    function postHref(slug) {
      return location.pathname + '?post=' + encodeURIComponent(slug);
    }
    function listHref() { return location.pathname; }
    function currentPostParam() {
      try { return new URLSearchParams(location.search).get('post'); } catch (e) { return null; }
    }

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
        'max-width:1080px;margin:0 auto;padding:1.5rem 1rem;box-sizing:border-box;line-height:1.6}',
        '.nblb *{box-sizing:border-box}',
        '.nblb a{color:inherit;text-decoration:none}',
        '.nblb h1,.nblb h2,.nblb h3{font-family:' + headFont + ';line-height:1.25}',
        // tag bar
        '.tags{display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:1.5rem}',
        '.tag{font-size:.8125rem;padding:.3em .75em;border:1px solid var(--ac);color:var(--ac);',
        'background:transparent;border-radius:999px;cursor:pointer}',
        '.tag.on{background:var(--ac);color:#fff}',
        // grid
        '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1.5rem}',
        '.card{display:block;border:1px solid rgba(0,0,0,.08);border-radius:14px;overflow:hidden;',
        'background:#fff;transition:transform .15s,box-shadow .15s}',
        '.card:hover{transform:translateY(-3px);box-shadow:0 10px 30px rgba(0,0,0,.10)}',
        '.card img{width:100%;height:180px;object-fit:cover;display:block;background:#f4f4f5}',
        '.card .body{padding:1rem 1.1rem 1.2rem}',
        '.card h2{font-size:1.05rem;font-weight:700;margin:0 0 .4rem}',
        '.card p{font-size:.875rem;color:rgba(0,0,0,.62);margin:0 0 .75rem;',
        'display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}',
        '.meta{font-size:.75rem;color:rgba(0,0,0,.5);display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}',
        '.chip{font-size:.7rem;background:var(--ac);color:#fff;padding:.15em .55em;border-radius:5px}',
        // load more
        '.more{display:block;margin:2rem auto 0;padding:.7em 1.5em;border:1px solid var(--ac);',
        'color:var(--ac);background:transparent;border-radius:999px;font-size:.9rem;cursor:pointer}',
        // single post
        '.back{display:inline-block;margin-bottom:1.25rem;font-size:.875rem;color:var(--ac);cursor:pointer}',
        '.post-hero{width:100%;max-height:420px;object-fit:cover;border-radius:14px;margin-bottom:1.5rem;background:#f4f4f5}',
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
        '.footer{margin-top:3rem;padding-top:1.5rem;border-top:1px solid rgba(0,0,0,.1);',
        'font-size:.8rem;color:rgba(0,0,0,.5)}',
        '.state{padding:3rem 1rem;text-align:center;color:rgba(0,0,0,.55)}',
        '.spin{width:2rem;height:2rem;border:3px solid rgba(0,0,0,.12);border-top-color:var(--ac);',
        'border-radius:50%;animation:nblbspin .7s linear infinite;margin:3rem auto}',
        '@keyframes nblbspin{to{transform:rotate(360deg)}}',
        '@media(max-width:600px){.post h1{font-size:1.5rem}.content{font-size:1rem}}',
      ].join('');
    }

    // ---- rendering ------------------------------------------------------
    function loading() { root.innerHTML = '<div class="spin"></div>'; }
    function stateMsg(m) { root.innerHTML = '<div class="state">' + esc(m) + '</div>'; }

    function tagBar() {
      var names = Object.keys(state.allTags);
      if (!names.length) return '';
      var chips = ['<button class="tag' + (state.tag ? '' : ' on') + '" data-tag="">All</button>'];
      names.sort();
      for (var i = 0; i < names.length; i++) {
        chips.push('<button class="tag' + (state.tag === names[i] ? ' on' : '') +
          '" data-tag="' + esc(names[i]) + '">' + esc(names[i]) + '</button>');
      }
      return '<div class="tags">' + chips.join('') + '</div>';
    }

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
        '<div class="meta"><span>' + esc(fmtDate(p.published_at)) + '</span>' + chips + '</div>' +
        '</div></a>';
    }

    function renderList() {
      var html = tagBar();
      if (!state.posts.length) {
        html += '<div class="state">No posts yet.</div>';
      } else {
        html += '<div class="grid">' + state.posts.map(cardHTML).join('') + '</div>';
        if (state.cursor) html += '<button class="more">Load more posts</button>';
      }
      html += footerHTML();
      root.innerHTML = html;

      // tag chips
      Array.prototype.forEach.call(root.querySelectorAll('.tag'), function (b) {
        b.addEventListener('click', function () {
          var t = b.getAttribute('data-tag') || null;
          if (t === state.tag) return;
          state.tag = t;
          state.posts = []; state.cursor = null;
          loading();
          loadPage(true);
        });
      });
      // card links -> SPA nav
      Array.prototype.forEach.call(root.querySelectorAll('.card'), function (a) {
        a.addEventListener('click', function (e) {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return; // let new-tab work
          e.preventDefault();
          go(a.getAttribute('data-slug'));
        });
      });
      // load more
      var moreBtn = root.querySelector('.more');
      if (moreBtn) moreBtn.addEventListener('click', function () {
        moreBtn.textContent = 'Loading...'; loadPage(false);
      });
    }

    function footerHTML() {
      var f = state.theme && state.theme.footer;
      return f ? '<div class="footer">' + esc(f) + '</div>' : '';
    }

    function renderPost(p) {
      try { document.title = p.title; } catch (e) {}
      var chips = (p.tags || []).map(function (t) { return '<span class="chip">' + esc(t) + '</span>'; }).join('');
      var hero = p.hero_image
        ? '<img class="post-hero" src="' + esc(p.hero_image) + '" alt="' + esc(p.hero_image_alt || p.title) + '">'
        : '';
      root.innerHTML =
        '<a class="back">&larr; All posts</a>' +
        '<article class="post">' + hero +
        '<h1>' + esc(p.title) + '</h1>' +
        '<div class="meta"><span>' + esc(fmtDate(p.published_at)) + '</span>' +
        (p.author ? '<span>By ' + esc(p.author) + '</span>' : '') + chips + '</div>' +
        '<div class="content">' + (p.body_html || '<p>No content.</p>') + '</div>' +
        '</article>' + footerHTML();
      root.querySelector('.back').addEventListener('click', function (e) {
        e.preventDefault(); goList();
      });
      try { window.scrollTo(0, 0); } catch (e) {}
    }

    // ---- data + routing -------------------------------------------------
    function indexTags(posts) {
      posts.forEach(function (p) {
        (p.tags || []).forEach(function (t) { state.allTags[t] = true; });
      });
    }

    function loadPage(replace) {
      if (state.loading) return;
      state.loading = true;
      var url = api + '/posts?limit=' + pageSize;
      if (state.tag) url += '&tag=' + encodeURIComponent(state.tag);
      if (state.cursor && !replace) url += '&cursor=' + encodeURIComponent(state.cursor);
      getJSON(url).then(function (d) {
        state.posts = replace ? (d.posts || []) : state.posts.concat(d.posts || []);
        state.cursor = d.next_cursor || null;
        indexTags(d.posts || []);
        state.loading = false;
        renderList();
      }).catch(function () {
        state.loading = false;
        stateMsg('Unable to load posts right now.');
      });
    }

    function showPost(slug) {
      loading();
      getJSON(api + '/posts/' + encodeURIComponent(slug)).then(function (p) {
        renderPost(p);
      }).catch(function () {
        stateMsg('That post could not be found.');
      });
    }

    // SPA navigation that keeps shareable URLs (?post=slug)
    function go(slug) {
      try { history.pushState({ post: slug }, '', postHref(slug)); } catch (e) {}
      showPost(slug);
    }
    function goList() {
      try { history.pushState({}, '', listHref()); } catch (e) {}
      if (state.posts.length) renderList(); else { loading(); loadPage(true); }
    }
    function route() {
      var slug = currentPostParam();
      if (slug) showPost(slug);
      else { if (state.posts.length) renderList(); else { loading(); loadPage(true); } }
    }
    window.addEventListener('popstate', route);

    // ---- boot -----------------------------------------------------------
    loading();
    getJSON(api + '/theme')
      .then(function (t) { state.theme = t; })
      .catch(function () { state.theme = null; })
      .then(function () { applyTheme(); route(); });
  }

  // Find this script tag (currentScript fails for async/defer in some cases).
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
