// البرنامج متوقف يوميًا من 11:59 مساءً حتى 4:00 صباحًا (بتوقيت الجهاز) حتى تنام قاعدة البيانات.
export function isQuietHours(d: Date = new Date()) {
  const m = d.getHours() * 60 + d.getMinutes();
  return m >= 23 * 60 + 59 || m < 4 * 60;
}
