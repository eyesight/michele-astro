import { downloadImage } from './remoteImages.mjs';

const unmapped = [];
const rawHtmlUses = [];

function columnsFromClass(classAttr) {
  const match = (classAttr ?? '').match(/image--col-(\d+)/);
  return match ? Number(match[1]) : 12;
}

function parseVideoEmbedHtml($, el) {
  const iframe = $(el).find('iframe').first();
  const src = iframe.attr('src');
  const fullWidth = $(el).hasClass('embedVideo--full-with');

  if (src?.includes('youtube.com/embed/')) {
    return { type: 'video', provider: 'youtube', videoUrl: src, fullWidth };
  }
  if (src?.includes('player.vimeo.com/video/')) {
    return { type: 'video', provider: 'vimeo', videoUrl: src, fullWidth };
  }
  return { type: 'video', embedHtml: $(el).html() ?? '', fullWidth };
}

async function mapImageSized($, el) {
  const img = $(el).find('img').first();
  return {
    type: 'imageSized',
    src: await downloadImage(img.attr('src')),
    alt: img.attr('alt') ?? '',
    caption: $(el).find('.image__caption').first().text().trim() || undefined,
    columns: columnsFromClass($(el).attr('class')),
  };
}

function mapListGroup($, containerEl) {
  const title = $(containerEl).find('.list__title').first().text().trim() || undefined;
  const items = $(containerEl)
    .find('.list__item')
    .map((_, item) => $(item).html()?.trim() ?? '')
    .get();
  return { title, items };
}

const KNOWN_BLOCK_SELECTOR = [
  '.wp-block-cgb-block-mim-text',
  '.wp-block-cgb-block-mim-title-h3',
  '.wp-block-cgb-block-mim-img',
  '.wp-block-cgb-block-mim-img-sizes',
  '.wp-block-cgb-block-mim-img-txt',
  '.wp-block-cgb-block-mim-img-title',
  '.wp-block-cgb-block-mim-video',
  '.wp-block-cgb-block-mim-image-container',
  '.wp-block-cgb-block-mim-list-outer-container',
  'p.wp-block-paragraph',
  '.wp-block-heading',
  'figure.wp-block-image',
  'figure.wp-block-embed',
  'figure.wp-block-video',
  '.accordion',
].join(', ');

// Template chrome that can appear anywhere in the content subtree (not just
// as a direct child of <main>) -- e.g. .prev-next turned up nested inside
// the same "bg-white" wrapper as the actual content blocks live. Skipped
// unconditionally rather than relying on top-level-only filtering.
const SKIP_CLASSES = ['prev-next', 'hero-image', 'hero-video', 'hero-image--placeholder', 'title-lead'];

/** Maps one top-level DOM node to a Block, an array of Blocks (wrapper
 * flattening), or null (skip). */
async function mapNode($, el) {
  const node = $(el);
  const classAttr = node.attr('class') ?? '';

  if (SKIP_CLASSES.some((c) => node.hasClass(c))) {
    return null;
  }

  if (node.hasClass('wp-block-cgb-block-mim-text')) {
    return { type: 'text', text: node.html()?.trim() ?? '' };
  }
  if (node.hasClass('wp-block-cgb-block-mim-title-h3')) {
    return { type: 'heading3', text: node.text().trim() };
  }
  // Generic ".image" figure: covers both the original custom block
  // (wp-block-cgb-block-mim-img[-sizes]) and a core/image + "is-style-default"
  // block-style variant found live that reproduces the same look without the
  // custom block's marker class. Distinguished from imageSized by the
  // presence of an "image--col-N" class.
  if (node.is('figure') && node.hasClass('image')) {
    if (/image--col-\d+/.test(classAttr)) {
      return mapImageSized($, el);
    }
    const img = node.find('img').first();
    return {
      type: 'image',
      src: await downloadImage(img.attr('src')),
      alt: img.attr('alt') ?? '',
      caption: node.find('.image__caption').first().text().trim() || undefined,
      fullWidth: node.hasClass('image--full-with'),
    };
  }
  if (node.hasClass('wp-block-cgb-block-mim-img-txt')) {
    const img = node.find('.image-with-text__img img').first();
    return {
      type: 'imageWithText',
      src: await downloadImage(img.attr('src')),
      alt: img.attr('alt') ?? '',
      heading: node.find('.image-with-text__cat').first().text().trim() || undefined,
      text: node.find('.image-with-text__txt').first().html()?.trim() ?? '',
    };
  }
  if (node.hasClass('wp-block-cgb-block-mim-img-title')) {
    const img = node.find('.title-image__image img').first();
    return {
      type: 'titleWithImage',
      src: await downloadImage(img.attr('src')),
      alt: img.attr('alt') ?? '',
      heading: node.find('.title-image__title').first().text().trim() ?? '',
      big: node.find('.title-image__wrapper').hasClass('title-image__wrapper--big'),
    };
  }
  if (node.hasClass('wp-block-cgb-block-mim-video')) {
    return parseVideoEmbedHtml($, el);
  }
  if (node.hasClass('wp-block-cgb-block-mim-image-container')) {
    // InnerBlocks is restricted to img-sizes + core/video (see
    // image-container.js ALLOWED_BLOCKS) -- iterate all direct children
    // generically rather than only the img-sizes selector, so a nested
    // self-hosted video isn't silently dropped.
    const gridContainer = node.find('.grid-container.image-container').first();
    const images = [];
    for (const childEl of gridContainer.children().toArray()) {
      const child = $(childEl);
      if (child.is('figure.wp-block-video')) {
        const video = child.find('video').first();
        images.push({
          type: 'selfHostedVideo',
          src: await downloadImage(video.attr('src')),
          poster: video.attr('poster') ? await downloadImage(video.attr('poster')) : undefined,
          autoplay: video.attr('autoplay') !== undefined,
          loop: video.attr('loop') !== undefined,
          muted: video.attr('muted') !== undefined,
        });
      } else {
        images.push(await mapImageSized($, childEl));
      }
    }
    return {
      type: 'imageContainer',
      spaceBetween: gridContainer.hasClass('image-container--space-between'),
      centered: gridContainer.hasClass('image-container--center'),
      images,
    };
  }
  if (node.hasClass('wp-block-cgb-block-mim-list-outer-container')) {
    const groups = node
      .find('.list__wrapper')
      .map((_, containerEl) => mapListGroup($, containerEl))
      .get();
    return { type: 'list', groups };
  }
  if (node.is('figure.wp-block-image')) {
    const img = node.find('img').first();
    return {
      type: 'image',
      src: await downloadImage(img.attr('src')),
      alt: img.attr('alt') ?? '',
      caption: node.find('figcaption').first().text().trim() || undefined,
      fullWidth: false,
    };
  }
  if (node.is('figure.wp-block-embed')) {
    const iframe = node.find('iframe').first();
    const provider = classAttr.includes('is-provider-vimeo') ? 'vimeo' : 'youtube';
    return { type: 'embed', provider, url: iframe.attr('src') };
  }
  if (node.is('figure.wp-block-video')) {
    const video = node.find('video').first();
    return {
      type: 'selfHostedVideo',
      src: await downloadImage(video.attr('src')),
      poster: video.attr('poster') ? await downloadImage(video.attr('poster')) : undefined,
      autoplay: video.attr('autoplay') !== undefined,
      loop: video.attr('loop') !== undefined,
      muted: video.attr('muted') !== undefined,
    };
  }
  if (node.hasClass('accordion')) {
    const items = node
      .find('.accordion-item')
      .map((_, itemEl) => ({
        title: $(itemEl).find('.accordion-item__title').first().text().trim(),
        content: $(itemEl).find('.accordion-item__content-inner').first().html()?.trim() ?? '',
      }))
      .get();
    return { type: 'accordion', items };
  }
  if (node.hasClass('wp-block-heading') || /^h[1-6]$/i.test(node.prop('tagName') ?? '')) {
    const level = Number((node.prop('tagName') ?? 'h2').slice(1));
    return { type: 'heading', level: Math.min(Math.max(level, 2), 6), text: node.text().trim() };
  }
  if (node.is('p')) {
    return { type: 'paragraph', text: node.html()?.trim() ?? '' };
  }

  // Transparent wrapper: doesn't match a known block itself, but wraps
  // known blocks (e.g. a "bg-white" background div around the whole post
  // body found live) -- recurse into its direct children instead of
  // treating the wrapper as opaque content.
  if (node.find(KNOWN_BLOCK_SELECTOR).length > 0) {
    return mapChildren($, node.children().toArray());
  }

  const html = node.prop('outerHTML')?.trim();
  if (html) {
    rawHtmlUses.push({ tag: node.prop('tagName'), class: classAttr });
    return { type: 'rawHtml', html };
  }
  return null;
}

async function mapChildren($, elements) {
  const blocks = [];
  for (const el of elements) {
    const result = await mapNode($, el);
    if (Array.isArray(result)) blocks.push(...result);
    else if (result) blocks.push(result);
  }
  return blocks;
}

/** Parses the direct element children of a container into our Block[] shape. */
export async function parseDomBlocks($, containerEl) {
  return mapChildren($, $(containerEl).children().toArray());
}

export function domBlockReport() {
  return { unmapped, rawHtmlUses };
}
