ALTER TABLE public.cars ADD COLUMN odometer_broken boolean NOT NULL DEFAULT false;

ALTER TABLE public.trips
  ADD COLUMN odometer_broken boolean NOT NULL DEFAULT false,
  ADD COLUMN estimated_km integer,
  ADD COLUMN odometer_note text,
  ADD COLUMN odometer_review text NOT NULL DEFAULT 'none';

ALTER TABLE public.trips ADD CONSTRAINT trips_odometer_review_check
  CHECK (odometer_review IN ('none','pending','approved','rejected'));

ALTER TABLE public.trips ADD CONSTRAINT trips_estimated_km_check
  CHECK (estimated_km IS NULL OR (estimated_km >= 0 AND estimated_km <= 10000));