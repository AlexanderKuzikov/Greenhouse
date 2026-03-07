import * as fs from 'fs/promises';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { google } from 'googleapis';

dotenv.config();

const CREDENTIALS_PATH = path.resolve(process.env.GOOGLE_CREDENTIALS_PATH!);
const SPREADSHEET_ID   = process.env.GOOGLE_SPREADSHEET_ID!;
const INPUT_PATH       = path.resolve('data/products_table.json');

const PRODUCTS_SHEET  = 'Товары';
const REFERENCE_SHEET = 'Справочник';

const PRICE_OPTIONS  = ['до 2500 руб.', 'от 2500 до 5000 руб.', 'от 5000 до 7500 руб.', 'свыше 7500 руб.'];
const SIZE_OPTIONS   = ['Малый', 'Средний', 'Большой', 'Гигантский'];
const EVENT_OPTIONS  = ['', 'Свадебный букет', '1 Сентября', 'Букет для мамы', 'Тюльпаны 8 Марта'];
const TYPE_OPTIONS   = ['', 'Букеты из роз'];
const STATUS_OPTIONS = ['publish', 'draft'];
const BADGE_OPTIONS  = ['', 'Новинка'];

const HEADERS = [
  'id', 'sku', 'name_line1', 'name_line2', 'short_description',
  'regular_price', 'category_price', 'category_size', 'category_event', 'category_type',
  'badge', 'date_created', 'status', 'permalink', 'image_url', 'slug',
];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function getSheets() {
  const credentials = JSON.parse(await fs.readFile(CREDENTIALS_PATH, 'utf-8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function ensureSheets(sheets: any) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existing = meta.data.sheets.map((s: any) => s.properties.title);

  const requests: any[] = [];
  for (const title of [PRODUCTS_SHEET, REFERENCE_SHEET]) {
    if (!existing.includes(title)) {
      requests.push({ addSheet: { properties: { title } } });
    }
  }
  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests } });
    console.log(`Created sheets: ${requests.map(r => r.addSheet.properties.title).join(', ')}`);
  }
}

async function getSheetId(sheets: any, title: string): Promise<number> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = meta.data.sheets.find((s: any) => s.properties.title === title);
  return sheet.properties.sheetId;
}

async function writeReferenceSheet(sheets: any) {
  const maxLen = Math.max(
    PRICE_OPTIONS.length, SIZE_OPTIONS.length, EVENT_OPTIONS.length,
    TYPE_OPTIONS.length, STATUS_OPTIONS.length, BADGE_OPTIONS.length,
  );
  const rows: string[][] = [
    ['category_price', 'category_size', 'category_event', 'category_type', 'status', 'badge'],
  ];
  for (let i = 0; i < maxLen; i++) {
    rows.push([
      PRICE_OPTIONS[i]  ?? '',
      SIZE_OPTIONS[i]   ?? '',
      EVENT_OPTIONS[i]  ?? '',
      TYPE_OPTIONS[i]   ?? '',
      STATUS_OPTIONS[i] ?? '',
      BADGE_OPTIONS[i]  ?? '',
    ]);
  }

  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${REFERENCE_SHEET}!A1:Z1000`,
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${REFERENCE_SHEET}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });
  console.log('Reference sheet updated.');
}

async function writeProductsSheet(sheets: any, products: any[]) {
  const rows: any[][] = [HEADERS];

  for (const p of products) {
    rows.push(HEADERS.map(h => {
      if (h === 'image_url') return `=IMAGE("${p[h]}")`;
      if (h === 'sku')       return `'${p[h]}`;
      return p[h] ?? '';
    }));
  }

  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${PRODUCTS_SHEET}!A1:Z10000`,
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${PRODUCTS_SHEET}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: rows },
  });
  console.log(`Written ${products.length} products to sheet.`);
}

async function applyFormatting(sheets: any, productCount: number) {
  const sheetId = await getSheetId(sheets, PRODUCTS_SHEET);
  const lastRow = productCount + 1;
  const colIndex = (name: string) => HEADERS.indexOf(name);

  const refDropdown = (col: string, refCol: number, optionCount: number) => ({
    setDataValidation: {
      range: {
        sheetId,
        startRowIndex: 1, endRowIndex: lastRow,
        startColumnIndex: colIndex(col), endColumnIndex: colIndex(col) + 1,
      },
      rule: {
        condition: {
          type: 'ONE_OF_RANGE',
          values: [{
            userEnteredValue: `=${REFERENCE_SHEET}!${String.fromCharCode(65 + refCol)}2:${String.fromCharCode(65 + refCol)}${optionCount + 1}`,
          }],
        },
        showCustomUi: true,
        strict: true,
      },
    },
  });

  const protectRange = (startCol: number, endCol: number, desc: string) => ({
    addProtectedRange: {
      protectedRange: {
        range: { sheetId, startRowIndex: 1, endRowIndex: lastRow, startColumnIndex: startCol, endColumnIndex: endCol },
        description: desc,
        warningOnly: true,
      },
    },
  });

  const permalinkIdx = colIndex('permalink');

  const requests: any[] = [
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: 'gridProperties.frozenRowCount',
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: colIndex('image_url'), endIndex: colIndex('image_url') + 1 },
        properties: { hiddenByUser: true },
        fields: 'hiddenByUser',
      },
    },
    refDropdown('category_price', 0, PRICE_OPTIONS.length),
    refDropdown('category_size',  1, SIZE_OPTIONS.length),
    refDropdown('category_event', 2, EVENT_OPTIONS.length),
    refDropdown('category_type',  3, TYPE_OPTIONS.length),
    refDropdown('status',         4, STATUS_OPTIONS.length),
    refDropdown('badge',          5, BADGE_OPTIONS.length),
    protectRange(0, 1, 'Read-only: id'),
    protectRange(permalinkIdx, permalinkIdx + 3, 'Read-only: permalink, image_url, slug'),
  ];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests },
  });
  console.log('Formatting applied.');
}

async function exportToSheets() {
  console.log('Reading products_table.json...');
  const products = JSON.parse(await fs.readFile(INPUT_PATH, 'utf-8'));

  console.log('Connecting to Google Sheets...');
  const sheets = await getSheets();

  await ensureSheets(sheets);        await sleep(500);
  await writeReferenceSheet(sheets); await sleep(500);
  await writeProductsSheet(sheets, products); await sleep(500);
  await applyFormatting(sheets, products.length);

  console.log(`\nDone. Open your spreadsheet:`);
  console.log(`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`);
}

exportToSheets().catch(console.error);
