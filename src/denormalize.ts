import * as fs from 'fs/promises';
import * as path from 'path';

const INPUT_PATH  = path.resolve('data/products_table.json');
const OUTPUT_PATH = path.resolve('data/products_export.json');

const NAME_TO_ID: Record<string, number> = {
  'до 2500 руб.':           39,
  'от 2500 до 5000 руб.':   40,
  'от 5000 до 7500 руб.':   41,
  'свыше 7500 руб.':        43,
  'Малый':                  23,
  'Средний':                24,
  'Большой':                25,
  'Гигантский':             26,
  'Свадебный букет':        51,
  '1 Сентября':             44,
  'Букет для мамы':         34,
  'Тюльпаны 8 Марта':       35,
  'Букеты из роз':          32,
  'Новинка':                38,
};

function buildName(name_line1: string, name_line2: string): string {
  if (!name_line2) return name_line1;
  return `${name_line1} </br>${name_line2}`;
}

function buildShortDescription(text: string): string {
  if (!text) return '';

  const [composition, dimensions] = text.split(/\s+(?=Диаметр)/);

  const compositionLines = composition.split(/,\s+/);
  const compositionHtml = compositionLines.length === 1
    ? `<p>${composition}</p>`
    : `<p>${compositionLines.join(',<br />\n')}</p>`;

  if (!dimensions) return compositionHtml;

  return `${compositionHtml}\n\n<p>${dimensions}</p>`;
}

function buildCategories(
  category_price: string,
  category_size: string,
  category_event: string,
  category_type: string,
  badge: string,
): Array<{ id: number }> {
  return [category_price, category_size, category_event, category_type, badge]
    .filter(name => name && NAME_TO_ID[name] !== undefined)
    .map(name => ({ id: NAME_TO_ID[name] }));
}

function denormalizeProduct(p: any) {
  return {
    id:                p.id,
    sku:               p.sku,
    slug:              p.slug,
    name:              buildName(p.name_line1, p.name_line2),
    short_description: buildShortDescription(p.short_description),
    regular_price:     String(p.regular_price),
    status:            p.status,
    date_created:      p.date_created,
    categories:        buildCategories(
                         p.category_price,
                         p.category_size,
                         p.category_event,
                         p.category_type,
                         p.badge,
                       ),
  };
}

async function denormalize() {
  console.log('Reading products_table.json...');
  const products = JSON.parse(await fs.readFile(INPUT_PATH, 'utf-8'));

  console.log(`Denormalizing ${products.length} products...`);
  const exported = products.map(denormalizeProduct);

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(exported, null, 2), 'utf-8');
  console.log(`Done. Saved ${exported.length} products to ${OUTPUT_PATH}`);
}

denormalize().catch(console.error);
