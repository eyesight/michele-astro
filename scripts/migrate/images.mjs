import fs from 'node:fs';
import path from 'node:path';

const WP_ROOT = '/Applications/MAMP/htdocs/michelle';
const UPLOADS_URL_MARKER = '/wp-content/uploads/';
const ASSET_DEST = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  '..',
  '..',
  'src',
  'assets',
  'uploads',
);

const copied = new Set();
const missing = [];
const external = [];

/**
 * Rewrites a WP media URL to a project-root-relative asset path
 * (e.g. "src/assets/uploads/2019/10/foo.jpg"), copying the physical file
 * from the WP install alongside it. URLs that aren't under
 * /wp-content/uploads/ (e.g. http://placehold.it placeholders used in this
 * dev DB) are passed through unchanged and logged for review.
 */
export function resolveImage(url) {
  if (!url) return url;

  const markerIndex = url.indexOf(UPLOADS_URL_MARKER);
  if (markerIndex === -1) {
    external.push(url);
    return url;
  }

  const relPath = url.slice(markerIndex + UPLOADS_URL_MARKER.length);
  const srcFile = path.join(WP_ROOT, 'wp-content/uploads', relPath);
  const destFile = path.join(ASSET_DEST, relPath);
  const destProjectPath = path.join('src/assets/uploads', relPath).split(path.sep).join('/');

  if (!copied.has(destFile)) {
    if (!fs.existsSync(srcFile)) {
      missing.push(srcFile);
    } else {
      fs.mkdirSync(path.dirname(destFile), { recursive: true });
      fs.copyFileSync(srcFile, destFile);
    }
    copied.add(destFile);
  }

  return destProjectPath;
}

export function imageReport() {
  return { copiedCount: copied.size, missing, external };
}
