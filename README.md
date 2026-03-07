# 🌿 Greenhouse

> CLI-инструмент синхронизации каталога WooCommerce через локальные JSON-снапшоты и Google Sheets.

**Автор:** [Alexander Kuzikov](https://github.com/AlexanderKuzikov)  
**Репозиторий:** [github.com/AlexanderKuzikov/Greenhouse](https://github.com/AlexanderKuzikov/Greenhouse)

---

## Что это

Greenhouse позволяет управлять каталогом товаров WooCommerce без входа в админку.  
Менеджер редактирует товары в Google Sheets — скрипт синхронизирует изменения с сайтом, отправляя только изменённые поля.

---

## Архитектура

```
WooCommerce
    ↕  pull / push
products_full.json       ← полный снапшот с сайта
    ↕  normalize / denormalize
products_table.json      ← нормализованная таблица
    ↕  export / import-sheets
Google Sheets            ← редактирование менеджером
```

---

## Скрипты

| Команда | Что делает |
|---|---|
| `npm run pull` | Скачивает все товары с WooCommerce → `products_full.json` |
| `npm run normalize` | Преобразует `products_full.json` → `products_table.json` |
| `npm run denormalize` | Преобразует `products_table.json` → `products_export.json` |
| `npm run check-diff` | Сравнивает `products_export.json` с `products_full.json`, показывает расхождения |
| `npm run export` | Экспортирует `products_table.json` в Google Sheets |
| `npm run import-sheets` | Импортирует данные из Google Sheets → `products_table.json` |
| `npm run push` | Пушит изменённые товары из `products_export.json` на сайт (diff-based) |
| `npm run push --dry-run` | Показывает что будет запушено без реальной отправки |
| `npm run sync-images` | Синхронизирует изображения товаров |
| `npm run fetch-categories` | Скачивает список категорий с сайта |

---

## Рабочие циклы

### WooCommerce → Google Sheets
```bash
npm run pull
npm run normalize
npm run check-diff    # убеждаемся что diff = 0
npm run export
```

### Google Sheets → WooCommerce
```bash
npm run import-sheets
npm run denormalize
npm run check-diff    # смотрим что изменилось
npm run push
npm run pull          # обновляем эталон после пуша
```

### Проверка синхронизации без изменений
```bash
npm run pull
npm run normalize
npm run denormalize
npm run check-diff    # должно быть "No differences found"
```

---

## Установка

```bash
git clone https://github.com/AlexanderKuzikov/Greenhouse.git
cd Greenhouse
npm install
```

Создай `.env` в корне проекта:

```env
WC_URL=https://your-site.com
WC_CONSUMER_KEY=ck_...
WC_CONSUMER_SECRET=cs_...
GOOGLE_CREDENTIALS_PATH=./credentials.json
GOOGLE_SPREADSHEET_ID=your_spreadsheet_id
```

---

## Структура файлов

```
data/
  products_full.json     ← снапшот с сайта (эталон)
  products_table.json    ← нормализованная таблица для редактирования
  products_export.json   ← денормализованный экспорт для пуша
  push-report.json       ← отчёт последнего пуша
src/
  pull.ts
  normalize.ts
  denormalize.ts
  check-diff.ts
  export.ts
  import-sheets.ts
  push.ts
  push-test.ts
  sync-images.ts
  fetch-categories.ts
```

---

## Требования

- Node.js 18+
- TypeScript 5+
- WooCommerce REST API (Consumer Key + Secret)
- Google Cloud сервисный аккаунт с доступом к Sheets API
