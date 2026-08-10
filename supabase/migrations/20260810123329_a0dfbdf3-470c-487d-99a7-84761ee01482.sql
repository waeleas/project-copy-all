ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS driver_name text,
  ADD COLUMN IF NOT EXISTS driver_sap text;

CREATE OR REPLACE FUNCTION public.snapshot_trip_driver()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.driver_id IS NOT NULL THEN
    SELECT d.name, d.sap_number INTO NEW.driver_name, NEW.driver_sap
    FROM public.drivers d WHERE d.id = NEW.driver_id;
  ELSIF NEW.driver_name_rental IS NOT NULL AND NEW.driver_name_rental <> '' THEN
    NEW.driver_name := NEW.driver_name_rental;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.snapshot_trip_driver() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trips_snapshot_driver ON public.trips;
CREATE TRIGGER trips_snapshot_driver
BEFORE INSERT OR UPDATE OF driver_id, driver_name_rental ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.snapshot_trip_driver();

UPDATE public.trips t
SET driver_name = d.name, driver_sap = d.sap_number
FROM public.drivers d
WHERE t.driver_id = d.id AND (t.driver_name IS NULL OR t.driver_name = '');

UPDATE public.trips
SET driver_name = driver_name_rental
WHERE driver_id IS NULL AND (driver_name IS NULL OR driver_name = '')
  AND driver_name_rental IS NOT NULL AND driver_name_rental <> '';