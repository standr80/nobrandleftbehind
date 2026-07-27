// Bailey stage 5 — build the published gallery page body_html.
//
// Structure (per spec):
//   1. Clem intro (stage 6 — renders whatever is in body_mdx, empty until then)
//   2. Responsive grid of <figure><img/><figcaption/></figure>
//      - src = master, srcset = transform URLs, explicit width/height (CLS —
//        critical on an all-image page), loading=lazy (first two eager)
//   3. ONE ImageGallery JSON-LD node with associatedMedia ImageObjects
//
// The Related-reading block is appended by the Shopify adapter (same
// delimited mechanism as posts/FAQs). Lightbox: pending spike #2, v1 ships
// the safe bottom rung — each figure links to the full-size master (SEO
// value identical on every rung of the ladder).

import {
  TRANSFORM_THUMB_WIDTH,
  USE_TRANSFORM_URLS,
  galleryTransformUrl,
  type GalleryImage,
} from './constants'

const SRCSET_WIDTHS = [480, 800, 1400]

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function srcsetFor(image: GalleryImage, supabaseUrl: string): string {
  if (!image.master_path || !image.width) return ''
  if (USE_TRANSFORM_URLS) {
    const entries = SRCSET_WIDTHS.filter((w) => w < image.width!).map(
      (w) => `${galleryTransformUrl(supabaseUrl, image.master_path!, w)} ${w}w`,
    )
    entries.push(`${image.url} ${image.width}w`)
    return entries.join(', ')
  }
  const entries = (image.variants ?? []).map((v) => `${v.url} ${v.width}w`)
  entries.push(`${image.url} ${image.width}w`)
  return entries.join(', ')
}

/** The figure grid + scoped styles. */
export function buildGalleryGridHtml(images: GalleryImage[], supabaseUrl: string): string {
  const figures = images
    .map((img, idx) => {
      if (!img.url || !img.width || !img.height) return ''
      const srcset = srcsetFor(img, supabaseUrl)
      const eager = idx < 2
      const alt = esc(img.alt ?? '')
      const caption = img.caption ? `<figcaption>${esc(img.caption)}</figcaption>` : ''
      return (
        `<figure class="nblb-g-item">` +
        `<a href="${img.url}" target="_blank" rel="noopener">` +
        `<img src="${img.url}"${srcset ? ` srcset="${srcset}" sizes="(max-width: 599px) 100vw, (max-width: 899px) 50vw, 33vw"` : ''}` +
        ` width="${img.width}" height="${img.height}" alt="${alt}"` +
        ` loading="${eager ? 'eager' : 'lazy'}"${eager ? ' fetchpriority="high"' : ''} />` +
        `</a>` +
        caption +
        `</figure>`
      )
    })
    .filter(Boolean)
    .join('\n')

  // Square cover tiles (same look as the Bailey admin grid — uniform,
  // theme-proof) + a self-contained lightbox. Progressive enhancement: each
  // tile is a plain <a> to the full-size master, so if a theme ever strips
  // the <script>, the gallery still fully works (spike-#2 fallback ladder).
  return (
    `<style>` +
    `.nblb-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;margin:24px 0}` +
    `.nblb-g-item{margin:0}` +
    `.nblb-g-item a{display:block;aspect-ratio:1/1;overflow:hidden;border-radius:10px}` +
    `.nblb-g-item img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .25s}` +
    `.nblb-g-item a:hover img{transform:scale(1.04)}` +
    `.nblb-g-item figcaption{font-size:.85em;opacity:.75;margin-top:6px;line-height:1.4}` +
    // The lightbox is re-parented to <body> by the script (theme containers
    // with transform/overflow would otherwise trap and clip it) and its
    // critical styles carry !important to survive theme button resets.
    `.nblb-lb{position:fixed!important;inset:0!important;z-index:2147483000!important;background:rgba(0,0,0,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;margin:0!important;max-width:none!important}` +
    `.nblb-lb[hidden]{display:none!important}` +
    `.nblb-lb img{max-width:92vw;max-height:78vh;width:auto!important;height:auto!important;object-fit:contain;border-radius:8px}` +
    `.nblb-lb-cap{color:#fff;font-size:.9em;margin-top:12px;text-align:center;max-width:80ch}` +
    `.nblb-lb-count{color:rgba(255,255,255,.55);font-size:.8em;margin-top:6px}` +
    `.nblb-lb button{position:absolute!important;display:flex!important;align-items:center;justify-content:center;background:rgba(255,255,255,.16)!important;color:#fff!important;border:0!important;border-radius:999px!important;cursor:pointer;font-size:22px!important;line-height:1!important;width:44px!important;height:44px!important;min-width:44px!important;min-height:44px!important;padding:0!important;margin:0!important;box-shadow:none!important;text-transform:none!important;z-index:2147483001!important}` +
    `.nblb-lb button:hover{background:rgba(255,255,255,.3)!important}` +
    `.nblb-lb-close{top:16px!important;right:16px!important;left:auto!important}` +
    `.nblb-lb-prev{left:16px!important;top:50%!important;transform:translateY(-50%)!important}` +
    `.nblb-lb-next{right:16px!important;left:auto!important;top:50%!important;transform:translateY(-50%)!important}` +
    `.nblb-lb button:disabled{opacity:.25!important;cursor:default}` +
    `</style>` +
    `<div class="nblb-gallery">\n${figures}\n</div>` +
    `<div class="nblb-lb" id="nblb-lb" hidden>` +
    `<button type="button" class="nblb-lb-close" aria-label="Close">&#10005;</button>` +
    `<button type="button" class="nblb-lb-prev" aria-label="Previous">&#8249;</button>` +
    `<button type="button" class="nblb-lb-next" aria-label="Next">&#8250;</button>` +
    `<img alt="" /><div class="nblb-lb-cap"></div><div class="nblb-lb-count"></div>` +
    `</div>` +
    `<script>(function(){` +
    `var lb=document.getElementById("nblb-lb");if(!lb||lb.dataset.init)return;lb.dataset.init="1";` +
    `document.body.appendChild(lb);` +
    // NB: Shopify's body_html filter strips empty brackets "[]" — never use
    // an empty array literal in this script (Array.prototype instead).
    `var links=Array.prototype.slice.call(document.querySelectorAll(".nblb-gallery .nblb-g-item a"));if(!links.length)return;` +
    `var items=links.map(function(a){var img=a.querySelector("img");var fig=a.parentNode.querySelector("figcaption");` +
    `return{src:a.getAttribute("href"),alt:img?img.getAttribute("alt")||"":"",cap:fig?fig.textContent:""}});` +
    `var pic=lb.querySelector("img"),cap=lb.querySelector(".nblb-lb-cap"),cnt=lb.querySelector(".nblb-lb-count"),` +
    `prev=lb.querySelector(".nblb-lb-prev"),next=lb.querySelector(".nblb-lb-next"),close=lb.querySelector(".nblb-lb-close"),cur=0;` +
    `function show(i){cur=Math.max(0,Math.min(i,items.length-1));var it=items[cur];pic.src=it.src;pic.alt=it.alt;` +
    `cap.textContent=it.cap;cnt.textContent=(cur+1)+" / "+items.length;prev.disabled=cur===0;next.disabled=cur===items.length-1;` +
    `lb.hidden=false;document.body.style.overflow="hidden"}` +
    `function hide(){lb.hidden=true;document.body.style.overflow=""}` +
    `links.forEach(function(a,i){a.addEventListener("click",function(e){e.preventDefault();show(i)})});` +
    `prev.addEventListener("click",function(){show(cur-1)});next.addEventListener("click",function(){show(cur+1)});` +
    `close.addEventListener("click",hide);lb.addEventListener("click",function(e){if(e.target===lb)hide()});` +
    `document.addEventListener("keydown",function(e){if(lb.hidden)return;` +
    `if(e.key==="Escape")hide();else if(e.key==="ArrowLeft")show(cur-1);else if(e.key==="ArrowRight")show(cur+1)});` +
    `})();</` +
    `script>`
  )
}

/** ImageGallery JSON-LD — the page-level type declaration (what FAQPage is
 *  to FAQ hubs, ImageGallery is to galleries). */
export function galleryJsonLd(
  title: string,
  description: string | null,
  images: GalleryImage[],
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name: title,
    ...(description ? { description } : {}),
    associatedMedia: images
      .filter((img) => img.url && img.width && img.height)
      .map((img) => ({
        '@type': 'ImageObject',
        contentUrl: img.url,
        ...(img.caption ? { caption: img.caption } : {}),
        ...(img.alt ? { name: img.alt } : {}),
        width: img.width,
        height: img.height,
        ...(img.thumb_url ? { thumbnailUrl: img.thumb_url } : {}),
      })),
  }
}

/** Lead image for the Shopify article featured image (feeds Shopify's auto
 *  image sitemap + og:image). First ready image for now; a user-chosen lead
 *  can override later. */
export function leadImage(images: GalleryImage[]): GalleryImage | null {
  return images.find((i) => i.status === 'ready' && i.url && !i.hidden) ?? null
}

/** Thumb width export kept here for future gallery-index rendering. */
export const GALLERY_THUMB_WIDTH = TRANSFORM_THUMB_WIDTH
