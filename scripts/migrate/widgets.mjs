import { unserialize } from 'php-serialize';

/** Parses a WP `theme_mods_*` option value into a plain object. */
export function parseThemeMods(serialized) {
  return unserialize(serialized);
}

/** Parses the `widget_text` option (classic Text widget instances). */
export function parseWidgetText(serialized) {
  return unserialize(serialized);
}

/**
 * Resolves a sidebar's widget-id list (e.g. ["text-2"]) against the
 * unserialized widget_text option, returning {title, content} entries.
 * Widget ids with no corresponding entry (deleted/never filled in) are
 * skipped rather than producing empty placeholders.
 */
export function resolveTextWidgets(widgetIds, widgetTextData) {
  const entries = [];
  for (const id of widgetIds ?? []) {
    const match = id.match(/^text-(\d+)$/);
    if (!match) continue;
    const data = widgetTextData?.[Number(match[1])];
    if (!data || !data.text) continue;
    entries.push({ title: data.title || undefined, content: data.text });
  }
  return entries;
}
