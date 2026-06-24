# Vibe — AI Coding Platform + E-Commerce

## Architektura projektu

```
gbesiu/vibe (Next.js 15, App Router, Turbopack)
├── AI Coding Platform (przekod.pl)
│   ├── /projects/[id]         — chat + live E2B sandbox preview
│   ├── /pricing               — subskrypcje Clerk Billing
│   └── AI agent: Claude Sonnet 4 via Inngest + @inngest/agent-kit
│
└── E-Commerce (Krypton store)
    ├── /shop                  — listing produktów
    ├── /admin                 — panel zarządzania
    └── Integracje: Baselinker, iMoje, Higgsfield AI video
```

## Stack

| Warstwa | Technologia |
|---|---|
| Framework | Next.js 15 App Router |
| Styling | Tailwind CSS v4 |
| Auth | Clerk (produkcja: klucze `pk_live_`) |
| ORM | Prisma 6 + PostgreSQL |
| API | tRPC v11 |
| Background jobs | Inngest + @inngest/agent-kit |
| AI agent | Claude Sonnet 4 (`claude-sonnet-4-20250514`) |
| Code sandbox | E2B (`amazziarz/vibe-code-fotz` template) |
| Płatności | iMoje (ING Bank Śląski) |
| Katalog produktów | Baselinker API |
| AI video | Higgsfield AI |

## Env vars (wymagane)

```bash
DATABASE_URL=postgresql://...         # PostgreSQL (Neon/Supabase na prod)
ANTHROPIC_API_KEY=sk-ant-...         # WYMAGANE — Claude Sonnet 4
E2B_API_KEY=e2b_...                  # WYMAGANE — code sandboxes
E2B_SANDBOX_TEMPLATE=amazziarz/vibe-code-fotz
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_APP_URL=https://www.przekod.pl
INNGEST_SIGNING_KEY=signkey-prod-...  # tylko produkcja
INNGEST_EVENT_KEY=...                 # tylko produkcja
BASELINKER_API_TOKEN=...              # sync produktów
IMOJE_MERCHANT_ID=...                 # płatności
IMOJE_SERVICE_ID=...
IMOJE_SERVICE_KEY=...
HIGGSFIELD_API_KEY=...                # AI video
```

## Kluczowe pliki

### AI Agent
- `src/inngest/functions.ts` — główna funkcja agenta (Claude Sonnet, E2B sandbox)
- `src/inngest/client.ts` — klient Inngest
- `src/app/api/inngest/route.ts` — endpoint produkcyjny

### E-Commerce
- `src/inngest/shop-functions.ts` — sync Baselinker (cron co godzinę) + AI generowanie
- `src/lib/baselinker.ts` — klient Baselinker API
- `src/lib/imoje.ts` — iMoje płatności
- `src/lib/higgsfield.ts` — Higgsfield AI video
- `src/app/api/baselinker/sync/route.ts` — POST /api/baselinker/sync
- `src/app/api/checkout/route.ts` — POST /api/checkout
- `src/app/api/payment/notify/route.ts` — webhook iMoje
- `src/app/api/products/[id]/generate/route.ts` — POST generowanie AI

### UI
- `src/app/shop/page.tsx` — strona sklepu
- `src/app/admin/page.tsx` — panel admin
- `src/components/shop/CartDrawer.tsx` — koszyk drawer
- `src/components/shop/ProductCard.tsx` — karta produktu
- `src/components/shop/ShopNavbar.tsx` — nawigacja sklepu
- `src/hooks/use-cart.tsx` — CartContext + hook

### Core
- `src/modules/projects/` — tRPC procedures dla projektów
- `src/modules/messages/` — tRPC procedures dla wiadomości
- `src/lib/usage.ts` — rate limiting (Clerk billing tiers)
- `prisma/schema.prisma` — pełna schema DB

## Uruchamianie lokalnie

```bash
# Terminal 1 — Next.js
npm run dev

# Terminal 2 — Inngest (wymagane dla AI agenta)
npx inngest-cli@latest dev

# Otwórz
open http://localhost:3000        # aplikacja
open http://localhost:8288        # Inngest dashboard
```

## Deployment

- **Platforma:** Vercel
- **Domena:** przekod.pl
- **Auto-deploy:** push do `main` → Vercel CI/CD
- **DB migrations na prod:** `npx prisma migrate deploy`

## Aktualne TODO

- [ ] Uzupełnić `ANTHROPIC_API_KEY` w Vercel env vars
- [ ] Uzupełnić `DATABASE_URL` (produkcyjna PostgreSQL)
- [ ] Wkleić klucze Baselinker + iMoje + Higgsfield
- [ ] Uruchomić migrację na produkcyjnej bazie
- [ ] Strona `/admin/page.tsx` — panel zarządzania
- [ ] Integracja Higgsfield — generowanie wideo dla produktów
