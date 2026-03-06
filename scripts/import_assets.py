#!/usr/bin/env python3
"""
Import assets into Firestore:
  1. All 11 Fixed Deposits from scripts/data/Cushion - Fixed Deposits.csv
  2. Seed 4 investment items (PPF, PF, Sidvin/SIPs, Stocks & ETF)
     — values are from Aug 2025 snapshot; update them manually in /assets after import.

Usage:
    python import_assets.py          # dry run
    python import_assets.py --commit # write to Firestore
"""

import csv
import sys
import os
from datetime import datetime

from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore

CSV_PATH = os.path.join(os.path.dirname(__file__), "data", "Cushion - Fixed Deposits.csv")

# Snapshot values from "money out vs. in" CSV, dated Aug 4 2025.
# Update each card to current value after importing.
INVESTMENT_SEEDS = [
    {'name': 'PPF',           'type': 'ppf',        'currentValue': 545998,   'amountInvested': 545998},
    {'name': 'PF / EPF',      'type': 'pf',         'currentValue': 1483477,  'amountInvested': 1483477},
    {'name': 'Sidvin / SIPs', 'type': 'sip',        'currentValue': 319847,   'amountInvested': 319847},
    {'name': 'Stocks & ETF',  'type': 'stocks_etf', 'currentValue': 72167,    'amountInvested': 72167},
]


def load_env():
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
    sa_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH")
    user_id = os.environ.get("USER_ID")
    if not sa_path or not user_id:
        print("ERROR: FIREBASE_SERVICE_ACCOUNT_PATH and USER_ID must be set in scripts/.env")
        sys.exit(1)
    return sa_path, user_id


def parse_amount(raw):
    return float(raw.replace('₹', '').replace(',', '').strip())


def parse_date(raw):
    raw = raw.strip()
    for fmt in ('%d %B %Y', '%d %b %Y'):
        try:
            return datetime.strptime(raw, fmt).date().isoformat()
        except ValueError:
            continue
    return raw  # return as-is if unparseable


def load_fds():
    fds = []
    with open(CSV_PATH, newline='', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        rows = list(reader)

    for row in rows[1:]:  # skip header row
        if not row or not row[0].strip():
            continue  # skip blank / summary rows
        bank = row[0].strip()
        status_raw = row[1].strip()
        status = 'in_progress' if status_raw == 'In Progress' else 'matured'
        start = parse_date(row[2])
        end = parse_date(row[3])
        invested = parse_amount(row[4])
        maturity = parse_amount(row[5])
        returns_pct = round((maturity - invested) / invested * 100, 2) if invested else None

        fds.append({
            'name': f'{bank} FD',
            'type': 'fd',
            'platform': bank,
            'amountInvested': invested,
            'currentValue': maturity,
            'returnsPercent': returns_pct,
            'startDate': start,
            'maturityDate': end,
            'status': status,
            'notes': None,
        })
    return fds


def main():
    commit = '--commit' in sys.argv

    fds = load_fds()
    active = [f for f in fds if f['status'] == 'in_progress']
    matured = [f for f in fds if f['status'] == 'matured']

    mode = 'COMMIT' if commit else 'DRY RUN'
    print(f'\n=== {mode} SUMMARY ===')
    print(f'\n  Fixed Deposits: {len(fds)} total ({len(active)} active, {len(matured)} matured)')
    for fd in fds:
        tag = '[ACTIVE ] ' if fd['status'] == 'in_progress' else '[MATURED] '
        print(f'  {tag} {fd["platform"]:<22} ₹{fd["amountInvested"]:>10,.0f}  →  ₹{fd["currentValue"]:>10,.0f}  ({fd["returnsPercent"]}%)')

    print(f'\n  Investments (Aug 2025 snapshot — update in /assets after import):')
    for inv in INVESTMENT_SEEDS:
        print(f'  {inv["name"]:<22} ₹{inv["currentValue"]:>10,.0f}')

    if not commit:
        print('\n>>> DRY RUN — no data written. Re-run with --commit to import.')
        return

    sa_path, user_id = load_env()
    cred = credentials.Certificate(sa_path)
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    col = db.collection('cushion_investments')

    for fd in fds:
        col.add({
            'userId': user_id,
            **fd,
            'importedFrom': 'csv_import_fds',
            'createdAt': firestore.SERVER_TIMESTAMP,
            'updatedAt': firestore.SERVER_TIMESTAMP,
        })
    print(f'  Wrote {len(fds)} FD docs.')

    for inv in INVESTMENT_SEEDS:
        col.add({
            'userId': user_id,
            'name': inv['name'],
            'type': inv['type'],
            'amountInvested': inv['amountInvested'],
            'currentValue': inv['currentValue'],
            'returnsPercent': None,
            'platform': None,
            'startDate': None,
            'maturityDate': None,
            'status': 'active',
            'notes': 'Aug 2025 snapshot — tap card to update',
            'importedFrom': 'seed_investments',
            'createdAt': firestore.SERVER_TIMESTAMP,
            'updatedAt': firestore.SERVER_TIMESTAMP,
        })
    print(f'  Wrote {len(INVESTMENT_SEEDS)} investment seed docs.')
    print('\nDone. Open /assets → Investments tab and update each card to current values.')


if __name__ == '__main__':
    main()
