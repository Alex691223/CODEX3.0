# C O D E X — Family Portal PRD

## Project
- **Name:** C O D E X Family Portal
- **Server:** Redwood (GTA 5RP)
- **Language:** Russian
- **Aesthetic:** Dark gothic / mafia

## Architecture
- **Backend:** FastAPI + Motor (MongoDB) + bcrypt + PyJWT + slowapi + Emergent Object Storage
- **Frontend:** React 19 + React Router + Tailwind + shadcn/ui + Sonner + react-day-picker
- **Auth:** JWT Bearer (localStorage) + brute-force lockout + rate-limit
- **Deployment:** Docker + nginx + Let's Encrypt on Namecheap VPS

## Implemented (iteration 3)
- **UI:** X close on login → `/`, logout → `/`, no «Глав 2», no «© CODEX» текста, убрана строка «Discord обязателен», снят age-спиннер, территория «Владения · Тени Redwood».
- **Admin auth:** keyboard shortcut `m+d` → `/admin`.
- **Applications:** поиск (по нику/IRL/пригласил/таймзоне) + фильтр по статусу (все/pending/approved/rejected).
- **Drive:** превью картинок (thumbnails + lightbox), жирный ползунок для календаря, категории ниже Таблиц, экспорт таблицы в CSV.
- **Sheets:** inline-редактор + CSV export.
- **Settings (admin):** редактирование Hero subtitle, Территория (label+desc), История, Server name, Год основания, Discord URL; полный CRUD состава семьи (Главы/Советники/Важные) с выпадающим рангом — изменения мгновенно подтягиваются на главную.
- **Passwords:** модераторы меняют свой пароль (вкладка Профиль); админ сбрасывает пароли модераторов из вкладки Модераторы.
- **Security:**
  - `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Resource-Policy`, опциональный HSTS.
  - Rate-limit: `/api/auth/login` 20/min, `/api/applications` 10/min, `/api/visits` 30/min.
  - Brute-force lockout: 8 фейлов на (IP,username) или 16 по username-only → 429 на 15 мин (TTL).
  - `TRUSTED_HOSTS`, lockable `CORS_ORIGINS`, все пароли bcrypt, JWT secret из env.

## Deployment (Namecheap VPS)
- `Dockerfile.backend`, `Dockerfile.frontend`, `docker-compose.yml` (mongo + backend + frontend + nginx edge).
- `deploy/nginx/edge.conf` — TLS + nginx rate-limit (login / apply / general) + security headers.
- `.env.example` — все production-секреты.
- `DEPLOY.md` — пошаговая инструкция (Namecheap VPS Pulsar, Docker, Let's Encrypt, бэкапы, Cloudflare WAF).

## Stats
- Backend: **59/59** pytest pass.
- Frontend: 100% critical flows verified.

## Backlog
### P1
- Thumbnail генерация на сервере (сейчас — полный файл в img, есть кеширование http).
- Reordering участников (drag-n-drop) вместо фиксированного порядка.
- Multi-file bulk operations в Диске.
- Логи активности (audit trail) в Аналитике.

### P2
- Webhook в Discord на новую заявку.
- Двухфакторная аутентификация.
- Полнотекстовый поиск по таблицам.

## Credentials
`/app/memory/test_credentials.md` — admin `alex` / `123`.
