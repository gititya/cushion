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
Before doing anything, say in one sentence what you are about 
to do and why -- like explaining to a smart non-technical person.

After doing it, say in one sentence what was created or changed 
and what it means for the app.

Example of the right level:
"Creating the DAL file -- this is the single file that talks to 
Firebase so nothing else in the app ever needs to."
"Done. db/index.js exists now. Every other file will import from 
here instead of touching Firebase directly."

Do not explain every line of code. Do not use jargon without a 
one-word clarification in brackets. Do not narrate things that 
did not happen yet. If something fails, say what failed and what 
you are trying instead -- one sentence each."
