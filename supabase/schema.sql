-- =====================================================================
-- Estudo ADS — login do admin e histórico sincronizado entre máquinas
-- Rode este arquivo inteiro no Supabase: SQL Editor → New query → Run.
-- Pode rodar de novo sem problema (é idempotente).
--
-- Regras garantidas AQUI, no banco (não dá para burlar pelo navegador):
--   * cada conta tem no máximo 5 dispositivos cadastrados;
--   * só um dispositivo cadastrado lê ou grava o histórico;
--   * cada conta só enxerga os próprios dados.
-- As tabelas não ficam expostas pela API: o site só conversa com as funções.
-- =====================================================================

create table if not exists public.dispositivos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  device_id  text not null,
  nome       text not null default 'Dispositivo',
  criado_em  timestamptz not null default now(),
  visto_em   timestamptz not null default now(),
  unique (user_id, device_id)
);

create table if not exists public.progresso (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  dados          jsonb not null default '{}'::jsonb,
  atualizado_em  timestamptz not null default now()
);

-- RLS ligado e nenhuma policy: acesso direto pela API é sempre negado
alter table public.dispositivos enable row level security;
alter table public.progresso enable row level security;
revoke all on public.dispositivos, public.progresso from anon, authenticated;

create or replace function public.limite_dispositivos()
returns int language sql immutable as $$ select 5 $$;

-- Cadastra (ou só atualiza) este navegador. Devolve 'ok', 'novo' ou 'limite'.
create or replace function public.registrar_dispositivo(p_device text, p_nome text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  uid   uuid := auth.uid();
  nome_ok text := coalesce(nullif(left(trim(p_nome), 80), ''), 'Dispositivo');
  total int;
begin
  if uid is null then raise exception 'não autenticado'; end if;
  if p_device is null or length(p_device) < 16 or length(p_device) > 100 then
    raise exception 'identificador de dispositivo inválido';
  end if;

  update dispositivos set visto_em = now(), nome = nome_ok
   where user_id = uid and device_id = p_device;
  if found then return 'ok'; end if;

  -- trava por usuário: duas máquinas novas ao mesmo tempo não passam do limite
  perform pg_advisory_xact_lock(hashtext(uid::text));
  select count(*) into total from dispositivos where user_id = uid;
  if total >= limite_dispositivos() then return 'limite'; end if;

  insert into dispositivos (user_id, device_id, nome) values (uid, p_device, nome_ok);
  return 'novo';
end $$;

create or replace function public.listar_dispositivos()
returns table (id uuid, device_id text, nome text, criado_em timestamptz, visto_em timestamptz)
language sql stable security definer set search_path = public
as $$
  select d.id, d.device_id, d.nome, d.criado_em, d.visto_em
    from dispositivos d
   where d.user_id = auth.uid()
   order by d.visto_em desc
$$;

create or replace function public.remover_dispositivo(p_id uuid)
returns void
language sql security definer set search_path = public
as $$
  delete from dispositivos where id = p_id and user_id = auth.uid()
$$;

create or replace function public.dispositivo_autorizado(p_device text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from dispositivos where user_id = auth.uid() and device_id = p_device)
$$;

create or replace function public.carregar_progresso(p_device text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  if not dispositivo_autorizado(p_device) then raise exception 'dispositivo não autorizado'; end if;
  return coalesce((select dados from progresso where user_id = auth.uid()), '{}'::jsonb);
end $$;

create or replace function public.salvar_progresso(p_device text, p_dados jsonb)
returns timestamptz
language plpgsql security definer set search_path = public
as $$
declare agora timestamptz := now();
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  if not dispositivo_autorizado(p_device) then raise exception 'dispositivo não autorizado'; end if;
  if jsonb_typeof(p_dados) <> 'object' then raise exception 'formato inválido'; end if;
  if pg_column_size(p_dados) > 2000000 then raise exception 'histórico grande demais'; end if;

  insert into progresso (user_id, dados, atualizado_em) values (auth.uid(), p_dados, agora)
  on conflict (user_id) do update set dados = excluded.dados, atualizado_em = agora;
  update dispositivos set visto_em = agora where user_id = auth.uid() and device_id = p_device;
  return agora;
end $$;

-- funções só para quem está logado
revoke all on function public.registrar_dispositivo(text, text) from public, anon;
revoke all on function public.listar_dispositivos() from public, anon;
revoke all on function public.remover_dispositivo(uuid) from public, anon;
revoke all on function public.dispositivo_autorizado(text) from public, anon;
revoke all on function public.carregar_progresso(text) from public, anon;
revoke all on function public.salvar_progresso(text, jsonb) from public, anon;
grant execute on function public.registrar_dispositivo(text, text) to authenticated;
grant execute on function public.listar_dispositivos() to authenticated;
grant execute on function public.remover_dispositivo(uuid) to authenticated;
grant execute on function public.dispositivo_autorizado(text) to authenticated;
grant execute on function public.carregar_progresso(text) to authenticated;
grant execute on function public.salvar_progresso(text, jsonb) to authenticated;
