-- ========================================
-- SafeP2P India — Supabase Database Schema
-- Run this in Supabase Dashboard > SQL Editor
-- ========================================

-- 1. Profiles table (for Telegram bot users)
create table public.profiles (
  id uuid default gen_random_uuid() primary key,
  telegram_id text unique not null,
  username text,
  name text not null,
  avatar text,
  phone text,
  kyc_verified boolean default false,
  kyc_pan text,
  kyc_aadhaar text,
  upi_id text,
  bank_name text,
  bank_account text,
  bank_ifsc text,
  rating numeric(3,2) default 0,
  total_trades integer default 0,
  total_volume numeric(15,2) default 0,
  is_online boolean default false,
  last_seen timestamptz default now(),
  created_at timestamptz default now()
);

-- 2. Offers table
create table public.offers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text check (type in ('buy', 'sell')) not null,
  crypto text not null,
  amount numeric(20,8) not null,
  rate numeric(15,2) not null,
  currency text default 'INR',
  min_limit numeric(15,2) not null,
  max_limit numeric(15,2) not null,
  payment_methods text[] not null,
  completion_time integer default 15,
  terms text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Trades table
create table public.trades (
  id uuid default gen_random_uuid() primary key,
  offer_id uuid references public.offers(id) not null,
  buyer_id uuid references public.profiles(id) not null,
  seller_id uuid references public.profiles(id) not null,
  crypto text not null,
  crypto_amount numeric(20,8) not null,
  inr_amount numeric(15,2) not null,
  rate numeric(15,2) not null,
  payment_method text not null,
  status text check (status in ('escrow', 'paid', 'released', 'completed', 'disputed', 'cancelled')) default 'escrow',
  cancelled_by uuid references public.profiles(id),
  cancel_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. Reviews table
create table public.reviews (
  id uuid default gen_random_uuid() primary key,
  trade_id uuid references public.trades(id) on delete cascade not null,
  reviewer_id uuid references public.profiles(id) not null,
  reviewed_id uuid references public.profiles(id) not null,
  rating integer check (rating >= 1 and rating <= 5) not null,
  comment text,
  created_at timestamptz default now(),
  unique(trade_id, reviewer_id)
);

-- ========================================
-- Disable RLS for bot (service role)
-- The bot uses the anon key but we allow all for simplicity
-- In production, use service_role key
-- ========================================

alter table public.profiles enable row level security;
alter table public.offers enable row level security;
alter table public.trades enable row level security;
alter table public.reviews enable row level security;

-- Allow everything for anon (bot uses this)
create policy "Allow all on profiles" on public.profiles for all using (true) with check (true);
create policy "Allow all on offers" on public.offers for all using (true) with check (true);
create policy "Allow all on trades" on public.trades for all using (true) with check (true);
create policy "Allow all on reviews" on public.reviews for all using (true) with check (true);

-- Indexes
create index idx_profiles_telegram on public.profiles(telegram_id);
create index idx_offers_active on public.offers(is_active, created_at desc);
create index idx_offers_user on public.offers(user_id);
create index idx_trades_buyer on public.trades(buyer_id);
create index idx_trades_seller on public.trades(seller_id);
create index idx_reviews_reviewed on public.reviews(reviewed_id);
