# Cushion -- SKILL.md
# Claude Code reads this at the start of every session before writing any code.

## What this app is
Personal finance tracker. App 1 of the my_os ecosystem.
Firebase project: my_os | GitHub: https://github.com/gititya/cushion
PRD: https://www.notion.so/31903a88e6bd81079704e95f8802b207

## Current phase
Phase 1 -- Core
Update this line at the start of each session.

## Stack
- Frontend: React + Vite + Tailwind
- Database: Firebase Firestore (flat, relational, prefixed cushion_)
- Auth: Firebase Auth (email + password)
- Hosting: Firebase Hosting (my_os project)
- AI: Claude API -- haiku (claude-haiku-4-5-20251001) for NL parsing, sonnet for insights
- Notifications: Webhook to Microsoft Graph API
- Python: venv inside /scripts for all scripts

## Non-negotiable architecture rules
1. DAL only -- src/db/index.js is the ONLY file that imports Firebase
2. Flat collections -- no subcollections, ever
3. Prefix -- all collections are cushion_{name}
4. userId -- first field on every Firestore document
5. Aggregations -- src/analytics.js only, never inline in components
6. Claude calls -- src/claude.js only, never inline in components
7. Encryption -- DAL encrypts amount, description, notes on write and decrypts on read
8. Categories and recurring items -- always live from Firestore, never hardcoded
9. Scripts -- always run inside /venv

## Naming
- Collections: cushion_expenses, cushion_credit_cards (snake_case plural)
- Components: PascalCase (TransactionCard, BudgetProgressBar)
- Files: kebab-case (transaction-list.jsx, use-budgets.js)
- Env vars: VITE_FIREBASE_* and VITE_CLAUDE_API_KEY in .env.local (gitignored)

## Design system
- Google Material 3 Expressive -- @mui/material v5+
- Primary colour: #6750A4
- Font: Plus Jakarta Sans (Google Fonts, imported in index.html)
- Gradients: linear from primary to tertiary on hero cards and chart backgrounds
- Charts: Recharts with M3 colour palette
- No heavy shadows -- M3 tinted surface elevation only

## Session startup -- do this before writing any code
1. State which feature you are building today
2. Confirm you have read this SKILL.md
3. Check Section 5 of the PRD before creating any new Firestore collection
4. Check Section 12 of the PRD for the full mandatory rules list

## Out of scope -- never build unless explicitly told to
- SMS or bank feed integration of any kind
- Credit card number storage
- Direct Groww or bank API integration
- Trip tracking UI (Phase 5 -- tripId field exists in schema, no UI yet)
- Expected Income UI (Phase 3 -- needs design session first)
- Cross-app integration with any other my_os app

## Communication style
Before starting a task, give 2-3 sentences on what you are 
building and how you are approaching it. Enough context that 
a non-technical person understands what is about to happen 
and why.

After completing it, briefly confirm what was built and call 
out anything the user should know or decide -- e.g. a default 
you chose that they might want to change.

If something is ambiguous, state your assumption and proceed. 
Do not ask. Flag the assumption at the end so the user can 
correct it if needed.

If something fails, say what failed, why, and what you are 
trying next. One short paragraph.

Never explain line by line. No jargon without a brief 
clarification. No excessive bullet points.

## Communication style
Before starting, 2-3 sentences on what you're building and 
your approach. After, confirm what was built and flag any 
assumptions you made. State assumptions and proceed -- never 
stop to ask. Flag at the end.

## Git
When I say push or push to [branch]: stage all, commit with 
a descriptive message, push, confirm. No prompts.

7. No encryption -- data stored as plaintext in Firestore.
   Do not use CryptoJS or any encryption layer.
