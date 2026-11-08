#!/usr/bin/env node
// Scrapes the LIVE production site (https://studio-mi.ch) via its Yoast
// sitemaps and reads the rendered HTML directly -- used instead of
// migrate.mjs (which reads the local dev DB full of placeholder content)
// since studio-mi.ch has the real content, and its theme has drifted from
// the local wp-content/themes/mim checkout (new fields: client, per-page
// lead/credit, self-hosted core/video, GA4 via Site Kit, nav merged into
// the filter bar -- see scripts/SCRAPE_NOTES.md).
//
// Usage: node scripts/scrape.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import { discoverUrls, SITE } from './scrape/sitemap.mjs';
import { parseDomBlocks, domBlockReport } from './scrape/domBlocks.mjs';
import { downloadImage, imageReport } from './scrape/remoteImages.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = path.join(ROOT, 'src/content');
const UA = { headers: { 'User-Agent': 'Mozilla/5.0 (migration-script)' } };

function writeJson(collection, slug, data) {
  const dir = path.join(CONTENT_DIR, collection);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${slug}.json`), JSON.stringify(data, null, 2) + '\n');
}

function slugFromUrl(url) {
  const { pathname } = new URL(url);
  const segments = pathname.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? '';
}

/**
 * Nav/footer links scraped from the live site come back as absolute
 * https://studio-mi.ch/... URLs. Same-site links need to stay internal
 * (root-relative) so they navigate within the migrated site instead of
 * bouncing back to production; genuinely external links (mailto:,
 * instagram.com, wa.me, etc.) are left untouched.
 */
function internalizeUrl(url) {
  if (!url) return url;
  if (url.startsWith(SITE)) return url.slice(SITE.length) || '/';
  return url;
}

async function fetchDom(url) {
  const res = await fetch(url, UA);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  $.__rawHtml = html;
  return $;
}

function bodyColors($) {
  const style = $('body').attr('style') ?? '';
  const bg = style.match(/--mim-background-color:\s*([^;]+);/)?.[1]?.trim();
  const text = style.match(/--mim-text-color:\s*([^;]+);/)?.[1]?.trim();
  const header = style.match(/--mim-header-color:\s*([^;]+);/)?.[1]?.trim();
  return { backgroundColor: bg || undefined, textColor: text || undefined, headerColor: header || undefined };
}

function seoFrom($) {
  const description = $('meta[name="description"]').attr('content');
  const title = $('title').first().text().split('|')[0]?.trim();
  return description || title ? { title: title || undefined, description: description || undefined } : undefined;
}

/** Scrapes the homepage: tile grid (per-post categories/columns/thumbnail),
 * the filter bar (categories + the merged "About" nav link), the footer
 * (address widget + social/footer menus), and the GA4 measurement ID. */
async function scrapeHomepage() {
  const $ = await fetchDom(SITE + '/');

  // --- filter bar: category buttons + the merged nav link(s) ---
  const categories = [];
  const navLinks = [];
  $('.filter__button').each((i, el) => {
    const node = $(el);
    const filterTarget = node.attr('data-filter-target');
    if (filterTarget) {
      categories.push({ slug: filterTarget, name: node.text().trim(), order: categories.length });
    } else if (node.is('a')) {
      navLinks.push({ label: node.text().trim(), url: internalizeUrl(node.attr('href')) });
    }
  });

  // --- tile grid: per-post categories/columns/thumbnail, in final order ---
  // front-page.php's query includes post_type=page too (tiles__item--page
  // modifier) -- e.g. the About page currently shows up this way, with its
  // own pseudo-category (data-category="about") that has no real filter
  // button, only the nav link.
  const tiles = [];
  for (const el of $('.tiles__item').toArray()) {
    const node = $(el);
    const href = node.find('.tiles__item-link').attr('href');
    const slug = slugFromUrl(href);
    const colMatch = (node.attr('class') ?? '').match(/tiles__item--col-(\d+)/);
    const thumbSrc = node.find('.tiles__img-wrapper img').attr('src');
    tiles.push({
      slug,
      isPage: node.hasClass('tiles__item--page'),
      label: node.find('.tiles__item-title').first().text().trim(),
      tileColumns: colMatch ? Number(colMatch[1]) : 3,
      thumbnail: await downloadImage(thumbSrc),
      categories: (node.attr('data-category') ?? '').trim().split(/\s+/).filter(Boolean),
      sortNumber: tiles.length,
    });
  }

  // --- footer: address widget + social/footer menus ---
  const footerAddress1 = $('.footer__left > .footer__text')
    .map((_, el) => ({ content: $(el).html()?.trim() ?? '' }))
    .get();

  const socialMenu = $('#menu-social-media > li')
    .map((_, el) => ({
      label: $(el).find('a span').first().text().trim() || $(el).find('a').first().text().trim(),
      url: internalizeUrl($(el).find('a').first().attr('href')),
      target: $(el).find('a').first().attr('target') || undefined,
      children: [],
    }))
    .get();

  const footerMenu = $('#menu-footermenu > li')
    .map((_, el) => ({
      label: $(el).find('a').first().text().trim(),
      url: internalizeUrl($(el).find('a').first().attr('href')),
      children: [],
    }))
    .get();

  const gaMatch = $.__rawHtml.match(/gtag\(\s*["']config["']\s*,\s*["'](G-[A-Z0-9]+)["']/);

  return {
    categories,
    navLinks,
    tiles,
    footerAddress1,
    socialMenu,
    footerMenu,
    homeSeo: seoFrom($),
    gaTrackingId: gaMatch?.[1],
  };
}

async function scrapePage(url, tileData) {
  const $ = await fetchDom(url);
  const slug = slugFromUrl(url);
  const main = $('main').first();
  const mainClass = main.attr('class') ?? '';

  let template = 'default';
  if (mainClass.includes('content-left-indent')) template = 'leftIndent';
  else if (mainClass.includes('title-image')) template = 'withImage';

  const frontpageTile =
    tileData && tileData.isPage
      ? {
          label: tileData.label,
          categorySlug: tileData.categories[0] ?? '',
          thumbnail: tileData.thumbnail,
          tileColumns: tileData.tileColumns,
          sortNumber: tileData.sortNumber,
        }
      : undefined;

  const colors = bodyColors($);
  let title, featuredImage, lead;

  if (template === 'withImage') {
    title = main.find('.title-image__title').first().text().trim();
    featuredImage = await downloadImage(main.find('.title-image__image img').attr('src'));
    lead = main.find('.title-image__lead').first().text().trim() || undefined;
    // pageWithImage.php loops credits0..credits19, each its own
    // .title-image__credit div (job in a "bold" <p>, name in a plain one) --
    // unlike single.php's combined-paragraph pattern.
    const credits = main
      .find('.title-image__credit')
      .map((_, el) => {
        const texts = $(el).find('.title-image__text').map((_, e) => $(e).text().trim()).get();
        return { job: texts[0] ?? '', name: texts[1] ?? '' };
      })
      .get()
      .filter((c) => c.name);
    // body blocks (if any) are siblings of title-image__container within
    // main; filter out the hero's own container before parsing.
    const filtered = [];
    for (const child of main.children().toArray()) {
      if ($(child).hasClass('title-image__container')) continue;
      filtered.push(child);
    }
    const extraBlocks = await parseDomBlocks($, $('<div>').append(filtered.map((c) => $(c).clone())));
    writeJson('pages', slug, {
      frontpageTile,
      title,
      slug,
      template,
      featuredImage,
      lead,
      credits,
      backgroundColor: colors.backgroundColor,
      textColor: colors.textColor,
      headerColor: colors.headerColor,
      body: extraBlocks,
      seo: seoFrom($),
    });
    return;
  }

  // default / leftIndent: h1 in .content.title, remaining siblings are body
  title = main.find('.title__text').first().text().trim();
  const bodyChildren = main
    .children()
    .toArray()
    .filter((el) => !$(el).hasClass('title'));
  const body = await parseDomBlocks($, $('<div>').append(bodyChildren.map((c) => $(c).clone())));

  writeJson('pages', slug, {
      frontpageTile,
    title,
    slug,
    template,
    backgroundColor: colors.backgroundColor,
    textColor: colors.textColor,
    headerColor: colors.headerColor,
    body,
    seo: seoFrom($),
  });
}

function extractJsonLd($) {
  const raw = $('script.yoast-schema-graph').first().html();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function scrapePost(url, tileData) {
  const $ = await fetchDom(url);
  const slug = slugFromUrl(url);
  const main = $('main.single, main.main.single').first();
  const colors = bodyColors($);

  const title = main.find('.title-lead__title').first().text().trim();
  const headline = main.find('.title-lead__headline').first().text().trim() || undefined;
  const lead = main.find('.title-lead__lead').first().text().trim() || undefined;

  // .title-lead__credit-item holds one <p class="title-lead__text"> per
  // credit (job label in a nested bold <span>, name as trailing text) plus
  // one more such <p> for the copyright line (starts with "©", no bold
  // span) -- all siblings in the same container, not separate wrappers.
  let copyright, client;
  const credits = [];
  main.find('.title-lead__credit-item > .title-lead__text').each((_, el) => {
    const node = $(el);
    const fullText = node.text().trim();
    if (fullText.startsWith('©')) {
      copyright = fullText.slice(1).trim();
      return;
    }
    const boldSpan = node.find('.title-lead__text--bold').first();
    if (boldSpan.length) {
      const job = boldSpan.text().replace(/:\s*$/, '').trim();
      const name = node.clone().find('.title-lead__text--bold').remove().end().text().trim();
      if (name) credits.push({ job, name });
    }
  });
  const clientText = main.find('.title-lead__client-wrapper').first().text().trim();
  if (clientText) client = clientText.replace(/^Kunde:\s*/, '').trim();

  const jsonLd = extractJsonLd($);
  const graph = jsonLd?.['@graph'] ?? [];
  const webpageNode = graph.find((n) => n['@type'] === 'WebPage');
  const sortDate = (webpageNode?.datePublished ?? '').slice(0, 10) || undefined;

  // Hero is either an image (possibly desktop/mobile crops) or, if no image
  // is set, a raw video embed (ACF hero_video) -- .hero-image / .hero-video
  // share the same "fullwidth"/"content" width modifier and an optional
  // "--contain" object-fit modifier on the wrapper.
  const heroImageEl = main.find('.hero-image').first();
  const heroVideoEl = main.find('.hero-video').first();
  const heroEl = heroImageEl.length ? heroImageEl : heroVideoEl;
  const heroWidth = heroEl.hasClass('content') ? 'content' : 'fullwidth';
  const heroObjectFitContain = heroEl.find('.hero-image__wrapper--contain').length > 0;

  const heroImage = await downloadImage(heroImageEl.find('.hero-image__image.screen-only, .hero-image__image').first().attr('src'));
  const heroImageMobile = await downloadImage(heroImageEl.find('.hero-image__image.mobile-only').first().attr('src'));
  const heroVideo = heroVideoEl.length ? heroVideoEl.find('.hero-video__wrapper').first().html()?.trim() : undefined;

  // body: everything in <main> except the header (.title-lead), the hero
  // image, and the prev/next nav, unwrapping the "bg-white" (or similar)
  // content wrapper. (domBlocks.mjs also skips these classes wherever they
  // appear nested, but filtering here too avoids cloning them needlessly.)
  const bodyChildren = main
    .children()
    .toArray()
    .filter((el) => !['title-lead', 'prev-next', 'hero-image', 'hero-video', 'hero-image--placeholder'].some((c) => $(el).hasClass(c)));
  const body = await parseDomBlocks($, $('<div>').append(bodyChildren.map((c) => $(c).clone())));

  writeJson('posts', slug, {
    title,
    slug,
    categories: tileData?.categories ?? [],
    sortDate: sortDate ?? new Date().toISOString().slice(0, 10),
    tileColumns: tileData?.tileColumns ?? 3,
    sortNumber: tileData?.sortNumber,
    thumbnail: tileData?.thumbnail ?? '',
    heroImage: heroImage || undefined,
    heroImageMobile: heroImageMobile || undefined,
    heroVideo: heroVideo || undefined,
    heroWidth,
    heroObjectFitContain,
    headline,
    lead,
    copyright,
    client,
    credits,
    backgroundColor: colors.backgroundColor,
    textColor: colors.textColor,
    headerColor: colors.headerColor,
    body,
    seo: seoFrom($),
  });
}

async function main() {
  const { posts: postUrls, pages: pageUrls } = await discoverUrls();
  console.log(`Discovered ${postUrls.length} posts, ${pageUrls.length} pages from sitemaps.`);

  const home = await scrapeHomepage();

  home.categories.forEach((cat) => {
    writeJson('categories', cat.slug, { name: cat.name, slug: cat.slug, order: cat.order });
  });

  writeJson('navigation', 'main-menu', {
    location: 'main-menu',
    items: home.navLinks.map((l) => ({ label: l.label, url: l.url, children: [] })),
  });
  writeJson('navigation', 'main-menu-mobile', { location: 'main-menu-mobile', items: [] });
  writeJson('navigation', 'social-menu', { location: 'social-menu', items: home.socialMenu });
  writeJson('navigation', 'footer-menu', { location: 'footer-menu', items: home.footerMenu });

  writeJson('site', 'settings', {
    footerAddress1: home.footerAddress1,
    footerAddress2: [],
    gaTrackingId: home.gaTrackingId,
    homeSeo: home.homeSeo,
  });

  const tilesBySlug = new Map(home.tiles.map((t) => [t.slug, t]));

  const frontPageUrl = SITE + '/';
  for (const url of pageUrls) {
    if (url === frontPageUrl) continue; // homepage handled above, not a pages/ entry
    try {
      await scrapePage(url, tilesBySlug.get(slugFromUrl(url)));
    } catch (err) {
      console.error(`Failed to scrape page ${url}:`, err.message);
    }
  }

  for (const url of postUrls) {
    const slug = slugFromUrl(url);
    try {
      await scrapePost(url, tilesBySlug.get(slug));
    } catch (err) {
      console.error(`Failed to scrape post ${url}:`, err.message);
    }
  }

  console.log('\n=== Scrape report ===');
  console.log('Categories found:', home.categories.map((c) => c.slug));
  console.log('Nav links (merged into filter bar):', home.navLinks);
  console.log('Image report:', imageReport());
  console.log('DOM block report:', domBlockReport());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
