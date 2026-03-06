#!/usr/bin/env python3
"""
One-time import of historical expense data from CSV into Firestore.

Usage:
    python import_data.py          # dry run — prints summary, writes nothing
    python import_data.py --commit # actually writes to Firestore

Setup:
    cd scripts
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    cp .env.example .env           # fill in FIREBASE_SERVICE_ACCOUNT_PATH and USER_ID
"""

import csv
import sys
import os
from datetime import date, datetime
from collections import defaultdict

from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

CUTOFF_DATE = date(2026, 3, 1)   # exclude rows with date >= this
CSV_PATH = os.path.join(os.path.dirname(__file__), "data", "transactions.csv")

# Default emoji + color for each category name (case-insensitive match).
# These are used only when creating a new category doc.
CATEGORY_DEFAULTS = {
    "car":                      ("🚗", "#EF5350"),
    "entertainment":            ("🎬", "#AB47BC"),
    "food ordering":            ("🛵", "#FF7043"),
    "gift":                     ("🎁", "#EC407A"),
    "go out":                   ("🍻", "#FFA726"),
    "groceries":                ("🛒", "#66BB6A"),
    "health/fitness/wellness":  ("💪", "#26C6DA"),
    "house rent":               ("🏠", "#5C6BC0"),
    "investment":               ("📈", "#42A5F5"),
    "learning":                 ("📚", "#8D6E63"),
    "one-off":                  ("🔖", "#78909C"),
    "public transport":         ("🚌", "#29B6F6"),
    "recurring":                ("🔁", "#26A69A"),
    "smokes":                   ("🚬", "#BDBDBD"),
    "travel":                   ("✈️",  "#FFA000"),
}


def load_env():
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
    sa_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH")
    user_id = os.environ.get("USER_ID")
    if not sa_path or not user_id:
        print("ERROR: FIREBASE_SERVICE_ACCOUNT_PATH and USER_ID must be set in scripts/.env")
        sys.exit(1)
    return sa_path, user_id


def parse_amount(raw: str) -> float:
    """Strip ₹, commas, whitespace → float."""
    return float(raw.replace("₹", "").replace(",", "").strip())


def parse_date(raw: str) -> date:
    """DD/MM/YYYY → date object."""
    return datetime.strptime(raw.strip(), "%d/%m/%Y").date()


def load_csv():
    rows = []
    errors = []
    with open(CSV_PATH, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, start=2):  # line 1 = header
            try:
                d = parse_date(row["Date"])
                amount = parse_amount(row["Amount"])
                rows.append({
                    "date": d,
                    "amount": amount,
                    "description": row["Description"].strip(),
                    "category": row["Category"].strip(),
                })
            except Exception as e:
                errors.append(f"  Line {i}: {e} — {row}")
    return rows, errors


def partition_rows(rows):
    included = [r for r in rows if r["date"] < CUTOFF_DATE]
    excluded = [r for r in rows if r["date"] >= CUTOFF_DATE]
    return included, excluded


def print_summary(included, excluded, errors):
    print("\n=== DRY RUN SUMMARY ===")
    print(f"  Total CSV rows parsed : {len(included) + len(excluded)}")
    print(f"  Rows to import        : {len(included)}")
    print(f"  Rows skipped (>=Mar 2026): {len(excluded)}")
    if errors:
        print(f"  Parse errors          : {len(errors)}")
        for e in errors:
            print(e)

    if not included:
        return

    dates = [r["date"] for r in included]
    print(f"  Date range            : {min(dates)} → {max(dates)}")
    total = sum(r["amount"] for r in included)
    print(f"  Total amount          : ₹{total:,.2f}")

    cat_counts = defaultdict(lambda: {"count": 0, "total": 0.0})
    for r in included:
        cat_counts[r["category"]]["count"] += 1
        cat_counts[r["category"]]["total"] += r["amount"]

    print(f"\n  {'Category':<35} {'Count':>6}  {'Total':>12}")
    print(f"  {'-'*35} {'-'*6}  {'-'*12}")
    for cat in sorted(cat_counts):
        c = cat_counts[cat]
        print(f"  {cat:<35} {c['count']:>6}  ₹{c['total']:>11,.2f}")
    print()


def ensure_categories(db, user_id, included, commit):
    """
    For each unique category in the import set:
      - Look for existing doc in cushion_categories (case-insensitive name match)
      - If missing, create it (only when commit=True)
    Returns a mapping: category_name (original case) → categoryId
    """
    col = db.collection("cushion_categories")
    existing_docs = col.where("userId", "==", user_id).stream()
    existing = {}  # lower_name → (doc_id, doc_data)
    for doc in existing_docs:
        d = doc.to_dict()
        existing[d.get("name", "").lower()] = (doc.id, d)

    unique_cats = sorted({r["category"] for r in included})
    cat_map = {}  # original name → doc_id

    print(f"\n  {'Category':<35} {'Status':<12}  {'ID'}")
    print(f"  {'-'*35} {'-'*12}  {'-'*20}")

    for cat in unique_cats:
        lower = cat.lower()
        if lower in existing:
            doc_id, _ = existing[lower]
            cat_map[cat] = doc_id
            print(f"  {cat:<35} {'found':<12}  {doc_id}")
        else:
            emoji, color = CATEGORY_DEFAULTS.get(lower, ("📦", "#90A4AE"))
            new_doc = {
                "userId": user_id,
                "name": cat,
                "icon": emoji,
                "color": color,
                "sortOrder": 99,
                "isActive": True,
                "createdAt": firestore.SERVER_TIMESTAMP,
            }
            if commit:
                ref = col.add(new_doc)[1]
                cat_map[cat] = ref.id
                print(f"  {cat:<35} {'CREATED':<12}  {ref.id}")
            else:
                cat_map[cat] = f"<would-create:{cat}>"
                print(f"  {cat:<35} {'would create':<12}  —")

    return cat_map


def import_expenses(db, user_id, included, cat_map, commit):
    col = db.collection("cushion_expenses")
    imported = 0
    for r in included:
        doc = {
            "userId": user_id,
            "date": r["date"].isoformat(),
            "amount": r["amount"],
            "description": r["description"],
            "categoryId": cat_map[r["category"]],
            "paymentMethod": None,
            "cardId": None,
            "notes": None,
            "importedFrom": "csv_import_2025",
            "createdAt": firestore.SERVER_TIMESTAMP,
        }
        if commit:
            col.add(doc)
        imported += 1
    return imported


def main():
    commit = "--commit" in sys.argv

    print("Loading CSV...")
    rows, errors = load_csv()
    included, excluded = partition_rows(rows)

    print_summary(included, excluded, errors)

    if not commit:
        print(">>> DRY RUN — no data written. Re-run with --commit to import.")
        print()
        # Still show what categories would be created (need firebase for this)
        answer = input("Show category resolution against Firestore? (needs Firebase) [y/N]: ").strip().lower()
        if answer != "y":
            return

    # Init Firebase
    sa_path, user_id = load_env()
    cred = credentials.Certificate(sa_path)
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    print("\n=== CATEGORY RESOLUTION ===")
    cat_map = ensure_categories(db, user_id, included, commit)

    if commit:
        print(f"\n=== IMPORTING {len(included)} EXPENSES ===")
        imported = import_expenses(db, user_id, included, cat_map, commit)
        print(f"  Done. {imported} expense docs written to cushion_expenses.")
    else:
        print("\n>>> DRY RUN — Re-run with --commit to import.")


if __name__ == "__main__":
    main()
