-- ========================================
-- SafeP2P India — Real Escrow Migration
-- Run this in Supabase Dashboard > SQL Editor
-- ========================================

-- 1. Add TRON wallet to user profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tron_wallet text;

-- 2. Add escrow columns to trades
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS fee_amount numeric(15,2) DEFAULT 0;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS escrow_usdt_amount numeric(20,6);
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS buyer_wallet text;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS deposit_tx_id text;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS release_tx_id text;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS crypto_deposited boolean DEFAULT false;

-- 3. Update trade status constraint to include new statuses
ALTER TABLE public.trades DROP CONSTRAINT IF EXISTS trades_status_check;
ALTER TABLE public.trades ADD CONSTRAINT trades_status_check
  CHECK (status IN ('awaiting_deposit', 'crypto_locked', 'paid', 'completed', 'disputed', 'cancelled', 'refunded',
                    'escrow', 'released'));
-- kept old statuses (escrow, released) for backward compatibility

-- 4. Index for finding pending deposits quickly
CREATE INDEX IF NOT EXISTS idx_trades_awaiting_deposit
  ON public.trades(status) WHERE status = 'awaiting_deposit';
