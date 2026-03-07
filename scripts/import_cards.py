"""
import_cards.py — seed credit cards + category card advice into Firestore

Dry run by default. Use --commit to write.
Run inside my_os_venv: source ~/venvs/my_os_venv/bin/activate && python scripts/import_cards.py
"""

import sys
import os
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

SERVICE_ACCOUNT = os.getenv(
    'FIREBASE_SERVICE_ACCOUNT',
    '/Users/aditya/Documents/Projects/firebase/cushion-serviceaccount.json',
)
USER_ID = os.getenv('CUSHION_USER_ID')
COMMIT = '--commit' in sys.argv

# ---------------------------------------------------------------------------
# Cards to seed
# ---------------------------------------------------------------------------

CARDS = [
    {'name': 'Regalia Gold',    'network': 'Visa',       'billingCycle': '13th–12th'},
    {'name': 'Tata Neu',        'network': 'Rupay',      'billingCycle': None},
    {'name': 'HDFC Swiggy',     'network': 'Visa',       'billingCycle': None},
    {'name': 'ICICI Amazon',    'network': 'Visa',       'billingCycle': '19th–19th'},
    {'name': 'Axis Atlas',      'network': 'Visa',       'billingCycle': '11th–9th'},
    {'name': 'Axis Indian Oil', 'network': 'Rupay',      'billingCycle': None},
    {'name': 'Amex Platinum',   'network': 'Amex',       'billingCycle': '9th–8th'},
]

# ---------------------------------------------------------------------------
# Per-category card advice (category name → advice text)
# ---------------------------------------------------------------------------

CATEGORY_ADVICE = {
    'Car':                       'Indian Oil Fuel → Axis Indian Oil\nOther fuel & repairs → Regalia Gold',
    'Entertainment':             'Regalia Gold | Amex or Atlas (for milestone)',
    'Food ordering':             'Swiggy → HDFC Swiggy | Zomato → Tata Neu or Regalia Gold | Also consider Amazon vouchers via ICICI Amazon',
    'Gift':                      'Amazon → ICICI Amazon | Offline/others → Regalia Gold | Tata purchases → Tata Neu | Check Amex multiplier',
    'Go out':                    'Swiggy Dineout → HDFC Swiggy | Other restaurants → Axis Atlas | Regalia Gold in general',
    'Groceries':                 'Instamart → HDFC Swiggy | Blinkit → Regalia Gold or Tata Neu | Amazon Fresh → ICICI Amazon | Offline → Regalia Gold | BigBasket → Tata Neu',
    'Health/Fitness/Wellness':   'Amazon → ICICI Amazon | Otherwise Regalia Gold or Tata Neu',
    'House rent':                'None ideal — use Regalia Gold, Atlas, or Amex for milestone spend',
    'One-off':                   'Amazon → ICICI Amazon | Offline stores → Amex or Regalia Gold (check offers)',
    'Public Transport':          'Tata Neu',
    'Smokes':                    'Instamart → HDFC Swiggy | Blinkit/Offline → Regalia Gold or Tata Neu',
    'Travel':                    'Direct airline/hotel → Axis Atlas (transfer miles, book via Travel EDGE) | Aggregators → Regalia Gold SmartBuy | Amex portal or for milestone',
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    if not USER_ID:
        print('ERROR: set CUSHION_USER_ID in scripts/.env')
        sys.exit(1)

    cred = credentials.Certificate(SERVICE_ACCOUNT)
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    print(f'Mode: {"COMMIT" if COMMIT else "DRY RUN"}\n')

    # --- Cards ---
    print('=== Credit Cards ===')
    existing_cards = db.collection('cushion_credit_cards').where('userId', '==', USER_ID).get()
    existing_names = {d.to_dict()['name'] for d in existing_cards}

    for card in CARDS:
        if card['name'] in existing_names:
            print(f'  SKIP (exists): {card["name"]}')
            continue
        print(f'  ADD: {card["name"]} ({card["network"]}, billing: {card["billingCycle"] or "—"})')
        if COMMIT:
            db.collection('cushion_credit_cards').add({
                'userId': USER_ID,
                'name': card['name'],
                'network': card['network'],
                'billingCycle': card['billingCycle'],
                'cashbackCategories': [],
                'rewardPointsRate': None,
                'travelBenefits': None,
                'onlineOfflineBenefits': None,
                'isActive': True,
            })

    # --- Category advice ---
    print('\n=== Category Card Advice ===')
    cats = db.collection('cushion_categories').where('userId', '==', USER_ID).get()
    cat_map = {d.to_dict()['name'].lower(): d for d in cats}

    for cat_name, advice in CATEGORY_ADVICE.items():
        if cat_name.lower() not in cat_map:
            print(f'  NOT FOUND: {cat_name} — skipping')
            continue
        doc = cat_map[cat_name.lower()]
        existing_advice = doc.to_dict().get('cardAdvice')
        if existing_advice:
            print(f'  SKIP (has advice): {cat_name}')
            continue
        print(f'  SET advice: {cat_name}')
        if COMMIT:
            doc.reference.update({'cardAdvice': advice})

    print('\nDone.' if COMMIT else '\nDry run complete. Run with --commit to write.')


if __name__ == '__main__':
    main()
