import * as fs from 'fs/promises';
import * as path from 'path';

const EXPORT_PATH = path.resolve('data/products_export.json');
const FULL_PATH   = path.resolve('data/products_full.json');

function diffProduct(exported: any, full: any): Record<string, any> | null {
  const FIELDS = ['sku', 'slug', 'name', 'short_description', 'regular_price', 'status', 'date_created'];
  const changes: Record<string, any> = {};

  for (const field of FIELDS) {
    const exportedVal = String(exported[field] ?? '');
    const fullVal     = String(full[field] ?? '');
    if (exportedVal !== fullVal) {
      changes[field] = { was: fullVal, now: exportedVal };
    }
  }

  const exportedIds = exported.categories.map((c: any) => c.id).sort().join(',');
  const fullIds     = (full.categories ?? []).map((c: any) => c.id).sort().join(',');
  if (exportedIds !== fullIds) {
    changes['categories'] = { was: fullIds, now: exportedIds };
  }

  return Object.keys(changes).length > 0 ? changes : null;
}

async function checkDiff() {
  console.log('Reading products_export.json...');
  const exported: any[] = JSON.parse(await fs.readFile(EXPORT_PATH, 'utf-8'));

  console.log('Reading products_full.json...');
  const full: any[] = JSON.parse(await fs.readFile(FULL_PATH, 'utf-8'));
  const fullMap = new Map(full.map(p => [p.id, p]));

  let changedCount = 0;
  const fieldStats: Record<string, number> = {};
  const examples: Record<string, any> = {};

  for (const p of exported) {
    const original = fullMap.get(p.id);
    if (!original) {
      console.warn(`[SKIP] id=${p.id} not found in products_full.json`);
      continue;
    }
    const changes = diffProduct(p, original);
    if (changes) {
      changedCount++;
      for (const field of Object.keys(changes)) {
        fieldStats[field] = (fieldStats[field] ?? 0) + 1;
        // Сохраняем по одному примеру на поле
        if (!examples[field]) {
          examples[field] = { id: p.id, ...changes[field] };
        }
      }
    }
  }

  if (changedCount === 0) {
    console.log('\nNo differences found. Data is in sync.');
    return;
  }

  console.log(`\nTotal products with changes: ${changedCount}`);
  console.log('\n--- Field stats ---');
  for (const [field, count] of Object.entries(fieldStats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${field}: ${count} products`);
    const ex = examples[field];
    console.log(`    example id=${ex.id}:`);
    console.log(`      was: ${JSON.stringify(ex.was)}`);
    console.log(`      now: ${JSON.stringify(ex.now)}`);
  }
}

checkDiff().catch(console.error);
