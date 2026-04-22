# C O D E X — Family Portal PRD

## Original Problem Statement
> сделай сайт для семьи в 5rp. название C O D E X... (см. историю диалога)

## Project
- **Name:** C O D E X Family Portal
- **Server:** Redwood (GTA 5RP)
- **Language:** Russian
- **Aesthetic:** Dark gothic / mafia — black (#050505), blood crimson (#8A0303), bone white.

## User personas
1. **Visitor** — читает лор, подаёт заявку, идёт в Discord.
2. **Moderator** — обрабатывает заявки, пользуется диском и аналитикой.
3. **Admin (alex)** — всё то же + управление модераторами, настройками и файлами.

## Architecture
- **Backend:** FastAPI + Motor + bcrypt + PyJWT + Emergent Object Storage (`requests`).
- **Frontend:** React 19 + React Router + Tailwind + shadcn/ui + Sonner + react-day-picker.
- **Auth:** JWT Bearer (localStorage). Admin auto-seeded (`ADMIN_USERNAME`/`ADMIN_PASSWORD`).
- **Object storage:** через `integrations.emergentagent.com/objstore` + `EMERGENT_LLM_KEY`. Пути: `codex-family/drive/{user_id}/{uuid}.{ext}`.

## Implemented (iteration 2)
- Public landing: Hero (mansion), Кодекс (lore+emblem+EST. 2026), Иерархия (Theo/Butcher — Главы; Eva/Bushido — Советники; Owner Codex — Важный), Анкета (8 полей), Discord CTA, Footer © CODEX.
- Discord URL seeded to `https://discord.gg/QKTpvNsfu7`; admin может менять.
- Авторизация: нет кнопки «Вход»; хоткей `m+d` открывает `/admin`.
- Админ-панель: 5 вкладок — Заявки, Диск, Аналитика, Модераторы (admin), Настройки (admin).
- **Диск:** загрузка/скачивание/удаление файлов, календарь с точками под днями загрузок, фильтр по дате, CRUD таблиц с инлайн-редактором ячеек (добавление/удаление строк/столбцов, сохранение).
- **Аналитика:** KPI (визиты, заявки, файлы, обработано), график визитов за 7 дней, распределение заявок по статусу, лидерборд модераторов.

## Stats
- Backend: **40/40** pytest pass.
- Frontend: все критичные флоу проверены e2e (testing_agent_v3).

## Backlog
### P0
- Фото пользователя — пока не предоставлено; размещу после получения.
- Реальная биография семьи (пользователь может дополнить текст истории).

### P1
- CRUD состава семьи через БД (сейчас — хардкод в JSX).
- Уведомления в Discord о новых заявках (webhook).
- Поиск/фильтры по заявкам (по нику, статусу, дате).
- Превью изображений в Диске (thumbnails вместо иконки).
- Публичный превью таблиц (read-only share link).

### P2
- Полнотекстовый редактор таблиц (формулы, сортировка).
- Rate-limit POST /api/applications (антиспам).
- Логи активности (кто что одобрил/удалил) в аналитике.
- Экспорт заявок и таблиц в CSV/XLSX.

## Credentials
`/app/memory/test_credentials.md` — admin `alex` / `123`.
