#!/usr/bin/env node
// WordPress (michelle DB) -> Astro content collections migration.
//
// Reads directly from the local MAMP MySQL database (same DB the mim theme
// runs against) rather than the REST API, since we need raw post_content
// (for block parsing) and postmeta/ACF/menu/widget data the default REST
// API doesn't expose.
//
// Usage: node scripts/migrate.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, query } from './migrate/db.mjs';
import { parseBlocks, blockMigrationReport } from './migrate/blocks.mjs';
import { resolveImage, imageReport } from './migrate/images.mjs';
import { parseThemeMods, parseWidgetText, resolveTextWidgets } from './migrate/widgets.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = path.join(ROOT, 'src/content');

const TEMPLATE_MAP = {
  'pageLeftIndent.php': 'leftIndent',
  'pageWithImage.php': 'withImage',
};

function writeJson(collection, slug, data) {
  const dir = path.join(CONTENT_DIR, collection);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${slug}.json`), JSON.stringify(data, null, 2) + '\n');
}

async function getMeta(conn, postId, key) {
  const rows = await query(
    conn,
    'SELECT meta_value FROM wp_postmeta WHERE post_id = ? AND meta_key = ? LIMIT 1',
    [postId, key],
  );
  return rows[0]?.meta_value ?? null;
}

async function getThumbnail(conn, postId) {
  const attachmentId = await getMeta(conn, postId, '_thumbnail_id');
  if (!attachmentId) return null;
  const rows = await query(conn, 'SELECT guid FROM wp_posts WHERE ID = ?', [attachmentId]);
  return rows[0]?.guid ? resolveImage(rows[0].guid) : null;
}

/** ACF date_picker fields are stored as d/m/Y strings; normalize to ISO. */
function acfDateToIso(value) {
  const match = value?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

async function migrateCategories(conn) {
  const rows = await query(
    conn,
    `SELECT t.term_id, t.name, t.slug, tt.description
     FROM wp_terms t JOIN wp_term_taxonomy tt ON t.term_id = tt.term_id
     WHERE tt.taxonomy = 'category'
     ORDER BY t.term_id`,
  );

  const slugByTermId = new Map();
  rows.forEach((row, index) => {
    slugByTermId.set(row.term_id, row.slug);
    writeJson('categories', row.slug, {
      name: row.name,
      slug: row.slug,
      description: row.description || undefined,
      // No wp_termmeta rows exist in this DB despite the taxonomy-terms-order
      // plugin being active, so there's nothing to read an explicit order
      // from here. Falling back to term_id order (index); re-run against
      // the production DB if it actually has termmeta ordering data.
      order: index,
    });
  });

  return slugByTermId;
}

async function migratePages(conn, frontPageId) {
  const rows = await query(conn, "SELECT * FROM wp_posts WHERE post_type = 'page' AND post_status = 'publish'");
  const skipped = [];
  let migrated = 0;

  for (const row of rows) {
    if (row.ID === frontPageId) {
      skipped.push({ id: row.ID, reason: 'is the static front page (handled as homepage view, not a pages/ entry)' });
      continue;
    }

    const templateFile = await getMeta(conn, row.ID, '_wp_page_template');
    const backgroundColor = await getMeta(conn, row.ID, 'background-color');
    const textColor = await getMeta(conn, row.ID, 'text-color');
    const metaDesc = await getMeta(conn, row.ID, '_yoast_wpseo_metadesc');
    const template = TEMPLATE_MAP[templateFile] ?? 'default';
    const featuredImage = template === 'withImage' ? await getThumbnail(conn, row.ID) : null;

    writeJson('pages', row.post_name, {
      title: row.post_title,
      slug: row.post_name,
      template,
      featuredImage: featuredImage || undefined,
      backgroundColor: backgroundColor || undefined,
      textColor: textColor || undefined,
      body: parseBlocks(row.post_content),
      seo: metaDesc ? { description: metaDesc } : undefined,
    });
    migrated += 1;
  }

  return { migrated, skipped };
}

async function migratePosts(conn) {
  const published = await query(conn, "SELECT * FROM wp_posts WHERE post_type = 'post' AND post_status = 'publish'");
  const drafts = await query(conn, "SELECT ID, post_title, post_status FROM wp_posts WHERE post_type = 'post' AND post_status != 'publish'");

  for (const row of published) {
    const catRows = await query(
      conn,
      `SELECT t.slug FROM wp_term_relationships tr
       JOIN wp_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
       JOIN wp_terms t ON t.term_id = tt.term_id
       WHERE tr.object_id = ? AND tt.taxonomy = 'category'`,
      [row.ID],
    );

    const dateMeta = await getMeta(conn, row.ID, 'date');
    const colNumb = await getMeta(conn, row.ID, 'col-numb');
    const sortNumber = await getMeta(conn, row.ID, 'sort-number');
    const lead = await getMeta(conn, row.ID, 'lead');
    const copyright = await getMeta(conn, row.ID, 'copyright');
    const backgroundColor = await getMeta(conn, row.ID, 'background-color');
    const textColor = await getMeta(conn, row.ID, 'text-color');
    const metaDesc = await getMeta(conn, row.ID, '_yoast_wpseo_metadesc');
    const thumbnail = await getThumbnail(conn, row.ID);

    const credits = [];
    for (let i = 1; i <= 4; i++) {
      const job = await getMeta(conn, row.ID, `credits${i}_job`);
      const name = await getMeta(conn, row.ID, `credits${i}_name`);
      if (job || name) credits.push({ job: job ?? '', name: name ?? '' });
    }

    writeJson('posts', row.post_name, {
      title: row.post_title,
      slug: row.post_name,
      categories: catRows.map((r) => r.slug),
      sortDate: acfDateToIso(dateMeta) ?? row.post_date.toISOString().slice(0, 10),
      tileColumns: colNumb ? Number(colNumb) : 3,
      sortNumber: sortNumber ? Number(sortNumber) : undefined,
      thumbnail: thumbnail ?? '',
      lead: lead || undefined,
      copyright: copyright || undefined,
      credits,
      backgroundColor: backgroundColor || undefined,
      textColor: textColor || undefined,
      body: parseBlocks(row.post_content),
      seo: metaDesc ? { description: metaDesc } : undefined,
    });
  }

  return {
    migrated: published.length,
    skippedDrafts: drafts.map((d) => ({ id: d.ID, title: d.post_title, status: d.post_status })),
    missingThumbnails: [], // filled in below by caller if needed
  };
}

async function resolveMenuItemTarget(conn, item) {
  if (item.type === 'custom') {
    return { url: item.url, label: item.title };
  }
  // type === 'post_type': resolve the linked page/post's slug + title.
  const rows = await query(conn, 'SELECT post_name, post_title FROM wp_posts WHERE ID = ?', [item.objectId]);
  const target = rows[0];
  if (!target) return { url: '#', label: item.title || '(missing target)' };
  return {
    url: `/${target.post_name}/`,
    label: item.title || target.post_title,
  };
}

async function migrateNavigation(conn) {
  const [themeModsRow] = await query(conn, "SELECT option_value FROM wp_options WHERE option_name = 'theme_mods_mim'");
  const themeMods = parseThemeMods(themeModsRow.option_value);
  const locations = themeMods.nav_menu_locations ?? {};

  for (const location of ['main-menu', 'main-menu-mobile', 'social-menu', 'footer-menu']) {
    const termId = locations[location];
    if (!termId) {
      writeJson('navigation', location, { location, items: [] });
      continue;
    }

    const menuItemRows = await query(
      conn,
      `SELECT p.ID, p.post_title, p.menu_order
       FROM wp_posts p
       JOIN wp_term_relationships tr ON tr.object_id = p.ID
       JOIN wp_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
       WHERE p.post_type = 'nav_menu_item' AND tt.term_id = ?
       ORDER BY p.menu_order`,
      [termId],
    );

    const items = [];
    for (const row of menuItemRows) {
      const metaRows = await query(
        conn,
        `SELECT meta_key, meta_value FROM wp_postmeta WHERE post_id = ? AND meta_key IN
         ('_menu_item_type','_menu_item_object_id','_menu_item_url','_menu_item_target','_menu_item_menu_item_parent')`,
        [row.ID],
      );
      const meta = Object.fromEntries(metaRows.map((m) => [m.meta_key, m.meta_value]));
      const target = await resolveMenuItemTarget(conn, {
        type: meta._menu_item_type,
        objectId: meta._menu_item_object_id,
        url: meta._menu_item_url,
        title: row.post_title,
      });
      items.push({
        label: target.label,
        url: target.url,
        target: meta._menu_item_target || undefined,
        children: [], // none of the current menus are nested (all parent=0)
      });
    }

    writeJson('navigation', location, { location, items });
  }

  return themeMods;
}

async function migrateSiteSettings(conn, themeMods, frontPageId) {
  const [widgetTextRow] = await query(conn, "SELECT option_value FROM wp_options WHERE option_name = 'widget_text'");
  const widgetTextData = parseWidgetText(widgetTextRow.option_value);
  const sidebarWidgets = themeMods.sidebars_widgets?.data ?? {};

  const footerAddress1 = resolveTextWidgets(sidebarWidgets['footer-adress'], widgetTextData);
  const footerAddress2 = resolveTextWidgets(sidebarWidgets['footer-adress2'], widgetTextData);

  const [frontPage] = await query(conn, 'SELECT post_title FROM wp_posts WHERE ID = ?', [frontPageId]);
  const frontMetaDesc = await getMeta(conn, frontPageId, '_yoast_wpseo_metadesc');

  writeJson('site', 'settings', {
    footerAddress1,
    footerAddress2,
    gaTrackingId: 'UA-158008354-1', // hardcoded in header.php, not DB-driven
    homeSeo: {
      title: frontPage?.post_title || undefined,
      description: frontMetaDesc || undefined,
    },
  });

  return { footerAddress1Count: footerAddress1.length, footerAddress2Count: footerAddress2.length };
}

async function main() {
  const conn = await connect();

  const [[{ option_value: frontPageIdRaw }]] = [
    await query(conn, "SELECT option_value FROM wp_options WHERE option_name = 'page_on_front'"),
  ];
  const frontPageId = Number(frontPageIdRaw);

  await migrateCategories(conn);
  const pagesResult = await migratePages(conn, frontPageId);
  const postsResult = await migratePosts(conn);
  const themeMods = await migrateNavigation(conn);
  const settingsResult = await migrateSiteSettings(conn, themeMods, frontPageId);

  await conn.end();

  console.log('\n=== Migration report ===');
  console.log(`Pages migrated: ${pagesResult.migrated}`);
  console.log('Pages skipped:', pagesResult.skipped);
  console.log(`Posts migrated: ${postsResult.migrated}`);
  console.log('Draft posts skipped (not migrated):', postsResult.skippedDrafts);
  console.log('Footer widget counts:', settingsResult);
  console.log('Block mapping report:', blockMigrationReport());
  console.log('Image report:', imageReport());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
