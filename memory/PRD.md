# C O D E X — Family Portal PRD

## Stack
- **Backend:** FastAPI + Motor + bcrypt + PyJWT + slowapi + Emergent Object Storage
- **Frontend:** React 19 + Tailwind + shadcn/ui + Sonner + react-day-picker
- **Deploy:** Docker + nginx + Let's Encrypt (Namecheap VPS)

## Implemented (iteration 5 — cPanel port)
- **Parallel cPanel build** в `/app/cpanel/` — тот же сайт, работает на Namecheap Shared Hosting (cPanel) без Docker/VPS.
  - Backend: FastAPI + PyMySQL + bcrypt + PyJWT, in-memory rate-limit, локальное файловое хранилище вне `public_html`.
  - Passenger WSGI wrapper (`a2wsgi`) — cPanel «Setup Python App» сам поднимает приложение.
  - Автоматический seed админа, настроек, рангов и участников на старте.
  - 46/46 smoke-тестов зелёные (MariaDB 10.11, локально) — 100% контрактная совместимость с оригинальным `/api/*`.
  - Дисковая запись файлов (`UPLOAD_DIR` вне `public_html`), скачивание `FileResponse` с Bearer или `?auth=`-токеном.
  - Файлы: `cpanel/backend/server.py` (717 строк), `passenger_wsgi.py`, `requirements.txt`, `.env.example`, `.htaccess` для SPA, `build_frontend_for_cpanel.sh`, `DEPLOY_CPANEL.md` (пошаговая инструкция).

## Implemented (iteration 4)
- **Audit log** — `/api/audit`, каждая значимая операция (логин, заявки, модераторы, участники, настройки, ранги, файлы, таблицы, категории) пишет событие. Вкладка «Журнал» с фильтром действий и поиском.
- **Text file editor** — `.txt`, `.md`, `.csv`, `.json`, `.xml`, `.html`, `.css`, `.js`, `.ts`, `.py`, `.yaml`, `.yml`, `.log` открываются прямо в браузере в редакторе. Права: админ редактирует любой, модератор — только свои.
- **Territory text editable** — `territory_desc` теперь до 2000 символов, multi-line Textarea в Настройках; убрана надпись «Под защитой семьи».
- **Advanced sheet features** — импорт CSV, очистка, Find/Replace с подсчётом замен, сортировка по столбцу (asc/desc, числа и строки), дублирование строки, строка сумм по числовым колонкам.
- **Custom ranks** — ранги теперь кастомные: CRUD в Настройках (создание/переименование/порядок/удаление), защищённое удаление если в ранге есть участники. Миграция: старые `rank` (owner/advisor/important) автоматически конвертированы в `rank_id` на старте сервера. Roster на главной группирует участников по рангам в порядке `sort_order`.

## Security
- X-Content-Type-Options, X-Frame-Options: DENY, Referrer-Policy, Permissions-Policy, HSTS-opt.
- slowapi rate-limit: login 20/min, apply 10/min, visits 30/min.
- Brute-force lockout (IP+username и username-only).
- bcrypt hashes, JWT из env, TRUSTED_HOSTS, CORS lock.
- Audit log для forensic trail.

## Stats
- Backend: **78/78** pytest pass ✅
- Frontend: 100% critical flows ✅
- Zero regressions

## Deploy
- `docker-compose.yml`, `deploy/Dockerfile.backend`, `deploy/Dockerfile.frontend`, `deploy/nginx/edge.conf` (rate-limit + TLS).
- `.env.example` + `DEPLOY.md` (Namecheap VPS + Certbot + backups + Cloudflare WAF).

## Backlog
### P1
- Drag-n-drop порядок участников
- Thumbnail generation на сервере (image optimization)
- Discord webhook на новые заявки

### P2
- Audit log экспорт в CSV
- 2FA для админа
- Bulk-операции на диске

## Credentials
`/app/memory/test_credentials.md` — admin `alex` / `123`.
