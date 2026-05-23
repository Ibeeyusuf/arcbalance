import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)


// create table rebalances (
//   id uuid default gen_random_uuid() primary key,
//   created_at timestamp with time zone default now(),
//   regime text not null,
//   regime_confidence float not null,
//   portfolio_usd float not null,
//   trades_executed int not null,
//   tx_hashes text[] default '{}',
//   btc_price float not null,
//   block_number text,
//   allocations jsonb
// );
//
// create table positions (
//   id uuid default gen_random_uuid() primary key,
//   symbol text not null unique,
//   cost_basis float not null,
//   quantity float not null,
//   purchase_date text not null,
//   updated_at timestamp with time zone default now()
// );
//
// alter table rebalances enable row level security;
// alter table positions enable row level security;
// create policy "Allow all" on rebalances for all using (true);
// create policy "Allow all" on positions for all using (true);