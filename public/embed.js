(function(){
'use strict';

function initWidget(sc){
  var tenant=sc.getAttribute('data-tenant')||'';
  var mode=sc.getAttribute('data-mode')||'feed';
  var limit=parseInt(sc.getAttribute('data-limit')||'10',10);
  var theme=sc.getAttribute('data-theme')||'light';
  var accent=sc.getAttribute('data-accent')||'#2563eb';
  var showImg=sc.getAttribute('data-show-images')!=='false';
  var showAuth=sc.getAttribute('data-show-author')!=='false';
  var slugAttr=sc.getAttribute('data-slug')||'';
  var openMode=sc.getAttribute('data-open')||'same-tab';
  var font=sc.getAttribute('data-font')||'inherit';
  var base=sc.src.replace(/\/embed\.js(\?.*)?$/,'');

  if(!tenant){console.warn('[Clem embed] data-tenant required');return;}

  var host=document.createElement('div');
  sc.parentNode.insertBefore(host,sc.nextSibling);
  var shadow=host.attachShadow({mode:'open'});

  var dark=theme==='dark'||(theme==='auto'&&window.matchMedia('(prefers-color-scheme:dark)').matches);
  var bg=dark?'#18181b':'#fff';
  var bg2=dark?'#27272a':'#f4f4f5';
  var tx=dark?'#f4f4f5':'#18181b';
  var tx2=dark?'#a1a1aa':'#71717a';
  var br=dark?'#3f3f46':'#e4e4e7';

  var st=document.createElement('style');
  st.textContent=':host{--ac:'+accent+';font-family:'+font+';box-sizing:border-box}'
  +'*{box-sizing:border-box;margin:0;padding:0}'
  +'.w{background:'+bg+';color:'+tx+';padding:1rem}'
  +'.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem}'
  +'.c{background:'+bg2+';border:1px solid '+br+';border-radius:12px;overflow:hidden;cursor:pointer;transition:transform .15s,box-shadow .15s}'
  +'.c:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.12)}'
  +'.c img{width:100%;height:160px;object-fit:cover;display:block}'
  +'.cb{padding:.875rem 1rem 1rem}'
  +'.ct{font-size:.9375rem;font-weight:600;line-height:1.35;margin-bottom:.375rem;color:'+tx+'}'
  +'.cx{font-size:.8125rem;color:'+tx2+';line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:.625rem}'
  +'.cm{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}'
  +'.cd{font-size:.75rem;color:'+tx2+'}'
  +'.tg{font-size:.6875rem;background:var(--ac);color:#fff;padding:.15em .5em;border-radius:4px}'
  +'.ca{font-size:.75rem;color:'+tx2+';margin-top:.25rem}'
  +'.err{padding:2rem;text-align:center;color:'+tx2+';font-size:.875rem}'
  +'.ov{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:2147483647;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:2rem 1rem}'
  +'.mo{background:'+bg+';border-radius:16px;max-width:720px;width:100%;padding:2rem;position:relative;margin:auto}'
  +'.mc{position:absolute;top:1rem;right:1rem;background:'+bg2+';border:1px solid '+br+';border-radius:50%;width:2rem;height:2rem;cursor:pointer;font-size:1rem;color:'+tx+';display:flex;align-items:center;justify-content:center}'
  +'.mo h1{font-size:1.5rem;font-weight:700;line-height:1.3;margin-bottom:1rem;color:'+tx+'}'
  +'.mo img{width:100%;height:auto;border-radius:8px;margin-bottom:1rem}'
  +'.mb{font-size:.9375rem;line-height:1.7;color:'+tx+'}'
  +'.mb p{margin-bottom:1em}.mb h2{font-size:1.15em;font-weight:600;margin:1.25em 0 .5em}'
  +'.mb ul,.mb ol{padding-left:1.25em;margin-bottom:1em}.mb a{color:var(--ac)}'
  +'.mb code{background:'+bg2+';padding:.1em .3em;border-radius:3px;font-size:.875em}'
  +'.sp{width:2rem;height:2rem;border:3px solid '+br+';border-top-color:var(--ac);border-radius:50%;animation:spin .7s linear infinite;margin:2rem auto}'
  +'@keyframes spin{to{transform:rotate(360deg)}}';
  shadow.appendChild(st);

  var wrap=document.createElement('div');
  wrap.className='w';
  shadow.appendChild(wrap);

  function fmt(d){
    if(!d)return'';
    try{return new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});}catch(e){return d;}
  }
  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

  function card(post){
    var img=(showImg&&post.heroImage)?'<img src="'+esc(post.heroImage)+'" alt="'+esc(post.heroImageAlt||post.title)+'" loading="lazy">':'';
    var tags=(post.tags||[]).slice(0,3).map(function(t){return'<span class="tg">'+esc(t)+'</span>';}).join('');
    var auth=(showAuth&&post.author)?'<p class="ca">By '+esc(post.author)+'</p>':'';
    var ex=post.excerpt?'<p class="cx">'+esc(post.excerpt)+'</p>':'';
    return'<div class="c">'+img+'<div class="cb"><p class="ct">'+esc(post.title)+'</p>'+ex+'<div class="cm"><span class="cd">'+esc(fmt(post.date))+'</span>'+tags+'</div>'+auth+'</div></div>';
  }

  function modal(post){
    var ov=document.createElement('div');
    ov.className='ov';
    ov.innerHTML='<div class="mo"><button class="mc" aria-label="Close">&#x2715;</button>'
      +(showImg&&post.heroImage?'<img src="'+esc(post.heroImage)+'" alt="'+esc(post.heroImageAlt||'')+'">':"")
      +'<h1>'+esc(post.title)+'</h1><div class="sp"></div></div>';
    shadow.appendChild(ov);
    function close(){if(ov.parentNode)shadow.removeChild(ov);document.removeEventListener('keydown',onKey);}
    ov.querySelector('.mc').addEventListener('click',close);
    ov.addEventListener('click',function(e){if(e.target===ov)close();});
    function onKey(e){if(e.key==='Escape')close();}
    document.addEventListener('keydown',onKey);
    fetch(base+'/api/feed/'+encodeURIComponent(tenant)+'/'+encodeURIComponent(post.slug))
      .then(function(r){if(!r.ok)throw 0;return r.json();})
      .then(function(d){
        var m=ov.querySelector('.mo');
        var sp=m.querySelector('.sp');if(sp)sp.remove();
        var bd=document.createElement('div');bd.className='mb';bd.innerHTML=d.body_html||'<p>No content.</p>';
        m.appendChild(bd);
      })
      .catch(function(){var s=ov.querySelector('.sp');if(s)s.outerHTML='<p class="err">Failed to load post.</p>';});
  }

  function render(posts){
    if(!posts||!posts.length){wrap.innerHTML='<p class="err">No posts found.</p>';return;}
    var items=mode==='latest'?posts.slice(0,1):posts.slice(0,limit);
    var g=document.createElement('div');g.className=mode==='latest'?'':'g';
    items.forEach(function(p){
      var tmp=document.createElement('div');tmp.innerHTML=card(p);
      var el=tmp.firstChild;
      el.addEventListener('click',function(){
        if(openMode==='modal')modal(p);
        else if(openMode==='new-tab')window.open(p.url,'_blank','noopener');
        else location.href=p.url;
      });
      g.appendChild(el);
    });
    wrap.innerHTML='';wrap.appendChild(g);
  }

  function err(msg){wrap.innerHTML='<p class="err">'+esc(msg)+'</p>';}

  wrap.innerHTML='<div class="sp"></div>';

  if(mode==='single'&&slugAttr){
    fetch(base+'/api/feed/'+encodeURIComponent(tenant)+'/'+encodeURIComponent(slugAttr))
      .then(function(r){if(!r.ok)throw 0;return r.json();})
      .then(function(p){render([p]);})
      .catch(function(){err('Post not found.');});
  }else{
    fetch(base+'/api/feed/'+encodeURIComponent(tenant))
      .then(function(r){if(!r.ok)throw new Error(r.status===404?'Tenant not found.':'Feed unavailable.');return r.json();})
      .then(function(d){render(d.posts);})
      .catch(function(e){err(e.message||'Failed to load posts.');});
  }
}

// ── Bootstrap ────────────────────────────────────────────────────────────────
// If currentScript is available (synchronous load), initialise just this one.
// If null (async/dynamic injection by a CMS), all instances are already in the
// DOM so we initialise every uninitialised embed script in one pass.
var cur=document.currentScript;
if(cur){
  cur.setAttribute('data-clem-init','1');
  initWidget(cur);
}else{
  var all=document.querySelectorAll('script[src*="embed.js"][data-tenant]:not([data-clem-init])');
  for(var i=0;i<all.length;i++){all[i].setAttribute('data-clem-init','1');initWidget(all[i]);}
}
})();
