import { arabicError } from "@/lib/errors";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Camera, Loader2, MapPin, Gauge } from "lucide-react";
import { uploadOdometerPhoto } from "@/lib/storage";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { NfcScanner } from "@/components/nfc-scanner";
import { CameraCapture } from "@/components/camera-capture";

export const Route = createFileRoute("/trips/new")({
  head: () => ({ meta: [{ title: "رحلة جديدة" }] }),
  component: () => <AppShell><NewTrip /></AppShell>,
});

function useLookup(table: string) {
  return useQuery({
    queryKey: [table],
    queryFn: async () => {
      const { data, error } = await supabase.from(table as any).select("*").order("name");
      if (error) throw error;
      return data as any[];
    },
  });
}

function NewTrip() {
  const navigate = useNavigate();
  const offices = useLookup("offices");
  const managers = useLookup("managers");
  const technicians = useLookup("technicians");
  const drivers = useLookup("drivers");
  const services = useLookup("service_types");
  const cars = useQuery({
    queryKey: ["cars"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cars" as any).select("*").order("code");
      if (error) throw error;
      return data as any[];
    },
  });

  const [form, setForm] = useState({
    car_type: "company",
    office_id: "", manager_id: "", technician_id: "", driver_id: "", driver_name_rental: "", service_type_id: "",
    route_start: "", start_odometer: "", car_code: "", car_plate: "",
    handheld_code: "",
  });

  const selectedTech = technicians.data?.find((t) => t.id === form.technician_id);
  const selectedDriver = drivers.data?.find((d) => d.id === form.driver_id);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const handheldRef = useRef<HTMLInputElement | null>(null);
  const routeStartRef = useRef<HTMLTextAreaElement | null>(null);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => (e[k as string] ? { ...e, [k as string]: false } : e));
  }

  // عند اختيار سيارة إيجار + وجود كود هاند هيلد، اختر "نقل عاملين" تلقائياً فقط إذا لم يتم اختيار نوع خدمة
  useEffect(() => {
    if (form.car_type !== "rental") return;
    if (!form.handheld_code.trim()) return;
    if (form.service_type_id) return;
    const worker = services.data?.find((s) => s.name === "نقل عاملين");
    if (worker) {
      setForm((f) => ({ ...f, service_type_id: worker.id }));
    }
  }, [form.car_type, form.handheld_code, services.data, form.service_type_id]);

  function handlePhoto(file: File | null) {
    setPhoto(file);
    if (file) setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const isWorkerTransport = services.data?.find((s) => s.id === form.service_type_id)?.name === "نقل عاملين";
    const isAfterSales = services.data?.find((s) => s.id === form.service_type_id)?.name === "خدمة ما بعد البيع";
    const needsManager =
      (form.car_type !== "company" && !isWorkerTransport && !!form.service_type_id) ||
      (form.car_type === "company" && isAfterSales);
    const errs: Record<string, boolean> = {};
    if (form.car_type === "rental" && !form.office_id) errs.office_id = true;
    if (!form.service_type_id) errs.service_type_id = true;
    if (needsManager && !form.manager_id) errs.manager_id = true;
    if (!isWorkerTransport && !form.technician_id && form.technician_id !== "__none__") errs.technician_id = true;
    if (form.car_type === "rental" ? !form.driver_name_rental.trim() : !form.driver_id) {
      errs[form.car_type === "rental" ? "driver_name_rental" : "driver_id"] = true;
    }
    if (form.car_type === "company" && !form.car_code) errs.car_code = true;
    if (form.car_type === "rental" && !form.car_plate) errs.car_plate = true;
    if (!form.route_start.trim()) errs.route_start = true;
    if (form.route_start.trim().length > 40) {
      errs.route_start = true;
      return toast.error("يجب ألا تزيد بداية خط السير عن 40 حرف");
    }
    if (!form.start_odometer) errs.start_odometer = true;
    if (!photo) errs.photo = true;

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error("يوجد حقول ناقصة — تم تظليلها باللون الأحمر");
      setTimeout(() => {
        document.querySelector('[data-invalid="true"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 0);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const path = await uploadOdometerPhoto(photo!, "start");
      const { data: { user } } = await supabase.auth.getUser();
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("user_id", user!.id)
        .maybeSingle();
      const creatorName = prof?.display_name ?? prof?.username ?? user!.email ?? null;
      const { data: trip, error } = await supabase.from("trips").insert({
        created_by: user!.id,
        created_by_email: user!.email ?? null,
        created_by_name: creatorName,
        car_type: form.car_type,

        office_id: form.car_type === "rental" ? (form.office_id || null) : null,
        manager_id: form.manager_id || null,
        technician_id: form.technician_id && form.technician_id !== "__none__" ? form.technician_id : null,
        driver_id: form.car_type === "rental" ? null : (form.driver_id || null),
        driver_name_rental: form.car_type === "rental" ? (form.driver_name_rental.trim() || null) : null,
        service_type_id: form.service_type_id || null,
        route_start: form.route_start,
        start_odometer: parseInt(form.start_odometer, 10),
        start_photo_url: path,
        car_code: form.car_code || null,
        car_plate: form.car_plate || null,
        car_description: (() => {
          const car = form.car_type === "rental"
            ? cars.data?.find((c) => c.type === "rental" && (c.handheld_code === form.handheld_code || c.plate === form.car_plate))
            : cars.data?.find((c) => c.code === form.car_code);
          return car?.description ?? null;
        })(),
        handheld_code: form.car_type === "rental" ? (form.handheld_code || null) : null,
      } as any).select().single();
      if (error) throw error;
      toast.success("تم بدء الرحلة");
      navigate({ to: "/trips/$id", params: { id: trip.id } });
    } catch (err: any) {
      toast.error(arabicError(err, "فشل الحفظ"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">رحلة جديدة</h1>
        <p className="text-sm text-muted-foreground">سجّل بداية خط السير وصورة العداد</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">نوع السيارة</CardTitle></CardHeader>
        <CardContent>
          <RadioGroup value={form.car_type} onValueChange={(v) => set("car_type", v)} className="grid grid-cols-2 gap-3">
            <label className={`border-2 rounded-lg p-3 cursor-pointer flex items-center gap-2 ${form.car_type === "company" ? "border-primary bg-primary/5" : "border-border"}`}>
              <RadioGroupItem value="company" />
              <span className="font-medium">سيارة شركة</span>
            </label>
            <label className={`border-2 rounded-lg p-3 cursor-pointer flex items-center gap-2 ${form.car_type === "rental" ? "border-primary bg-primary/5" : "border-border"}`}>
              <RadioGroupItem value="rental" />
              <span className="font-medium">سيارات إيجار</span>
            </label>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">بيانات الرحلة</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {form.car_type === "rental" && (
            <Field label="المكتب (مطلوب)" invalid={errors.office_id}>
              <LookupSelect items={offices.data} value={form.office_id} onChange={(v) => set("office_id", v)} placeholder="اختر المكتب" />
            </Field>
          )}
          <Field label="نوع الخدمة" invalid={errors.service_type_id}>
            <LookupSelect items={services.data} value={form.service_type_id} onChange={(v) => set("service_type_id", v)} placeholder="اختر النوع" />
          </Field>
          {((form.car_type !== "company" && services.data?.find((s) => s.id === form.service_type_id)?.name !== "نقل عاملين") ||
            (form.car_type === "company" && services.data?.find((s) => s.id === form.service_type_id)?.name === "خدمة ما بعد البيع")) && (
            <Field label="المدير المسؤول" invalid={errors.manager_id}>
              <LookupSelect items={managers.data} value={form.manager_id} onChange={(v) => set("manager_id", v)} placeholder="اختر المدير" />
            </Field>
          )}
          {services.data?.find((s) => s.id === form.service_type_id)?.name !== "نقل عاملين" && (
            <Field label="متلقي الخدمة أو فنى (رقم الساب)" invalid={errors.technician_id}>
              <SapSelect items={technicians.data} value={form.technician_id} onChange={(v) => set("technician_id", v)} placeholder="اختر رقم الساب أو اكتب: لا يوجد" allowNone noneLabel="لا يوجد متلقى خدمة أو فنى" />

              {selectedTech && (
                <div className="mt-2 p-2 rounded-md bg-primary/10 border border-primary/30">
                  <div className="text-xs text-muted-foreground">الاسم</div>
                  <div className="text-lg font-bold text-primary">{selectedTech.name}</div>
                </div>
              )}
            </Field>
          )}
          {form.car_type === "company" ? (
            <Field label="السائق (رقم الساب)" invalid={errors.driver_id}>
              <SapSelect items={drivers.data?.filter((d) => d.type !== "rental")} value={form.driver_id} onChange={(v) => set("driver_id", v)} placeholder="اختر رقم الساب" />
              {selectedDriver && (
                <div className="mt-2 p-2 rounded-md bg-primary/10 border border-primary/30">
                  <div className="text-xs text-muted-foreground">الاسم</div>
                  <div className="text-lg font-bold text-primary">{selectedDriver.name}</div>
                </div>
              )}
            </Field>
          ) : (
            <Field label="اسم السائق (إيجار)" invalid={errors.driver_name_rental}>
              <Input
                list="rental-drivers"
                value={form.driver_name_rental}
                onChange={(e) => set("driver_name_rental", e.target.value)}
                placeholder="اختر من القائمة أو أدخل اسم السائق"
              />
              <datalist id="rental-drivers">
                {drivers.data?.filter((d) => d.type === "rental").map((d) => (
                  <option key={d.id} value={d.name} />
                ))}
              </datalist>
            </Field>
          )}
          {form.car_type === "company" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="كود السيارة" invalid={errors.car_code}>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <CarCodeCombobox
                      items={cars.data?.filter((c) => c.type !== "rental")}
                      value={form.car_code}
                      onChange={(code, car) => {
                        setForm((f) => ({ ...f, car_code: code, car_plate: car?.plate ?? "" }));
                        setErrors((e) => (e.car_code ? { ...e, car_code: false } : e));
                      }}
                      onComplete={() => {
                        setTimeout(() => {
                          routeStartRef.current?.focus();
                          routeStartRef.current?.setSelectionRange(0, 0);
                          routeStartRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                        }, 0);
                      }}
                      placeholder="اكتب أو اختر كود السيارة"
                    />
                  </div>
                  <BarcodeScanner
                    onScan={(text) => {
                      const v = text.trim();
                      const car = cars.data?.find((c) => c.code === v);
                      setForm((f) => ({ ...f, car_code: v, car_plate: car?.plate ?? "" }));
                      setErrors((e) => (e.car_code ? { ...e, car_code: false } : e));
                    }}
                  />
                </div>
              </Field>
              <Field label="رقم لوحة السيارة">
                <Input value={form.car_plate} readOnly placeholder="يظهر تلقائياً" />
              </Field>
            </div>
          ) : (
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
              <Field label="كود الهاند هيلد">
                <Input
                  ref={handheldRef}
                  dir="ltr"
                  value={form.handheld_code}
                  placeholder="كود الهاند هيلد"
                  onChange={(e) => {
                    const v = e.target.value;
                    const car = cars.data?.find((c) => c.handheld_code === v);
                    const workerService = services.data?.find((s) => s.name === "نقل عاملين");
                    setForm((f) => ({
                      ...f,
                      handheld_code: v,
                      car_plate: car?.plate ?? f.car_plate,
                      office_id: car?.follow_office_id ?? f.office_id,
                      route_start: (car?.route_description ?? f.route_start).slice(0, 40),
                      service_type_id: f.service_type_id || (workerService ? workerService.id : ""),
                    }));
                  }}
                />
              </Field>
              <div className="pb-0.5 flex gap-1">
                <BarcodeScanner
                  onScan={(text) => {
                    const v = text.trim();
                    const car =
                      cars.data?.find((c) => c.handheld_code === v) ||
                      cars.data?.find((c) => c.type === "rental" && c.plate === v);
                    const workerService = services.data?.find((s) => s.name === "نقل عاملين");
                    setForm((f) => ({
                      ...f,
                      handheld_code: car?.handheld_code ?? v,
                      car_plate: car?.plate ?? f.car_plate,
                      office_id: car?.follow_office_id ?? f.office_id,
                      route_start: (car?.route_description ?? f.route_start).slice(0, 40),
                      service_type_id: f.service_type_id || (workerService ? workerService.id : ""),
                    }));
                    toast.success(car ? `تم التعرف على السيارة: ${car.plate ?? ""}` : "تم قراءة الكود");
                    setTimeout(() => handheldRef.current?.focus(), 0);
                  }}
                />
                <NfcScanner
                  onScan={(text) => {
                    const v = text.trim();
                    const car =
                      cars.data?.find((c) => c.handheld_code === v) ||
                      cars.data?.find((c) => c.type === "rental" && c.plate === v);
                    const workerService = services.data?.find((s) => s.name === "نقل عاملين");
                    setForm((f) => ({
                      ...f,
                      handheld_code: car?.handheld_code ?? v,
                      car_plate: car?.plate ?? f.car_plate,
                      office_id: car?.follow_office_id ?? f.office_id,
                      route_start: (car?.route_description ?? f.route_start).slice(0, 40),
                      service_type_id: f.service_type_id || (workerService ? workerService.id : ""),
                    }));
                    toast.success(car ? `تم التعرف على السيارة: ${car.plate ?? ""}` : "تم قراءة البطاقة");
                    setTimeout(() => handheldRef.current?.focus(), 0);
                  }}
                />
              </div>
              <Field label="رقم لوحة السيارة (إيجار)" invalid={errors.car_plate}>
                <Input
                  list="rental-plates"
                  value={form.car_plate}
                  onChange={(e) => {
                    const v = e.target.value;
                    const car = cars.data?.find((c) => c.type === "rental" && c.plate === v);
                    const workerService = services.data?.find((s) => s.name === "نقل عاملين");
                    setForm((f) => ({
                      ...f,
                      car_code: "",
                      car_plate: v,
                      handheld_code: car?.handheld_code ?? f.handheld_code,
                      route_start: (car?.route_description ?? f.route_start).slice(0, 40),
                      service_type_id: f.service_type_id || (workerService ? workerService.id : ""),
                    }));
                  }}
                  placeholder="اختر أو أدخل اللوحة"
                />
                <datalist id="rental-plates">
                  {cars.data?.filter((c) => c.type === "rental" && c.plate).map((c) => (
                    <option key={c.id} value={c.plate} />
                  ))}
                </datalist>
              </Field>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><MapPin className="size-4" /> بداية خط السير</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="بداية خط السير" invalid={errors.route_start}>
            <Textarea ref={routeStartRef} value={form.route_start} maxLength={40} onChange={(e) => set("route_start", e.target.value.slice(0, 40))} placeholder="مثال: من مكتب المنصورة إلى العميل..." rows={2} />
            <div className="text-xs text-muted-foreground text-left">{form.route_start.length}/40</div>
          </Field>
          <Field label="قراءة العداد (كم)" invalid={errors.start_odometer}>
            <div className="relative">
              <Gauge className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input type="number" min={0} value={form.start_odometer} onChange={(e) => set("start_odometer", e.target.value)} className="pr-10" dir="ltr" />
            </div>
          </Field>
          <PhotoInput preview={photoPreview} onFile={(f) => { handlePhoto(f); if (f) setErrors((e) => (e.photo ? { ...e, photo: false } : e)); }} invalid={errors.photo} />
        </CardContent>
      </Card>

      <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
        {loading && <Loader2 className="ml-2 size-4 animate-spin" />} بدء الرحلة
      </Button>
    </form>
  );
}

function Field({ label, children, invalid }: { label: string; children: React.ReactNode; invalid?: boolean }) {
  return (
    <div className="space-y-1.5" data-invalid={invalid ? "true" : undefined}>
      <Label className={invalid ? "text-destructive" : undefined}>{label}</Label>
      <div className={invalid ? "rounded-md ring-2 ring-destructive ring-offset-1 ring-offset-background" : undefined}>
        {children}
      </div>
    </div>
  );
}

function LookupSelect({ items, value, onChange, placeholder }: { items?: any[]; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {items?.map((i) => (
          <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SapSelect({ items, value, onChange, placeholder, allowNone, noneLabel }: { items?: any[]; value: string; onChange: (v: string) => void; placeholder: string; allowNone?: boolean; noneLabel?: string }) {
  return <SapCombobox items={items} value={value} onChange={onChange} placeholder={placeholder} allowNone={allowNone} noneLabel={noneLabel} />;
}

export function CarCodeCombobox({ items, value, onChange, onComplete, placeholder }: { items?: any[]; value: string; onChange: (code: string, car?: any) => void; onComplete?: () => void; placeholder: string }) {
  const [text, setText] = useState<string>(value ?? "");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setText(value ?? ""); }, [value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const q = text.trim().toLowerCase();
  const filtered = (items ?? []).filter((c) => {
    if (!q) return true;
    return (c.code ?? "").toLowerCase().includes(q) || (c.plate ?? "").toLowerCase().includes(q);
  }).slice(0, 50);

  return (
    <div ref={wrapRef} className="relative">
      <Input
        dir="ltr"
        inputMode="numeric"
        maxLength={4}
        value={text}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 4);
          setText(v);
          setOpen(true);
          const match = items?.find((c) => c.code === v);
          onChange(v, match);
          if (v.length === 4) {
            setOpen(false);
            onComplete?.();
          }
        }}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-md border bg-popover shadow-lg">
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              className="w-full text-right px-3 py-2 text-sm hover:bg-accent flex justify-between gap-2"
              onClick={() => {
                setText(c.code ?? "");
                onChange(c.code ?? "", c);
                setOpen(false);
                onComplete?.();
              }}
            >
              <span className="text-muted-foreground text-xs">{c.plate}</span>
              <span dir="ltr" className="font-mono">{c.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SapCombobox({ items, value, onChange, placeholder, allowNone, noneLabel }: { items?: any[]; value: string; onChange: (v: string) => void; placeholder: string; allowNone?: boolean; noneLabel?: string }) {
  const NONE = "__none__";
  const noneText = noneLabel ?? "لا يوجد";
  const selected = items?.find((i) => i.id === value);
  const initialText = value === NONE ? noneText : (selected?.sap_number ?? "");
  const [text, setText] = useState<string>(initialText);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value === NONE) { if (text !== noneText) setText(noneText); return; }
    if (selected && selected.sap_number !== text) setText(selected.sap_number ?? "");
    if (!value && text === noneText) setText("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const q = text.trim().toLowerCase();
  const filtered = (items ?? []).filter((i) => {
    if (!q) return true;
    return (i.sap_number ?? "").toLowerCase().includes(q) || (i.name ?? "").toLowerCase().includes(q);
  }).slice(0, 50);
  const showNone = allowNone && (q === "" || "لا يوجد".includes(q) || q.includes("لا"));

  return (
    <div ref={wrapRef} className="relative">
      <Input
        dir="ltr"
        value={text}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          setOpen(true);
          if (allowNone && v.trim() === noneText) { onChange(NONE); return; }
          const match = items?.find((i) => i.sap_number === v);
          onChange(match ? match.id : "");
        }}
      />
      {open && (filtered.length > 0 || showNone) && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-md border bg-popover shadow-lg">
          {showNone && (
            <button
              type="button"
              className="w-full text-right px-3 py-2 text-sm hover:bg-accent border-b bg-muted/40"
              onClick={() => { setText(noneText); onChange(NONE); setOpen(false); }}
            >
              {noneText}
            </button>
          )}
          {filtered.map((i) => (
            <button
              key={i.id}
              type="button"
              className="w-full text-right px-3 py-2 text-sm hover:bg-accent flex justify-between gap-2"
              onClick={() => {
                setText(i.sap_number ?? "");
                onChange(i.id);
                setOpen(false);
              }}
            >
              <span className="text-muted-foreground text-xs">{i.name}</span>
              <span dir="ltr" className="font-mono">{i.sap_number}</span>
            </button>
          ))}
        </div>
      )}
      {selected && <div className="mt-1 text-xs text-muted-foreground">{selected.name}</div>}
      {value === NONE && <div className="mt-1 text-xs text-muted-foreground">{noneText}</div>}
    </div>
  );
}

export function PhotoInput({ preview, onFile, label = "صورة العداد", invalid }: { preview: string; onFile: (f: File | null) => void; label?: string; invalid?: boolean }) {
  return (
    <div className="space-y-1.5" data-invalid={invalid ? "true" : undefined}>
      <Label className={invalid ? "text-destructive" : undefined}>{label}</Label>
      {preview && <img src={preview} alt="معاينة" className="w-full max-h-60 object-contain rounded-lg border bg-muted" />}
      <div className={`grid grid-cols-2 gap-2 ${invalid ? "rounded-md ring-2 ring-destructive ring-offset-1 ring-offset-background p-1" : ""}`}>
        <CameraCapture onCapture={(f) => onFile(f)} />
        <label className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center gap-1 cursor-pointer hover:bg-accent/30 text-sm">
          <span className="text-xl">🖼️</span>
          <span>من المعرض</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        </label>
      </div>
    </div>
  );
}
