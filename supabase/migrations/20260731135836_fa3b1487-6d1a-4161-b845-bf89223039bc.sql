CREATE OR REPLACE FUNCTION public.last_odometer_for_car(_car_code text DEFAULT NULL, _car_plate text DEFAULT NULL)
RETURNS TABLE (reading integer, at timestamp with time zone, trip_no bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(t.end_odometer, t.start_odometer) AS reading,
         COALESCE(t.end_at, t.start_at) AS at,
         t.trip_no
  FROM public.trips t
  WHERE (
      (_car_code IS NOT NULL AND _car_code <> '' AND t.car_code = _car_code)
      OR (_car_plate IS NOT NULL AND _car_plate <> '' AND t.car_plate = _car_plate)
    )
  ORDER BY COALESCE(t.end_at, t.start_at) DESC, t.trip_no DESC
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.last_odometer_for_car(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.last_odometer_for_car(text, text) TO authenticated;