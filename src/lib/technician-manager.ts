/**
 * منطق اختيار المدير تلقائيًا عند اختيار الفني (متلقي الخدمة).
 * Pure وقابل للاختبار بدون الوصول لقاعدة البيانات.
 */

export interface TechnicianManagerLink {
  technician_id: string;
  manager_id: string;
}

/**
 * يعيد معرف المدير الوحيد المرتبط بالفني، أو null إذا لم يوجد مدير
 * أو وُجد أكثر من مدير (عندها تُترك الخانة فارغة للإدخال اليدوي).
 */
export function autoManagerForTechnician(
  technicianId: string | null | undefined,
  links: TechnicianManagerLink[] | null | undefined
): string | null {
  if (!technicianId || technicianId === "__none__" || !links) return null;
  const managerIds = [
    ...new Set(
      links.filter((l) => l.technician_id === technicianId).map((l) => l.manager_id)
    ),
  ];
  return managerIds.length === 1 ? (managerIds[0] ?? null) : null;
}
