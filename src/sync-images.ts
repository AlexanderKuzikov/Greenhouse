import axios from 'axios';
import * as fs from 'fs/promises';
import * as fss from 'fs';
import * as path from 'path';

const INPUT_PATH  = path.resolve('data/products_table.json');
const IMAGES_DIR  = path.resolve('data/images');

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function downloadImage(url: string, dest: string): Promise<void> {
  const response = await axios.get(url, { responseType: 'stream' });
  const writer = fss.createWriteStream(dest);
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

async function syncImages() {
  await fs.mkdir(IMAGES_DIR, { recursive: true });

  const products = JSON.parse(await fs.readFile(INPUT_PATH, 'utf-8'));
  const total = products.length;

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const url = product.image_url;

    if (!url) {
      console.log(`[${i + 1}/${total}] SKU ${product.sku} — no image, skipping`);
      skipped++;
      continue;
    }

    const filename = path.basename(new URL(url).pathname);
    const dest = path.join(IMAGES_DIR, filename);

    if (fss.existsSync(dest)) {
      console.log(`[${i + 1}/${total}] ${filename} — already exists, skipping`);
      skipped++;
      continue;
    }

    try {
      console.log(`[${i + 1}/${total}] Downloading ${filename}...`);
      await downloadImage(url, dest);
      downloaded++;
      await sleep(300);
    } catch (err) {
      console.error(`[${i + 1}/${total}] FAILED: ${filename} — ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(`\nDone. Downloaded: ${downloaded}, skipped: ${skipped}, failed: ${failed}`);
}

syncImages().catch(console.error);
