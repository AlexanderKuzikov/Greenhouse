# \# 🌿 Greenhouse

# 

# > CLI-инструмент синхронизации каталога WooCommerce через локальные JSON-снапшоты и Google Sheets.

# 

# \*\*Автор:\*\* \[Alexander Kuzikov](https://github.com/AlexanderKuzikov)  

# \*\*Репозиторий:\*\* \[github.com/AlexanderKuzikov/Greenhouse](https://github.com/AlexanderKuzikov/Greenhouse)

# 

# ---

# 

# \## Что это

# 

# Greenhouse позволяет управлять каталогом товаров WooCommerce без входа в админку.  

# Менеджер редактирует товары в Google Sheets — скрипт синхронизирует изменения с сайтом, отправляя только изменённые поля.

# 

# ---

# 

# \## Архитектура

# 

# ```

# WooCommerce

# &nbsp;   ↕  pull / push

# products\_full.json       ← полный снапшот с сайта

# &nbsp;   ↕  normalize / denormalize

# products\_table.json      ← нормализованная таблица

# &nbsp;   ↕  export / import-sheets

# Google Sheets            ← редактирование менеджером

# ```

# 

# ---

# 

# \## Скрипты

# 

# | Команда | Что делает |

# |---|---|

# | `npm run pull` | Скачивает все товары с WooCommerce → `products\_full.json` |

# | `npm run normalize` | Преобразует `products\_full.json` → `products\_table.json` |

# | `npm run denormalize` | Преобразует `products\_table.json` → `products\_export.json` |

# | `npm run check-diff` | Сравнивает `products\_export.json` с `products\_full.json`, показывает расхождения |

# | `npm run export` | Экспортирует `products\_table.json` в Google Sheets |

# | `npm run import-sheets` | Импортирует данные из Google Sheets → `products\_table.json` |

# | `npm run push` | Пушит изменённые товары из `products\_export.json` на сайт (diff-based) |

# | `npm run push --dry-run` | Показывает что будет запушено без реальной отправки |

# | `npm run sync-images` | Синхронизирует изображения товаров |

# | `npm run fetch-categories` | Скачивает список категорий с сайта |

# 

# ---

# 

# \## Рабочие циклы

# 

# \### WooCommerce → Google Sheets

# 

# ```bash

# npm run pull

# npm run normalize

# npm run check-diff    # убеждаемся что diff = 0

# npm run export

# ```

# 

# \### Google Sheets → WooCommerce

# 

# ```bash

# npm run import-sheets

# npm run denormalize

# npm run check-diff    # смотрим что изменилось

# npm run push

# npm run pull          # обновляем эталон после пуша

# ```

# 

# \### Проверка синхронизации без изменений

# 

# ```bash

# npm run pull

# npm run normalize

# npm run denormalize

# npm run check-diff    # должно быть "No differences found"

# ```

# 

# ---

# 

# \## Установка

# 

# ```bash

# git clone https://github.com/AlexanderKuzikov/Greenhouse.git

# cd Greenhouse

# npm install

# ```

# 

# Создай `.env` в корне проекта:

# 

# ```env

# WC\_URL=https://your-site.com

# WC\_CONSUMER\_KEY=ck\_...

# WC\_CONSUMER\_SECRET=cs\_...

# GOOGLE\_CREDENTIALS\_PATH=./credentials.json

# GOOGLE\_SPREADSHEET\_ID=your\_spreadsheet\_id

# ```

# 

# ---

# 

# \## Структура файлов

# 

# ```

# data/

# &nbsp; products\_full.json     ← снапшот с сайта (эталон)

# &nbsp; products\_table.json    ← нормализованная таблица для редактирования

# &nbsp; products\_export.json   ← денормализованный экспорт для пуша

# &nbsp; push-report.json       ← отчёт последнего пуша

# src/

# &nbsp; pull.ts

# &nbsp; normalize.ts

# &nbsp; denormalize.ts

# &nbsp; check-diff.ts

# &nbsp; export.ts

# &nbsp; import-sheets.ts

# &nbsp; push.ts

# &nbsp; push-test.ts

# &nbsp; sync-images.ts

# &nbsp; fetch-categories.ts

# ```

# 

# ---

# 

# \## Требования

# 

# \- Node.js 18+

# \- TypeScript 5+

# \- WooCommerce REST API (Consumer Key + Secret)

# \- Google Cloud сервисный аккаунт с доступом к Sheets API



