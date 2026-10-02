-- Stop end users from granting themselves a role.
--
-- RLS on public.profiles lets every signed-in user INSERT and UPDATE their own
-- row ("Users can insert own profile", "Users can update own profile", both
-- checking only auth.uid() = id), and the `authenticated` role holds INSERT and
-- UPDATE on every column, `type` included. Any user could therefore call the
-- Supabase REST API with the public anon key and set their own type to
-- SUPER_ADMIN, which every server-side role check (withAuth, getUserRole)
-- trusts.
--
-- This trigger closes that without changing the policies other flows rely on:
-- when the statement runs as an end-user PostgREST role (`authenticated` or
-- `anon`), it rejects
--   * an INSERT whose type is a staff role (ADMIN, SUPER_ADMIN, HELPDESK), and
--   * an UPDATE that changes type at all.
-- Prisma (postgres) and the Supabase service role are unaffected, so role
-- changes keep working through server code that has already authorized the
-- caller as staff.
--
-- SECURITY INVOKER (the default) on purpose: current_user must be the role
-- that issued the statement.

CREATE OR REPLACE FUNCTION public.guard_profile_role_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.type IN ('ADMIN', 'SUPER_ADMIN', 'HELPDESK') THEN
    RAISE EXCEPTION 'profiles.type % cannot be self-assigned', NEW.type
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.type IS DISTINCT FROM OLD.type THEN
    RAISE EXCEPTION 'profiles.type can only be changed by staff'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_role_changes ON public.profiles;

CREATE TRIGGER trg_guard_profile_role_changes
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_role_changes();
