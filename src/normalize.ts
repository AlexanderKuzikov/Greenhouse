import * as fs from 'fs/promises';
import * as path from 'path';

const INPUT_PATH = path.resolve('data/products_full.json');
const OUTPUT_PATH = path.resolve('data/products_table.json');

const PRICE_SLUGS = new Set(['do-2500-rub', 'ot-2500-do-5000-rub', 'ot-5000-do-7500-rub', 'svyshe-7500-rub']);
const SIZE_SLUGS  = new Set(['malyj', 'srednij', 'bolshoj', 'gigantskij']);
const EVENT_SLUGS = new Set(['svadebnyj-buket', '1-sentjabrja', 'buket-dlja-mamy', 'tjulpany']);
const TYPE_SLUGS  = new Set(['bukety-iz-roz']);
const NEW_SLUG    = 'novinka';

function parseName(raw: string): { name_line1: string; name_line2: string } {
  const decoded = raw.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
  const parts = decoded.split(/<\/?\s*br\s*\/?>/i);
  return {
    name_line1: parts[0]?.trim() ?? '',
    name_line2: parts[1]?.trim() ?? '',
  };
}

function classifyCategories(categories: Array<{ id: number; name: string; slug: string }>) {
  let category_price = '';
  let category_size  = '';
  let category_event = '';
  let category_type  = '';
  let is_new         = false;

  for (const cat of categories) {
    if (cat.slug === NEW_SLUG)           is_new = true;
    else if (PRICE_SLUGS.has(cat.slug)) category_price = cat.name;
    else if (SIZE_SLUGS.has(cat.slug))  category_size  = cat.name;
    else if (EVENT_SLUGS.has(cat.slug)) category_event = cat.name;
    else if (TYPE_SLUGS.has(cat.slug))  category_type  = cat.name;
  }

  return { category_price, category_size, category_event, category_type, is_new };
}

function normalizeProduct(raw: any) {
  const { name_line1, name_line2 } = parseName(raw.name ?? '');
  const categories = classifyCategories(raw.categories ?? []);

  return {
    id:                raw.id,
    sku:               raw.sku,
    slug:              raw.slug,
    permalink:         raw.permalink,
    image_url:         raw.images?.[0]?.src ?? '',
    name_line1,
    name_line2,
    description:       raw.description ?? '',
    short_description: raw.short_description ?? '',
    regular_price:     raw.regular_price ?? '',
    status:            raw.status,
    date_created:      raw.date_created,
    ...categories,
  };
}

async function normalize() {
  console.log('Reading products_full.json...');
  const products = JSON.parse(await fs.readFile(INPUT_PATH, 'utf-8'));

  console.log(`Normalizing ${products.length} products...`);
  const normalized = products.map(normalizeProduct);

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(normalized, null, 2), 'utf-8');
  console.log(`Done. Saved ${normalized.length} products to ${OUTPUT_PATH}`);
}

normalize().catch(console.error);
