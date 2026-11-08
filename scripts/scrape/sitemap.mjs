import * as cheerio from 'cheerio';

const SITE = 'https://studio-mi.ch';

async function fetchXml(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (migration-script)' } });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return cheerio.load(await res.text(), { xmlMode: true });
}

/** Returns { pages: string[], posts: string[] } of full URLs from the Yoast sitemaps. */
export async function discoverUrls() {
  const $index = await fetchXml(`${SITE}/sitemap_index.xml`);
  const sitemapUrls = $index('sitemap > loc')
    .map((_, el) => $index(el).text())
    .get();

  const postSitemap = sitemapUrls.find((u) => u.includes('post-sitemap'));
  const pageSitemap = sitemapUrls.find((u) => u.includes('page-sitemap'));

  const [posts, pages] = await Promise.all([
    urlsFromSitemap(postSitemap),
    urlsFromSitemap(pageSitemap),
  ]);

  return { posts, pages };
}

async function urlsFromSitemap(sitemapUrl) {
  if (!sitemapUrl) return [];
  const $ = await fetchXml(sitemapUrl);
  return $('url > loc')
    .map((_, el) => $(el).text())
    .get();
}

export { SITE };
