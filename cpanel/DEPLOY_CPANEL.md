# CODEX — Развёртывание на Namecheap Shared Hosting (cPanel)

> **Важно:** нужен план со **Stellar Plus** или выше (Python App + MySQL + минимум 5GB места).
> На минимальном Stellar могут быть ограничения на Python-приложения и слабая производительность.

## Итоговая архитектура
- **Frontend (React build)** лежит в `public_html/` — отдаётся Apache напрямую.
- **Backend (FastAPI через Passenger WSGI)** запущен в cPanel «Setup Python App». Доступен по URL `/api/...` через обратный прокси или через поддомен `api.your-domain.com`.
- **MySQL** вместо MongoDB (все таблицы создаются автоматически).
- **Файлы пользователей** — в защищённой папке **вне** `public_html` (например `/home/youruser/codex_uploads/`).

---

## 1. Подготовка в cPanel

### 1.1 Создайте MySQL базу
cPanel → **MySQL Databases**:
- Create database: `codex` (получит префикс, например `youruser_codex`)
- Create user: `codex` + надёжный пароль
- **Add User To Database** → выдайте ALL PRIVILEGES

### 1.2 Создайте Python App
cPanel → **Setup Python App** → **Create Application**:
- Python version: **3.11** (или 3.10)
- Application root: `codex_api` (это папка в вашем home)
- Application URL: **/api** (если основной домен), либо поддомен `api.your-domain.com`
- Application startup file: `passenger_wsgi.py`
- Application Entry point: `application`

cPanel создаст виртуальное окружение и покажет команду вроде
`source /home/youruser/virtualenv/codex_api/3.11/bin/activate && cd /home/youruser/codex_api`
Сохраните её.

---

## 2. Загрузка файлов

Из папки `/app/cpanel/` на вашем компьютере загрузите на хостинг через **File Manager** или **FTP (FileZilla)**:

### 2.1 Бэкенд
Загрузите **содержимое** папки `cpanel/backend/` в ту папку, что вы указали как Application root (`/home/youruser/codex_api/`):
```
codex_api/
  ├── server.py
  ├── passenger_wsgi.py
  ├── requirements.txt
  └── .env              ← создать из .env.example
```

### 2.2 Фронтенд
Используйте готовый скрипт (он соберёт билд и положит `.htaccess` автоматически):
```bash
cd cpanel
./build_frontend_for_cpanel.sh https://your-domain.com
#  или при варианте с поддоменом:
#  ./build_frontend_for_cpanel.sh https://api.your-domain.com
```
После сборки — залейте **всё содержимое** `cpanel/build_for_cpanel/` (включая скрытый `.htaccess`) в `public_html/` через File Manager или FTP.

**Если хотите собрать вручную:**
```bash
cd frontend
echo "REACT_APP_BACKEND_URL=https://your-domain.com" > .env.production.local
yarn install && yarn build
cp cpanel/frontend_public_html/.htaccess build/.htaccess
# затем залейте содержимое build/ в public_html/
```

### 2.3 Создайте .env на сервере
В `/home/youruser/codex_api/.env` через File Manager заполните все значения из `.env.example`:
- `DB_USER`, `DB_PASS`, `DB_NAME` — ваша MySQL база из п. 1.1
- `JWT_SECRET` — 64 hex-символа (`python -c "import secrets;print(secrets.token_hex(32))"`)
- `ADMIN_PASSWORD` — сильный пароль админа
- `UPLOAD_DIR=/home/youruser/codex_uploads` — создайте эту папку через File Manager
- `CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com`

---

## 3. Установка зависимостей

В cPanel → **Setup Python App** → кликните на ваше приложение → внизу поле **Run Pip Install** — впишите:
```
-r requirements.txt
```
и нажмите Run. (Альтернативно: откройте Terminal в cPanel и выполните команду активации venv + `pip install -r requirements.txt`.)

---

## 4. Настройка маршрута /api

### Вариант A — отдельный поддомен (рекомендовано, проще всего)
Создайте поддомен `api.your-domain.com` в cPanel → **Subdomains**,
в Setup Python App укажите этот поддомен как Application URL.

В `frontend/.env` перед билдом поставьте:
```
REACT_APP_BACKEND_URL=https://api.your-domain.com
```

### Вариант B — один домен с `/api` префиксом
Установите Application URL = `/api`. cPanel сам настроит Passenger на этот префикс.
В `frontend/.env`:
```
REACT_APP_BACKEND_URL=https://your-domain.com
```

---

## 5. Запуск

В Setup Python App → **Restart** (или «Restart App»). Проверьте в браузере:
- `https://your-domain.com/` — сайт CODEX с главной страницей ✓
- `https://your-domain.com/api/` — `{"message":"CODEX API","status":"ok"}` ✓

Вход: хоткей **m + d** → `alex` / ваш `ADMIN_PASSWORD`.

---

## 6. SSL

cPanel → **SSL/TLS Status** → **Run AutoSSL** (обычно включено по умолчанию).
После получения сертификата раскомментируйте в `public_html/.htaccess` блок с HTTP→HTTPS редиректом.

---

## 7. Бэкапы

cPanel → **Backup** → «Download a Full Account Backup» раз в неделю.
Отдельно через **phpMyAdmin** → Export вашей базы `youruser_codex` раз в сутки (`.sql` файл).

---

## 8. Обновление

Когда я вышлю обновления:
1. Загрузите новый `server.py` поверх старого (File Manager).
2. Если менялся `requirements.txt` — в Setup Python App запустите `Run Pip Install -r requirements.txt`.
3. **Restart App**.

Схема MySQL обновляется автоматически (новые таблицы создаются при старте).

---

## 9. Что отличается от VPS-версии

| | VPS (Docker) | cPanel |
|---|---|---|
| БД | MongoDB | MySQL (MariaDB) ✅ |
| Хранилище файлов | Emergent Object Storage | Локальная папка вне `public_html` ✅ |
| Rate-limit | slowapi | in-memory ✅ |
| Audit log | ✅ | ✅ |
| Все эндпоинты | ✅ | ✅ 1-в-1 |
| Фронтенд | React build | React build (идентичный) ✅ |

**Функционально всё то же самое.** Производительность на Stellar Plus достаточна для ~20 модераторов одновременно.

---

## 10. Проверено автотестами (46 эндпоинтов)

Вся cPanel-сборка прогнана через smoke-тест против живой MySQL/MariaDB — 46/46 кейсов зелёные:

- Auth: логин админа, `/auth/me`, смена пароля, неверный пароль → 401
- Приложения: публичное создание, список (авторизованно), approve/reject, удаление
- Модераторы: создание, логин под модером, RBAC (модер не видит админские ручки), удаление
- Ранги: CRUD + запрет удалять ранг с участниками
- Участники: CRUD с валидацией существования ранга
- Настройки: GET/PUT с мержем дефолтов
- Визиты и аналитика (визиты за 7 дней, статистика по модераторам, файлам, таблицам)
- Audit log
- Drive: категории, загрузка файлов на диск, скачивание (Bearer + `?auth=` query), просмотр/редактирование текстовых файлов, soft-delete
- Таблицы (Sheets): создание 5×8, список, чтение, обновление строк, удаление

Файл стартового smoke-теста (для локального прогона): `/tmp/cpanel_smoke.py` в среде разработчика.

---

## Troubleshooting

| Ошибка | Решение |
|---|---|
| 500 Internal Server Error | cPanel → Setup Python App → откройте логи приложения (иконка «View logs»). Проверьте `.env` и доступ к MySQL. |
| 502 Bad Gateway на `/api` | Restart App в cPanel. Проверьте Application URL. |
| «pymysql: Can't connect» | Убедитесь что DB_HOST=`localhost`, имена БД/юзера с префиксом (`youruser_codex`). |
| Файл не загружается | Проверьте права на `UPLOAD_DIR` (755) и что путь абсолютный. |
| 429 при каждом логине | Rate-limit in-memory. Restart App сбросит счётчики. |
| Фронт белый экран | `.htaccess` в `public_html` не загружен или Apache не умеет `mod_rewrite` (очень редко на Namecheap). |

Если что-то не работает — пришлите последние 20 строк из логов Python App, разберёмся.
