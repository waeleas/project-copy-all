// ترجمة رسائل الأخطاء الشائعة إلى العربية

const MAP: Array<[RegExp, string]> = [
  [/invalid login credentials/i, "بيانات الدخول غير صحيحة"],
  [/email not confirmed/i, "البريد الإلكتروني غير مفعّل"],
  [/user not found/i, "المستخدم غير موجود"],
  [/user already (registered|exists)/i, "المستخدم مسجّل بالفعل"],
  [/email.*already.*registered|already.*registered/i, "البريد مسجّل بالفعل"],
  [/password.*should be at least (\d+)/i, "كلمة المرور قصيرة جداً (الحد الأدنى $1 أحرف)"],
  [/password.*(weak|known|leaked|pwned|breach)/i, "كلمة المرور ضعيفة أو مسربة، اختر كلمة أقوى"],
  [/new password should be different/i, "كلمة المرور الجديدة يجب أن تختلف عن القديمة"],
  [/rate limit|too many requests/i, "محاولات كثيرة، حاول لاحقاً"],
  [/network|fetch failed|failed to fetch|networkerror|err_network|err_internet_disconnected/i, "تعذر الاتصال بالإنترنت، تحقق من الشبكة وحاول مجدداً"],
  [/timeout|timed out|etimedout/i, "انتهت مهلة الاتصال، الشبكة بطيئة"],
  [/abort(ed)?|aborterror/i, "تم إلغاء العملية، أعد المحاولة"],
  [/jwt|token.*(expired|invalid)/i, "انتهت الجلسة، يرجى تسجيل الدخول مجدداً"],
  [/unauthorized|not authorized|permission denied|forbidden/i, "غير مصرّح لك بهذا الإجراء"],
  [/row[- ]level security|rls|violates.*policy/i, "غير مصرّح لك بهذا الإجراء"],
  [/duplicate key|already exists|unique constraint/i, "هذا السجل موجود بالفعل"],
  [/foreign key|violates foreign/i, "لا يمكن تنفيذ العملية لارتباط هذا السجل بسجلات أخرى"],
  [/check constraint|violates check/i, "قيمة غير مقبولة في أحد الحقول"],
  [/not[- ]null|null value/i, "حقل مطلوب فارغ"],
  [/value too long/i, "القيمة المُدخلة طويلة جداً"],
  [/invalid input syntax/i, "صيغة الإدخال غير صحيحة"],
  [/storage.*(quota|exceeded)|payload too large|too large|413/i, "حجم الملف كبير جداً"],
  [/bucket not found/i, "مساحة التخزين غير موجودة"],
  [/object not found|not found|404/i, "العنصر غير موجود"],
  [/invalid.*email/i, "صيغة البريد الإلكتروني غير صحيحة"],
  [/signups? not allowed|signup.*disabled/i, "التسجيل غير مسموح به"],
  [/database error|internal server error|500/i, "خطأ في الخادم، حاول مجدداً"],
  [/service unavailable|503|502|bad gateway/i, "الخدمة غير متاحة مؤقتاً، حاول بعد قليل"],
  [/load failed|type.*error/i, "تعذر تحميل البيانات، الشبكة ضعيفة"],
];

export function arabicError(err: unknown, fallback = "حدث خطأ، يرجى المحاولة مجدداً"): string {
  if (!err) return fallback;
  const raw =
    typeof err === "string"
      ? err
      : err instanceof Error
        ? err.message
        : (err as { message?: string })?.message || String(err);
  if (!raw) return fallback;
  // إذا كانت الرسالة بالعربية بالفعل اتركها
  if (/[\u0600-\u06FF]/.test(raw)) return raw;
  for (const [re, ar] of MAP) {
    if (re.test(raw)) return raw.replace(re, ar);
  }
  // لا نعرض رسالة إنجليزية للمستخدم — نعيد الرسالة الافتراضية بالعربية
  return fallback;
}

export function isNetworkError(err: unknown): boolean {
  const raw =
    typeof err === "string"
      ? err
      : err instanceof Error
        ? err.message
        : (err as { message?: string })?.message || String(err ?? "");
  return /network|fetch failed|failed to fetch|timeout|timed out|abort|load failed|networkerror|err_network|err_internet_disconnected|etimedout/i.test(
    raw,
  );
}
