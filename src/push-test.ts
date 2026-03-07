import * as fs from 'fs/promises';
import * as path from 'path';
import * as dotenv from 'dotenv';
import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api';

dotenv.config();

const EXPORT_PATH = path.resolve('data/products_export.json');

const api = new WooCommerceRestApi({
  url:            process.env.WC_URL!,
  consumerKey:    process.env.WC_CONSUMER_KEY!,
  consumerSecret: process.env.WC_CONSUMER_SECRET!,
  version:        'wc/v3',
});

async function importTest() {
  console.log('Reading products_export.json...');
  const products: any[] = JSON.parse(await fs.readFile(EXPORT_PATH, 'utf-8'));

  const product = products[0];
  if (!product) {
    console.log('No products found.');
    return;
  }

  console.log(`Sending product id=${product.id} (${product.name})...`);
  console.log('Payload:', JSON.stringify(product, null, 2));

  try {
    const response = await api.put(`products/${product.id}`, product);
    console.log('\n[OK] Response:', JSON.stringify(response.data, null, 2));
  } catch (err: any) {
    console.error('\n[FAIL]:', err?.response?.data ?? err.message);
  }
}

importTest().catch(console.error);
