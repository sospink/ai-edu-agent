const STORAGE_KEY = 'agent-edu-lab-client-id';

export function getLabClientId(): string {
  const existing = localStorage.getItem(STORAGE_KEY)?.trim();
  if (existing) return existing;

  const generated = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `lab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(STORAGE_KEY, generated);
  return generated;
}
