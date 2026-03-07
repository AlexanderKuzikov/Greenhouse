import * as fs from 'fs/promises';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { google } from 'googleapis';

dotenv.config();

const CREDENTIALS_PATH = path.resolve(process.env.GOOGLE_CREDENTIALS_PATH!);
const SPREADSHEET_ID   = process.env.GOOGLE_SPREADSHEET_ID!;
const OUTPUT_PATH      = path.resolve('data/products_table.json');

const PRODUCTS_SHEET = 'Товары';

const HEADERS = [
  'id', 'sku', 'name_line1', 'name_line2', 'short_description',
  'regular_price', 'category_price', 'category_size', 'category_event', 'category_type',
  'badge', 'date_created', 'status', 'permalink', 'image_url', 'slug',
];

const NUMBER_FIELDS = new Set(['id', 'regular_price']);

async function getSheets() {
  const credentials = JSON.parse(await fs.readFile(CREDENTIALS_PATH, 'utf-8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

function parseImageFormula(formula: string): string {
  const match = formula.match(/=IMAGE\("([^"]+)"\)/i);
  return match ? match[1] : formula;
}

function excelSerialToISO(serial: number): string {
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(ms).toISOString().slice(0, 19);
}

function parseCell(header: string, value: string): any {
  if (NUMBER_FIELDS.has(header)) return value ? Number(value) : null;
  if (header === 'image_url')    return parseImageFormula(value);
  if (header === 'date_created') {
    const n = Number(value);
    return isNaN(n) ? value : excelSerialToISO(n);
  }
  return value ?? '';
}

async function importFromSheets() {
  console.log('Connecting to Google Sheets...');
  const sheets = await getSheets();

  console.log(`Reading sheet "${PRODUCTS_SHEET}"...`);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range:         `${PRODUCTS_SHEET}!A1:Z10000`,
    valueRenderOption: 'FORMULA',
  });

  const rows: string[][] = response.data.values ?? [];
  if (rows.length < 2) {
    console.log('Sheet is empty.');
    return;
  }

  const sheetHeaders: string[] = rows[0];
  const colIndex = (h: string) => sheetHeaders.indexOf(h);

  const products = rows.slice(1)
    .filter(row => row.some(cell => cell !== ''))
    .map(row => {
      const product: Record<string, any> = {};
      for (const h of HEADERS) {
        const idx = colIndex(h);
        const raw = idx >= 0 ? (row[idx] ?? '') : '';
        product[h] = parseCell(h, String(raw));
      }
      return product;
    })
    .filter(p => p.id);

  console.log(`Parsed ${products.length} products.`);

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(products, null, 2), 'utf-8');
  console.log(`Saved to ${OUTPUT_PATH}`);
}

importFromSheets().catch(console.error);
