/*
# Dedication Optimiser — scheduling rework (4/6): wishlist funded by real savings

## Purpose
Rework the existing wishlist_items table to the spec's shape (target_cost,
status instead of a plain purchased boolean) and introduce a "savings"
category convention on finance_entries so wishlist items can show real
funding progress — no new table for savings; a finance_entries row with
category='savings' IS a savings transfer.

## Savings convention (decision, not a guess — asked and confirmed)
- type='out', category='savings'  -> money moved from spendable into savings
- type='in',  category='savings'  -> money moved from savings back to spendable (a withdrawal)
- savings balance = sum(out where category='savings') - sum(in where category='savings')
- "spendable net" needs no new logic — the existing total net (in - out
  across everything) already correctly reflects it, since a savings
  transfer is a real out-flow (and a withdrawal a real in-flow) from the
  spendable pool.

## Altered table

### wishlist_items
- price -> renamed to target_cost (matches the spec's field name)
- + status (text, check: active|purchased, default 'active') replacing the
  purchased boolean — purchased boolean column dropped once status is
  backfilled from it
- title, url, priority, notes, purchased_at, created_at unchanged

## Security
- No RLS changes — same owner-scoped policies as before.
*/

ALTER TABLE wishlist_items RENAME COLUMN price TO target_cost;

ALTER TABLE wishlist_items ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
UPDATE wishlist_items SET status = 'purchased' WHERE purchased = true AND status = 'active';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wishlist_items_status_check') THEN
    ALTER TABLE wishlist_items ADD CONSTRAINT wishlist_items_status_check
      CHECK (status IN ('active','purchased'));
  END IF;
END $$;

ALTER TABLE wishlist_items DROP COLUMN IF EXISTS purchased;
