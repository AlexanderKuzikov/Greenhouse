import * as fs from 'fs/promises';
import * as path from 'path';

const INPUT_PATH  = path.resolve('data/products_full.json');
const OUTPUT_PATH = path.resolve('data/products_table.json');

const CATEGORY_PRICE: Record<number, string> = {
  39: 'до 2500 руб.',
  40: 'от 2500 до 5000 руб.',
  41: 'от 5000 до 7500 руб.',
  43: 'свыше 7500 руб.',
};

const CATEGORY_SIZE: Record<number, string> = {
  23: 'Малый',
  24: 'Средний',
  25: 'Большой',
  26: 'Гигантский',
};

const CATEGORY_EVENT: Record<number, string> = {
  51: 'Свадебный букет',
  44: '1 Сентября',
  34: 'Букет для мамы',
  35: 'Тюльпаны 8 Марта',
};

const CATEGORY_TYPE: Record<number, string> = {
  32: 'Букеты из роз',
};

const BADGE: Record<number, string> = {
  38: 'Новинка',
};

function decodeEntities(str: string): string {
  return str
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#8212;/g, '—')
    .replace(/&#\d+;/g, '')
    .replace(/&[a-z]+;/g, '');
}

function stripHtml(str: string): string {
  return str.replace(/<[^>]+>/g, '');
}

function cleanText(str: string): string {
  return decodeEntities(stripHtml(str)).replace(/\s+/g, ' ').trim();
}

function parseName(raw: string): { name_line1: string; name_line2: string } {
  const clean = decodeEntities(raw);
  const match = clean.match(/^(.*?)\s*<\/br>(.*?)$/s);
  if (match) {
    return {
      name_line1: match[1].trim(),
      name_line2: match[2].trim(),
    };
  }
  return { name_line1: cleanText(raw), name_line2: '' };
}

function parseShortDescription(raw: string): string {
  const text = cleanText(raw)
    .replace(/([^\s])(Диаметр)/g, '$1 $2');
  return text;
}

function parseCategories(categories: any[]) {
  let category_price = '';
  let category_size  = '';
  let category_event = '';
  let category_type  = '';
  let badge          = '';

  for (const cat of categories) {
    const id = cat.id;
    if (CATEGORY_PRICE[id])  category_price = CATEGORY_PRICE[id];
    if (CATEGORY_SIZE[id])   category_size  = CATEGORY_SIZE[id];
    if (CATEGORY_EVENT[id])  category_event = CATEGORY_EVENT[id];
    if (CATEGORY_TYPE[id])   category_type  = CATEGORY_TYPE[id];
    if (BADGE[id])           badge          = BADGE[id];
  }

  return { category_price, category_size, category_event, category_type, badge };
}

function normalizeProduct(p: any) {
  const { name_line1, name_line2 } = parseName(p.name ?? '');
  const cats = parseCategories(p.categories ?? []);

  return {
    id:                p.id,
    sku:               p.sku ?? '',
    slug:              p.slug ?? '',
    permalink:         p.permalink ?? '',
    image_url:         p.images?.[0]?.src ?? '',
    image_file:        p.images?.[0]?.name ?? '',
    name_line1,
    name_line2,
    short_description: parseShortDescription(p.short_description ?? ''),
    regular_price:     Number(p.regular_price) || 0,
    status:            p.status ?? 'draft',
    date_created:      p.date_created ?? '',
    ...cats,
  };
}

async function normalize() {
  console.log('Reading products_full.json...');
  const products = JSON.parse(await fs.readFile(INPUT_PATH, 'utf-8'));

  console.log(`Normalizing ${products.length} products...`);
  const table = products.map(normalizeProduct);

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(table, null, 2), 'utf-8');
  console.log(`Done. Saved ${table.length} products to ${OUTPUT_PATH}`);
}

normalize().catch(console.error);
