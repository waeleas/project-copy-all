import { getLastClosedTripPhoto } from "@/lib/last-photo.functions";
import { canReuseStartPhoto } from "@/lib/automatic-start-photo";
import { arabicError } from "@/lib/errors";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect, type FormEvent } from "react";
import { openPhotoPicker } from "@/lib/photo-picker";
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
import { Loader2, MapPin, Gauge, Car as CarIcon, ClipboardList as ClipboardListIcon, User as UserIcon, Image as ImageIcon } from "lucide-react";
import { makeThumbnail, uploadOdometerPhoto } from "@/lib/storage";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { NfcScanner } from "@/components/nfc-scanner";
import { CameraCapture } from "@/components/camera-capture";
import { usePermissions } from "@/hooks/use-permissions";
import { toEnglishDigits, toOdometerInput } from "@/lib/utils";

export const Route = createFileRoute("/trips/new")({
  head: () => ({ meta: [
    { title: "طلب رحلة جديد | Service Tracker Pro" },
    { name: "description", content: "تسجيل طلب رحلة جديد وإرفاق صورة العداد في Service Tracker Pro." },
    { property: "og:title", content: "طلب رحلة جديد | Service Tracker Pro" },
    { property: "og:description", content: "تسجيل طلب رحلة جديد وإرفاق صورة العداد في Service Tracker Pro." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
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
  const { canCreateTrips, canSeeRentals, loading: permLoading } = usePermissions();

  const [openTrip, setOpenTrip] = useState<{ id: string; trip_no: number | string } | null>(null);
  const [checkingOpenTrip, setCheckingOpenTrip] = useState(true);

  useEffect(() => {
    if (permLoading) return;
    if (!canCreateTrips) {
      toast.error("تم تعطيل تسجيل الرحلات لحسابك");
      navigate({ to: "/" });
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) {
        if (!cancelled) setCheckingOpenTrip(false);
        return;
      }
      const { data: openTrips } = await supabase
        .from("trips")
        .select("id, trip_no")
        .eq("created_by", uid)
        .eq("status", "open")
        .order("trip_no", { ascending: false })
        .limit(1);
      if (cancelled) return;
      if (openTrips && openTrips.length > 0) {
        setOpenTrip(openTrips[0] as any);
      }
      setCheckingOpenTrip(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [permLoading, canCreateTrips, navigate]);

  useEffect(() => {
    if (!permLoading && !canSeeRentals) {
      setForm((f) => (f.car_type === "rental" ? { ...f, car_type: "company" } : f));
    }
  }, [permLoading, canSeeRentals]);





  const offices = useLookup("offices");
  const managers = useLookup("managers");
  const technicians = useLookup("technicians");
  const drivers = useLookup("drivers");
  const services = useLookup("service_types");
  const governorates = useLookup("governorates");
  const cars = useQuery({
    queryKey: ["cars", canSeeRentals],
    queryFn: async () => {
      const { data, error } = await supabase.from("cars" as any).select("*").order("code");
      if (error) throw error;
      const rows = (data as any[]) ?? [];
      return canSeeRentals ? rows : rows.filter((c) => c.type !== "rental");
    },
  });


  const [form, setForm] = useState({
    car_type: "company",
    office_id: "", manager_id: "", technician_id: "", driver_id: "", driver_name_rental: "", service_type_id: "", governorate_id: "",
    route_start: "", start_odometer: "", car_code: "", car_plate: "",
    handheld_code: "",
  });

  const selectedTech = technicians.data?.find((t) => t.id === form.technician_id);
  const selectedDriver = drivers.data?.find((d) => d.id === form.driver_id);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [submitStep, setSubmitStep] = useState("");
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const handheldRef = useRef<HTMLInputElement | null>(null);
  const routeStartRef = useRef<HTMLTextAreaElement | null>(null);

  // آخر قراءة عداد لهذه السيارة من جميع الطلبات
  const lastReading = useQuery({
    queryKey: ["last-odometer", form.car_code, form.car_plate],
    enabled: !!(form.car_code || form.car_plate),
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("last_odometer_for_car", {
        _car_code: form.car_code || null,
        _car_plate: form.car_plate || null,
      });
      if (error) throw error;
      return ((data as any[]) ?? [])[0] ?? null;
    },
  });

  // آخر رحلة مغلقة لهذه السيارة مع صورة عداد النهاية (لإعادة استخدامها عند تطابق القراءة)
  const lastClosedTrip = useQuery({
    queryKey: ["last-closed-trip", form.car_code, form.car_plate],
    enabled: !!(form.car_code || form.car_plate),
    queryFn: async () => {

      const r = await getLastClosedTripPhoto({
        data: { car_code: toEnglishDigits(form.car_code).trim(), car_plate: form.car_plate.trim() },
      });
      if (!r) return null;
      // photo_url رابط موقّع مؤقت للتحميل فقط؛ photo_path هو المرجع الدائم للحفظ
      return { trip_no: r.trip_no, status: r.status, at: r.at, end_odometer: r.end_odometer, end_photo_url: r.photo_url, photo_path: r.photo_path, start_photo_url: null };
    },
  });

  const [reusedPhotoUrl, setReusedPhotoUrl] = useState<string | null>(null);
  const [autoPhoto, setAutoPhoto] = useState(false);

  // إذا كانت قراءة البداية مساوية لقراءة نهاية آخر رحلة مغلقة، اجلب صورتها وأرفقها كملف عادي
  // (كأن المستخدم اختارها من المعرض) حتى تُضغط وترفع كصورة جديدة مستقلة لهذا الطلب
  useEffect(() => {
    const odo = toEnglishDigits(form.start_odometer).trim();
    const last = lastClosedTrip.data;
    const lastPhoto = (last?.end_photo_url ?? last?.start_photo_url ?? null) as string | null;
    const matches =
      !!last && canReuseStartPhoto({ status: last.status, at: last.at, reading: last.end_odometer }, odo) && !!lastPhoto;
    if (!matches) {
      if (autoPhoto) {
        if (photoPreview?.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
        setPhoto(null);
        setPhotoPreview("");
        setAutoPhoto(false);
        setReusedPhotoUrl(null);
      } else if (reusedPhotoUrl) {
        setReusedPhotoUrl(null);
        setPhotoPreview((p) => (p && !p.startsWith("blob:") && !p.startsWith("data:") ? "" : p));
      }
      return;
    }
    if (photo || !lastPhoto) return;
    let cancelled = false;
    (async () => {
      let blob: Blob | null = null;
      try {
        if (/^https?:\/\//i.test(lastPhoto)) {
          const res = await fetch(lastPhoto);
          if (res.ok) blob = await res.blob();
        } else {
          // مسار داخل التخزين: نزّل الملف مباشرة
          const { data, error } = await supabase.storage.from("odometer-photos").download(lastPhoto);
          if (!error && data) blob = data;
          if (!blob) {
            // احتياط: رابط موقّع ثم جلب عادي
            const { getSignedPhotoUrl } = await import("@/lib/storage");
            const signed = await getSignedPhotoUrl(lastPhoto);
            const res = await fetch(signed);
            if (res.ok) blob = await res.blob();
          }
        }
      } catch {
        blob = null;
      }
      if (cancelled) return;
      if (blob && blob.size > 0) {
        const file = new File([blob], "صورة-العداد-من-الرحلة-السابقة.jpg", { type: blob.type || "image/jpeg" });
        if (photoPreview?.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
        setPhoto(file);
        setPhotoPreview(URL.createObjectURL(file));
        setAutoPhoto(true);
        setReusedPhotoUrl(null);
        setErrors((e) => (e.photo ? { ...e, photo: false } : e));
      } else {
        // تعذر جلب الصورة — نحفظ المسار الدائم داخل التخزين (وليس الرابط المؤقت)
        const stablePath = (last?.photo_path ?? null) as string | null;
        if (stablePath && reusedPhotoUrl !== stablePath) {
          setReusedPhotoUrl(stablePath);
          setPhotoPreview(lastPhoto);
          setErrors((e) => (e.photo ? { ...e, photo: false } : e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.start_odometer, lastClosedTrip.data, photo, autoPhoto, reusedPhotoUrl, photoPreview]);

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

  // التحقق من أن كود السيارة مسجل في قاعدة البيانات
  useEffect(() => {
    if (form.car_type !== "company") return;
    const code = toEnglishDigits(form.car_code).trim();
    if (!code) {
      setErrors((e) => (e.car_code ? { ...e, car_code: false } : e));
      return;
    }
    const match = cars.data?.find((c: any) => c.code === code);
    if (code.length === 4 && !match) {
      setErrors((e) => ({ ...e, car_code: true }));
    } else if (match) {
      setErrors((e) => (e.car_code ? { ...e, car_code: false } : e));
    }
  }, [form.car_code, form.car_type, cars.data]);

  // تعبئة السائق تلقائياً من رقم الساب لليوزر المسجل دخوله (فقط إذا كان اليوزر أرقام)
  useEffect(() => {
    if (form.car_type !== "company") return;
    if (form.driver_id) return;
    if (!drivers.data) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", user.id)
        .maybeSingle();
      const uname = (prof?.username ?? "").trim();
      if (!uname || !/^\d+$/.test(uname)) return;
      const match = drivers.data.find(
        (d: any) => (d.sap_number ?? "").trim() === uname && d.type !== "rental",
      );
      if (match) setForm((f) => (f.driver_id ? f : { ...f, driver_id: match.id }));
    })();
  }, [form.car_type, form.driver_id, drivers.data]);

  function handlePhoto(file: File | null) {
    setPhoto(file);
    setAutoPhoto(false);
    setReusedPhotoUrl(null);
    if (photoPreview?.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(file ? URL.createObjectURL(file) : "");
  }

  function getTripSubmitError(err: unknown, step: string) {
    return arabicError(err, step === "photo"
      ? "تعذر رفع صورة العداد؛ السبب غير محدد، والصورة ما زالت مختارة للمحاولة مجددًا"
      : "تعذر إكمال إنشاء الرحلة؛ لم تحدد الخدمة سببًا واضحًا");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const normalizedCarCode = toEnglishDigits(form.car_code).trim();
    const normalizedStartOdometer = toEnglishDigits(form.start_odometer).trim();
    const normalizedRouteStart = form.route_start.trim();
    const normalizedRentalDriver = form.driver_name_rental.trim();
    const selectedService = services.data?.find((s) => s.id === form.service_type_id);
    const isWorkerTransport = selectedService?.name === "نقل عاملين";
    const isAfterSales = selectedService?.name === "خدمة ما بعد البيع";
    const hasTechnician = !!form.technician_id && form.technician_id !== "__none__";
    const needsManager =
      (form.car_type !== "company" && !isWorkerTransport && !!form.service_type_id) ||
      (form.car_type === "company" && isAfterSales) ||
      hasTechnician;
    const selectedManager = managers.data?.find((m) => m.id === form.manager_id);
    const managerName = (selectedManager?.name ?? "").trim();
    const managerIsNone = !form.manager_id || managerName === "لا يوجد" || managerName.toLowerCase() === "none";
    const errs: Record<string, boolean> = {};
    const missing: string[] = [];
    const addMiss = (key: string, label: string) => { errs[key] = true; missing.push(label); };

    if (form.car_type === "rental" && !form.office_id) addMiss("office_id", "المكتب");
    if (!form.service_type_id) addMiss("service_type_id", "نوع الخدمة");
    if (!form.governorate_id) addMiss("governorate_id", "المحافظة");
    if (needsManager && managerIsNone) addMiss("manager_id", "المدير المسؤول");
    if (!isWorkerTransport && !form.technician_id && form.technician_id !== "__none__") addMiss("technician_id", "متلقي الخدمة أو الفني");
    if (!managerIsNone && !hasTechnician) addMiss("technician_id", "متلقي الخدمة أو الفني (إلزامي عند اختيار مدير مسؤول)");
    if (form.car_type === "rental" ? !normalizedRentalDriver : !form.driver_id) {
      addMiss(form.car_type === "rental" ? "driver_name_rental" : "driver_id", "السائق");
    }
    if (form.car_type === "company" && !normalizedCarCode) addMiss("car_code", "كود السيارة");
    if (form.car_type === "rental" && !form.car_plate.trim()) addMiss("car_plate", "رقم لوحة السيارة");
    const selectedCar =
      cars.data?.find((c: any) =>
        form.car_type === "rental"
          ? c.type === "rental" && String(c.plate ?? "").trim() === form.car_plate.trim()
          : String(c.code ?? "").trim() === normalizedCarCode,
      ) ?? null;
    if (form.car_type === "company" && normalizedCarCode && !selectedCar) {
      addMiss("car_code", "كود السيارة غير مسجل في قاعدة البيانات");
    }
    if ((selectedCar as any)?.blocked) {
      setErrors({ ...errs, [form.car_type === "rental" ? "car_plate" : "car_code"]: true });
      toast.error("هذه السيارة ممنوعة من التسجيل، برجاء اختيار سيارة أخرى", { duration: 6000 });
      setTimeout(() => {
        document.querySelector('[data-invalid="true"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 0);
      return;
    }
    if (!normalizedRouteStart) addMiss("route_start", "بداية خط السير");
    if (!normalizedStartOdometer) addMiss("start_odometer", "قراءة العداد");
    if (!photo && !reusedPhotoUrl) addMiss("photo", "صورة العداد");

    if (normalizedRouteStart.length > 40) {
      setErrors({ ...errs, route_start: true });
      toast.error("بداية خط السير: يجب ألا تزيد عن 40 حرف", { duration: 6000 });
      setTimeout(() => {
        document.querySelector('[data-invalid="true"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 0);
      return;
    }
    if (normalizedStartOdometer && (isNaN(parseInt(normalizedStartOdometer, 10)) || parseInt(normalizedStartOdometer, 10) < 0)) {
      setErrors({ ...errs, start_odometer: true });
      toast.error("قراءة العداد: يجب أن تكون رقماً صحيحاً موجباً", { duration: 6000 });
      return;
    }

    if (missing.length > 0) {
      setErrors(errs);
      const list = missing.map((m) => `• ${m}`).join("\n");
      toast.error(
        `تعذّر إنشاء الرحلة — الحقول التالية مطلوبة:\n${list}\n(تم تظليلها باللون الأحمر)`,
        { duration: 8000, style: { whiteSpace: "pre-line", textAlign: "right" } as any },
      );
      setTimeout(() => {
        document.querySelector('[data-invalid="true"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 0);
      return;
    }
    setErrors({});
    setLoading(true);
    let step = "auth";
    let stepLabel = "جارٍ التحقق من المستخدم...";
    setSubmitStep(stepLabel);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("انتهت الجلسة، يرجى تسجيل الدخول مجدداً");
      step = "open-trip";
      stepLabel = "جارٍ التحقق من الرحلات المفتوحة...";
      setSubmitStep(stepLabel);
      const { data: openTrips } = await supabase
        .from("trips")
        .select("id, trip_no, car_code, car_plate")
        .eq("created_by", user.id)
        .eq("status", "open");
      const currentPlate = form.car_plate.trim();
      const sameCarOpen = (openTrips ?? []).find((t: any) =>
        (normalizedCarCode && t.car_code && String(t.car_code).trim() === normalizedCarCode) ||
        (currentPlate && t.car_plate && String(t.car_plate).trim() === currentPlate)
      ) as { id: string; trip_no: number | string } | undefined;
      if (sameCarOpen) {
        const openTrip = sameCarOpen;
        setLoading(false);
        toast.error(`يوجد رحلة مفتوحة رقم #${openTrip.trip_no} لنفس السيارة، يجب إكمالها أو حذفها`, {

          duration: 10000,
          action: {
            label: "فتح الرحلة",
            onClick: () => navigate({ to: "/trips/$id", params: { id: openTrip.id } }),
          },
          cancel: {
            label: "حذف الرحلة",
            onClick: async () => {
              if (!confirm(`هل أنت متأكد من حذف الرحلة #${openTrip.trip_no}؟`)) return;
              const { error: delErr } = await supabase.from("trips").delete().eq("id", openTrip.id);
              if (delErr) {
                toast.error("تعذّر حذف الرحلة: " + arabicError(delErr));
              } else {
                toast.success(`تم حذف الرحلة #${openTrip.trip_no}`);
              }
            },
          },
        });
        return;
      }

      if (!photo && !reusedPhotoUrl) throw new Error("يجب اختيار صورة العداد");
      step = "photo";
      stepLabel = photo ? "جارٍ ضغط ورفع صورة العداد..." : "جارٍ استخدام صورة العداد من الرحلة السابقة...";
      setSubmitStep(stepLabel);
      const path = photo ? await uploadOdometerPhoto(photo, "start", setSubmitStep) : (reusedPhotoUrl as string);
      step = "profile";
      stepLabel = "جارٍ قراءة بيانات المستخدم...";
      setSubmitStep(stepLabel);
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("user_id", user.id)
        .maybeSingle();
      const creatorName = prof?.display_name ?? prof?.username ?? user.email ?? null;
      step = "insert";
      stepLabel = "جارٍ حفظ بيانات الرحلة...";
      setSubmitStep(stepLabel);
      const { data: trip, error } = await supabase.from("trips").insert({
        created_by: user.id,
        created_by_email: user.email ?? null,
        created_by_name: creatorName,
        car_type: form.car_type,

        office_id: form.car_type === "rental" ? (form.office_id || null) : null,
        manager_id: form.manager_id || null,
        technician_id: form.technician_id && form.technician_id !== "__none__" ? form.technician_id : null,
        driver_id: form.car_type === "rental" ? null : (form.driver_id || null),
        driver_name_rental: form.car_type === "rental" ? (normalizedRentalDriver || null) : null,
        service_type_id: form.service_type_id || null,
        governorate_id: form.governorate_id || null,
        governorate_name: governorates.data?.find((g) => g.id === form.governorate_id)?.name ?? null,
        route_start: normalizedRouteStart,
        start_odometer: parseInt(normalizedStartOdometer, 10),
        start_photo_url: path,
        car_code: normalizedCarCode || null,
        car_plate: form.car_plate.trim() || null,
        car_description: (() => {
          const car = form.car_type === "rental"
            ? cars.data?.find((c) => c.type === "rental" && (c.handheld_code === form.handheld_code || c.plate === form.car_plate))
            : cars.data?.find((c) => c.code === normalizedCarCode);
          return car?.description ?? null;
        })(),
        handheld_code: form.car_type === "rental" ? (form.handheld_code || null) : null,
      } as any).select().single();
      if (error) throw error;
      toast.success("تم بدء الرحلة");
      navigate({ to: "/trips/$id", params: { id: trip.id } });
    } catch (err: any) {
      const msg = getTripSubmitError(err, step);
      toast.error(
        `${msg}\nالمرحلة: ${stepLabel || "إنشاء الرحلة"}\nراجع الحقول وحاول مرة أخرى.`,
        { duration: 9000, style: { whiteSpace: "pre-line", textAlign: "right" } as any },
      );
    } finally {
      setLoading(false);
      setSubmitStep("");
    }
  }

  if (checkingOpenTrip || permLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="size-10 animate-spin text-primary" />
        <p className="text-muted-foreground">جارٍ التحقق من الرحلات المفتوحة...</p>
      </div>
    );
  }

  if (openTrip) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/90 backdrop-blur-sm">
        <Card className="w-full max-w-md shadow-xl border-2 border-destructive/30">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 size-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <Gauge className="size-8 text-destructive" />
            </div>
            <CardTitle className="text-xl leading-relaxed">يجب إكمال الرحلة المفتوحة رقم #{openTrip.trip_no} أو حذفها</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground text-center">
              لا يمكن بدء رحلة جديدة قبل إغلاق أو حذف الرحلة الحالية.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => navigate({ to: "/trips/$id", params: { id: openTrip.id } })}>
                فتح الرحلة
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (!confirm(`هل أنت متأكد من حذف الرحلة #${openTrip.trip_no}؟`)) return;
                  const { error: delErr } = await supabase.from("trips").delete().eq("id", openTrip.id);
                  if (delErr) {
                    toast.error("تعذّر حذف الرحلة: " + arabicError(delErr));
                  } else {
                    toast.success(`تم حذف الرحلة #${openTrip.trip_no}`);
                    setOpenTrip(null);
                  }
                }}
              >
                حذف الرحلة
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">رحلة جديدة</h1>
          <p className="text-sm text-muted-foreground mt-1">سجّل بداية خط السير وصورة العداد</p>
        </div>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold text-lg shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <Gauge className="size-5" />
          <span>طلب جديد</span>
        </div>
      </div>

      {canSeeRentals && (
        <Card className="rounded-2xl border-l-4 border-l-primary shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <CarIcon className="size-4 text-primary" />
              </div>
              نوع السيارة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup value={form.car_type} onValueChange={(v) => set("car_type", v)} className="grid grid-cols-2 gap-3">
              <label className={`border-2 rounded-xl p-4 cursor-pointer flex items-center gap-2 transition-all ${form.car_type === "company" ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:bg-muted/30"}`}>
                <RadioGroupItem value="company" />
                <span className="font-semibold">سيارة شركة</span>
              </label>
              <label className={`border-2 rounded-xl p-4 cursor-pointer flex items-center gap-2 transition-all ${form.car_type === "rental" ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:bg-muted/30"}`}>
                <RadioGroupItem value="rental" />
                <span className="font-semibold">سيارات إيجار</span>
              </label>
            </RadioGroup>
          </CardContent>
        </Card>
      )}


      <Card className="rounded-2xl border-l-4 border-l-blue-500 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <ClipboardListIcon className="size-4 text-blue-500" />
            </div>
            بيانات الرحلة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {form.car_type === "rental" && (
            <Field label="المكتب (مطلوب)" invalid={errors.office_id}>
              <LookupSelect items={offices.data} value={form.office_id} onChange={(v) => set("office_id", v)} placeholder="اختر المكتب" />
            </Field>
          )}
          <Field label="نوع الخدمة" invalid={errors.service_type_id}>
            <LookupSelect items={services.data} value={form.service_type_id} onChange={(v) => set("service_type_id", v)} placeholder="اختر النوع" />
          </Field>
          <Field label="المحافظة (مطلوب)" invalid={errors.governorate_id}>
            <LookupSelect items={governorates.data} value={form.governorate_id} onChange={(v) => set("governorate_id", v)} placeholder="اختر المحافظة" />
          </Field>

          {((form.car_type !== "company" && services.data?.find((s) => s.id === form.service_type_id)?.name !== "نقل عاملين") ||
            (form.car_type === "company" && services.data?.find((s) => s.id === form.service_type_id)?.name === "خدمة ما بعد البيع") ||
            (!!form.technician_id && form.technician_id !== "__none__")) && (
            <Field label="المدير المسؤول" invalid={errors.manager_id}>
              <LookupSelect items={managers.data} value={form.manager_id} onChange={(v) => set("manager_id", v)} placeholder="اختر المدير" />
              <p className="mt-1 text-xs text-muted-foreground">
                يتم اختيار المدير النشط الخاص بمتلقي الخدمة أو الفني. عند اختيار متلقي خدمة أو فني (غير "لا يوجد") يصبح اختيار المدير إلزامياً، وكذلك عند اختيار مدير مسؤول يجب اختيار متلقي خدمة أو فني (لا يُقبل "لا يوجد").
              </p>
            </Field>
          )}
          {services.data?.find((s) => s.id === form.service_type_id)?.name !== "نقل عاملين" && (
            <Field label="متلقي الخدمة أو فنى (رقم الساب)" invalid={errors.technician_id}>
              <SapSelect items={technicians.data} value={form.technician_id} onChange={(v) => set("technician_id", v)} placeholder="اختر رقم الساب أو اكتب: لا يوجد" allowNone noneLabel="لا يوجد متلقى خدمة أو فنى" />

              {selectedTech && (
                <div className="mt-2 p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <UserIcon className="size-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">الاسم</div>
                    <div className="text-lg font-bold text-primary">{selectedTech.name}</div>
                  </div>
                </div>
              )}
            </Field>
          )}
          {form.car_type === "company" ? (
            <Field label="السائق (رقم الساب)" invalid={errors.driver_id}>
              <SapSelect items={drivers.data?.filter((d) => d.type !== "rental")} value={form.driver_id} onChange={(v) => set("driver_id", v)} placeholder="اختر رقم الساب" />
              {selectedDriver && (
                <div className="mt-2 p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <UserIcon className="size-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">الاسم</div>
                    <div className="text-lg font-bold text-primary">{selectedDriver.name}</div>
                  </div>
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
                    const v = toEnglishDigits(text).trim();
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
                    const v = toEnglishDigits(e.target.value);
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
                    const v = toEnglishDigits(text).trim();
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
                    const v = toEnglishDigits(text).trim();
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

      <Card className="rounded-2xl border-l-4 border-l-emerald-500 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <MapPin className="size-4 text-emerald-500" />
            </div>
            بداية خط السير
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="بداية خط السير" invalid={errors.route_start}>
            <Textarea ref={routeStartRef} value={form.route_start} maxLength={40} onChange={(e) => set("route_start", e.target.value.slice(0, 40))} placeholder="مثال: من مكتب المنصورة إلى العميل..." rows={2} />
            <div className="text-xs text-muted-foreground text-left">{form.route_start.length}/40</div>
          </Field>
          <Field label="قراءة العداد (كم)" invalid={errors.start_odometer}>
            <div className="relative">
              <Gauge className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input type="text" inputMode="decimal" min={0} value={form.start_odometer} onChange={(e) => set("start_odometer", toOdometerInput(e.target.value))} className="pr-10" dir="ltr" />
            </div>
            {(form.car_code || form.car_plate) && (
              <div className="mt-1 text-xs">
                {lastReading.isLoading ? (
                  <span className="text-muted-foreground">جارٍ جلب آخر قراءة للعداد...</span>
                ) : lastReading.data ? (
                  <button
                    type="button"
                    onClick={() => set("start_odometer", String(lastReading.data.reading))}
                    className="rounded-md bg-accent/40 px-2 py-1 text-right hover:bg-accent"
                  >
                    آخر قراءة لهذه السيارة:{" "}
                    <span dir="ltr" className="font-mono font-semibold">{lastReading.data.reading}</span>{" "}
                    كم (طلب #{lastReading.data.trip_no} — {new Date(lastReading.data.at).toLocaleDateString("ar-EG")}) — اضغط للاستخدام
                  </button>
                ) : (
                  <span className="text-muted-foreground">لا توجد قراءة سابقة لهذه السيارة</span>
                )}
              </div>
            )}
          </Field>

          <PhotoInput preview={photoPreview} onFile={(f) => { handlePhoto(f); if (f) setErrors((e) => (e.photo ? { ...e, photo: false } : e)); }} invalid={errors.photo} />
          {(autoPhoto || reusedPhotoUrl) && (
            <p className="mt-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1">
              تم إرفاق صورة العداد تلقائياً من آخر رحلة مغلقة بنفس القراءة {autoPhoto ? "وسيتم رفعها كصورة جديدة لهذا الطلب" : ""} — يمكنك التقاط صورة جديدة إذا أردت
            </p>
          )}
        </CardContent>
      </Card>

      <Button type="submit" className="w-full h-14 text-lg font-bold rounded-2xl shadow-lg shadow-primary/30 hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0 transition-all" disabled={loading}>
        {loading && <Loader2 className="ml-2 size-5 animate-spin" />} {loading ? (submitStep || "جارٍ إنشاء الرحلة...") : "بدء الرحلة"}
      </Button>
    </form>
  );
}

function Field({ label, children, invalid }: { label: string; children: React.ReactNode; invalid?: boolean }) {
  return (
    <div className="space-y-2" data-invalid={invalid ? "true" : undefined}>
      <Label className={`text-sm font-semibold ${invalid ? "text-destructive" : "text-foreground"}`}>{label}</Label>
      <div className={invalid ? "rounded-xl ring-2 ring-destructive ring-offset-2 ring-offset-background" : undefined}>
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
          const v = toEnglishDigits(e.target.value).replace(/\D/g, "").slice(0, 4);
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
    if (value || !items?.length) return;
    const normalized = toEnglishDigits(text).trim();
    if (!normalized) return;
    if (allowNone && (normalized === noneText || normalized === "لا يوجد")) {
      onChange(NONE);
      return;
    }
    const match = items.find((i) => String(i.sap_number ?? "").trim() === normalized);
    if (match) onChange(match.id);
  }, [allowNone, items, noneText, onChange, text, value]);

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
    return (i.sap_number ?? "").toLowerCase().includes(toEnglishDigits(q)) || (i.name ?? "").toLowerCase().includes(q);
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
          const v = toEnglishDigits(e.target.value);
          setText(v);
          setOpen(true);
          if (allowNone && v.trim() === noneText) { onChange(NONE); return; }
          const match = items?.find((i) => String(i.sap_number ?? "").trim() === v.trim());
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
  const [info, setInfo] = useState<{ name: string; size: number } | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [dataPreview, setDataPreview] = useState("");
  const [pickError, setPickError] = useState("");
  const lastFileRef = useRef<string>("");
  const previewRequestRef = useRef(0);
  const pickerCleanupRef = useRef<(() => void) | null>(null);
  function handle(f: File | null) {
    const sig = f ? `${f.name}|${f.size}|${f.lastModified}` : "";
    if (f && sig === lastFileRef.current) return;
    lastFileRef.current = sig;
    const requestId = ++previewRequestRef.current;
    setPreviewFailed(false);
    setPickError("");
    setDataPreview("");
    if (f) {
      const nameExt = (f.name.split(".").pop() || "").toLowerCase();
      const type = (f.type || "").toLowerCase();
      const knownNonImage = !!type && !type.startsWith("image/");
      const looksImage = type.startsWith("image/") ||
        ["jpg", "jpeg", "png", "webp", "heic", "heif", "avif", "gif", "bmp", "tif", "tiff"].includes(nameExt);
      if (!looksImage && knownNonImage) {
        setInfo(null);
        setPickError("الملف المختار ليس صورة، اختر صورة عداد واضحة");
        onFile(null);
        return;
      }
      setInfo({ name: f.name || "photo", size: f.size });
      // سجّل الملف فوراً قبل إنشاء المعاينة؛ بعض WebView يتأخر في قراءة الصورة.
      onFile(f);
      // مصغّرة مضمونة العرض (تعمل مع heic/avif وغيرها) مع بديل data URL
      (async () => {
        const thumb = await makeThumbnail(f);
        if (requestId !== previewRequestRef.current) return;
        if (thumb) {
          setDataPreview(thumb);
          setPreviewFailed(false);
          return;
        }
        try {
          const reader = new FileReader();
          reader.onload = () => {
            if (requestId === previewRequestRef.current) setDataPreview(String(reader.result || ""));
          };
          reader.onerror = () => {
            if (requestId === previewRequestRef.current) setPreviewFailed(true);
          };
          reader.readAsDataURL(f);
        } catch {
          if (requestId === previewRequestRef.current) setPreviewFailed(true);
        }
      })();
    } else {
      setInfo(null);
      onFile(null);
    }
  }
  function pickPhoto(accept?: string) {
    pickerCleanupRef.current?.();
    lastFileRef.current = "";
    pickerCleanupRef.current = openPhotoPicker(handle, accept);
  }

  useEffect(() => () => pickerCleanupRef.current?.(), []);


  const previewSrc = dataPreview || (previewFailed ? "" : preview);

  return (
    <div className="space-y-1.5" data-invalid={invalid ? "true" : undefined}>
      <Label className={invalid ? "text-destructive" : undefined}>{label}</Label>
      {previewSrc && (
        <img
          src={previewSrc}
          alt="معاينة"
          className="w-full max-h-60 object-contain rounded-lg border bg-muted"
          onError={() => { setDataPreview(""); setPreviewFailed(true); }}
        />
      )}

      {info && (
        <div className="text-xs text-success flex items-center gap-1 bg-success/10 rounded-md px-2 py-1">
          <span>✓</span>
          <span>تم اختيار الصورة{previewFailed && !dataPreview ? " (تعذّر عرض المعاينة لكن سيتم رفعها)" : ""}: {info.name} — {(info.size / 1024).toFixed(0)} KB</span>
        </div>
      )}
      {pickError && (
        <div className="text-xs text-destructive bg-destructive/10 rounded-md px-2 py-1">
          {pickError}
        </div>
      )}
      <div className={`grid grid-cols-2 gap-3 ${invalid ? "rounded-xl ring-2 ring-destructive ring-offset-2 ring-offset-background p-2" : ""}`}>
        <CameraCapture onCapture={(f) => handle(f)} />
        <Button
          type="button"
          variant="outline"
          onClick={() => pickPhoto("image/*,.heic,.heif")}
          className="h-auto min-h-28 border-2 border-dashed border-muted-foreground/30 rounded-xl flex flex-col items-center justify-center gap-2 text-sm cursor-pointer bg-muted/20 hover:bg-primary/5 hover:border-primary/40 active:bg-primary/10 transition-all select-none"
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <ImageIcon className="size-5 text-primary" />
          </div>
          <span className="font-semibold text-foreground">من المعرض</span>
        </Button>
        {/* بديل: بدون تقييد النوع — يعمل حتى لو مُنع إذن الصور */}
        <Button
          type="button"
          variant="link"
          onClick={() => pickPhoto()}
          className="col-span-2 text-xs text-center underline text-muted-foreground cursor-pointer py-2 hover:text-primary transition-colors"
        >
          لم يفتح المعرض؟ اختر ملفاً من الجهاز
        </Button>
      </div>


    </div>
  );
}
