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

  return (
    `<style>` +
    `.nblb-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;margin:24px 0}` +
    `.nblb-g-item{margin:0}` +
    `.nblb-g-item img{width:100%;height:auto;border-radius:8px;display:block}` +
    `.nblb-g-item figcaption{font-size:.85em;opacity:.75;margin-top:6px;line-height:1.4}` +
    `</style>` +
    `<div class="nblb-gallery">\n${figures}\n</div>`
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
  return images.find((i) => i.status === 'ready' && i.url) ?? null
}

/** Thumb width export kept here for future gallery-index rendering. */
export const GALLERY_THUMB_WIDTH = TRANSFORM_THUMB_WIDTH
