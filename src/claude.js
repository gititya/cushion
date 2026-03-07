/**
 * claude.js -- All Claude API calls live here.
 *
 * Nothing else in the codebase calls the Claude API directly.
 * Model: claude-haiku-4-5-20251001 for NL transaction parsing (Phase 1).
 */

import Anthropic from '@anthropic-ai/sdk'

const HAIKU_MODEL = 'claude-haiku-4-5-20251001'

const client = new Anthropic({
  apiKey: import.meta.env.VITE_CLAUDE_API_KEY,
  dangerouslyAllowBrowser: true,
})

// ---------------------------------------------------------------------------
// Natural language transaction parser (Phase 1)
// ---------------------------------------------------------------------------

/**
 * Parse a natural language expense description into structured fields.
 *
 * @param {string} input - e.g. "paid 450 for coffee at Blue Tokai with HDFC card"
 * @param {Array}  categories - live list from Firestore [{ id, name }]
 * @param {Array}  cards - live list from Firestore [{ id, name }]
 * @returns {Object} Parsed fields -- any unresolved fields are null
 *   { amount, description, categoryId, paymentMethod, cardId, date }
 */
export async function parseExpenseNL(input, categories, cards) {
  const categoryList = categories
    .filter((c) => c.isActive)
    .map((c) => `${c.id}: ${c.name}`)
    .join('\n')

  const cardList = cards
    .filter((c) => c.isActive)
    .map((c) => `${c.id}: ${c.name}`)
    .join('\n')

  const systemPrompt = `You are a transaction parser for a personal finance app.
Extract fields from a natural language expense description and return valid JSON only.
No explanation, no markdown -- raw JSON only.

Available expense categories (id: name):
${categoryList}

Available credit cards (id: name):
${cardList}

Return this exact shape:
{
  "amount": <number or null>,
  "description": <string or null>,
  "categoryId": <category id from the list above, or null if unclear>,
  "paymentMethod": <"credit_card" | "upi" | "cash" | null>,
  "cardId": <card id from the list above, only if paymentMethod is credit_card, else null>,
  "date": <"today" | "yesterday" | ISO date string, default "today">
}

Rules:
- amount must be a plain number, no currency symbols
- If the category is ambiguous, set categoryId to null -- do not guess
- If a card is mentioned by partial name, match to the closest card in the list
- If no card is mentioned but paymentMethod is credit_card, set cardId to null`

  const message = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: 'user', content: input }],
  })
  const text = message.content?.[0]?.text ?? ''
  console.log('[NL] raw text from Claude:', text)

  try {
    // Strip markdown code fences if Claude wraps the JSON
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    return JSON.parse(cleaned)
  } catch {
    // Parse failed -- return null fields so the form stays open for manual entry
    return {
      amount: null,
      description: null,
      categoryId: null,
      paymentMethod: null,
      cardId: null,
      date: 'today',
    }
  }
}

// ---------------------------------------------------------------------------
// Financial Q&A (Phase 2)
// ---------------------------------------------------------------------------

/**
 * Answer a natural language financial question using dashboard context.
 *
 * @param {string} query - User's question
 * @param {Object} ctx
 *   @param {Array} ctx.monthlyData - [{ ym, total, byCat }] last 6 months
 *   @param {Array} ctx.months - all month strings (YYYY-MM)
 *   @param {Array} ctx.categories - [{ id, name }]
 *   @param {Array} ctx.cards - [{ id, name, network, cashbackCategories, rewardPointsRate }]
 *   @param {Array} ctx.budgets - [{ categoryId, monthlyLimit }]
 * @returns {string} Plain text answer
 */
export async function askFinancialQuestion(query, { monthlyData, months, categories, cards, budgets }) {
  const last6 = monthlyData.slice(-6)

  const catById = Object.fromEntries(categories.map((c) => [c.id, c.name]))

  const spendSummary = last6.map(({ ym, total, byCat }) => ({
    month: ym,
    total: Math.round(total),
    byCategory: Object.fromEntries(
      Object.entries(byCat).map(([id, amt]) => [catById[id] || id, Math.round(amt)])
    ),
  }))

  const cardSummary = cards.map((c) => ({
    name: c.name,
    network: c.network,
    cashbackCategories: c.cashbackCategories,
    rewardPointsRate: c.rewardPointsRate,
  }))

  const budgetSummary = budgets.map((b) => ({
    category: catById[b.categoryId] || b.categoryId,
    monthlyLimit: b.monthlyLimit,
  }))

  const systemPrompt = `You are a personal finance assistant for a single user in India. All amounts are in Indian rupees (₹).
Answer the user's question concisely in plain text only — no markdown, no bullet points, no headers.
Keep your answer to 2-4 sentences. Be direct and specific with numbers where relevant.

Monthly spend data (last 6 months):
${JSON.stringify(spendSummary, null, 2)}

Credit cards available:
${JSON.stringify(cardSummary, null, 2)}

Budget limits by category:
${JSON.stringify(budgetSummary, null, 2)}`

  const message = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 400,
    system: systemPrompt,
    messages: [{ role: 'user', content: query }],
  })

  return message.content?.[0]?.text?.trim() ?? 'Sorry, I could not generate a response.'
}
