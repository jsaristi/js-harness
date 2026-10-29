// Prints the sitemap of the pages listed in `pages.json`, one path a line: `node scripts/sitemap.mjs`.
import fs from 'node:fs';
import { slug } from '../src/lib/slug.mjs';

const pages = JSON.parse(fs.readFileSync(new URL('../pages.json', import.meta.url), 'utf8'));
for (const page of pages) console.log(`/${page.section}/${slug(page.title)}`);
