ALTER TABLE public.trips DROP CONSTRAINT trips_created_by_fkey;
ALTER TABLE public.trips ADD CONSTRAINT trips_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;