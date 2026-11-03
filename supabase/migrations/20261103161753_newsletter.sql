-- citext makes Foo@x.com and foo@x.com the same address, so the unique
-- constraints below cannot be dodged by retyping an email in another case.
create extension if not exists citext with schema extensions;

-- Only people who consented to the newsletter: the form itself, or the
-- unchecked-by-default box on the preview and out-of-stock forms. Someone who
-- only asked for a restock email never lands here — mailing them campaigns
-- would be unsolicited.
create table public.newsletter_subscribers (
  -- Doubles as the unsubscribe-link token: an email in that URL would expose
  -- the address and let anyone unsubscribe someone else by typing it.
  id               uuid primary key default gen_random_uuid(),
  email            extensions.citext not null unique,
  -- Consent evidence, not analytics: proves where the subscriber opted in if
  -- they ever claim they never did (Ley 25.326 puts that burden on the store).
  source           text not null
                   check (source in ('newsletter', 'product_launch', 'restock')),
  created_at       timestamptz not null default now(),
  unsubscribed_at  timestamptz
);

-- Requests are consumed, not deleted: `notified_at` marks the one email sent,
-- so a later restock never re-sends it, while the row still records that it
-- went out. Senders must claim rows with
-- `update ... set notified_at = now() where notified_at is null returning ...`
-- before sending, so a duplicated webhook finds nothing left to claim.
create table public.product_launch_requests (
  id           uuid primary key default gen_random_uuid(),
  email        extensions.citext not null,
  product_id   bigint not null,
  created_at   timestamptz not null default now(),
  notified_at  timestamptz
);
-- Unique only while pending: a shopper already notified can sign up again.
create unique index product_launch_pending_unique
  on public.product_launch_requests (email, product_id) where notified_at is null;
create index product_launch_pending_by_product
  on public.product_launch_requests (product_id) where notified_at is null;

create table public.restock_requests (
  id           uuid primary key default gen_random_uuid(),
  email        extensions.citext not null,
  -- Tiendanube's product/updated webhook names the product, not the variant,
  -- so pending requests are looked up by product and then matched by variant.
  product_id   bigint not null,
  variant_id   bigint not null,
  created_at   timestamptz not null default now(),
  notified_at  timestamptz
);
create unique index restock_pending_unique
  on public.restock_requests (email, variant_id) where notified_at is null;
create index restock_pending_by_product
  on public.restock_requests (product_id) where notified_at is null;

-- RLS on with no policies: the Data API refuses every publishable-key request,
-- so only the server, holding the secret key, can read or write these emails.
alter table public.newsletter_subscribers  enable row level security;
alter table public.product_launch_requests enable row level security;
alter table public.restock_requests        enable row level security;
