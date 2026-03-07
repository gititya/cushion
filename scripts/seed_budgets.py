#!/usr/bin/env python3
"""
One-time seed script: write monthly budget limits to cushion_budgets.

Usage:
  python seed_budgets.py          # dry run (no writes)
  python seed_budgets.py --commit # write to Firestore

Reads userId from existing cushion_categories documents.
Skips categories with no budget defined and categories that already have a budget.
"""

import sys
import os
from pathlib import Path
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore

load_dotenv(Path(__file__).parent / '.env')

SERVICE_ACCOUNT = os.getenv(
    'SERVICE_ACCOUNT_PATH',
    '/Users/aditya/Documents/Projects/firebase/cushion-serviceaccount.json',
)
DRY_RUN = '--commit' not in sys.argv

# category name → monthly limit in INR (None = no budget, skip)
BUDGETS = [
    ('Travel',                   40000),
    ('House rent',               27400),
    ('Investment',               None),
    ('Food ordering',            12000),
    ('Recurring',                15000),
    ('One-off',                  5000),
    ('Health/Fitness/Wellness',  10000),
    ('Groceries',                8000),
    ('Car',                      5000),
    ('Go out',                   5000),
    ('Smokes',                   4000),
    ('Entertainment',            4000),
    ('Learning',                 3000),
    ('Public Transport',         1000),
    ('Gift',                     None),
]


def main():
    cred = credentials.Certificate(SERVICE_ACCOUNT)
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    # Resolve userId from an existing category document
    cat_docs = list(db.collection('cushion_categories').limit(5).stream())
    if not cat_docs:
        print('ERROR: no cushion_categories documents found — cannot determine userId')
        sys.exit(1)

    user_id = None
    for doc in cat_docs:
        user_id = doc.to_dict().get('userId')
        if user_id:
            break

    if not user_id:
        print('ERROR: userId field not found on category documents')
        sys.exit(1)

    print(f'userId: {user_id}')

    # Build category name → Firestore doc id map
    all_cats = list(db.collection('cushion_categories').stream())
    cat_map = {doc.to_dict().get('name'): doc.id for doc in all_cats}
    print(f'Categories in Firestore: {sorted(cat_map.keys())}')

    # Find existing budgets to avoid duplicates
    existing = list(db.collection('cushion_budgets').stream())
    existing_cat_ids = {doc.to_dict().get('categoryId') for doc in existing}
    print(f'Existing budget docs: {len(existing)}')
    print()

    seeded = 0
    for cat_name, limit in BUDGETS:
        if limit is None:
            print(f'  skip (no budget defined): {cat_name}')
            continue

        cat_id = cat_map.get(cat_name)
        if not cat_id:
            print(f'  WARN: category not found in Firestore — skipping: {cat_name}')
            continue

        if cat_id in existing_cat_ids:
            print(f'  skip (budget already exists): {cat_name}')
            continue

        doc = {
            'userId': user_id,
            'categoryId': cat_id,
            'monthlyLimit': limit,
            'alertAt80': True,
            'alertAt100': True,
            'isActive': True,
        }

        if DRY_RUN:
            print(f'  [DRY] would seed: {cat_name} => Rs {limit:,}')
        else:
            db.collection('cushion_budgets').add(doc)
            print(f'  seeded: {cat_name} => Rs {limit:,}')

        seeded += 1

    print()
    if DRY_RUN:
        print(f'DRY RUN complete — {seeded} budgets would be written.')
        print('Run with --commit to write to Firestore.')
    else:
        print(f'Done — {seeded} budgets written to cushion_budgets.')


if __name__ == '__main__':
    main()
