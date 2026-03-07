import * as fs from 'fs/promises';
import * as path from 'path';
import * as dotenv from 'dotenv';
import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api';

dotenv.config();

const EXPORT_PATH = path.resolve('data/products_export.json');
const FULL_PATH   = path.resolve('data/products_full.json');

const api = new WooCommerceRestApi({
  url:            process.env.WC_URL!,
  consumerKey:    process.env.WC_CONSUMER_KEY!,
  consumerSecret: process.env.WC_CONSUMER_SECRET!,
  version:        'wc/v3',
});

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function diffProduct(exported: any, full: any): Record<string, any> | null {
  const FIELDS = ['sku', 'slug', 'name', 'short_description', 'regular_price', 'status', 'date_created'];
  const changes: Record<string, any> = {};

  for (const field of FIELDS) {
    const exportedVal = String(exported[field] ?? '');
    const fullVal     = String(full[field] ?? '');
    if (exportedVal !== fullVal) {
      changes[field] = exported[field];
    }
  }

  // Сравниваем категории по набору id
  const exportedIds = exported.categories.map((c: any) => c.id).sort().join(',');
  const fullIds     = (full.categories ?? []).map((c: any) => c.id).sort().join(',');
  if (exportedIds !== fullIds) {
    changes['categories'] = exported.categories;
  }

  return Object.keys(changes).length > 0 ? changes : null;
}

async function importProducts() {
  console.log('Reading products_export.json...');
  const exported: any[] = JSON.parse(await fs.readFile(EXPORT_PATH, 'utf-8'));

  console.log('Reading products_full.json...');
  const full: any[] = JSON.parse(await fs.readFile(FULL_PATH, 'utf-8'));
  const fullMap = new Map(full.map(p => [p.id, p]));

  const toUpdate: Array<{ id: number; changes: Record<string, any> }> = [];

  for (const p of exported) {
    const original = fullMap.get(p.id);
    if (!original) {
      console.warn(`  [SKIP] id=${p.id} not found in products_full.json`);
      continue;
    }
    const changes = diffProduct(p, original);
    if (changes) {
      toUpdate.push({ id: p.id, changes });
    }
  }

  if (toUpdate.length === 0) {
    console.log('No changes detected. Nothing to update.');
    return;
  }

  console.log(`\nFound ${toUpdate.length} products to update:`);
  for (const { id, changes } of toUpdate) {
    console.log(`  id=${id} changed fields: ${Object.keys(changes).join(', ')}`);
  }

  console.log('\nSending updates...');
  let success = 0;
  let failed  = 0;

  for (const { id, changes } of toUpdate) {
    try {
      await api.put(`products/${id}`, changes);
      console.log(`  [OK] id=${id}`);
      success++;
    } catch (err: any) {
      console.error(`  [FAIL] id=${id}:`, err?.response?.data ?? err.message);
      failed++;
    }
    await sleep(300);
  }

  console.log(`\nDone. Success: ${success}, Failed: ${failed}`);
}

importProducts().catch(console.error);
