# CODEX — Развёртывание на Namecheap VPS

> Стек сайта: FastAPI + MongoDB + React. Для Namecheap **Shared Hosting (cPanel)
> не подходит** — нужны права root для MongoDB. Возьмите **Namecheap VPS**
> (Pulsar / Magnetar / Dedicated) с Ubuntu 22.04.

## 1. Что заказать у Namecheap

- **VPS Pulsar** (2 vCPU / 2 GB RAM / 40 GB SSD) — минимум для комфортной работы.
- ОС: **Ubuntu 22.04 LTS**.
- Выделенный IP включён по умолчанию.
- Привяжите ваш домен: в панели домена создайте **A-запись** на IP VPS.

## 2. Первичная настройка сервера

Подключитесь по SSH:

```bash
ssh root@YOUR_VPS_IP
```

Обновите систему и создайте пользователя:

```bash
apt update && apt upgrade -y
adduser codex
usermod -aG sudo codex
rsync --archive --chown=codex:codex ~/.ssh /home/codex
```

Firewall:

```bash
ufw allow OpenSSH
ufw allow http
ufw allow https
ufw --force enable
```

Fail2ban (защита SSH от перебора):

```bash
apt install -y fail2ban
systemctl enable --now fail2ban
```

## 3. Установка Docker

```bash
curl -fsSL https://get.docker.com | sh
usermod -aG docker codex
apt install -y docker-compose-plugin
```

Перезайдите под пользователем `codex`.

## 4. Код приложения

Загрузите проект на сервер (варианты: `git clone`, `rsync`, `scp`).

```bash
cd ~
git clone https://github.com/YOUR_USER/codex-family.git
cd codex-family
```

Скопируйте и заполните `.env`:

```bash
cp .env.example .env
nano .env
```

Обязательно поменяйте:

- `PUBLIC_URL` → ваш домен, напр. `https://codex-family.com`
- `ADMIN_PASSWORD` → длинный сложный пароль
- `MONGO_ROOT_PASS` → длинный случайный пароль
- `JWT_SECRET` → результат `openssl rand -hex 32`
- `EMERGENT_LLM_KEY` → ваш ключ Emergent
- `TRUSTED_HOSTS` → ваш домен (через запятую)

## 5. Запуск

```bash
docker compose build
docker compose up -d
docker compose ps
```

Проверьте логи:

```bash
docker compose logs -f backend
```

Сайт уже доступен по HTTP. Админ: `alex` / значение `ADMIN_PASSWORD`.

## 6. HTTPS через Let's Encrypt

Получите сертификат (сервер должен быть доступен по 80 порту):

```bash
sudo apt install -y certbot
sudo docker compose stop nginx
sudo certbot certonly --standalone -d codex-family.com -d www.codex-family.com \
    --email you@email.com --agree-tos --no-eff-email
sudo mkdir -p deploy/certs
sudo cp /etc/letsencrypt/live/codex-family.com/fullchain.pem deploy/certs/
sudo cp /etc/letsencrypt/live/codex-family.com/privkey.pem deploy/certs/
sudo chown codex:codex deploy/certs/*
```

В `deploy/nginx/edge.conf` раскомментируйте блоки `listen 443 ssl http2;`,
`ssl_certificate*` и HTTP→HTTPS редирект, поставьте свой `server_name`.

Перезапустите:

```bash
docker compose up -d nginx
```

Авто-обновление сертификата добавьте в cron (`crontab -e`):

```
0 3 * * 0 certbot renew --quiet && docker compose -f /home/codex/codex-family/docker-compose.yml restart nginx
```

## 7. Бэкап MongoDB

Раз в сутки по cron:

```bash
mkdir -p ~/backups
crontab -e
```

```
0 4 * * * docker exec $(docker ps -qf name=mongo) mongodump --archive --gzip \
  -u "$MONGO_ROOT_USER" -p "$MONGO_ROOT_PASS" --authenticationDatabase admin \
  > ~/backups/codex-$(date +\%Y\%m\%d).gz
```

Храните бэкапы отдельно (rclone → S3 / Google Drive и т.п.).

## 8. Чек-лист безопасности

- [x] Root-пароль MongoDB длинный и случайный
- [x] 27017 **не** опубликован наружу (только в `codex_net`)
- [x] `JWT_SECRET` ≥ 64 hex символов, уникальный на прод
- [x] `ADMIN_PASSWORD` изменён со стандартного `123`
- [x] CORS ограничен `PUBLIC_URL` (не `*`)
- [x] HSTS включён (`ENABLE_HSTS=1`)
- [x] `TRUSTED_HOSTS` указан
- [x] nginx rate-limit на `/api/auth/login` и `/api/applications`
- [x] Бэкенд rate-limit через slowapi + brute-force lockout
- [x] UFW разрешает только 22/80/443
- [x] Fail2ban настроен для SSH
- [x] Регулярные `apt upgrade`

## 9. Cloudflare как WAF (сильно рекомендовано)

Подключите домен к Cloudflare (Free план) и включите:
- **Proxy (orange cloud)** — скрывает реальный IP VPS.
- **SSL/TLS mode: Full (strict)**.
- **Rules → Security → Bot Fight Mode**.
- **Rate Limiting Rules** на `/api/auth/login` (5 req / 10 s).
- **Firewall Rules**: блок стран, откуда вы не ожидаете трафик.

## 10. Обновление приложения

```bash
cd ~/codex-family
git pull
docker compose build
docker compose up -d
```

## Troubleshooting

| Проблема | Решение |
|---|---|
| 502 Bad Gateway | `docker compose logs backend` — проверьте коннект к MongoDB и env. |
| Файлы не грузятся | проверьте `EMERGENT_LLM_KEY`. Баланс key — https://emergent.sh profile. |
| 429 Too Many Requests | rate-limit сработал, подождите 15 минут. |
| Забыл admin пароль | в `.env` поменяйте `ADMIN_PASSWORD`, `docker compose restart backend` — seed обновит хеш. |

---

Готово. Сайт работает на вашем Namecheap VPS с HTTPS, бэкапами, rate-limit и
безопасностью по умолчанию.
