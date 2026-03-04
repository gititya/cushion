# Cushion — Claude Code Skill

## What this app is
Personal finance tracker. Part of adi-os ecosystem.
Firebase project: adi-os. GitHub repo: cushion.

## Stack
- Frontend: React + Vite + Tailwind
- Database: Firebase Firestore (flat, relational, prefixed cushion_)
- Auth: Firebase Auth (email + password)
- Hosting: Firebase Hosting
- AI: Claude API — haiku for NL parsing, sonnet for insights
- Notifications: Webhook → Microsoft Graph API

## Non-negotiable architecture rules
1. DAL only: src/db/index.js is the ONLY file that imports Firebase
2. Flat collections: no subcollections ever
3. Prefix: all collections are cushion_{name}
4. userId: first field on every document
5. Aggregations: analytics.js only, never inline
6. Claude calls: claude.js only, never inline
7. Encryption: DAL encrypts amount/description/notes on write, decrypts on read
8. Categories: always live from Firestore, never hardcoded

## Naming
- Collections: cushion_expenses, cushion_credit_cards (snake_case plural)
- Components: PascalCase (TransactionCard)
- Files: kebab-case (transaction-list.jsx)
- Env vars: VITE_FIREBASE_*, VITE_CLAUDE_API_KEY (.env.local, gitignored)

## Design system
- Material 3 Expressive — @mui/material v5+
- Primary: #6750A4
- Font: Plus Jakarta Sans (Google Fonts)
- Gradients: primary → tertiary on hero cards + chart backgrounds
- Charts: Recharts with M3 palette
- No heavy shadows — M3 tinted surface elevation

## Current phase
[Update this line at the start of each session]
Phase 1 — Core

## Session startup checklist
1. State which feature you are building today
2. Confirm you have read this SKILL.md
3. Confirm you have read Section 11 of the PRD
4. Do not scaffold new collections without checking 
   the data model in Section 5 of the PRD first

## Out of scope — never build
- SMS/bank feed integration
- Card number storage
- Direct Groww/bank API integration
- Trip tracking UI (Phase 5)
- Expected Income UI (Phase 3, needs design first)
- Cross-app integration with other adi-os apps
