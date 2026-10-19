-- Shared soundboard. Only the publishable key ships in the application.
create extension if not exists pgcrypto with schema extensions;

create table public.soundboard_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  joined_at timestamptz not null default now()
);
create table public.soundboard_invites (
  token_hash text primary key,
  expires_at timestamptz not null default now() + interval '30 days'
);
create table public.soundboard_sounds (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id),
  name text not null check (char_length(name) between 1 and 80),
  tags text[] not null default '{}' check (cardinality(tags) <= 8 and char_length(array_to_string(tags, ',')) <= 200),
  storage_path text not null unique,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  mime text not null check (mime in ('audio/mpeg','audio/wav','audio/ogg','audio/webm','audio/mp4','audio/flac')),
  bytes integer not null check (bytes between 1 and 10485760),
  duration double precision not null check (duration > 0 and duration <= 60),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table public.soundboard_playback (
  channel_id text primary key check (channel_id ~ '^[0-9A-HJKMNP-TV-Z]{26}$'),
  version bigint not null default 0,
  enabled boolean not null default false,
  sound_id uuid references public.soundboard_sounds(id),
  started_at timestamptz,
  issued_at timestamptz not null default now(),
  actor_name text not null default '',
  event_id uuid not null default gen_random_uuid()
);
create index soundboard_sounds_owner_idx on public.soundboard_sounds(owner_id);
create index soundboard_sounds_created_idx on public.soundboard_sounds(created_at desc) where deleted_at is null;
create unique index soundboard_sounds_hash_idx on public.soundboard_sounds(sha256) where deleted_at is null;
alter table public.soundboard_members enable row level security;
alter table public.soundboard_invites enable row level security;
alter table public.soundboard_sounds enable row level security;
alter table public.soundboard_playback enable row level security;
revoke all on public.soundboard_members, public.soundboard_invites, public.soundboard_sounds, public.soundboard_playback from anon, authenticated;

create function public.soundboard_is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.soundboard_members where user_id = (select auth.uid()));
$$;
revoke all on function public.soundboard_is_member() from public;
grant execute on function public.soundboard_is_member() to authenticated;
create policy "Read own membership" on public.soundboard_members for select to authenticated using (user_id = (select auth.uid()));
create policy "Members read sounds" on public.soundboard_sounds for select to authenticated using ((select public.soundboard_is_member()));
create policy "Members upload metadata" on public.soundboard_sounds for insert to authenticated with check (
  (select public.soundboard_is_member()) and owner_id = (select auth.uid())
  and storage_path like (select auth.uid())::text || '/' || id::text || '.%'
);
create policy "Owners edit metadata" on public.soundboard_sounds for update to authenticated
using ((select public.soundboard_is_member()) and owner_id = (select auth.uid()))
with check ((select public.soundboard_is_member()) and owner_id = (select auth.uid()));
create policy "Members read playback" on public.soundboard_playback for select to authenticated using ((select public.soundboard_is_member()));
grant select on public.soundboard_members, public.soundboard_playback to authenticated;
grant select, insert on public.soundboard_sounds to authenticated;
grant update(name, tags, deleted_at) on public.soundboard_sounds to authenticated;
revoke all on public.soundboard_invites from anon, authenticated;

-- Invite tokens are random capabilities, redeemed once per installation/account.
create function public.soundboard_redeem_invite(invite text, display_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or char_length(invite) not between 32 and 128 then
    raise exception 'Convite inválido';
  end if;
  if not exists (select 1 from public.soundboard_invites where token_hash = encode(extensions.digest(invite, 'sha256'), 'hex') and expires_at > now()) then
    raise exception 'Convite inválido ou expirado';
  end if;
  insert into public.soundboard_members(user_id, display_name)
  values (auth.uid(), left(coalesce(nullif(trim(display_name), ''), 'Amigo'), 80))
  on conflict (user_id) do update set display_name = excluded.display_name;
end;
$$;
revoke all on function public.soundboard_redeem_invite(text,text) from public;
grant execute on function public.soundboard_redeem_invite(text,text) to authenticated;

-- Only project administrators can issue an invitation. Raw token is returned once.
create function public.soundboard_create_invite() returns text
language plpgsql security definer set search_path = '' as $$
declare token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  insert into public.soundboard_invites(token_hash) values (encode(extensions.digest(token, 'sha256'), 'hex'));
  return token;
end;
$$;
revoke all on function public.soundboard_create_invite() from public, anon, authenticated;
grant execute on function public.soundboard_create_invite() to service_role;

create function public.soundboard_clock() returns timestamptz
language sql volatile set search_path = '' as $$ select clock_timestamp(); $$;
revoke all on function public.soundboard_clock() from public;
grant execute on function public.soundboard_clock() to authenticated;

-- Serialize commands on the server. Stop/disable are never blocked by cooldown.
create function public.soundboard_command(target_channel text, command text, target_sound uuid default null)
returns public.soundboard_playback language plpgsql security definer set search_path = '' as $$
declare state public.soundboard_playback; actor text;
begin
  select display_name into actor from public.soundboard_members where user_id = auth.uid();
  if actor is null then raise exception 'Entre na biblioteca com um convite'; end if;
  if target_channel !~ '^[0-9A-HJKMNP-TV-Z]{26}$' or command not in ('enable','disable','play','stop') then
    raise exception 'Comando inválido';
  end if;
  insert into public.soundboard_playback(channel_id) values (target_channel) on conflict do nothing;
  select * into state from public.soundboard_playback where channel_id = target_channel for update;
  if command = 'play' then
    if not state.enabled then raise exception 'Ative a caixa de som primeiro'; end if;
    if state.sound_id is not null and state.issued_at > clock_timestamp() - interval '800 milliseconds' then
      raise exception 'Espere um instante antes do próximo efeito';
    end if;
    if not exists(select 1 from public.soundboard_sounds where id = target_sound and deleted_at is null) then
      raise exception 'Este efeito não está mais disponível';
    end if;
  end if;
  update public.soundboard_playback set
    version = state.version + 1,
    enabled = case when command = 'enable' then true when command = 'disable' then false else state.enabled end,
    sound_id = case when command = 'play' then target_sound else null end,
    started_at = case when command = 'play' then clock_timestamp() + interval '700 milliseconds' else null end,
    issued_at = clock_timestamp(), actor_name = actor, event_id = gen_random_uuid()
  where channel_id = target_channel returning * into state;
  return state;
end;
$$;
revoke all on function public.soundboard_command(text,text,uuid) from public;
grant execute on function public.soundboard_command(text,text,uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('soundboard','soundboard',false,10485760,array['audio/mpeg','audio/wav','audio/ogg','audio/webm','audio/mp4','audio/flac'])
on conflict (id) do nothing;
create policy "Members download effects" on storage.objects for select to authenticated
using (bucket_id = 'soundboard' and (select public.soundboard_is_member()));
create policy "Members upload effects" on storage.objects for insert to authenticated
with check (bucket_id = 'soundboard' and (select public.soundboard_is_member()) and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Owners remove effects" on storage.objects for delete to authenticated
using (bucket_id = 'soundboard' and (select public.soundboard_is_member()) and (storage.foldername(name))[1] = (select auth.uid())::text);

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'soundboard_sounds') then
    alter publication supabase_realtime add table public.soundboard_sounds;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'soundboard_playback') then
    alter publication supabase_realtime add table public.soundboard_playback;
  end if;
end $$;
