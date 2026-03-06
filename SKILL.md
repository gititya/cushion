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
5. Aggregations -- src/analytics.js for multi-collection aggregations only.
   Simple page-level useMemo totals on already-fetched data are fine inline.
6. Claude calls -- src/claude.js only, never inline in components
7. No encryption -- data is stored as plaintext in Firestore.
   Do not use CryptoJS or any encryption layer.
8. DataContext -- all data access goes through useData() from
   src/contexts/DataContext.jsx. Pages never call Firestore directly.
   Mutations update both Firestore and the context optimistically.
9. Categories and recurring items -- always live from DataContext, never hardcoded
10. Scripts -- always run inside /venv

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

### Typography scale
- Page titles: variant="h6" fontWeight 700
- Section labels: variant="subtitle2" fontWeight 700, letterSpacing 0.5
- Table content and sidebar nav: variant="body2"
- Secondary and meta text: variant="caption"

### Case
All UI text is lowercase -- page headings, nav labels, section headers,
table column headers, dialog titles, CTAs, stat labels.
Exception: user-entered data (descriptions, names) displayed exactly as entered.

### Amounts
Always format with maximumFractionDigits: 0. No trailing .00.
Use toLocaleString('en-IN', { maximumFractionDigits: 0 }) everywhere.

### Notes indicator
Any table row or list item with a non-null notes field shows a 6px
primary.light filled circle (borderRadius: '50%') next to the primary text,
wrapped in a Tooltip showing the note text on hover.

## Git behaviour
When the user says "push" or "push to main" or "push to [branch]":
- Stage all changed files
- Write a concise commit message describing what was built
- Commit and push to the specified branch
- Confirm with: branch name, commit message, files changed

Default branch for feature work: dev
Default branch for completed features: main
Never push to main unless explicitly told to.
Never ask "are you sure" -- just do it and confirm after.

## Communication style
Lead with action, not narration. Skip the preamble unless the approach
materially affects a decision the user needs to make.

After completing, give a tight summary -- one line per logical group of
changes, not per file. Flag assumptions and decisions worth revisiting.
Skip self-evident ones.

If something is ambiguous, state your assumption and proceed. Flag it
at the end. Do not stop to ask.

If something fails, say what failed, why, and what you are trying next.
One short paragraph.

## Autonomy
Work autonomously. Do not ask for confirmation on individual files,
folder names, or implementation details -- make the right call based
on SKILL.md and the PRD and keep going.

Only stop and ask when:
- You need a value not provided (API key, Firebase config)
- You are about to do something irreversible (delete data, change schema)
- You hit a genuine blocker you cannot resolve

## Session startup -- do this before writing any code
1. Read SKILL.md and CLAUDE.md
2. Read the PRD at https://www.notion.so/31903a88e6bd81079704e95f8802b207
3. Look at the existing codebase and determine what is built,
   what is partial, and what has not been started
4. State your findings and propose what to work on next
5. Wait for confirmation before writing any code

## Out of scope -- never build unless explicitly told to
- SMS or bank feed integration of any kind
- Credit card number storage
- Direct Groww or bank API integration
- Trip tracking UI (Phase 5 -- tripId field exists in schema, no UI yet)
- Expected Income UI (Phase 3 -- needs design session first)
- Cross-app integration with any other my_os app
