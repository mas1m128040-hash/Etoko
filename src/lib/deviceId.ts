const KEY = 'smart_resto_device_id';
let memoryId: string | null = null;

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = makeId();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    if (!memoryId) memoryId = makeId();
    return memoryId;
  }
}
