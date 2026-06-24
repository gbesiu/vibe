# CLAUDE.md — Instrukcja dla Claude Desktop

> Ten plik to briefing dla Claude Desktop. Czytasz go jako AI asystent pracujący na tym projekcie.
> Twój partner (Antigravity/Gemini) już skonfigurował infrastrukturę — kontynuujesz budowę.

---

## 🎯 Co budujemy

**Vibe** to platforma dostępna pod adresem **przekod.pl** składająca się z dwóch modułów:

1. **AI Coding Platform** — użytkownik wpisuje prompt → AI agent (Claude Sonnet 4) generuje aplikację webową w sandboxie E2B → preview na żywo
2. **Krypton Store** — sklep e-commerce zsynchronizowany z Baselinker, płatności iMoje, AI opisy/wideo przez Higgsfield

---

## 🏗️ Stack technologiczny

| Warstwa | Technologia | Wersja |
|---|---|---|
| Framework | Next.js App Router | 15.3.4 |
| Styling | Tailwind CSS | v4 |
| Auth | Clerk | najnowszy |
| ORM | Prisma | 6.x |
| DB | PostgreSQL | lokalnie: `localhost:5432/postgres` |
| API | tRPC | v11 |
| Background jobs | Inngest + @inngest/agent-kit | - |
| AI model | Claude Sonnet 4 | `claude-sonnet-4-20250514` |
| Code sandbox | E2B | template: `amazziarz/vibe-code-fotz` |
| Płatności | iMoje (ING) | - |
| Katalog | Baselinker API | - |
| AI video | Higgsfield AI | - |
| Bundler | Turbopack | (dev), Webpack (prod build) |

---

## 📁 Struktura projektu

```
nextjs-vibe/
├── prisma/
│   └── schema.prisma          ← pełna schema DB (User, Usage, Product, Category, Cart, Order...)
├── src/
│   ├── app/
│   │   ├── (home)/            ← landing page + pricing
│   │   ├── projects/[id]/     ← AI coding chat + E2B preview
│   │   ├── shop/              ← sklep (page.tsx + layout.tsx + category/[slug]/)
│   │   ├── admin/             ← panel zarządzania (page.tsx + layout.tsx)
│   │   └── api/
│   │       ├── inngest/       ← Inngest endpoint (AI agent)
│   │       ├── baselinker/sync/ ← POST sync produktów z Baselinker
│   │       ├── checkout/       ← POST tworzenie zamówienia + iMoje payment link
│   │       ├── payment/notify/ ← webhook iMoje (aktualizacja statusu)
│   │       ├── products/[id]/generate/ ← POST generowanie AI opisu + zdjęcia
│   │       └── admin/products/ ← GET lista produktów (dla admina)
│   ├── components/
│   │   ├── ui/               ← shadcn/ui komponenty
│   │   └── shop/
│   │       ├── ShopNavbar.tsx ← nawigacja sklepu
│   │       ├── ProductCard.tsx ← karta produktu
│   │       └── CartDrawer.tsx ← koszyk (drawer)
│   ├── hooks/
│   │   └── use-cart.tsx       ← CartContext + CartProvider + useCart()
│   ├── inngest/
│   │   ├── client.ts          ← Inngest client
│   │   ├── functions.ts       ← AI agent: code-agent/run (E2B + Claude)
│   │   └── shop-functions.ts  ← cron sync Baselinker + AI generowanie
│   ├── lib/
│   │   ├── db.ts              ← Prisma client singleton
│   │   ├── usage.ts           ← rate limiting (RateLimiterPrisma)
│   │   ├── baselinker.ts      ← Baselinker API client
│   │   ├── imoje.ts           ← iMoje płatności
│   │   ├── higgsfield.ts      ← Higgsfield AI video
│   │   └── stubs/RateLimiterDrizzle.js ← stub dla webpack/turbopack
│   ├── modules/
│   │   ├── projects/          ← tRPC router + UI dla projektów
│   │   ├── messages/          ← tRPC router + UI dla wiadomości
│   │   └── usage/             ← tRPC router dla rate limitingu
│   └── trpc/
│       ├── init.ts            ← tRPC context + auth
│       ├── client.ts          ← tRPC React client
│       └── routers/           ← główny router (łączy wszystkie)
├── next.config.ts             ← turbopack alias + image CDN patterns
├── CLAUDE.md                  ← ten plik
└── .env                       ← klucze (NIE commitować zmian!)
```

---

## 🔑 Wymagane zmienne środowiskowe

Plik `.env` istnieje lokalnie. **Nie commituj go.** Sprawdź `env.example` po wzorzec.

```bash
# Baza danych
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres"

# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"

# AI — WYMAGANE do działania agenta
ANTHROPIC_API_KEY="sk-ant-..."

# E2B Sandbox — WYMAGANE do podglądu kodu
E2B_API_KEY="e2b_..."
E2B_SANDBOX_TEMPLATE="amazziarz/vibe-code-fotz"

# Inngest — lokalnie używa "local"
INNGEST_EVENT_KEY="local"
INNGEST_SIGNING_KEY=""

# E-commerce (opcjonalne lokalnie, wymagane na prod)
BASELINKER_API_TOKEN="..."
IMOJE_MERCHANT_ID="..."
IMOJE_SERVICE_ID="..."
IMOJE_SERVICE_KEY="..."
HIGGSFIELD_API_KEY="..."
```

---

## 🚀 Jak uruchomić lokalnie

```bash
# Zainstaluj zależności (jeśli nie ma node_modules)
npm install

# Uruchom migracje DB
npx prisma migrate dev

# Terminal 1 — Next.js
npm run dev
# → http://localhost:3000

# Terminal 2 — Inngest (WYMAGANE dla AI agenta!)
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
# → http://localhost:8288 (dashboard Inngest)
```

---

## ✅ Co już działa

- [x] AI coding agent (Claude Sonnet 4 + E2B sandbox) — `/projects/[id]`
- [x] Autoryzacja Clerk — sign in/up, pricing tiers
- [x] Rate limiting — `src/lib/usage.ts` (RateLimiterPrisma)
- [x] tRPC API — projekty, wiadomości, usage
- [x] Schema Prisma — User, Usage, Product, Category, Cart, CartItem, Order, OrderItem
- [x] Strona sklepu — `/shop` (grid produktów, filtry kategorii)
- [x] Panel admin — `/admin` (stats, tabela, sync button)
- [x] CartDrawer + CartProvider + ProductCard
- [x] API: Baselinker sync, Checkout, iMoje webhook, AI generate
- [x] Inngest shop functions — cron sync, AI opis/video generowanie

---

## 🔧 Aktualne zadania do zrobienia

### Priorytet 1 — Krytyczne (blokują produkcję)
- [ ] **Uzupełnić `ANTHROPIC_API_KEY`** w Vercel Dashboard → Environment Variables
- [ ] **Uzupełnić `DATABASE_URL`** (produkcyjna PostgreSQL — Neon lub Supabase)
- [ ] **Uruchomić migrację na prod**: `npx prisma migrate deploy`
- [ ] **Klucze Clerk prod** (`pk_live_`, `sk_live_`) w Vercel

### Priorytet 2 — E-commerce
- [ ] **Uzupełnić klucze Baselinker** + przetestować `/api/baselinker/sync`
- [ ] **Uzupełnić klucze iMoje** + przetestować flow zakupu
- [ ] **Uzupełnić klucz Higgsfield** + przetestować generowanie wideo
- [ ] Strona produktu `/shop/[slug]` — szczegóły produktu
- [ ] Potwierdzenie zamówienia `/checkout/success`
- [ ] Email potwierdzenia zamówienia (Resend lub SendGrid)

### Priorytet 3 — UX/UI
- [ ] Strona błędu płatności `/checkout/cancel`
- [ ] Breadcrumbs w sklepie
- [ ] SEO meta tagi dla produktów
- [ ] Loading skeleton na `/shop`

---

## ⚠️ Ważne zasady przy modyfikacji kodu

### 1. Nie dodawaj do gita (są w .gitignore lub innych projektach)
```
Vibe Coding/
fotz-studio-web-experience/
instalatorstwo-borowiec/
pv-monitor-spark/
.env
.next/
node_modules/
```

### 2. Poprawne commitowanie
```bash
# Zawsze wyklucz inne projekty
git add -A -- ':!Vibe Coding/' ':!fotz-studio-web-experience/' ':!instalatorstwo-borowiec/' ':!pv-monitor-spark/'
git commit -m "typ: opis zmian"
git push origin main
```

### 3. Turbopack vs Webpack
`next.config.ts` ma **dwa** aliasy dla `rate-limiter-flexible`:
- `turbopack.resolveAlias` — dla `npm run dev` (Turbopack)
- `webpack()` — dla `npm run build` (produkcja)

**Nie usuwaj żadnego z nich!**

### 4. Prisma po zmianie schematu
```bash
npx prisma migrate dev --name "opis-zmiany"
npx prisma generate
```

### 5. Design systemu
- Tło: `bg-[#0a0a12]` lub `bg-[#080810]`
- Akcent: fiolet `#8b5cf6` lub indigo `#6366f1`
- Karty: `bg-white/5 border border-white/10 backdrop-blur-sm`
- Tekst: `text-white` / `text-white/60` / `text-white/40`
- Język UI: **Polski**

---

## 🤝 Workflow współpracy (Antigravity ↔ Claude Desktop)

```
Antigravity (Gemini)          Claude Desktop
       │                           │
       ├── commit → git push ──────┤
       │                     git pull
       │                           ├── analizuje
       │                           ├── koduje
       │                     git push
       └── git pull ───────────────┤
               │
           merge/review
```

**Przed każdą sesją:**
```bash
git pull origin main
```

**Po zakończeniu pracy:**
```bash
git add -A -- ':!Vibe Coding/' ':!fotz-studio-web-experience/' ':!instalatorstwo-borowiec/' ':!pv-monitor-spark/'
git commit -m "feat/fix/chore: opis"
git push origin main
```

---

## 📞 Kontekst biznesowy

- **Domena produkcyjna:** przekod.pl
- **Hosting:** Vercel (auto-deploy z `main`)
- **Segment klientów:** programiści, małe firmy, e-commerce PL
- **Model monetyzacji:** freemium (2 projekty za darmo, Pro = nieograniczone)
- **Rynek:** Polska (PLN, język polski, iMoje jako bramka płatnicza PL)
