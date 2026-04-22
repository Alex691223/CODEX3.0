README
======

CODEX Family Portal — сайт для семьи CODEX на сервере Redwood (GTA 5RP).

## Стек
- Backend: FastAPI + MongoDB + JWT + Emergent Object Storage
- Frontend: React 19 + Tailwind + shadcn/ui
- Auth: JWT Bearer (localStorage)
- Безопасность: rate-limit (slowapi), brute-force lockout, security headers, CORS lock, bcrypt

## Разработка

```bash
# Backend
cd backend
pip install -r requirements.txt
# .env с MONGO_URL, DB_NAME, JWT_SECRET, EMERGENT_LLM_KEY и т.д.
uvicorn server:app --reload --port 8001

# Frontend
cd frontend
yarn install
yarn start
```

Вход в админ-панель: комбинация клавиш **`m + d`** на главной странице →
логин `alex` / пароль `123` (по умолчанию; поменяйте через Настройки → Профиль).

## Деплой
См. [`DEPLOY.md`](./DEPLOY.md) — инструкция для Namecheap VPS
(Docker + nginx + Let's Encrypt + бэкапы).
