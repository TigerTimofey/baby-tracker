create table if not exists public.families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Моя семья',
  invite_code text not null unique
                default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  created_at  timestamptz not null default now()
);

create table if not exists public.family_members (
  family_id    uuid not null references public.families (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null default 'parent',
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  primary key (family_id, user_id)
);

alter table public.family_members
  add column if not exists display_name text,
  add column if not exists avatar_url text;

create or replace function public.is_family_member(target_family uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
      from public.family_members m
     where m.family_id = target_family
       and m.user_id = auth.uid()
  );
$$;

create or replace function public.my_family_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select m.family_id
    from public.family_members m
   where m.user_id = auth.uid()
   order by m.created_at desc
   limit 1;
$$;

create or replace function public.create_family(family_name text default 'Моя семья')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Требуется вход в аккаунт';
  end if;

  insert into public.families (name)
       values (coalesce(nullif(trim(family_name), ''), 'Моя семья'))
    returning id into new_id;

  insert into public.family_members (family_id, user_id, role)
       values (new_id, auth.uid(), 'owner');

  return new_id;
end;
$$;

create or replace function public.join_family(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
  leaving uuid;
begin
  if auth.uid() is null then
    raise exception 'Требуется вход в аккаунт';
  end if;

  select id into target
    from public.families
   where invite_code = upper(trim(code));

  if target is null then
    raise exception 'Код приглашения не найден';
  end if;

  insert into public.family_members (family_id, user_id, role)
       values (target, auth.uid(), 'parent')
  on conflict do nothing;

  for leaving in
    select m.family_id
      from public.family_members m
     where m.user_id = auth.uid()
       and m.family_id <> target
       and not exists (
             select 1 from public.children c
              where c.family_id = m.family_id and c.deleted = false
           )
       and (
             select count(*) from public.family_members x
              where x.family_id = m.family_id
           ) = 1
  loop
    delete from public.family_members
     where family_id = leaving and user_id = auth.uid();
    delete from public.families where id = leaving;
  end loop;

  return target;
end;
$$;

create or replace function public.touch_synced_at()
returns trigger
language plpgsql
as $$
begin
  new.synced_at = now();
  return new;
end;
$$;

create table if not exists public.children (
  id               uuid primary key,
  family_id        uuid not null references public.families (id) on delete cascade,
  name             text not null,
  birth_date       date not null,
  birth_time       text,
  sex              text check (sex in ('male', 'female')),
  birth_weight_g   integer,
  birth_height_mm  integer,
  updated_at       timestamptz not null default now(),
  deleted          boolean not null default false,
  synced_at        timestamptz not null default now()
);

create table if not exists public.sleep_sessions (
  id         uuid primary key,
  child_id   uuid not null references public.children (id) on delete cascade,
  start_at   timestamptz not null,
  end_at     timestamptz,
  kind       text not null default 'nap' check (kind in ('night', 'nap')),
  ended_by   uuid,
  night_feedings      integer,
  night_feeding_kind  text,
  night_feeding_ml    integer,
  no_feed_before      boolean,
  note       text,
  updated_at timestamptz not null default now(),
  deleted    boolean not null default false,
  synced_at  timestamptz not null default now()
);

create table if not exists public.measurements (
  id          uuid primary key,
  child_id    uuid not null references public.children (id) on delete cascade,
  measured_at timestamptz not null,
  weight_g    integer,
  height_mm   integer,
  head_mm     integer,
  note        text,
  updated_at  timestamptz not null default now(),
  deleted     boolean not null default false,
  synced_at   timestamptz not null default now()
);

create table if not exists public.milestones (
  id          uuid primary key,
  child_id    uuid not null references public.children (id) on delete cascade,
  happened_on date not null,
  kind        text not null default 'custom',
  title       text not null,
  note        text,
  updated_at  timestamptz not null default now(),
  deleted     boolean not null default false,
  synced_at   timestamptz not null default now()
);

create table if not exists public.feedings (
  id         uuid primary key,
  child_id   uuid not null references public.children (id) on delete cascade,
  start_at   timestamptz not null,
  end_at     timestamptz,
  kind       text not null,
  ended_by   uuid,
  amount_ml  integer,
  food       text,
  note       text,
  updated_at timestamptz not null default now(),
  deleted    boolean not null default false,
  synced_at  timestamptz not null default now()
);

create table if not exists public.diapers (
  id           uuid primary key,
  child_id     uuid not null references public.children (id) on delete cascade,
  happened_at  timestamptz not null,
  kind         text not null check (kind in ('wet', 'dirty', 'mixed')),
  note         text,
  updated_at   timestamptz not null default now(),
  deleted      boolean not null default false,
  synced_at    timestamptz not null default now()
);

create table if not exists public.temperatures (
  id          uuid primary key,
  child_id    uuid not null references public.children (id) on delete cascade,
  measured_at timestamptz not null,
  celsius     numeric(4,1) not null,
  method      text not null check (method in ('forehead', 'armpit', 'rectal')),
  note        text,
  updated_at  timestamptz not null default now(),
  deleted     boolean not null default false,
  synced_at   timestamptz not null default now()
);

create table if not exists public.medicines (
  id         uuid primary key,
  child_id   uuid not null references public.children (id) on delete cascade,
  given_at   timestamptz not null,
  name       text not null,
  amount     numeric(8,2),
  unit       text not null check (unit in ('mg', 'ml')),
  note       text,
  updated_at timestamptz not null default now(),
  deleted    boolean not null default false,
  synced_at  timestamptz not null default now()
);

create or replace function public.can_access_child(target_child uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
      from public.children c
      join public.family_members m on m.family_id = c.family_id
     where c.id = target_child
       and m.user_id = auth.uid()
  );
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'children', 'sleep_sessions', 'measurements',
    'milestones', 'feedings', 'diapers', 'temperatures', 'medicines'
  ]
  loop
    execute format(
      'alter table public.%I add column if not exists created_by uuid', t
    );
  end loop;
end;
$$;

alter table public.sleep_sessions
  add column if not exists no_feed_before boolean,
  add column if not exists night_feedings integer,
  add column if not exists night_feeding_kind text,
  add column if not exists night_feeding_ml integer,
  add column if not exists ended_by uuid;

alter table public.feedings
  add column if not exists ended_by uuid;

-- 'breast' без стороны появился, когда различать левую и правую стало
-- необязательным. Пересоздаём проверку, а не создаём — иначе на базе,
-- залитой раньше, старое ограничение отвергнет новые записи.
alter table public.feedings drop constraint if exists feedings_kind_check;
alter table public.feedings
  add constraint feedings_kind_check
  check (kind in ('breast', 'breast_left', 'breast_right', 'bottle', 'solid'));

do $$
declare
  t text;
begin
  foreach t in array array[
    'children', 'sleep_sessions', 'measurements',
    'milestones', 'feedings', 'diapers', 'temperatures', 'medicines'
  ]
  loop

    execute format(
      'create index if not exists %I on public.%I (synced_at)',
      t || '_synced_at_idx', t
    );

    if t <> 'children' then
      execute format(
        'create index if not exists %I on public.%I (child_id)',
        t || '_child_idx', t
      );
    end if;

    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format(
      'create trigger %I before insert or update on public.%I
         for each row execute function public.touch_synced_at()',
      t || '_touch', t
    );

    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

create table if not exists public.push_subscriptions (
  endpoint     text primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  family_id    uuid references public.families (id) on delete cascade,
  p256dh       text not null,
  auth         text not null,
  timezone     text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists push_subscriptions_family_idx
  on public.push_subscriptions (family_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions
  for all using (user_id = auth.uid())
          with check (user_id = auth.uid());

create table if not exists public.push_log (
  child_id uuid not null references public.children (id) on delete cascade,
  kind     text not null,
  key      text not null,
  sent_at  timestamptz not null default now(),
  primary key (child_id, kind, key)
);

alter table public.push_log enable row level security;

alter table public.children
  add column if not exists photo text,
  add column if not exists bedtime text,
  add column if not exists bedtime_warn_minutes integer,
  add column if not exists notify_bedtime boolean not null default true,
  add column if not exists notify_wake_window boolean not null default true;

create index if not exists children_family_idx on public.children (family_id);
create index if not exists sleep_sessions_start_idx on public.sleep_sessions (child_id, start_at desc);

alter table public.families enable row level security;
alter table public.family_members enable row level security;

drop policy if exists families_read on public.families;
create policy families_read on public.families
  for select using (public.is_family_member(id));

drop policy if exists families_update on public.families;
create policy families_update on public.families
  for update using (public.is_family_member(id))
              with check (public.is_family_member(id));

drop policy if exists family_members_read on public.family_members;
create policy family_members_read on public.family_members
  for select using (public.is_family_member(family_id));

drop policy if exists family_members_leave on public.family_members;
create policy family_members_leave on public.family_members
  for delete using (user_id = auth.uid());

drop policy if exists family_members_update_self on public.family_members;
create policy family_members_update_self on public.family_members
  for update using (user_id = auth.uid())
              with check (user_id = auth.uid());

drop policy if exists children_all on public.children;
create policy children_all on public.children
  for all using (public.is_family_member(family_id))
          with check (public.is_family_member(family_id));

do $$
declare
  t text;
begin
  foreach t in array array[
    'sleep_sessions', 'measurements', 'milestones', 'feedings', 'diapers',
    'temperatures', 'medicines'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_all', t);
    execute format(
      'create policy %I on public.%I
         for all using (public.can_access_child(child_id))
                 with check (public.can_access_child(child_id))',
      t || '_all', t
    );
  end loop;
end;
$$;
