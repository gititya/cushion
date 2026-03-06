#!/usr/bin/env python3
"""
Import recurring items from CSV into Firestore cushion_recurring_items.

CSV structure (scripts/data/Cushion - Recurring.csv):
  Row 1:  Sheet title (skip)
  Row 2:  Blank (skip)
  Row 3:  Headers (3 sections separated by blank column)
  Row 4+: Data rows

  Section 1 (Monthly active):  cols 0–5  (name, amount, cat, freq, type, source)
  Section 2 (Yearly active):   cols 7–12 (name, amount, cat, freq, type, when)
  Section 3 (Inactive):        cols 14–19 (name, amount, cat, freq, type, status)

Usage:
    python import_recurring.py          # dry run — prints summary, writes nothing
    python import_recurring.py --commit # actually writes to Firestore

Setup:
    Requires scripts/.env with FIREBASE_SERVICE_ACCOUNT_PATH and USER_ID.
    Run from the scripts/ directory or set paths accordingly.
"""

import csv
import sys
import os

from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

CSV_PATH = os.path.join(os.path.dirname(__file__), "data", "Cushion - Recurring.csv")

MONTH_MAP = {
    'january': 1, 'february': 2, 'march': 3, 'april': 4,
    'may': 5, 'june': 6, 'july': 7, 'august': 8,
    'september': 9, 'october': 10, 'november': 11, 'december': 12,
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_env():
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
    sa_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH")
    user_id = os.environ.get("USER_ID")
    if not sa_path or not user_id:
        print("ERROR: FIREBASE_SERVICE_ACCOUNT_PATH and USER_ID must be set in scripts/.env")
        sys.exit(1)
    return sa_path, user_id


def parse_amount(raw: str):
    """Return (float, is_variable). '??' or empty → (0, True)."""
    raw = raw.strip()
    if not raw or raw == '??':
        return 0.0, True
    try:
        return float(raw.replace('₹', '').replace(',', '').strip()), False
    except ValueError:
        return 0.0, True


def safe_get(row, idx):
    """Get cell value with bounds check."""
    return row[idx].strip() if idx < len(row) else ''


# ---------------------------------------------------------------------------
# CSV parsing
# ---------------------------------------------------------------------------

def load_csv():
    with open(CSV_PATH, newline='', encoding='utf-8-sig') as f:
        all_rows = list(csv.reader(f))
    # Row 0: title, Row 1: blank, Row 2: headers → data starts at index 3
    return all_rows[3:]


def extract_items(data_rows):
    """
    Returns list of dicts:
      name, amount, isVariable, category, frequency, renewalMonth,
      paymentMethod, isActive
    """
    items = []

    for row in data_rows:
        # Pad row to at least 20 columns
        while len(row) < 20:
            row.append('')

        # --- Section 1: Monthly active (cols 0–5) ---
        name1 = safe_get(row, 0)
        if name1 and name1 != '??':
            amount, is_var = parse_amount(safe_get(row, 1))
            type_str = safe_get(row, 4)
            if 'change' in type_str.lower():
                is_var = True
            items.append({
                'name': name1,
                'amount': amount,
                'isVariable': is_var,
                'category': safe_get(row, 2),
                'frequency': 'monthly',
                'renewalMonth': None,
                'paymentMethod': safe_get(row, 5) or None,
                'isActive': True,
            })

        # --- Section 2: Yearly active (cols 7–12) ---
        name2 = safe_get(row, 7)
        if name2 and name2 != '??':
            amount, is_var = parse_amount(safe_get(row, 8))
            type_str = safe_get(row, 11)
            if 'change' in type_str.lower():
                is_var = True
            when_raw = safe_get(row, 12).lower()
            renewal_month = MONTH_MAP.get(when_raw, None)
            items.append({
                'name': name2,
                'amount': amount,
                'isVariable': is_var,
                'category': safe_get(row, 9),
                'frequency': 'yearly',
                'renewalMonth': renewal_month,
                'paymentMethod': None,
                'isActive': True,
            })

        # --- Section 3: Inactive (cols 14–19) ---
        name3 = safe_get(row, 14)
        if name3 and name3 != '??':
            amount, is_var = parse_amount(safe_get(row, 15))
            type_str = safe_get(row, 18)
            if 'change' in type_str.lower():
                is_var = True
            freq_raw = safe_get(row, 17).lower()
            if 'year' in freq_raw:
                frequency = 'yearly'
            else:
                frequency = 'monthly'  # default for "Every 2 mths" etc.
            items.append({
                'name': name3,
                'amount': amount,
                'isVariable': is_var,
                'category': safe_get(row, 16),
                'frequency': frequency,
                'renewalMonth': None,
                'paymentMethod': None,
                'isActive': False,
            })

    return items


# ---------------------------------------------------------------------------
# Firestore helpers
# ---------------------------------------------------------------------------

def ensure_categories(db, user_id, items, commit):
    """Resolve category names to IDs; create missing ones if commit=True."""
    col = db.collection('cushion_categories')
    existing = {}
    for doc in col.where('userId', '==', user_id).stream():
        d = doc.to_dict()
        existing[d.get('name', '').lower()] = doc.id

    cat_map = {}
    for item in items:
        cat_name = item['category']
        if not cat_name:
            cat_map[cat_name] = None
            continue
        lower = cat_name.lower()
        if lower in existing:
            cat_map[cat_name] = existing[lower]
        elif cat_name not in cat_map:
            if commit:
                ref = col.add({
                    'userId': user_id,
                    'name': cat_name,
                    'icon': '📦',
                    'color': '#90A4AE',
                    'sortOrder': 99,
                    'isActive': True,
                    'createdAt': firestore.SERVER_TIMESTAMP,
                })[1]
                cat_map[cat_name] = ref.id
                existing[lower] = ref.id
                print(f"  Created category: {cat_name} → {ref.id}")
            else:
                cat_map[cat_name] = f'<would-create:{cat_name}>'

    return cat_map


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    commit = '--commit' in sys.argv

    print('Loading CSV...')
    data_rows = load_csv()
    items = extract_items(data_rows)

    monthly  = [i for i in items if i['isActive'] and i['frequency'] == 'monthly']
    yearly   = [i for i in items if i['isActive'] and i['frequency'] == 'yearly']
    inactive = [i for i in items if not i['isActive']]

    mode = 'COMMIT' if commit else 'DRY RUN'
    print(f'\n=== {mode} SUMMARY ===')
    print(f'  Monthly active : {len(monthly)} items')
    print(f'  Yearly active  : {len(yearly)} items')
    print(f'  Inactive       : {len(inactive)} items')
    print(f'  Total          : {len(items)} items')
    print()

    for item in sorted(items, key=lambda x: (x['frequency'], not x['isActive'], x['name'])):
        var_flag      = ' [variable]'  if item['isVariable'] else ''
        inactive_flag = ' [inactive]' if not item['isActive'] else ''
        renewal       = f' renews:{MONTH_MAP.get(str(item["renewalMonth"]).lower(), item["renewalMonth"])}' \
                        if item['renewalMonth'] else ''
        print(
            f'  [{item["frequency"][:3].upper()}]{inactive_flag:<11}'
            f' {item["name"]:<42} ₹{item["amount"]:>10,.2f}'
            f'{var_flag}{renewal}'
        )

    if not commit:
        print('\n>>> DRY RUN — no data written. Re-run with --commit to import.')
        return

    # --- Firebase ---
    sa_path, user_id = load_env()
    cred = credentials.Certificate(sa_path)
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    print('\n=== CATEGORY RESOLUTION ===')
    cat_map = ensure_categories(db, user_id, items, commit)

    print(f'\n=== IMPORTING {len(items)} RECURRING ITEMS ===')
    col = db.collection('cushion_recurring_items')
    for item in items:
        col.add({
            'userId': user_id,
            'name': item['name'],
            'amount': item['amount'],
            'isVariable': item['isVariable'],
            'categoryId': cat_map.get(item['category']),
            'frequency': item['frequency'],
            'renewalMonth': item['renewalMonth'],
            'paymentMethod': item['paymentMethod'],
            'type': 'expense',
            'nextDueDate': None,
            'reminderDaysBefore': None,
            'notes': None,
            'isActive': item['isActive'],
            'importedFrom': 'csv_import_recurring',
            'createdAt': firestore.SERVER_TIMESTAMP,
        })

    print(f'  Done. {len(items)} recurring item docs written to cushion_recurring_items.')


if __name__ == '__main__':
    main()
