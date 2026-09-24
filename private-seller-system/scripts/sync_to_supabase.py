"""Sync local SQLite leads.db into the Harbison Supabase private_seller_leads table.

Usage:
    python scripts/sync_to_supabase.py            # sync all leads
    python scripts/sync_to_supabase.py --dry-run  # show what would sync

Requires environment variables (or a .env file next to this repo's config):
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

The service role key is never printed or committed. Only the dashboard API
(token-authenticated) can read the table back.
"""
import argparse
import json
import os
import sqlite3
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

try:
    from dotenv import load_dotenv  # type: ignore
    for candidate in (ROOT / '.env', ROOT.parent / '.env'):
        if candidate.exists():
            load_dotenv(candidate)
            break
except ImportError:
    pass

SUPABASE_URL = os.environ.get('SUPABASE_URL', '').rstrip('/')
SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
DB_PATH = Path(os.environ.get('DB_PATH', ROOT / 'data' / 'leads.db'))

LEAD_FIELDS = ['id', 'address', 'city', 'price', 'price_text', 'source', 'source_type',
               'link', 'description', 'owner_name', 'owner_mailing', 'motivation',
               'deal_score', 'equity_estimate', 'status', 'created_at', 'updated_at',
               'raw_data']
BATCH = 500


def read_local_leads():
    if not DB_PATH.exists():
        raise SystemExit(f'No database at {DB_PATH} — run the scrapers first.')
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(f"SELECT {', '.join(LEAD_FIELDS)} FROM leads").fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def upsert_batch(session, url, key, rows):
    import requests
    response = session.post(
        f'{url}/rest/v1/rpc/upsert_private_seller_leads',
        headers={'apikey': key, 'Authorization': f'Bearer {key}',
                 'Content-Type': 'application/json', 'Prefer': 'return=minimal'},
        json={'payload': json.dumps(rows)}, timeout=60)
    response.raise_for_status()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    if not SUPABASE_URL or not SERVICE_ROLE_KEY:
        raise SystemExit('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.')

    leads = read_local_leads()
    print(f'Local leads: {len(leads)}')
    if args.dry_run:
        by_source = {}
        for lead in leads:
            by_source[lead['source']] = by_source.get(lead['source'], 0) + 1
        for source, count in sorted(by_source.items(), key=lambda kv: -kv[1]):
            print(f'  {source}: {count}')
        print('Dry run — nothing synced.')
        return

    import requests
    session = requests.Session()
    synced = 0
    started = time.time()
    for i in range(0, len(leads), BATCH):
        batch = leads[i:i + BATCH]
        try:
            upsert_batch(session, SUPABASE_URL, SERVICE_ROLE_KEY, batch)
            synced += len(batch)
            print(f'  synced {synced}/{len(leads)}')
        except Exception as exc:
            print(f'BATCH FAILED at {i}: {type(exc).__name__}: {exc}', file=sys.stderr)
            raise
    print(f'Done: {synced} leads synced in {time.time() - started:.1f}s')


if __name__ == '__main__':
    main()
