-- Fresh Hugo POC database. Run this one file in Supabase SQL Editor.
-- Run in Supabase Dashboard > SQL Editor (or as first migration).
-- All application tables are private by default: no direct anon/authenticated read/write policies.
-- All access is mediated by authenticated Next.js server routes using a SERVER-ONLY service-role client.
create extension if not exists pgcrypto;

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  chain_program_id text not null unique check (chain_program_id ~ '^0x[0-9a-fA-F]{64}$'),
  name text not null check (char_length(name) between 3 and 120),
  description text not null default '',
  owner_auth_user_id uuid not null references auth.users(id),
  owner_github_id text not null,
  owner_wallet text not null check (owner_wallet ~ '^0x[0-9a-fA-F]{40}$'),
  voucher_signer text not null check (voucher_signer ~ '^0x[0-9a-fA-F]{40}$'),
  policy text not null check (policy in ('CONTINUOUS','CAMPAIGN')),
  spend_bps integer not null default 8000 check (spend_bps between 1000 and 10000),
  epoch_days integer not null default 7 check (epoch_days between 1 and 365),
  campaign_commitment_micro numeric(38,0),
  campaign_periods integer,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','PAUSED','ARCHIVED')),
  created_tx_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((policy='CONTINUOUS' and campaign_commitment_micro is null and campaign_periods is null)
      or (policy='CAMPAIGN' and campaign_commitment_micro > 0 and campaign_periods >= 1))
);

create table if not exists public.repositories (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  provider text not null check (provider in ('github','gitlab')),
  external_repo_id text not null,
  full_name text not null,
  default_branch text not null default 'main',
  is_active boolean not null default true,
  added_at timestamptz not null default now(),
  unique(provider, external_repo_id),
  unique(program_id, provider, full_name)
);

create table if not exists public.merge_events (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid not null references public.repositories(id),
  provider text not null,
  external_repo_id text not null,
  pr_number integer not null check (pr_number > 0),
  merge_sha text not null check (char_length(merge_sha) between 40 and 64),
  merged_at timestamptz not null,
  status text not null default 'VERIFIED' check (status in ('VERIFIED','QUEUED','EVALUATING','EVALUATED','FAILED','REJECTED')),
  created_at timestamptz not null default now(),
  unique(provider,external_repo_id,pr_number)
);

create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  merge_event_id uuid not null unique references public.merge_events(id),
  evidence_hash text not null check (evidence_hash ~ '^0x[0-9a-fA-F]{64}$'),
  evidence_json jsonb not null,
  model_name text not null,
  og_request_id text not null,
  evaluator_version text not null,
  evaluation_json jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.contribution_scores (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(id),
  merge_event_id uuid not null references public.merge_events(id),
  identity_provider text not null check (identity_provider in ('github','gitlab')),
  provider_user_id text not null,
  contribution_role text not null check (contribution_role in ('CONTRIBUTOR','REVIEWER_ONLY')),
  impact_score integer not null check (impact_score between 0 and 100),
  justification text not null,
  evidence_keys text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique(merge_event_id,identity_provider,provider_user_id),
  check (contribution_role <> 'REVIEWER_ONLY' or impact_score=0)
);
create index if not exists ix_scores_identity on public.contribution_scores(identity_provider,provider_user_id);

create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id),
  tx_hash text not null,
  log_index integer not null check (log_index >= 0),
  block_number numeric(38,0) not null,
  block_timestamp timestamptz not null,
  donor_wallet text not null,
  amount_micro numeric(38,0) not null check (amount_micro>0),
  indexed_at timestamptz not null default now(),
  unique(tx_hash,log_index)
);
create index if not exists ix_donations_period on public.donations(program_id,block_timestamp);

create table if not exists public.wallet_challenges (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id),
  nonce_hash text not null unique,
  requested_wallet text not null,
  message text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.wallet_links (
  auth_user_id uuid not null references auth.users(id),
  wallet_address text not null,
  verified_at timestamptz not null default now(),
  primary key(auth_user_id,wallet_address)
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  program_id uuid references public.programs(id),
  actor_user_id uuid references auth.users(id),
  action text not null,
  subject_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Deliberately no RLS policies for client reads/writes; all application operations go through server.
alter table public.programs enable row level security;
alter table public.repositories enable row level security;
alter table public.merge_events enable row level security;
alter table public.evaluations enable row level security;
alter table public.contribution_scores enable row level security;
alter table public.donations enable row level security;
alter table public.wallet_challenges enable row level security;
alter table public.wallet_links enable row level security;
alter table public.audit_events enable row level security;


-- Additive migration. Supplied migrations 001/002 remain byte-for-byte unchanged.
-- SQL return values use strings for money to avoid PostgREST/JS precision loss.
create view public.programs_safe with (security_invoker=true) as
 select id,chain_program_id,name,description,owner_auth_user_id,owner_github_id,owner_wallet,voucher_signer,policy,spend_bps,epoch_days,campaign_commitment_micro::text,campaign_periods,status,created_tx_hash,created_at,updated_at from public.programs;
create view public.donations_safe with (security_invoker=true) as
 select id,program_id,tx_hash,log_index,block_number::text,block_timestamp,donor_wallet,amount_micro::text,indexed_at from public.donations;
create table public.rate_limits (subject text,action text,window_start timestamptz,hits integer not null,primary key(subject,action));
alter table public.rate_limits enable row level security;
create function public.rate_limit(p_subject text,p_action text,p_limit integer) returns boolean language plpgsql security definer set search_path='' as $$
declare v_hits integer;
begin
 insert into public.rate_limits values(p_subject,p_action,date_trunc('minute',now()),1)
 on conflict(subject,action) do update set window_start=date_trunc('minute',now()),hits=case when rate_limits.window_start=date_trunc('minute',now()) then rate_limits.hits+1 else 1 end returning hits into v_hits;
 return v_hits<=p_limit;
end $$;

create function public.consume_wallet(p_id uuid,p_user uuid,p_wallet text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.wallet_challenges set consumed_at=now() where id=p_id and auth_user_id=p_user and requested_wallet=p_wallet and consumed_at is null and expires_at>now();
 if not found then return false; end if;
 insert into public.wallet_links(auth_user_id,wallet_address) values(p_user,p_wallet) on conflict do nothing;
 return true;
end $$;

-- Service only: no RPC is an authentication boundary for the application.
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('rate_limit','consume_wallet') loop
 execute 'revoke execute on function '||f.signature||' from public,anon,authenticated';
 execute 'grant execute on function '||f.signature||' to service_role';
 end loop;
end $$;

-- User-requested product change: one private repository project per dedicated treasury.
-- Existing reference tables retain their names; application language is Project.
alter table public.programs add column treasury_address text check(treasury_address ~ '^0x[0-9a-fA-F]{40}$');
alter table public.programs add column deployment_tx_hash text check(deployment_tx_hash ~ '^0x[0-9a-fA-F]{64}$');
create unique index unique_project_treasury on public.programs(lower(treasury_address)) where treasury_address is not null;
-- Fails explicitly if an older installation has multi-repository programs that need separation.
create unique index one_repository_per_project on public.repositories(program_id);
create or replace view public.programs_safe with(security_invoker=true) as
 select id,chain_program_id,name,description,owner_auth_user_id,owner_github_id,owner_wallet,voucher_signer,policy,spend_bps,epoch_days,campaign_commitment_micro::text,campaign_periods,status,created_tx_hash,created_at,updated_at,treasury_address,deployment_tx_hash from public.programs;
-- Project listings must no longer be published to a public discovery index.

create function public.register_project(p_id uuid,p_chain_id text,p_name text,p_description text,p_actor uuid,p_github_id text,p_wallet text,p_signer text,p_treasury text,p_deployment_tx text,p_create_tx text,p_repo_id text,p_repo_name text,p_branch text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_existing public.programs;begin
 perform pg_advisory_xact_lock(hashtextextended('github:'||p_repo_id,0));
 select p.* into v_existing from public.programs p where p.id=p_id for update;
 if found then
  if v_existing.owner_auth_user_id<>p_actor or v_existing.owner_github_id<>p_github_id or v_existing.chain_program_id<>p_chain_id or v_existing.treasury_address<>p_treasury or v_existing.created_tx_hash<>p_create_tx or not exists(select 1 from public.repositories where program_id=p_id and external_repo_id=p_repo_id and provider='github') then raise exception 'registration mismatch';end if;
  return v_existing.id;
 end if;
 if exists(select 1 from public.repositories where provider='github' and external_repo_id=p_repo_id) then raise exception 'repository already registered';end if;
 if not exists(select 1 from public.wallet_links where auth_user_id=p_actor and wallet_address=p_wallet) then raise exception 'verified admin wallet required';end if;
 if p_wallet=p_signer or p_treasury is null or p_deployment_tx is null then raise exception 'invalid project treasury';end if;
 insert into public.programs(id,chain_program_id,name,description,owner_auth_user_id,owner_github_id,owner_wallet,voucher_signer,policy,spend_bps,epoch_days,created_tx_hash,treasury_address,deployment_tx_hash)
 values(p_id,p_chain_id,p_name,p_description,p_actor,p_github_id,p_wallet,p_signer,'CONTINUOUS',8000,7,p_create_tx,p_treasury,p_deployment_tx);
 insert into public.repositories(program_id,provider,external_repo_id,full_name,default_branch) values(p_id,'github',p_repo_id,p_repo_name,p_branch);
 insert into public.audit_events(program_id,actor_user_id,action,subject_id,metadata) values(p_id,p_actor,'PROJECT_REGISTERED',p_id::text,jsonb_build_object('repositoryId',p_repo_id,'treasuryAddress',p_treasury));
 return p_id;
end $$;
revoke execute on function public.register_project(uuid,text,text,text,uuid,text,text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.register_project(uuid,text,text,text,uuid,text,text,text,text,text,text,text,text,text) to service_role;

-- Project reward cap and the shared settlement lock.
alter table public.programs add column max_reward_micro numeric(38,0) not null default 100000000 check(max_reward_micro>=0);
create or replace view public.programs_safe with(security_invoker=true) as
 select id,chain_program_id,name,description,owner_auth_user_id,owner_github_id,owner_wallet,voucher_signer,policy,spend_bps,epoch_days,campaign_commitment_micro::text,campaign_periods,status,created_tx_hash,created_at,updated_at,treasury_address,deployment_tx_hash,max_reward_micro::text from public.programs;
create table public.reward_processor(id boolean primary key default true check(id),lease_token uuid,leased_until timestamptz);
alter table public.reward_processor enable row level security;
insert into public.reward_processor(id) values(true);


-- Immediate per-merge rewards for the POC.
-- Existing v1 contracts cannot acquire immutable caps or funding history: redeploy explicitly.
alter table public.programs add column contract_version integer not null default 1;
create or replace view public.programs_safe with (security_invoker=true) as
select id,chain_program_id,name,description,owner_auth_user_id,owner_github_id,owner_wallet,voucher_signer,policy,spend_bps,epoch_days,campaign_commitment_micro::text,campaign_periods,status,created_tx_hash,created_at,updated_at,treasury_address,deployment_tx_hash,max_reward_micro::text,contract_version from public.programs;

create table public.funding_transitions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id),
  effective_at timestamptz not null,
  active boolean not null,
  block_number bigint not null,
  log_index integer not null,
  tx_hash text not null,
  unique(program_id,tx_hash,log_index)
);
create index on public.funding_transitions(program_id,effective_at,block_number,log_index);

create table public.merge_reservations (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id),
  merge_event_id uuid not null unique references public.merge_events(id),
  chain_merge_id text not null unique,
  status text not null check(status in ('INELIGIBLE','NO_FUNDS','RESERVING','RESERVED','SETTLED')),
  amount_micro numeric(38,0) not null check(amount_micro>=0),
  report_hash text not null,
  report_json jsonb not null,
  reserve_tx_hash text,
  created_at timestamptz not null default now()
);
create view public.merge_reservations_safe with(security_invoker=true) as
select id,program_id,merge_event_id,chain_merge_id,status,amount_micro::text,report_hash,report_json,reserve_tx_hash,created_at from public.merge_reservations;

create table public.contributor_wallets (
  provider text not null check(provider='github'),
  provider_user_id text not null check(provider_user_id ~ '^[1-9][0-9]{0,19}$'),
  wallet_address text not null check(wallet_address ~ '^0x[0-9a-f]{40}$'),
  thirdweb_user_id text not null,
  verified_at timestamptz not null default now(),
  primary key(provider,provider_user_id),
  unique(thirdweb_user_id)
);
create table public.merge_allocations (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.merge_reservations(id),
  provider text not null,
  provider_user_id text not null,
  claim_id text not null unique check(claim_id ~ '^0x[0-9a-f]{64}$'),
  amount_micro numeric(38,0) not null check(amount_micro>0),
  auto_pay boolean not null default false,
  recipient text check(recipient ~ '^0x[0-9a-f]{40}$'),
  status text not null default 'RESERVED' check(status in ('RESERVED','PAYING','PAID')),
  payment_tx_hash text,
  unique(reservation_id,provider,provider_user_id)
);
create view public.merge_allocations_safe with(security_invoker=true) as
select id,reservation_id,provider,provider_user_id,claim_id,amount_micro::text,auto_pay,recipient,status,payment_tx_hash from public.merge_allocations;

-- Signed transactions are PRIVATE durable outbox records, persisted before broadcasting.
create table public.arc_transactions (
  id uuid primary key default gen_random_uuid(),
  operation text not null,
  attempt integer not null,
  sender text not null,
  nonce bigint not null,
  raw_transaction text not null,
  tx_hash text not null unique,
  status text not null default 'PENDING' check(status in ('PENDING','CONFIRMED','REVERTED')),
  unique(sender,nonce),
  unique(operation,attempt)
);
create unique index one_pending_arc_operation on public.arc_transactions(operation) where status='PENDING';

create table public.claim_challenges (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  message text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz
);
create table public.claim_sessions (
  token_hash text primary key,
  provider text not null,
  provider_user_id text not null,
  wallet_address text not null,
  expires_at timestamptz not null
);

create function public.lease_arc_processor() returns uuid language plpgsql security definer set search_path='' as $$
declare token uuid;
begin
  update public.reward_processor set lease_token=gen_random_uuid(),leased_until=now()+interval '3 minutes'
  where id and (leased_until is null or leased_until<now()) returning lease_token into token;
  return token;
end $$;
create function public.release_arc_processor(p_token uuid) returns void language sql security definer set search_path='' as $$
  update public.reward_processor set lease_token=null,leased_until=null where id and lease_token=p_token;
$$;
create function public.persist_arc_transaction(p_token uuid,p_operation text,p_attempt integer,p_sender text,p_nonce bigint,p_raw text,p_hash text)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.reward_processor where id and lease_token=p_token and leased_until>now() for update;
  if not found then raise exception 'lease expired'; end if;
  insert into public.arc_transactions(operation,attempt,sender,nonce,raw_transaction,tx_hash)
  values(p_operation,p_attempt,p_sender,p_nonce,p_raw,p_hash);
end $$;

create function public.freeze_merge_reservation(p_merge uuid,p_key text,p_report_hash text,p_report jsonb,p_rows jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  m public.merge_events; project public.programs; row jsonb;
  reservation uuid; eligible boolean; total numeric=0; inflow numeric; quality integer;
  target numeric; score integer;
begin
  select * into m from public.merge_events where id=p_merge for update;
  if not exists(select 1 from public.evaluations where merge_event_id=p_merge) then raise exception 'evaluation required'; end if;
  select id into reservation from public.merge_reservations where merge_event_id=p_merge;
  if found then return reservation; end if;
  select p.* into project from public.programs p join public.repositories r on r.program_id=p.id where r.id=m.repository_id for update of p;
  if project.contract_version<>2 then raise exception 'v2 treasury required'; end if;
  select active into eligible from public.funding_transitions where program_id=project.id and effective_at<=m.merged_at order by effective_at desc,block_number desc,log_index desc limit 1;
  eligible=coalesce(eligible,false);
  select coalesce(sum(amount_micro),0) into inflow from public.donations where program_id=project.id and block_timestamp>=m.merged_at-interval '7 days' and block_timestamp<m.merged_at;
  select coalesce(max(impact_score),0) into quality from public.contribution_scores where merge_event_id=m.id and contribution_role='CONTRIBUTOR';
  target=least(floor(inflow*8000/70000),project.max_reward_micro);
  target=floor(target*quality/100);
  target=least(target,(p_report->>'availableMicro')::numeric);
  if not eligible then target=0; end if;
  if jsonb_array_length(p_rows)>30 then raise exception 'too many recipients'; end if;
  for row in select * from jsonb_array_elements(p_rows) loop
    select impact_score into score from public.contribution_scores where merge_event_id=m.id and identity_provider=row->>'provider' and provider_user_id=row->>'providerUserId' and contribution_role='CONTRIBUTOR' and impact_score>0;
    if not found or (row->>'amountMicro')!~'^[1-9][0-9]{0,37}$' then raise exception 'ineligible recipient'; end if;
    total=total+(row->>'amountMicro')::numeric;
  end loop;
  if total<>target or total>project.max_reward_micro or p_report_hash!~'^0x[0-9a-f]{64}$' or (p_report->>'inflowMicro')::numeric<>inflow then raise exception 'invalid budget'; end if;
  insert into public.merge_reservations(program_id,merge_event_id,chain_merge_id,status,amount_micro,report_hash,report_json)
  values(project.id,m.id,p_key,case when not eligible then 'INELIGIBLE' when total=0 then 'NO_FUNDS' else 'RESERVING' end,total,p_report_hash,p_report) returning id into reservation;
  insert into public.merge_allocations(reservation_id,provider,provider_user_id,claim_id,amount_micro,auto_pay)
  select reservation,x->>'provider',x->>'providerUserId',x->>'claimId',(x->>'amountMicro')::numeric,exists(select 1 from public.contributor_wallets w where w.provider=x->>'provider' and w.provider_user_id=x->>'providerUserId') from jsonb_array_elements(p_rows) x;
  return reservation;
end $$;

create function public.link_contributor_wallet(p_challenge uuid,p_wallet text,p_identity text,p_thirdweb text,p_token_hash text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  update public.claim_challenges set consumed_at=now() where id=p_challenge and wallet_address=p_wallet and consumed_at is null and expires_at>now();
  if not found then return false; end if;
  -- Explicit authentication can change the link for FUTURE allocations. Locked recipients never change.
  insert into public.contributor_wallets(provider,provider_user_id,wallet_address,thirdweb_user_id)
  values('github',p_identity,p_wallet,p_thirdweb)
  on conflict(provider,provider_user_id) do update set wallet_address=excluded.wallet_address,thirdweb_user_id=excluded.thirdweb_user_id,verified_at=now();
  insert into public.claim_sessions values(p_token_hash,'github',p_identity,p_wallet,now()+interval '30 minutes');
  return true;
end $$;
create function public.lock_allocation_recipient(p_allocation uuid,p_provider text,p_identity text,p_wallet text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.contributor_wallets where provider=p_provider and provider_user_id=p_identity and wallet_address=p_wallet for share;
  if not found then return false; end if;
  update public.merge_allocations a set recipient=coalesce(recipient,p_wallet)
  where a.id=p_allocation and provider=p_provider and provider_user_id=p_identity and (recipient is null or recipient=p_wallet)
  and exists(select 1 from public.merge_reservations r where r.id=a.reservation_id and r.status in ('RESERVED','SETTLED'));
  return found;
end $$;


do $$
declare t text; f record;
begin
  foreach t in array array['funding_transitions','merge_reservations','merge_allocations','contributor_wallets','arc_transactions','claim_challenges','claim_sessions'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('lease_arc_processor','release_arc_processor','persist_arc_transaction','freeze_merge_reservation','link_contributor_wallet','lock_allocation_recipient') loop
    execute 'revoke execute on function '||f.signature||' from public,anon,authenticated';
    execute 'grant execute on function '||f.signature||' to service_role';
  end loop;
end $$;
grant select on public.merge_reservations_safe,public.merge_allocations_safe to service_role;

create table public.attestation_publications (
  subject_id uuid not null,
  kind text not null check(kind in ('Program','Contribution')),
  revision bigint not null default 1,
  pending boolean not null default true,
  lease_token uuid,
  leased_until timestamptz,
  entity_key text,
  tx_hash text,
  primary key(subject_id,kind)
);
alter table public.attestation_publications enable row level security;
grant all on public.attestation_publications to service_role;
create function public.queue_v2_attestation() returns trigger language plpgsql security definer set search_path='' as $$
declare subject uuid; v_kind text;
begin
  if TG_TABLE_NAME='programs' then
    if NEW.contract_version<>2 then return NEW; end if;
    subject=NEW.id; v_kind='Program';
  elsif TG_TABLE_NAME='merge_allocations' then subject=NEW.reservation_id; v_kind='Contribution';
  else subject=NEW.id; v_kind='Contribution'; end if;
  insert into public.attestation_publications(subject_id,kind) values(subject,v_kind)
  on conflict(subject_id,kind) do update set revision=public.attestation_publications.revision+1,pending=true;
  return NEW;
end $$;
create trigger queue_v2_program after insert or update on public.programs for each row execute function public.queue_v2_attestation();
create trigger queue_v2_merge after insert or update on public.merge_reservations for each row execute function public.queue_v2_attestation();
create trigger queue_v2_settlement after update of payment_tx_hash on public.merge_allocations for each row execute function public.queue_v2_attestation();
create function public.lease_v2_publication() returns jsonb language plpgsql security definer set search_path='' as $$
declare row public.attestation_publications;
begin
  select * into row from public.attestation_publications where pending and (leased_until is null or leased_until<now()) order by revision,subject_id for update skip locked limit 1;
  if not found then return null; end if;
  update public.attestation_publications set lease_token=gen_random_uuid(),leased_until=now()+interval '3 minutes' where subject_id=row.subject_id and kind=row.kind returning * into row;
  return to_jsonb(row);
end $$;
revoke execute on function public.queue_v2_attestation() from public,anon,authenticated;
revoke execute on function public.lease_v2_publication() from public,anon,authenticated;
grant execute on function public.lease_v2_publication() to service_role;


create function public.save_evaluation(p_merge uuid,p_evidence jsonb,p_evaluation jsonb,p_scores jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare evaluation_id uuid; score jsonb;
begin
  perform 1 from public.merge_events where id=p_merge for update;
  if exists(select 1 from public.evaluations where merge_event_id=p_merge) then return; end if;
  insert into public.evaluations(merge_event_id,evidence_hash,evidence_json,model_name,og_request_id,evaluator_version,evaluation_json)
  values(p_merge,p_evidence->>'evidenceHash',p_evidence,p_evaluation->>'model',p_evaluation->>'inferenceRequestId','hugo-sync-v1',p_evaluation) returning id into evaluation_id;
  for score in select * from jsonb_array_elements(p_scores) loop
    insert into public.contribution_scores(evaluation_id,merge_event_id,identity_provider,provider_user_id,contribution_role,impact_score,justification,evidence_keys)
    values(evaluation_id,p_merge,score->>'provider',score->>'providerUserId',score->>'role',(score->>'impactScore')::integer,score->>'justification',array(select jsonb_array_elements_text(score->'evidenceKeys')));
  end loop;
  update public.merge_events set status='EVALUATED' where id=p_merge;
end $$;
revoke execute on function public.save_evaluation(uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_evaluation(uuid,jsonb,jsonb,jsonb) to service_role;
