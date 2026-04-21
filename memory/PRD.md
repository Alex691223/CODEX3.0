# C O D E X — Family Portal PRD

## Original Problem Statement
> сделай сайт для семьи в 5rp. название C O D E X. мы играем на сервере redwood. сделай админку на логин alex и пароль 123. на сайте описание фамы, владельцы и другие важные люди. используй ui хороший и размести фотку мою на сайте. админ может назначать модеров, которые принимают заявки в семью. на сайте можно написать заявку по анкете и ссылки на дс канал наш. пока что сделай только то, как ты представляешь сайт. информацию, которую я еще не предоставил не заполняй, поставь просто "неизвестно".

## Project
- **Name:** C O D E X Family Portal
- **Server:** Redwood (GTA 5RP)
- **Language:** Russian
- **Aesthetic:** Dark gothic / mafia — black (#050505), blood crimson (#8A0303), bone white text. Cinzel + Manrope + UnifrakturMaguntia fonts.

## User personas
1. **Visitor** — drops by, reads lore, submits an application, clicks Discord button.
2. **Moderator** — logs in, reviews and approves/rejects applications.
3. **Admin (alex)** — full control: manages moderators, site settings (Discord URL), and deletes applications.

## Architecture
- **Backend:** FastAPI + Motor (Async MongoDB) + bcrypt + PyJWT.
- **Frontend:** React 19 + React Router + Tailwind + shadcn/ui + Sonner (toasts) + lucide-react.
- **Auth:** JWT (Bearer, localStorage). Admin auto-seeded on startup from `.env` (idempotent).

## Implemented (Feb 2026)
- Public landing with Hero (mansion bg), Lore (with user's CODEX emblem), Roster (placeholders), Application form, Discord CTA, Footer.
- Admin login `/admin` + protected dashboard `/admin/dashboard`.
- Applications: submit (public), list/filter, approve/reject, delete (admin only).
- Moderators CRUD (admin only).
- Settings: editable Discord URL → auto-reflected on public CTA button.
- Russian UI throughout, "неизвестно" placeholders where info not provided.
- 23/23 backend tests pass. E2E frontend flow validated.

## Backlog (Next)
### P0
- Replace placeholder logo artifact with the user's personal photo once provided.
- Fill "неизвестно" placeholders with real lore, owner names, static IDs, Discord handles.
- Supply production Discord invite URL via admin settings.

### P1
- Member roster as real DB entries (admin CRUD) instead of hardcoded placeholders.
- File/image upload for member avatars (object storage integration).
- Public roster page with filters (Owners / Council / Important).
- Email/Discord webhook notification when a new application lands.

### P2
- Activity log (who approved/rejected what, when).
- Rate-limit public application form (IP-based) to prevent spam.
- Password reset for moderators, "change my password" self-service.
- Public stats (open slots, online count if RP API exists).

## Credentials
See `/app/memory/test_credentials.md` — admin `alex` / `123`.
