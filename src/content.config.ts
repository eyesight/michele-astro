import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// ---------------------------------------------------------------------------
// Shared block schema
//
// Every "body" field (pages, posts) is an array of these. Each variant maps
// 1:1 to a custom Gutenberg block from the mim-gutenberg-block plugin (or a
// core block that was used directly in content). See MIGRATION_NOTES.md for
// the mapping back to the original wp:block-name.
// ---------------------------------------------------------------------------

const textBlock = z.object({
  type: z.literal('text'),
  text: z.string(),
});

const heading3Block = z.object({
  type: z.literal('heading3'),
  text: z.string(),
});

const imageBlock = z.object({
  type: z.literal('image'),
  src: z.string(),
  alt: z.string().default(''),
  caption: z.string().optional(),
  fullWidth: z.boolean().default(false),
});

const imageSizedBlock = z.object({
  type: z.literal('imageSized'),
  src: z.string(),
  alt: z.string().default(''),
  caption: z.string().optional(),
  columns: z.number().int().min(3).max(12),
});

const imageWithTextBlock = z.object({
  type: z.literal('imageWithText'),
  src: z.string(),
  alt: z.string().default(''),
  heading: z.string().optional(),
  text: z.string(),
});

// Legacy block: no longer authorable (excluded from the editor's allowed
// block list) but still present in existing content and must keep rendering.
const titleWithImageBlock = z.object({
  type: z.literal('titleWithImage'),
  src: z.string(),
  alt: z.string().default(''),
  heading: z.string(),
  big: z.boolean().default(false),
});

// Structured provider+url when the pasted iframe could be parsed (YouTube/
// Vimeo), raw embedHtml as a fallback for anything else so parity is never
// lost for an embed we don't recognize.
const videoBlock = z
  .object({
    type: z.literal('video'),
    provider: z.enum(['youtube', 'vimeo']).optional(),
    videoUrl: z.string().url().optional(),
    embedHtml: z.string().optional(),
    fullWidth: z.boolean().default(false),
  })
  .refine((b) => (b.provider && b.videoUrl) || b.embedHtml, {
    message: 'video block needs either provider+videoUrl or an embedHtml fallback',
  });

const listBlock = z.object({
  type: z.literal('list'),
  groups: z.array(
    z.object({
      title: z.string().optional(),
      items: z.array(z.string()),
    }),
  ),
});

const paragraphBlock = z.object({
  type: z.literal('paragraph'),
  text: z.string(),
});

const headingBlock = z.object({
  type: z.literal('heading'),
  level: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
  text: z.string(),
});

const embedBlock = z.object({
  type: z.literal('embed'),
  provider: z.enum(['youtube', 'vimeo']),
  url: z.string().url(),
});

// core/video, self-hosted <video> (found live, e.g. severin-jakob project) --
// distinct from the custom video block, which only ever holds a pasted
// iframe embed.
const selfHostedVideoBlock = z.object({
  type: z.literal('selfHostedVideo'),
  src: z.string(),
  poster: z.string().optional(),
  autoplay: z.boolean().default(false),
  loop: z.boolean().default(false),
  muted: z.boolean().default(false),
});

// InnerBlocks restricted to img-sizes + core/video (isCentered -> "center"
// modifier, addClassName -> "space-between" modifier).
const imageContainerBlock = z.object({
  type: z.literal('imageContainer'),
  spaceBetween: z.boolean().default(false),
  centered: z.boolean().default(false),
  images: z.array(z.union([imageSizedBlock, selfHostedVideoBlock])),
});

// cgb/block-mim-accordion + cgb/block-mim-accordion-item, InnerBlocks-nested
// in the source but flattened to one block here since an accordion only
// ever contains items (page post type only; not seen in any currently
// published content, added defensively to match the real block source).
const accordionBlock = z.object({
  type: z.literal('accordion'),
  items: z.array(z.object({ title: z.string(), content: z.string() })),
});

// Escape hatch for content that doesn't decompose into a known block --
// third-party widget embeds (e.g. the privacybee.io script on /datenschutz/)
// or any block type the scraper doesn't recognize. Keeps parity without
// forcing everything into typed blocks; the scraper logs every use so these
// stay visible rather than silently accumulating.
const rawHtmlBlock = z.object({
  type: z.literal('rawHtml'),
  html: z.string(),
});

export const blockSchema = z.discriminatedUnion('type', [
  textBlock,
  heading3Block,
  imageBlock,
  imageSizedBlock,
  imageWithTextBlock,
  titleWithImageBlock,
  videoBlock,
  imageContainerBlock,
  listBlock,
  paragraphBlock,
  headingBlock,
  embedBlock,
  selfHostedVideoBlock,
  accordionBlock,
  rawHtmlBlock,
]);

export type Block = z.infer<typeof blockSchema>;

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

const seoSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
  })
  .optional();

const pages = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    template: z.enum(['default', 'leftIndent', 'withImage']),
    featuredImage: z.string().optional(), // pageWithImage hero only
    lead: z.string().optional(), // title-image__lead, withImage template only
    // pageWithImage.php loops credits0..credits19 (job/name), same as posts --
    // was previously mis-scraped into a single `credit` object that the (non-
    // strict) Zod schema silently dropped; fixed to match the real source.
    credits: z.array(z.object({ job: z.string(), name: z.string() })).default([]),
    backgroundColor: z.string().optional(), // ACF "Farben" group override
    textColor: z.string().optional(),
    headerColor: z.string().optional(), // --mim-header-color, logo/nav color over a hero
    // front-page.php's tile query includes post_type=page (unless flagged
    // `not-on-front`) -- present only when this page actually appears in
    // the homepage grid (e.g. the About page). The tile's own thumbnail
    // (ACF image_front, can differ from the page's real featuredImage) and
    // label (falls back to the main-menu title, resolved server-side) are
    // captured separately from the page's own content.
    frontpageTile: z
      .object({
        label: z.string(),
        categorySlug: z.string(), // synthetic pseudo-category, e.g. "about" -- has no real filter button
        thumbnail: z.string(),
        tileColumns: z.number().int().min(1).max(12),
        sortNumber: z.number().int(),
      })
      .optional(),
    body: z.array(blockSchema),
    seo: seoSchema,
  }),
});

const posts = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    categories: z.array(z.string()), // category slugs
    sortDate: z.coerce.date(), // ACF 'date' meta -- drives prev/next + tile order, distinct from WP publish date
    tileColumns: z.number().int().min(1).max(12).default(3), // ACF col-numb
    sortNumber: z.number().int().optional(), // ACF sort-number, front-page/category tile ordering
    thumbnail: z.string(), // 16:9 crop for the portfolio tile grid
    heroImage: z.string().optional(), // .hero-image__image.screen-only
    heroImageMobile: z.string().optional(), // .hero-image__image.mobile-only, separate crop for mobile
    heroVideo: z.string().optional(), // ACF hero_video -- raw embed HTML, alternative to heroImage
    heroWidth: z.enum(['content', 'fullwidth']).default('fullwidth'), // ACF image-width
    heroObjectFitContain: z.boolean().default(false), // ACF object-fit-contain
    headline: z.string().optional(), // title-lead__headline, distinct from lead
    lead: z.string().optional(),
    copyright: z.string().optional(),
    client: z.string().optional(), // title-lead__client-wrapper "Kunde: X" -- found live, not in local theme copy
    credits: z.array(z.object({ job: z.string(), name: z.string() })).default([]),
    backgroundColor: z.string().optional(), // ACF "Farben" group override (applies to posts too)
    textColor: z.string().optional(),
    headerColor: z.string().optional(), // --mim-header-color, logo/nav color over a hero
    body: z.array(blockSchema),
    seo: seoSchema,
  }),
});

const categories = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/categories' }),
  schema: z.object({
    name: z.string(),
    slug: z.string(),
    description: z.string().optional(),
    order: z.number().int(), // from the taxonomy-terms-order plugin
  }),
});

const navigation = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/navigation' }),
  schema: z.object({
    location: z.enum(['main-menu', 'main-menu-mobile', 'social-menu', 'footer-menu']),
    items: z.array(
      z.object({
        label: z.string(),
        url: z.string(),
        target: z.string().optional(),
        children: z
          .array(z.object({ label: z.string(), url: z.string() }))
          .default([]),
      }),
    ),
  }),
});

const siteSettings = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/site' }),
  schema: z.object({
    footerAddress1: z.array(
      z.object({ title: z.string().optional(), content: z.string() }),
    ),
    footerAddress2: z.array(
      z.object({ title: z.string().optional(), content: z.string() }),
    ),
    gaTrackingId: z.string().optional(),
    // The static front page has no body blocks (front-page.php never calls
    // the_content(), it only renders the tile grid), but its title/meta
    // description still need to carry over for SEO.
    homeSeo: seoSchema,
  }),
});

export const collections = { pages, posts, categories, navigation, siteSettings };
