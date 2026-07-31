import { arabicError } from "@/lib/errors";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef, useId, type FormEvent, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedPhotoUrl, MAX_ODOMETER_PHOTO_BYTES, uploadOdometerPhoto } from "@/lib/storage";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Clock, Gauge, Loader2, Building2, User, Wrench, MapPin, Car, Hash, Trash2, Timer, Mail, Pencil } from "lucide-react";
import { formatDuration, tripDurationMs } from "@/lib/duration";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useIsViewer } from "@/hooks/use-is-viewer";
import { useAuth } from "@/hooks/use-auth";
import { PhotoInput, SapCombobox } from "./trips.new";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { useServerFn } from "@tanstack/react-start";
import { listUsersWithRoles } from "@/lib/users.functions";
import { toEnglishDigits } from "@/lib/utils";

export const Route = createFileRoute("/trips/$id")({
  head: () => ({ meta: [{ title: "تفاصيل الرحلة" }] }),
  component: () => <AppShell><TripDetail /></AppShell>,
});

function TripDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin } = useIsAdmin();
  const { isViewer } = useIsViewer();
  const { user } = useAuth();

  const { data: trip, isLoading } = useQuery({
    queryKey: ["trip", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("trips").select(`
        *,
        office:offices!trips_office_id_fkey(name),
        manager:managers(name),
        technician:technicians(name, sap_number),
        driver:drivers(name, sap_number),
        service_type:service_types(name)
      `).eq("id", id).single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: segments } = useQuery({
    queryKey: ["trip-segments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_segments" as any)
        .select("*")
        .eq("trip_id", id)
        .order("sequence", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });


  const [startPhotoUrl, setStartPhotoUrl] = useState("");
  const [endPhotoUrl, setEndPhotoUrl] = useState("");
  useEffect(() => {
    if (trip?.start_photo_url) getSignedPhotoUrl(trip.start_photo_url).then(setStartPhotoUrl).catch(() => {});
    if (trip?.end_photo_url) getSignedPhotoUrl(trip.end_photo_url).then(setEndPhotoUrl).catch(() => {});
  }, [trip?.start_photo_url, trip?.end_photo_url]);

  const [endKm, setEndKm] = useState("");
  const [endNotes, setEndNotes] = useState("");
  const [endPhoto, setEndPhoto] = useState<File | null>(null);
  const [endPreview, setEndPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (trip?.status !== "open") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [trip?.status]);

  if (isLoading) return <div className="text-center py-12"><Loader2 className="size-8 mx-auto animate-spin text-primary" /></div>;
  if (!trip) return <div className="text-center py-12 text-muted-foreground">الرحلة غير موجودة</div>;

  const canClose = trip.status === "open" && (isAdmin || trip.created_by === user?.id);
  const canDelete = isAdmin || (trip.status === "open" && trip.created_by === user?.id);
  const canEdit = isAdmin || (trip.status === "open" && trip.created_by === user?.id);
  const canChangePhoto = isAdmin || (trip.status === "open" && trip.created_by === user?.id);


  const lastOdometer = trip?.start_odometer ?? 0;

  async function closeTrip(e: FormEvent) {
    e.preventDefault();
    if (!endPhoto) return toast.error("يجب تصوير العداد عند نهاية الرحلة");
    const endVal = parseInt(endKm, 10);
    if (isNaN(endVal)) return toast.error("أدخل قراءة العداد");
    if (endVal <= lastOdometer) return toast.error("قراءة نهاية العداد يجب أن تكون أكبر من قراءة البداية");
    if (endVal - lastOdometer > 1000) return toast.error("لا يمكن أن تتجاوز مسافة الرحلة 1000 كم");
    setSaving(true);
    try {
      const path = await uploadOdometerPhoto(endPhoto, "end");
      const { error } = await supabase.from("trips").update({
        end_odometer: endVal,
        end_photo_url: path,
        end_at: new Date().toISOString(),
        status: "closed",
        notes: endNotes || null,
      }).eq("id", id);
      if (error) throw error;
      toast.success("تم إنهاء الرحلة");
      qc.invalidateQueries({ queryKey: ["trip", id] });
      qc.invalidateQueries({ queryKey: ["trips"] });
      navigate({ to: "/" });
    } catch (err: any) {
      toast.error(arabicError(err, "فشل"));
    } finally {
      setSaving(false);
    }
  }


  async function deleteTrip() {
    if (!confirm("هل أنت متأكد من حذف هذه الرحلة؟ لا يمكن التراجع.")) return;
    const { data, error } = await supabase.from("trips").delete().eq("id", id).select("id");
    if (error) return toast.error(arabicError(error));
    if (!data || data.length === 0) return toast.error("لا تملك صلاحية حذف هذه الرحلة");
    toast.success("تم حذف الرحلة");
    qc.invalidateQueries({ queryKey: ["trips"] });
    navigate({ to: "/" });
  }

  function handleEnd(f: File | null) {
    setEndPhoto(f);
    if (f) setEndPreview(URL.createObjectURL(f));
  }

  const distance = trip.end_odometer != null ? trip.end_odometer - trip.start_odometer : null;

  return (
    <div className="space-y-4">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4" /> العودة للرحلات
      </Link>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">تفاصيل الرحلة</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="font-mono text-base">#{trip.trip_no}</Badge>
            <Badge variant="outline">{trip.car_type === "rental" ? "سيارة إيجار" : "سيارة شركة"}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {trip.status === "open" ? (
            <Badge className="bg-warning text-warning-foreground"><Clock className="size-3 ml-1" /> مفتوحة</Badge>
          ) : (
            <Badge className="bg-success text-success-foreground"><CheckCircle2 className="size-3 ml-1" /> مكتملة</Badge>
          )}
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4 ml-1" /> تعديل
            </Button>
          )}
          {canDelete && (
            <Button size="sm" variant="outline" onClick={deleteTrip}>
              <Trash2 className="size-4 ml-1 text-destructive" /> حذف
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">معلومات الرحلة</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {trip.car_type === "rental" && <Info icon={Building2} label="المكتب" value={trip.office?.name} />}
          <Info icon={Wrench} label="نوع الخدمة" value={trip.service_type?.name} />
          {!(trip.car_type === "rental" && trip.service_type?.name === "نقل عاملين") && <Info icon={User} label="المدير المسؤول" value={trip.manager?.name} />}
          <Info icon={User} label="متلقي الخدمة أو فنى" value={trip.technician ? `${trip.technician.name} — ${trip.technician.sap_number}` : null} />
          <Info icon={User} label="السائق" value={trip.driver ? `${trip.driver.name} — ${trip.driver.sap_number}` : (trip.driver_name_rental ?? null)} />
          <Info icon={Car} label="كود السيارة" value={trip.car_code} />
          <Info icon={Hash} label="رقم لوحة السيارة" value={trip.car_plate} />
          <Info icon={Car} label="وصف السيارة" value={trip.car_description} />
          {trip.car_type === "rental" && <Info icon={Hash} label="كود الهاند هيلد" value={trip.handheld_code} />}
          <Info icon={MapPin} label="بداية خط السير" value={trip.route_start} full />
          <Info icon={User} label="منشئ الطلب" value={trip.created_by_name ?? trip.created_by_email} />
          <Info icon={Timer} label={trip.status === "open" ? "المدة حتى الآن" : "إجمالى مدة الرحلة"} value={formatDuration(tripDurationMs(trip, now))} full />
          {distance != null && (
            <Info icon={Gauge} label="فرق الكيلومتر" value={`${distance} كم`} full />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Gauge className="size-4" /> بداية الرحلة</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">قراءة العداد</span>
            <span className="font-bold text-lg">{trip.start_odometer} كم</span>
          </div>
          <div className="text-xs text-muted-foreground">{new Date(trip.start_at).toLocaleString("ar-EG")}</div>
          {trip.start_photo_url && <OdometerImage path={trip.start_photo_url} signedUrl={startPhotoUrl} onRefresh={setStartPhotoUrl} alt="عداد البداية" />}
          <PhotoAdminControls
            canChange={canChangePhoto}
            signedUrl={startPhotoUrl}
            tripId={id}
            field="start_photo_url"
            prefix="start"
            onLocalPreview={setStartPhotoUrl}
            onChanged={() => {
              qc.invalidateQueries({ queryKey: ["trip", id], refetchType: "all" });
              qc.invalidateQueries({ queryKey: ["trips"], refetchType: "all" });
            }}
          />
        </CardContent>
      </Card>

      {trip.status === "closed" && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Gauge className="size-4 text-success" /> نهاية الرحلة</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">قراءة العداد</span>
              <span className="font-bold text-lg">{trip.end_odometer} كم</span>
            </div>
            {distance != null && (
              <div className="flex justify-between text-sm bg-success/10 rounded-md p-2">
                <span className="text-success-foreground/80">المسافة المقطوعة</span>
                <span className="font-bold text-success">{distance} كم</span>
              </div>
            )}
            <div className="text-xs text-muted-foreground">{trip.end_at && new Date(trip.end_at).toLocaleString("ar-EG")}</div>
            {trip.notes && <p className="text-sm bg-muted p-2 rounded-md">{trip.notes}</p>}
            {trip.end_photo_url && <OdometerImage path={trip.end_photo_url} signedUrl={endPhotoUrl} onRefresh={setEndPhotoUrl} alt="عداد النهاية" />}
            <PhotoAdminControls
              canChange={isAdmin}
              signedUrl={endPhotoUrl}
              tripId={id}
              field="end_photo_url"
              prefix="end"
              onLocalPreview={setEndPhotoUrl}
              onChanged={() => {
                qc.invalidateQueries({ queryKey: ["trip", id], refetchType: "all" });
                qc.invalidateQueries({ queryKey: ["trips"], refetchType: "all" });
              }}
            />
          </CardContent>
        </Card>
      )}

      <SegmentsCard
        tripId={id}
        canManage={canEdit}
        startOdometer={trip.start_odometer}
        segments={segments ?? []}
        onChanged={() => {
          qc.invalidateQueries({ queryKey: ["trip-segments", id] });
        }}
      />

      {canClose && (
        <Card className="border-primary/50">
          <CardHeader><CardTitle className="text-base">إنهاء الرحلة</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={closeTrip} className="space-y-3">
              <div className="space-y-1.5">
                <Label>قراءة العداد عند النهاية (كم)</Label>
                <Input type="number" min={lastOdometer} required value={endKm} onChange={(e) => setEndKm(toEnglishDigits(e.target.value))} dir="ltr" />
                <p className="text-xs text-muted-foreground">آخر قراءة مسجلة: {lastOdometer} كم</p>
              </div>
              <div className="space-y-1.5">
                <Label>ملاحظات (اختياري)</Label>
                <Textarea value={endNotes} onChange={(e) => setEndNotes(e.target.value)} rows={2} />
              </div>
              <PhotoInput preview={endPreview} onFile={handleEnd} label="صورة عداد النهاية" />
              <Button type="submit" className="w-full h-12" disabled={saving}>
                {saving && <Loader2 className="ml-2 size-4 animate-spin" />} إنهاء الرحلة
              </Button>
            </form>
          </CardContent>
        </Card>
      )}


      {canEdit && editOpen && (
        <EditTripDialog
          trip={trip}
          isAdmin={isAdmin}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["trip", id], refetchType: "all" });
            qc.invalidateQueries({ queryKey: ["trips"], refetchType: "all" });
          }}
        />
      )}
    </div>
  );
}

function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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

function EditTripDialog({ trip, isAdmin, open, onClose, onSaved }: { trip: any; isAdmin: boolean; open: boolean; onClose: () => void; onSaved: () => void }) {
  const qc = useQueryClient();
  const offices = useLookup("offices");
  const managers = useLookup("managers");
  const technicians = useLookup("technicians");
  const drivers = useLookup("drivers");
  const services = useLookup("service_types");
  const cars = useQuery({
    queryKey: ["cars"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cars").select("*").order("code");
      if (error) throw error;
      return data as any[];
    },
  });
  const { data: segments } = useQuery({
    queryKey: ["trip-segments", trip.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_segments" as any)
        .select("*")
        .eq("trip_id", trip.id)
        .order("sequence", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: open,
  });

  const listUsers = useServerFn(listUsersWithRoles);
  const usersQuery = useQuery({
    queryKey: ["admin-users-list"],
    queryFn: () => listUsers(),
    enabled: open && isAdmin,
  });

  const [form, setForm] = useState({
    car_type: trip.car_type ?? "company",
    office_id: trip.office_id ?? "",
    manager_id: trip.manager_id ?? "",
    technician_id: trip.technician_id ?? "",
    driver_id: trip.driver_id ?? "",
    driver_name_rental: trip.driver_name_rental ?? "",
    service_type_id: trip.service_type_id ?? "",
    car_code: trip.car_code ?? "",
    car_plate: trip.car_plate ?? "",
    car_description: trip.car_description ?? "",
    handheld_code: trip.handheld_code ?? "",
    route_start: trip.route_start ?? "",
    start_odometer: String(trip.start_odometer ?? ""),
    end_odometer: trip.end_odometer != null ? String(trip.end_odometer) : "",
    start_at: toLocalInput(trip.start_at),
    end_at: toLocalInput(trip.end_at),
    notes: trip.notes ?? "",
    created_by: trip.created_by ?? "",
  });
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function onCarCodeChange(code: string) {
    const match = cars.data?.find((c) => c.code === code);
    setForm((p) => ({ ...p, car_code: code, car_plate: match?.plate ?? p.car_plate, car_description: match?.description ?? p.car_description }));
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const startVal = parseInt(form.start_odometer, 10);
    if (!Number.isFinite(startVal)) return toast.error("قراءة العداد غير صحيحة");
    const endVal = form.end_odometer ? parseInt(form.end_odometer, 10) : null;
    if (endVal != null && endVal <= startVal) return toast.error("قراءة نهاية العداد يجب أن تكون أكبر من قراءة البداية");
    if (endVal != null && endVal - startVal > 1000) return toast.error("لا يمكن أن تتجاوز مسافة الرحلة 1000 كم");
    if (form.car_type === "rental" && !form.office_id) return toast.error("المكتب مطلوب لسيارات الإيجار");
    if (form.route_start.trim().length > 40) return toast.error("يجب ألا يزيد وصف خط السير عن 40 حرف");

    setSaving(true);
    try {
      const payload: any = {
        car_type: form.car_type,
        office_id: form.car_type === "rental" ? form.office_id || null : null,
        manager_id: form.manager_id || null,
        technician_id: services.data?.find((s) => s.id === form.service_type_id)?.name === "نقل عاملين" ? null : (form.technician_id || null),
        driver_id: form.car_type === "rental" ? null : (form.driver_id || null),
        driver_name_rental: form.car_type === "rental" ? (form.driver_name_rental.trim() || null) : null,
        service_type_id: form.service_type_id || null,
        car_code: form.car_code || null,
        car_plate: form.car_plate || null,
        car_description: form.car_description.trim() || null,
        handheld_code: form.car_type === "rental" ? (form.handheld_code || null) : null,
        route_start: form.route_start,
        start_odometer: startVal,
        notes: form.notes || null,
      };
      if (trip.status === "closed") payload.end_odometer = endVal;
      if (isAdmin) {
        if (form.start_at) payload.start_at = new Date(form.start_at).toISOString();
        if (trip.status === "closed") payload.end_at = form.end_at ? new Date(form.end_at).toISOString() : null;
        if (form.created_by && form.created_by !== trip.created_by) {
          const u = usersQuery.data?.find((x: any) => x.id === form.created_by);
          if (u) {
            payload.created_by = u.id;
            payload.created_by_name = u.display_name ?? u.username ?? null;
            payload.created_by_email = u.email ?? null;
          }
        }
      }
      const { error } = await supabase.from("trips").update(payload).eq("id", trip.id);
      if (error) throw error;
      toast.success("تم حفظ التعديلات");
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(arabicError(err, "فشل الحفظ"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تعديل الرحلة #{trip.trip_no}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-1.5">
            <Label>نوع السيارة</Label>
            <RadioGroup value={form.car_type} onValueChange={(v) => set("car_type", v)} className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="company" id="edit-company" /> سيارة شركة
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="rental" id="edit-rental" /> سيارة إيجار
              </label>
            </RadioGroup>
          </div>

          {form.car_type === "rental" && (
            <Field label="المكتب">
              <Select value={form.office_id} onValueChange={(v) => set("office_id", v)}>
                <SelectTrigger><SelectValue placeholder="اختر المكتب" /></SelectTrigger>
                <SelectContent>
                  {offices.data?.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!(form.car_type === "rental" && services.data?.find((s) => s.id === form.service_type_id)?.name === "نقل عاملين") && (
              <Field label="المدير المسؤول">
                <Select value={form.manager_id} onValueChange={(v) => set("manager_id", v)}>
                  <SelectTrigger><SelectValue placeholder="اختر المدير" /></SelectTrigger>
                  <SelectContent>
                    {managers.data?.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            )}

            <Field label="نوع الخدمة">
              <Select value={form.service_type_id} onValueChange={(v) => set("service_type_id", v)}>
                <SelectTrigger><SelectValue placeholder="اختر الخدمة" /></SelectTrigger>
                <SelectContent>
                  {services.data?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>

            {services.data?.find((s) => s.id === form.service_type_id)?.name !== "نقل عاملين" && (
              <Field label="متلقي الخدمة أو فنى (كود ساب)">
                <SapInput
                  items={technicians.data}
                  value={form.technician_id}
                  onChange={(v) => set("technician_id", v)}
                  placeholder="اكتب أو اختر رقم الساب"
                />
              </Field>
            )}

            {form.car_type === "company" ? (
              <Field label="السائق (كود ساب)">
                <SapInput
                  items={drivers.data?.filter((d: any) => d.type !== "rental")}
                  value={form.driver_id}
                  onChange={(v) => set("driver_id", v)}
                  placeholder="اكتب أو اختر رقم الساب"
                />
              </Field>
            ) : (
              <Field label="اسم السائق (إيجار)">
                <Input
                  list="rental-drivers-edit"
                  value={form.driver_name_rental}
                  onChange={(e) => set("driver_name_rental", e.target.value)}
                  placeholder="اختر من القائمة أو أدخل اسم السائق"
                />
                <datalist id="rental-drivers-edit">
                  {drivers.data?.filter((d: any) => d.type === "rental").map((d) => (
                    <option key={d.id} value={d.name} />
                  ))}
                </datalist>
              </Field>
            )}

            <Field label="كود السيارة">
              <Input
                list="car-codes-edit"
                dir="ltr"
                value={form.car_code}
                placeholder="اختر أو اكتب كود السيارة"
                onChange={(e) => onCarCodeChange(e.target.value)}
              />
              <datalist id="car-codes-edit">
                {cars.data?.map((c) => (
                  <option key={c.id} value={c.code}>{c.plate}</option>
                ))}
              </datalist>
            </Field>

            <Field label="رقم لوحة السيارة">
              <Input value={form.car_plate} onChange={(e) => set("car_plate", e.target.value)} dir="ltr" />
            </Field>

            <Field label="وصف السيارة">
              <Input value={form.car_description} onChange={(e) => set("car_description", e.target.value)} />
            </Field>

            {form.car_type === "rental" && (
              <Field label="كود الهاند هيلد">
                <div className="flex gap-2">
                  <Input dir="ltr" value={form.handheld_code} onChange={(e) => set("handheld_code", e.target.value)} placeholder="امسح أو أدخل الكود" />
                  <BarcodeScanner onScan={(text) => set("handheld_code", text.trim())} />
                </div>
              </Field>
            )}




            <Field label="قراءة عداد البداية (كم)">
              <Input type="number" value={form.start_odometer} onChange={(e) => set("start_odometer", toEnglishDigits(e.target.value))} dir="ltr" />
            </Field>

            {trip.status === "closed" && (
              <Field label="قراءة عداد النهاية (كم)">
                <Input type="number" value={form.end_odometer} onChange={(e) => set("end_odometer", toEnglishDigits(e.target.value))} dir="ltr" />
              </Field>
            )}

            {isAdmin && (
              <Field label="تاريخ ووقت بداية الرحلة">
                <Input type="datetime-local" value={form.start_at} onChange={(e) => set("start_at", e.target.value)} dir="ltr" />
              </Field>
            )}

            {isAdmin && trip.status === "closed" && (
              <Field label="تاريخ ووقت نهاية الرحلة">
                <Input type="datetime-local" value={form.end_at} onChange={(e) => set("end_at", e.target.value)} dir="ltr" />
              </Field>
            )}

            {isAdmin && (
              <Field label="صاحب الطلب (المستخدم)">
                <Select value={form.created_by} onValueChange={(v) => set("created_by", v)}>
                  <SelectTrigger><SelectValue placeholder="اختر المستخدم" /></SelectTrigger>
                  <SelectContent>
                    {usersQuery.data?.map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>
                        {(u.display_name ?? u.username ?? u.email) + (u.username ? ` (${u.username})` : "")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>

          <Field label="وصف خط السير">
            <Textarea value={form.route_start} maxLength={40} onChange={(e) => set("route_start", e.target.value.slice(0, 40))} rows={2} />
            <div className="text-xs text-muted-foreground text-left">{form.route_start.length}/40</div>
          </Field>

          <Field label="ملاحظات">
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
          </Field>

          <SegmentsCard
            tripId={trip.id}
            canManage={true}
            startOdometer={trip.start_odometer}
            segments={segments ?? []}
            onChanged={() => qc.invalidateQueries({ queryKey: ["trip-segments", trip.id] })}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="ml-2 size-4 animate-spin" />} حفظ التعديلات
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Info({ icon: Icon, label, value, full }: { icon: any; label: string; value?: string | null; full?: boolean }) {
  return (
    <div className={`${full ? "sm:col-span-2" : ""} flex items-start gap-2`}>
      <Icon className="size-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-medium break-words">{value || "—"}</div>
      </div>
    </div>
  );
}

function SapInput({ items, value, onChange, placeholder }: { items?: any[]; value: string; onChange: (v: string) => void; placeholder: string }) {
  return <SapCombobox items={items} value={value} onChange={onChange} placeholder={placeholder} />;
}

function SegmentsCard({
  tripId,
  canManage,
  startOdometer,
  segments,
  onChanged,
}: {
  tripId: string;
  canManage: boolean;
  startOdometer: number;
  segments: any[];
  onChanged: () => void;
}) {
  const [route, setRoute] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!route.trim()) return toast.error("اكتب اسم المسار");
    if (route.trim().length > 40) return toast.error("يجب ألا يزيد اسم المسار عن 40 حرف");
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const nextSeq = (segments[segments.length - 1]?.sequence ?? 0) + 1;
      const { error } = await supabase.from("trip_segments" as any).insert({
        trip_id: tripId,
        sequence: nextSeq,
        route: route.trim(),
        odometer: null,
        photo_url: null,
        created_by: user?.id ?? null,
      } as any);
      if (error) throw error;
      toast.success("تم إضافة المسار");
      setRoute("");
      onChanged();
    } catch (err: any) {
      toast.error(arabicError(err, "فشل"));
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(id: string) {
    const v = editValue.trim();
    if (!v) return toast.error("اكتب اسم المسار");
    if (v.length > 40) return toast.error("يجب ألا يزيد اسم المسار عن 40 حرف");
    setEditSaving(true);
    try {
      const { error } = await supabase
        .from("trip_segments" as any)
        .update({ route: v } as any)
        .eq("id", id);
      if (error) throw error;
      toast.success("تم تعديل المسار");
      setEditingId(null);
      onChanged();
    } catch (err: any) {
      toast.error(arabicError(err, "فشل التعديل"));
    } finally {
      setEditSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("حذف هذا المسار؟")) return;
    const { error } = await supabase.from("trip_segments" as any).delete().eq("id", id);
    if (error) return toast.error(arabicError(error));
    toast.success("تم الحذف");
    onChanged();
  }

  if (!canManage && segments.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="size-4" /> مسارات إضافية ({segments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {segments.map((s, idx) => (
          <div key={s.id} className="flex items-start justify-between gap-2 border rounded-md p-3 bg-muted/30">
            {editingId === s.id ? (
              <div className="flex-1 space-y-2">
                <Input
                  value={editValue}
                  maxLength={40}
                  autoFocus
                  onChange={(e) => setEditValue(e.target.value.slice(0, 40))}
                />
                <div className="flex gap-2">
                  <Button type="button" size="sm" disabled={editSaving} onClick={() => saveEdit(s.id)}>
                    {editSaving && <Loader2 className="ml-2 size-4 animate-spin" />} حفظ
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    إلغاء
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-2 flex-1 min-w-0 flex-wrap">
                  <Badge variant="secondary" className="shrink-0">مسار #{idx + 1}</Badge>
                  <span className="font-medium break-words whitespace-normal min-w-0 flex-1">{s.route || "—"}</span>
                </div>
                {canManage && (
                  <div className="flex shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => { setEditingId(s.id); setEditValue(s.route ?? ""); }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => remove(s.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}

        {canManage && (
          <form onSubmit={add} className="space-y-2 border-t pt-3">
            <Label>اسم المسار الجديد</Label>
            <Input value={route} maxLength={40} onChange={(e) => setRoute(e.target.value.slice(0, 40))} placeholder="مثال: من العميل إلى المخزن..." />
            <div className="text-xs text-muted-foreground text-left">{route.length}/40</div>
            <Button type="submit" variant="outline" className="w-full" disabled={saving}>
              {saving && <Loader2 className="ml-2 size-4 animate-spin" />} + إضافة مسار جديد
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function PhotoAdminControls({
  canChange, signedUrl, tripId, field, prefix, onChanged, onLocalPreview,
}: {
  canChange: boolean;
  signedUrl: string;
  tripId: string;
  field: "start_photo_url" | "end_photo_url";
  prefix: string;
  onChanged: () => void;
  onLocalPreview?: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [pickError, setPickError] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const pickerId = `${useId()}-photo`;

  async function download() {
    if (!signedUrl) return;
    try {
      const res = await fetch(signedUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${prefix}-${tripId}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(arabicError(err, "تعذر التنزيل"));
    }
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setPickError("");
    if (file.size > MAX_ODOMETER_PHOTO_BYTES) {
      setPickError("حجم الصورة كبير جداً، اختر صورة أقل من 15 ميجابايت");
      return;
    }
    if (file.type && !file.type.startsWith("image/")) {
      setPickError("الملف المختار ليس صورة");
      return;
    }
    setBusy(true);
    // معاينة فورية من الملف المحلي حتى لا ينتظر المستخدم رفع الشبكة
    try {
      const localUrl = URL.createObjectURL(file);
      onLocalPreview?.(localUrl);
    } catch {}
    try {
      const path = await uploadOdometerPhoto(file, prefix);
      const { error } = await supabase.from("trips").update({ [field]: path } as any).eq("id", tripId);
      if (error) throw error;
      toast.success("تم تحديث الصورة");
      onChanged();
    } catch (err: any) {
      toast.error(arabicError(err, "فشل تحديث الصورة"));
    } finally {
      setBusy(false);
    }
  }

  if (!signedUrl && !canChange) return null;

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {signedUrl && (
        <Button type="button" size="sm" variant="outline" onClick={download}>
          <ArrowRight className="size-4 ml-1 rotate-90" /> تنزيل الصورة
        </Button>
      )}
      {canChange && (
        <label
          htmlFor={pickerId}
          className={`inline-flex h-8 items-center gap-1 rounded-md border px-3 text-sm cursor-pointer hover:bg-accent/40 ${busy ? "pointer-events-none opacity-60" : ""}`}
        >
          <Pencil className="size-4" />
          {busy ? "جاري الرفع..." : (signedUrl ? "تغيير الصورة" : "رفع صورة")}
        </label>
      )}
      {canChange && (
        <input
          id={pickerId}
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={busy}
          onClick={(e) => { (e.currentTarget as HTMLInputElement).value = ""; }}
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      )}
      {pickError && <div className="basis-full text-xs text-destructive bg-destructive/10 rounded-md px-2 py-1">{pickError}</div>}
    </div>
  );
}

function OdometerImage({ path, signedUrl, onRefresh, alt }: {
  path: string;
  signedUrl: string;
  onRefresh: (url: string) => void;
  alt: string;
}) {
  const [failed, setFailed] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [retrying, setRetrying] = useState(false);
  async function refresh() {
    if (retrying) return;
    setRetrying(true);
    try {
      const fresh = await getSignedPhotoUrl(path);
      onRefresh(`${fresh}${fresh.includes("?") ? "&" : "?"}t=${Date.now()}`);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setRetrying(false);
    }
  }
  function handleError() {
    if (attempts < 2) {
      setAttempts((n) => n + 1);
      refresh();
    } else {
      setFailed(true);
    }
  }
  if (!signedUrl) {
    return (
      <div className="w-full h-40 flex items-center justify-center rounded-lg border bg-muted text-xs text-muted-foreground">
        جاري تحميل الصورة...
      </div>
    );
  }
  if (failed) {
    return (
      <div className="w-full flex flex-col items-center justify-center gap-2 rounded-lg border bg-muted p-4">
        <span className="text-xs text-muted-foreground">تعذر عرض الصورة</span>
        <Button type="button" size="sm" variant="outline" onClick={() => { setAttempts(0); refresh(); }} disabled={retrying}>
          {retrying ? "جاري المحاولة..." : "إعادة المحاولة"}
        </Button>
      </div>
    );
  }
  return (
    <img
      src={signedUrl}
      alt={alt}
      loading="lazy"
      onError={handleError}
      className="w-full max-h-72 object-contain rounded-lg border bg-muted"
    />
  );
}
