import fs from 'node:fs';
import path from 'node:path';

const ASSET_DEST = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  '..',
  '..',
  'public',
  'uploads',
);

const downloaded = new Map(); // url -> root-relative URL (in-flight de-dupe)
const failed = [];

/**
 * Downloads a live wp-content/uploads image to public/uploads/<relpath> and
 * returns the root-relative URL to reference in content JSON (plain <img
 * src>, no build-time image-optimization resolution needed). Non-uploads
 * URLs (shouldn't normally occur on this site, but just in case) are passed
 * through unchanged.
 */
export async function downloadImage(url) {
  if (!url) return url;
  if (downloaded.has(url)) return downloaded.get(url);

  const marker = '/wp-content/uploads/';
  const markerIndex = url.indexOf(marker);
  if (markerIndex === -1) {
    downloaded.set(url, url);
    return url;
  }

  const relPath = decodeURIComponent(url.slice(markerIndex + marker.length));
  const destFile = path.join(ASSET_DEST, relPath);
  const destProjectPath = '/' + path.join('uploads', relPath).split(path.sep).join('/');

  if (!fs.existsSync(destFile)) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (migration-script)' } });
      if (!res.ok) throw new Error(`${res.status}`);
      fs.mkdirSync(path.dirname(destFile), { recursive: true });
      fs.writeFileSync(destFile, Buffer.from(await res.arrayBuffer()));
    } catch (err) {
      failed.push({ url, error: String(err) });
      downloaded.set(url, url); // fall back to the remote URL
      return url;
    }
  }

  downloaded.set(url, destProjectPath);
  return destProjectPath;
}

export function imageReport() {
  return { downloadedCount: downloaded.size, failed };
}
