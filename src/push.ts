import * as fs from 'fs/promises';
import * as path from 'path';
import * as dotenv from 'dotenv';
import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api';

dotenv.config();

const EXPORT_PATH = path.resolve('data/products_export.json');
const FULL_PATH   = path.resolve('data/products_full.json');
const REPORT_PATH = path.resolve('data/push-report.json');

const BATCH_SIZE  = 5;
const BATCH_DELAY = 1000;
const RETRY_LIMIT = 3;
const RETRY_DELAY = 2000;

const DRY_RUN = process.argv.includes('--dry-run');

const api = new WooCommerceRestApi({
  url:            process.env.WC_URL!,
  consumerKey:    process.env.WC_CONSUMER_KEY!,
  consumerSecret: process.env.WC_CONSUMER_SECRET!,
  version:        'wc/v3',
});

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function normalizeCategoryIds(categories: any[]): string {
  return JSON.stringify(
    (categories ?? []).map((c: any) => c.id).sort((a: number, b: number) => a - b),
  );
}

function diffFields(exported: any, full: any): Record<string, any> | null {
  const changed: Record<string, any> = {};

  for (const key of Object.keys(exported)) {
    if (key === 'id') continue;

    let a: string;
    let b: string;

    if (key === 'categories') {
      a = normalizeCategoryIds(exported[key]);
      b = normalizeCategoryIds(full[key]);
    } else {
      a = JSON.stringify(exported[key]);
      b = JSON.stringify(full[key]);
    }

    if (a !== b) changed[key] = exported[key];
  }

  return Object.keys(changed).length > 0 ? changed : null;
}

async function pushWithRetry(
  id: number,
  payload: Record<string, any>,
  attempt = 1,
): Promise<{ id: number; status: 'ok' | 'fail'; error?: string }> {
  if (DRY_RUN) return { id, status: 'ok' };
  try {
    await api.put(`products/${id}`, payload);
    return { id, status: 'ok' };
  } catch (err: any) {
    const code = err?.response?.status;
    if (attempt < RETRY_LIMIT && (code === 429 || code >= 500)) {
      console.warn(`  [RETRY ${attempt}] id=${id}, status=${code}`);
      await sleep(RETRY_DELAY * attempt);
      return pushWithRetry(id, payload, attempt + 1);
    }
    const error = JSON.stringify(err?.response?.data ?? err.message);
    return { id, status: 'fail', error };
  }
}

async function push() {
  console.log('Reading files...');
  const exported: any[] = JSON.parse(await fs.readFile(EXPORT_PATH, 'utf-8'));
  const full: any[]     = JSON.parse(await fs.readFile(FULL_PATH,   'utf-8'));

  const fullById = new Map(full.map(p => [p.id, p]));

  const toUpdate: Array<{ id: number; payload: Record<string, any> }> = [];

  for (const exp of exported) {
    const orig = fullById.get(exp.id);
    if (!orig) {
      console.warn(`  [SKIP] id=${exp.id} not found in products_full.json`);
      continue;
    }
    const diff = diffFields(exp, orig);
    if (diff) toUpdate.push({ id: exp.id, payload: diff });
  }

  console.log(`Products to update: ${toUpdate.length} of ${exported.length}${DRY_RUN ? ' [DRY-RUN]' : ''}`);

  if (toUpdate.length === 0) {
    console.log('Nothing to push.');
    return;
  }

  const results: Array<{ id: number; status: string; error?: string }> = [];

  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const batch = toUpdate.slice(i, i + BATCH_SIZE);
    console.log(`\nBatch ${Math.floor(i / BATCH_SIZE) + 1}: ids=${batch.map(x => x.id).join(', ')}`);

    const batchResults = await Promise.all(
      batch.map(({ id, payload }) => {
        console.log(`  Pushing id=${id}, fields: ${Object.keys(payload).join(', ')}`);
        return pushWithRetry(id, { ...payload, id });
      }),
    );

    for (const r of batchResults) {
      console.log(`  [${r.status.toUpperCase()}] id=${r.id}${r.error ? ': ' + r.error : ''}`);
      results.push(r);
    }

    if (i + BATCH_SIZE < toUpdate.length) await sleep(BATCH_DELAY);
  }

  const report = {
    date:    new Date().toISOString(),
    total:   toUpdate.length,
    ok:      results.filter(r => r.status === 'ok').length,
    fail:    results.filter(r => r.status === 'fail').length,
    results,
  };

  await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2), 'utf-8');

  console.log(`\nDone. OK: ${report.ok}, FAIL: ${report.fail}`);
  console.log(`Report saved to ${REPORT_PATH}`);
}

push().catch(console.error);
