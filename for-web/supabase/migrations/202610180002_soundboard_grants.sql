-- Supabase projects may inherit broad grants through default privileges.
-- Metadata identity, hashes and file paths must remain immutable after insertion.
revoke all on public.soundboard_members, public.soundboard_invites, public.soundboard_sounds, public.soundboard_playback from anon, authenticated;
grant select on public.soundboard_members, public.soundboard_playback to authenticated;
grant select, insert on public.soundboard_sounds to authenticated;
grant update(name, tags, deleted_at) on public.soundboard_sounds to authenticated;
