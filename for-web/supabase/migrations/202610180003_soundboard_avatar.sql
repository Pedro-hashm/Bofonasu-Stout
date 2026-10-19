-- OGG is commonly labelled application/ogg by Firefox; keep compatibility with
-- clients already installed, in addition to the canonical MIME sent by new ones.
begin;
update storage.buckets set allowed_mime_types = array[
  'audio/mpeg','audio/wav','audio/x-wav','audio/ogg','application/ogg',
  'audio/webm','audio/mp4','audio/x-m4a','audio/flac','audio/x-flac'
] where id = 'soundboard';

create table public.soundboard_profile (
  id integer primary key default 1 check (id = 1),
  avatar_path text,
  revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.soundboard_profile enable row level security;
revoke all on public.soundboard_profile from anon, authenticated;
grant select on public.soundboard_profile to authenticated;
create policy "Members read shared avatar" on public.soundboard_profile for select to authenticated
using ((select public.soundboard_is_member()));
insert into public.soundboard_profile(id) values (1);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('soundboard-avatars','soundboard-avatars',false,5242880,array['image/png','image/jpeg','image/webp','image/gif'])
on conflict(id) do nothing;
create policy "Members read shared images" on storage.objects for select to authenticated
using (bucket_id = 'soundboard-avatars' and (select public.soundboard_is_member()));
create policy "Members upload shared images" on storage.objects for insert to authenticated
with check (bucket_id = 'soundboard-avatars' and (select public.soundboard_is_member()) and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Owners remove shared images" on storage.objects for delete to authenticated
using (bucket_id = 'soundboard-avatars' and (select public.soundboard_is_member()) and (storage.foldername(name))[1] = (select auth.uid())::text);

create function public.soundboard_set_avatar(image_path text default null)
returns public.soundboard_profile language plpgsql security definer set search_path = '' as $$
declare profile public.soundboard_profile;
begin
  if not public.soundboard_is_member() then raise exception 'Entre na biblioteca com um convite'; end if;
  if image_path is not null then
    if image_path !~ ('^' || auth.uid()::text || '/[a-f0-9-]{36}\.(png|jpg|webp|gif)$')
      or not exists(select 1 from storage.objects where bucket_id = 'soundboard-avatars' and name = image_path) then
      raise exception 'Envie uma imagem válida antes de salvar';
    end if;
  end if;
  update public.soundboard_profile set avatar_path = image_path, revision = revision + 1,
    updated_at = clock_timestamp(), updated_by = auth.uid()
  where id = 1 returning * into profile;
  return profile;
end;
$$;
revoke all on function public.soundboard_set_avatar(text) from public, anon;
grant execute on function public.soundboard_set_avatar(text) to authenticated;
alter publication supabase_realtime add table public.soundboard_profile;
commit;
