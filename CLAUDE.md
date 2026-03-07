# Cushion — Project Rules for Claude

## What this is
Personal finance tracker. Single user (owner only). React + Vite frontend, Firebase Auth + Firestore backend, deployed via Firebase Hosting.

## Stack
- **React 18 + Vite** — frontend
- **MUI v5** — UI components (primary UI library, use this for everything)
- **Tailwind CSS** — utility classes only when MUI sx prop is insufficient
- **Firebase Auth** — authentication
- **Firestore** — database, collections prefixed with `cushion_`
- **React Router v6** — routing
- **Recharts** — charts
- **Anthropic SDK** (`@anthropic-ai/sdk`) — Claude AI integration; used for NL expense parsing in `src/claude.js` with `dangerouslyAllowBrowser: true`

## Architecture rules
- `src/db/index.js` is the **only file** that imports Firebase. All Firestore reads/writes go through it.
- Auth state lives in `src/contexts/AuthContext.jsx`. Use `useAuth()` to get `currentUser`.
- All protected routes render inside `AppShell` via `ProtectedRoute`.
- Pages go in `src/pages/`. Settings pages go in `src/pages/settings/`.

## Security decisions
- **No client-side encryption.** Removed intentionally. This is a personal app with no PII or PCI data. Firebase Auth + Firestore security rules scoped to UID is sufficient.
- **No encryption key field on login.** Login is email + password only via Firebase Auth.
- **Password management:** use a password manager with a long random password + Google 2FA on the Firebase account. No in-app password rotation needed — Firebase Console handles that.
- If encryption is ever needed in the future, the correct approach is PBKDF2 key derivation from the login password (not a separate field), with a migration script before switching.

## Firestore collections
| Collection | Encrypted fields (none now) | Notes |
|---|---|---|
| `cushion_categories` | — | name, icon (emoji), color (hex), sortOrder, isActive |
| `cushion_expenses` | — | date, amount, description, categoryId, paymentMethod, cardId, notes |
| `cushion_income` | — | date, amount, source, notes |
| `cushion_recurring_items` | — | name, amount, isVariable, categoryId, frequency, frequencyMonths, renewalMonth, paymentMethod, nextDueDate, isActive |
| `cushion_investments` | — | name, amountInvested, currentValue, type (ppf/pf/sip/stocks_etf/fd), platform, status (active/in_progress/matured), startDate, maturityDate, returnsPercent |
| `cushion_loans` | — | person, amount, dateGiven, expectedReturnDate, isReturned, repayments [{id, date, amount, notes}] |
| `cushion_emis` | — | merchant, emiAmount, cardId, monthsRemaining, startDate |
| `cushion_budgets` | — | categoryId, monthlyLimit, alertAt80, alertAt100 |
| `cushion_credit_cards` | — | name, network, cashbackCategories, rewardPointsRate |

## Routes
| Route | Component | Status |
|---|---|---|
| `/login` | `pages/login.jsx` | Done |
| `/` | `pages/dashboard.jsx` | Done (stat cards + 3-mode trend chart) |
| `/expenses` | `pages/Expenses.jsx` | Done |
| `/expenses/new` | `pages/ExpenseForm.jsx` | Done |
| `/expenses/:id/edit` | `pages/ExpenseForm.jsx` | Done |
| `/settings/categories` | `pages/settings/Categories.jsx` | Done |
| `/income` | `pages/Income.jsx` | Done (CRUD + info banner) |
| `/income/new` | `pages/IncomeForm.jsx` | Done |
| `/income/:id/edit` | `pages/IncomeForm.jsx` | Done |
| `/recurring` | `pages/Recurring.jsx` | Done |
| `/assets` | `pages/Assets.jsx` | Done (3 tabs: Investments, FDs, Loans) |
| `/investments` | — | Redirects to /assets |
| `/loans` | — | Redirects to /assets |
| `/emis` | — | Placeholder |
| `/settings/cards` | — | Placeholder |
| `/settings/budgets` | `pages/settings/Budgets.jsx` | Done (progress bars, add/edit/delete) |
| `/settings/webhooks` | — | Placeholder (Phase 2) |
| `/settings/account` | — | Placeholder (cut — not needed) |

## Data
- 871 historical expense rows imported via `scripts/import_data.py` (CSV from Google Sheets)
- Date range: Mar 2025 – Feb 2026
- All imported docs have `importedFrom: 'csv_import_2025'`
- Import script is one-time use; kept in `scripts/` for reference but not needed again
- `scripts/data/` and `scripts/.env` are gitignored (raw CSV + service account path)
- Service account JSON stored at `/Users/aditya/Documents/Projects/firebase/cushion-serviceaccount.json`

## scripts/import_data.py
- Requires `firebase-admin` and `python-dotenv` (installed in `my_os_venv`)
- Reads from `scripts/data/transactions.csv`
- Dry run by default; use `--commit` to write
- Filters out any rows with date >= 2026-03-01

## scripts/import_assets.py
- Imports all 11 FDs from `scripts/data/Cushion - Fixed Deposits.csv`
- Seeds 4 investment items (PPF, PF, Sidvin/SIPs, Stocks & ETF) with Aug 2025 snapshot values
- After import, update each investment card manually in /assets → Investments tab
- Loans (Shantanu, Karthik, Hers) are added manually in the UI — no import script

## scripts/import_recurring.py
- Reads from `scripts/data/Cushion - Recurring.csv` (3-section layout: monthly active, yearly active, inactive)
- Dry run by default; use `--commit` to write
- Maps category names to existing Firestore category IDs; creates missing ones
- Writes to `cushion_recurring_items` with `importedFrom: 'csv_import_recurring'`

## Recurring page notes
- Gas is currently inactive in Firestore — to use it as every-N-months, edit it in the UI: set frequency to "Every N months", set interval, toggle Active
- The `every_n_months` frequency + Occasional section is built but not currently used; it's there for when Gas (or similar items) are activated
- "Every N months" not appearing in dropdown after code change → hard refresh or dev server restart
- Variable monthly items (e.g. E-bill, Gas): mark as Variable + Monthly; enter actual amount each month in push drawer, enter 0 for months not due
- Push to Transactions creates expenses with `importedFrom: 'recurring_push_YYYY-MM'`; to clean up test pushes, filter by "Recurring" category chip in /expenses and delete

## Roadmap

### Phase 2 (in priority order)
1. Settings > Cards (`/settings/cards`) — unlocks credit card dropdown in expense form + NL parsing
2. Settings > Webhooks (`/settings/webhooks`) — Google Sheets pull for "Hers" loan balance
3. Dashboard enhancements — month selector, spending by category chart, recent transactions widget
4. Notifications / alerts — budget 80%/100% delivery (alertAt80/alertAt100 flags already in Firestore)
5. Export — CSV/PDF of expenses
6. Recurring auto-push — auto-push on due date instead of manual push drawer
7. Multi-month budget tracking — historical budget vs actual
8. EMIs page (`/emis`) — low priority
9. Income history import — low priority (`cushion_income` is currently empty)

### Phase 3
- DataContext global cache (onSnapshot) — deferred deliberately; pages call db/index.js directly until then. Build at Phase 3 start before PWA work. At ~73 expenses/month, lag becomes noticeable around 2,500–3,500 docs (~mid-2027 to early 2028), which aligns with Phase 3 timing.
- Mobile PWA (install to home screen, offline support)
- Trip / vacation tagging (`tripId` already on expense docs, no UI yet)

### Cut (not worth building)
- Settings > Account — Firebase Console handles everything
- Reports / insights page — redundant with dashboard
- Global search — expenses search is sufficient

## Code style
- Functional components only, no class components
- Named exports for pages, default exports are fine too
- No TypeScript — plain JS/JSX throughout
- Keep db calls in event handlers or useEffect, never inline in JSX
- MUI `sx` prop for styling, not inline `style` unless trivial
