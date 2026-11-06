-- Anti-theft: bind plugin tokens to a single device (Studio install).
-- The plugin sends an X-Vex-Device header; the first device that uses a token
-- becomes its owner. Requests from any other device are rejected (401).
--
-- Apply with:
--   supabase db push
-- or run this file in the Supabase SQL editor.

alter table plugin_tokens
  add column if not exists device_id text;

alter table plugin_sessions
  add column if not exists device_id text;

create index if not exists plugin_tokens_device_id_idx
  on plugin_tokens (device_id);

create index if not exists plugin_sessions_device_id_idx
  on plugin_sessions (device_id);
