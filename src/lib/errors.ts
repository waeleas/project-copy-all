type ErrorInfo = { message?: string; name?: string; code?: string; status?: number; statusCode?: number | string };

function info(err: unknown) {
  const value: ErrorInfo = err && typeof err === "object" ? err as ErrorInfo : {};
  const message = typeof err === "string" ? err : value.message ?? "";
  return { message, text: `${value.name ?? ""} ${value.code ?? ""} ${message}`, code: value.code, status: Number(value.statusCode ?? value.status) };
}

const RULES = [
  ["login_configuration", /missing supabase environment variable|invalid api key|invalid_api_key/i, "إعدادات خدمة الدخول غير مكتملة أو غير صالحة؛ يلزم مراجعتها بواسطة مسؤول البرنامج"],
  ["app_version", /server function (info )?not found|failed to find server function|failed to fetch dynamically imported module|importing a module script failed/i, "نسخة الصفحة لا تتوافق مع النسخة المنشورة؛ حدّث الصفحة ثم حاول الدخول مجددًا"],
  ["multiple_records", /PGRST116|multiple \(or no\) rows returned|cannot coerce the result to a single JSON object/i, "تعذر تحديد حساب واحد من البيانات المسجلة؛ يلزم مراجعة سجلات الحساب بواسطة مسؤول البرنامج"],
  ["credentials", /invalid login credentials|invalid_credentials/i, "اسم المستخدم أو كلمة المرور غير صحيحة"],
  ["email_unconfirmed", /email not confirmed|email_not_confirmed/i, "البريد الإلكتروني غير مفعّل؛ يلزم تفعيله قبل تسجيل الدخول"],
  ["user_missing", /user not found|user_not_found/i, "الحساب المطلوب غير موجود"],
  ["registered", /user already (registered|exists)|email.*already.*registered|already.*registered/i, "الحساب أو البريد الإلكتروني مسجّل بالفعل"],
  ["weak_password", /weak_password|password.*(weak|known|leaked|pwned|breach)|easy to guess/i, "رفضت الخدمة كلمة المرور لأنها ضعيفة أو معروفة؛ اختر كلمة أقوى"],
  ["password_length", /password.*(should be at least|too short)/i, "كلمة المرور أقصر من الحد المطلوب؛ أدخل كلمة أطول"],
  ["same_password", /new password should be different/i, "كلمة المرور الجديدة يجب أن تختلف عن القديمة"],
  ["camera_permission", /NotAllowedError|PermissionDeniedError/i, "لم يُسمح بالوصول إلى الكاميرا أو الجهاز؛ راجع إذن الوصول في إعدادات المتصفح"],
  ["camera_missing", /NotFoundError|DevicesNotFoundError/i, "لم يعثر المتصفح على كاميرا أو جهاز متاح"],
  ["camera_busy", /NotReadableError|TrackStartError/i, "تعذر تشغيل الكاميرا؛ قد تكون مشغولة بتطبيق آخر أو غير متاحة للنظام"],
  ["device_security", /SecurityError|secure context/i, "المتصفح منع الوصول لأسباب أمنية؛ افتح الموقع باتصال آمن وفي نافذة مستقلة"],
  ["device_constraints", /OverconstrainedError|ConstraintNotSatisfiedError/i, "الكاميرا لا تدعم إعدادات التصوير المطلوبة"],
  ["unsupported", /NotSupportedError|unsupported.*(type|format)|mime.*not supported|invalid.*mime/i, "صيغة الملف أو العملية غير مدعومة؛ جرّب صيغة أخرى يدعمها الجهاز والخدمة"],
  ["session", /jwt|token.*(expired|invalid)|unauthorized|no authorization|no token/i, "تعذر التحقق من جلسة الدخول؛ سجّل الدخول مجددًا"],
  ["permission", /permission denied|not authorized|forbidden|row[- ]level security|rls|violates.*policy/i, "حسابك لا يملك صلاحية تنفيذ هذا الإجراء"],
  ["duplicate", /duplicate key|already exists|unique constraint/i, "يوجد سجل بنفس البيانات الفريدة؛ راجع الاسم أو الكود قبل الحفظ"],
  ["reference", /foreign key|violates foreign/i, "العملية مرتبطة بسجل آخر؛ راجع البيانات المرتبطة قبل الحفظ أو الحذف"],
  ["required", /not[- ]null|null value/i, "أحد الحقول المطلوبة فارغ؛ أكمل البيانات المطلوبة"],
  ["invalid_value", /check constraint|violates check|invalid input syntax|value too long/i, "قيمة أحد الحقول لا توافق الصيغة أو الطول المسموح؛ راجع البيانات المدخلة"],
  ["quota", /quota|storage.*exceeded|disk.*full/i, "مساحة التخزين المتاحة للخدمة غير كافية؛ يلزم مراجعة المساحة"],
  ["file_size", /payload too large|entity too large|file.*too large|exceeded.*maximum.*size/i, "الخدمة رفضت الملف لأن حجمه المرسل يتجاوز الحد المسموح"],
  ["bucket", /bucket not found/i, "مساحة حفظ الملفات غير متاحة؛ يلزم مراجعة إعدادات التخزين"],
  ["missing", /object not found|not found/i, "الملف أو السجل المطلوب غير موجود أو لم يعد متاحًا"],
  ["email", /invalid.*email/i, "صيغة البريد الإلكتروني غير صحيحة"],
  ["signup", /signups? not allowed|signup.*disabled/i, "إنشاء حسابات جديدة غير مسموح حاليًا"],
  ["rate_limit", /rate limit|too many requests/i, "الخدمة أوقفت الطلب مؤقتًا لكثرة المحاولات؛ انتظر قليلًا ثم أعد المحاولة"],
  ["timeout", /timeout|timed out|etimedout/i, "انتهت مهلة انتظار الرد؛ قد يكون السبب الاتصال أو تأخر الخدمة"],
  ["network", /network|fetch failed|failed to fetch|load failed|err_internet_disconnected|econn|socket/i, "تعذر الاتصال بالخدمة؛ تحقق من اتصال الجهاز، وقد تكون الخدمة غير متاحة مؤقتًا"],
  ["cancelled", /abort(ed)?|aborterror/i, "انقطع الطلب أو أُلغي قبل اكتماله؛ أعد المحاولة"],
  ["file_parse", /SyntaxError|JSON|zip|workbook|spreadsheet|unsupported file|corrupt|invalid file/i, "تعذر قراءة محتوى الملف؛ قد يكون تالفًا أو لا يوافق نوع الملف المطلوب"],
  ["server", /database error|internal server error|service unavailable|bad gateway/i, "حدث خطأ في الخدمة أثناء تنفيذ الطلب؛ حاول مجددًا لاحقًا"],
] as const;

const CODES: Record<string, string> = { "23505": "duplicate", "23503": "reference", "23502": "required", "23514": "invalid_value", "22P02": "invalid_value", "42501": "permission", "PGRST301": "session", "PGRST116": "multiple_records" };

/** Classification uses evidence, never guesses that a generic TypeError means weak internet. */
export function errorReason(err: unknown): string {
  const { text, code, status } = info(err);
  if (code && CODES[code]) return CODES[code];
  const matched = RULES.find(([, pattern]) => pattern.test(text));
  if (matched) return matched[0];
  if (status === 401) return "session";
  if (status === 403) return "permission";
  if (status === 404) return "missing";
  if (status === 413) return "file_size";
  if (status === 429) return "rate_limit";
  if (status === 408 || status === 504) return "timeout";
  if (status >= 500) return "server";
  return "unknown";
}

export function arabicError(err: unknown, fallback = "تعذر إكمال العملية؛ لم تحدد الخدمة سببًا واضحًا، أعد المحاولة أو تواصل مع مسؤول البرنامج"): string {
  const { message } = info(err);
  const reason = errorReason(err);
  const rule = RULES.find(([key]) => key === reason);
  if (rule) return rule[2];
  // Preserve application validation, not mixed-language provider diagnostics.
  if (/[\u0600-\u06FF]/.test(message) && !/[a-z]{4,}/.test(message)) return message;
  return /[\u0600-\u06FF]/.test(fallback) && !/[a-z]{4,}/.test(fallback)
    ? fallback : "تعذر إكمال العملية؛ السبب غير محدد";
}

export function isNetworkError(err: unknown): boolean {
  return ["network", "timeout", "cancelled"].includes(errorReason(err));
}
