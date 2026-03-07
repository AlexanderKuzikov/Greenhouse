import * as fs from 'fs/promises';
import * as path from 'path';
import * as dotenv from 'dotenv';
import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api';

dotenv.config();

const OUTPUT_PATH = path.resolve('data/categories.json');

const api = new WooCommerceRestApi({
  url:            process.env.WC_URL!,
  consumerKey:    process.env.WC_CONSUMER_KEY!,
  consumerSecret: process.env.WC_CONSUMER_SECRET!,
  version:        'wc/v3',
});

async function fetchAllCategories() {
  const all: any[] = [];
  let page = 1;

  while (true) {
    const response = await api.get('products/categories', { per_page: 100, page });
    const data = response.data;
    if (!data.length) break;
    all.push(...data);
    if (data.length < 100) break;
    page++;
  }

  return all;
}

async function main() {
  console.log('Fetching categories...');
  const categories = await fetchAllCategories();

  const slim = categories.map(({ id, slug, name }: any) => ({ id, slug, name }));

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(slim, null, 2), 'utf-8');
  console.log(`Done. Saved ${slim.length} categories to ${OUTPUT_PATH}`);

  console.log('\nslug → id → name:');
  for (const cat of slim) {
    console.log(`  '${cat.slug}': ${cat.id},  // ${cat.name}`);
  }
}

main().catch(console.error);
