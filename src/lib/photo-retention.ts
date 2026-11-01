export const PHOTO_RETENTION_DAYS = 90;
export const PHOTO_PLACEHOLDER = "/__l5e/assets-v1/810396f8-fc18-43c7-a50a-5ec200bf8815/odometer-placeholder.jpg";

export function photoCutoff(now = Date.now()) {
  return new Date(now - PHOTO_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function isStoredPhoto(path: string | null | undefined): path is string {
  return !!path && !/^https?:\/\//i.test(path) && !path.startsWith("/");
}

export function removablePhotoPaths(oldPaths: Array<string | null>, retainedPaths: Array<string | null>) {
  const protectedPaths = new Set(retainedPaths.filter(isStoredPhoto));
  return [...new Set(oldPaths.filter(isStoredPhoto))].filter((path) => !protectedPaths.has(path));
}