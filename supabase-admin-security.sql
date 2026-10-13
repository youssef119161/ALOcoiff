-- ════════════════════════════════════════════════════════════════════
-- Alocoiff — Sécurité du rôle administrateur
-- À exécuter une fois dans Supabase Dashboard → SQL Editor.
-- Administrateur unique : youssefalaya85@gmail.com
-- ════════════════════════════════════════════════════════════════════

-- 1. AUDIT : qui possède aujourd'hui role = 'admin' ? (lecture seule)
select p.id, p.email as profile_email, u.email as auth_email, p.role
from public.profiles p
left join auth.users u on u.id::text = p.id  -- profiles.id est de type text, auth.users.id de type uuid
where p.role = 'admin';

-- 2. Rétrograder tout « admin » qui n'est pas le compte officiel
--    (l'e-mail de référence est celui de auth.users, pas profiles.email)
update public.profiles p
set role = 'coiffeur'
from auth.users u
where u.id::text = p.id  -- profiles.id est de type text, auth.users.id de type uuid
  and p.role = 'admin'
  and lower(u.email) <> 'youssefalaya85@gmail.com';

-- 3. Fonction de référence « est-ce l'administrateur ? »
--    Basée sur l'e-mail signé dans le JWT Supabase (non modifiable par l'utilisateur).
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(lower(auth.jwt() ->> 'email') = 'youssefalaya85@gmail.com', false);
$$;

-- 4. Verrou sur les colonnes sensibles de profiles :
--    un utilisateur connecté (rôle Postgres « authenticated ») ne peut ni se
--    donner le rôle admin, ni s'auto-approuver, ni prolonger son abonnement.
--    L'admin, la clé service_role (route /api/signup) et le SQL Editor ne sont
--    pas concernés.
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.role := 'coiffeur';
    new.is_approved := false;
    return new;
  end if;

  if new.role is distinct from old.role
     or new.is_approved is distinct from old.is_approved
     or new.subscription_status is distinct from old.subscription_status
     or new.subscription_end is distinct from old.subscription_end then
    raise exception 'Modification non autorisée des champs role / is_approved / abonnement'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_privileged_columns on public.profiles;
create trigger protect_profile_privileged_columns
  before insert or update on public.profiles
  for each row execute function public.protect_profile_privileged_columns();

-- 5. (Recommandé) Si vos politiques RLS admin testent « role = 'admin' »,
--    remplacez cette condition par « public.is_admin() ». Pour les lister :
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename in ('profiles', 'bookings', 'payments');
