import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.WC_URL!;
const KEY = process.env.WC_CONSUMER_KEY!;
const SECRET = process.env.WC_CONSUMER_SECRET!;
const PER_PAGE = 100;
const OUTPUT_PATH = path.resolve('data/products_full.json');

async function fetchPage(page: number): Promise<{ products: any[]; total: number }> {
  const response = await axios.get(`${BASE_URL}/wp-json/wc/v3/products`, {
    auth: { username: KEY, password: SECRET },
    params: { per_page: PER_PAGE, page, orderby: 'id', order: 'asc' },
  });

  const total = parseInt(response.headers['x-wp-total'] ?? '0', 10);
  return { products: response.data, total };
}

async function pull() {
  console.log('Starting pull from WooCommerce...');

  const { products: firstPage, total } = await fetchPage(1);
  const totalPages = Math.ceil(total / PER_PAGE);

  console.log(`Total products: ${total}, pages: ${totalPages}`);

  const allProducts = [...firstPage];

  for (let page = 2; page <= totalPages; page++) {
    console.log(`Fetching page ${page}/${totalPages}...`);
    const { products } = await fetchPage(page);
    allProducts.push(...products);
    await sleep(400);
  }

  await fs.mkdir('data', { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(allProducts, null, 2), 'utf-8');

  console.log(`Done. Saved ${allProducts.length} products to ${OUTPUT_PATH}`);
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

pull().catch(console.error);
