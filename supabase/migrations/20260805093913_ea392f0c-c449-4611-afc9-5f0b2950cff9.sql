CREATE TABLE public.governorates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.governorates TO authenticated;
GRANT ALL ON public.governorates TO service_role;
ALTER TABLE public.governorates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read governorates" ON public.governorates FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write governorates" ON public.governorates FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

ALTER TABLE public.trips
  ADD COLUMN governorate_id uuid REFERENCES public.governorates(id),
  ADD COLUMN governorate_name text;

INSERT INTO public.governorates (name) VALUES
 ('القاهرة'),('الجيزة'),('الإسكندرية'),('القليوبية'),('الشرقية'),('الدقهلية'),('الغربية'),('المنوفية'),('البحيرة'),('كفر الشيخ'),('دمياط'),('بورسعيد'),('الإسماعيلية'),('السويس'),('شمال سيناء'),('جنوب سيناء'),('الفيوم'),('بني سويف'),('المنيا'),('أسيوط'),('سوهاج'),('قنا'),('الأقصر'),('أسوان'),('البحر الأحمر'),('الوادي الجديد'),('مطروح')
ON CONFLICT (name) DO NOTHING;