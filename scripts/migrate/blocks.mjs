import { parse } from '@wordpress/block-serialization-default-parser';
import { resolveImage } from './images.mjs';

const unmapped = new Map(); // blockName -> count
const skippedTitleLead = { count: 0 };

function noteUnmapped(name) {
  unmapped.set(name, (unmapped.get(name) ?? 0) + 1);
}

function stripOuterTag(html) {
  const trimmed = (html ?? '').trim();
  const match = trimmed.match(/^<([a-z0-9]+)(?:\s[^>]*)?>([\s\S]*)<\/\1>$/i);
  return match ? match[2].trim() : trimmed;
}

function headingLevel(node) {
  if (node.attrs?.level) return node.attrs.level;
  const match = (node.innerHTML ?? '').match(/<h([1-6])[\s>]/i);
  return match ? Number(match[1]) : 2;
}

function columnsFromOption(selectedOption) {
  const match = (selectedOption ?? '').match(/col-(\d+)/);
  return match ? Number(match[1]) : 12;
}

function parseVideoEmbed(rawHtml, isFullWidth) {
  const srcMatch = (rawHtml ?? '').match(/src=["']([^"']+)["']/i);
  const src = srcMatch?.[1];

  if (src?.includes('youtube.com/embed/')) {
    return { type: 'video', provider: 'youtube', videoUrl: src, fullWidth: !!isFullWidth };
  }
  if (src?.includes('player.vimeo.com/video/')) {
    return { type: 'video', provider: 'vimeo', videoUrl: src, fullWidth: !!isFullWidth };
  }
  // Fallback: couldn't identify a known provider, keep the raw markup so
  // nothing is lost.
  return { type: 'video', embedHtml: rawHtml ?? '', fullWidth: !!isFullWidth };
}

function mapImageSized(node) {
  const a = node.attrs ?? {};
  return {
    type: 'imageSized',
    src: resolveImage(a.imgUrl ?? ''),
    alt: a.text ?? '',
    caption: a.caption || undefined,
    columns: columnsFromOption(a.selectedOption),
  };
}

function mapListGroup(containerNode) {
  const children = containerNode.innerBlocks ?? [];
  const titleNode = children.find((c) => c.blockName === 'cgb/block-mim-list-item-title');
  const items = children
    .filter((c) => c.blockName === 'cgb/block-mim-list-item')
    .map((c) => c.attrs?.txt ?? '');
  return { title: titleNode?.attrs?.txt || undefined, items };
}

function mapNode(node) {
  const a = node.attrs ?? {};

  switch (node.blockName) {
    case 'cgb/block-mim-text':
      return { type: 'text', text: a.txt ?? '' };

    case 'cgb/block-mim-title-h3':
      return { type: 'heading3', text: a.txt ?? '' };

    case 'cgb/block-mim-img':
      return {
        type: 'image',
        src: resolveImage(a.imgUrl ?? ''),
        alt: a.text ?? '',
        caption: a.caption || undefined,
        fullWidth: !!a.isFullWidth,
      };

    case 'cgb/block-mim-img-sizes':
      return mapImageSized(node);

    case 'cgb/block-mim-img-txt':
      return {
        type: 'imageWithText',
        src: resolveImage(a.imgUrl ?? ''),
        alt: a.text ?? '',
        heading: a.heading || undefined,
        text: a.bodyContent ?? '',
      };

    case 'cgb/block-mim-img-title':
      return {
        type: 'titleWithImage',
        src: resolveImage(a.imgUrl ?? ''),
        alt: a.text ?? '',
        heading: a.heading ?? '',
        big: !!a.isBig,
      };

    case 'cgb/block-mim-video':
      return parseVideoEmbed(a.videoUrl, a.isFullWidth);

    case 'cgb/block-mim-image-container':
      return {
        type: 'imageContainer',
        spaceBetween: !!a.addClassName,
        images: (node.innerBlocks ?? [])
          .filter((c) => c.blockName === 'cgb/block-mim-img-sizes')
          .map(mapImageSized),
      };

    case 'cgb/block-mim-list-outer-container':
      return {
        type: 'list',
        groups: (node.innerBlocks ?? [])
          .filter((c) => c.blockName === 'cgb/block-mim-list-container')
          .map(mapListGroup),
      };

    case 'cgb/block-mim-list-container':
      // Only expected nested inside list-outer-container; handle a
      // stray top-level occurrence gracefully as a single-group list.
      return { type: 'list', groups: [mapListGroup(node)] };

    case 'cgb/block-mim-title-lead':
      // Discarded per decision: single.php already renders this header
      // natively from ACF fields, this saved block is orphaned duplicate
      // content from an earlier iteration of the theme.
      skippedTitleLead.count += 1;
      return null;

    case 'core/paragraph':
      return { type: 'paragraph', text: stripOuterTag(node.innerHTML) };

    case 'core/heading':
      return { type: 'heading', level: headingLevel(node), text: stripOuterTag(node.innerHTML) };

    case 'core/image':
      return {
        type: 'image',
        src: resolveImage(a.url ?? ''),
        alt: a.alt ?? '',
        caption: a.caption || undefined,
        fullWidth: false,
      };

    case 'core/embed':
    case 'core-embed/vimeo':
    case 'core-embed/youtube': {
      const provider = a.providerNameSlug === 'vimeo' ? 'vimeo' : 'youtube';
      return { type: 'embed', provider, url: a.url };
    }

    case null: {
      // Freeform/classic HTML between blocks. Keep non-empty content as a
      // paragraph so nothing silently disappears; skip pure whitespace.
      const text = (node.innerHTML ?? '').trim();
      return text ? { type: 'paragraph', text } : null;
    }

    default:
      noteUnmapped(node.blockName);
      return null;
  }
}

/** Parses raw post_content into our structured block array. */
export function parseBlocks(postContent) {
  if (!postContent) return [];
  return parse(postContent)
    .map(mapNode)
    .filter((b) => b !== null);
}

export function blockMigrationReport() {
  return {
    unmapped: Object.fromEntries(unmapped),
    skippedTitleLeadInstances: skippedTitleLead.count,
  };
}
