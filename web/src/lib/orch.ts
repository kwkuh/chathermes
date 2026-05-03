const ORCH_URL = process.env.ORCH_URL ?? "http://127.0.0.1:7010";

export async function orchFetch(path: string, init: RequestInit = {}) {
  const url = `${ORCH_URL}${path}`;
  return fetch(url, init);
}

export async function orchJson<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await orchFetch(path, init);
  if (!r.ok) throw new Error(`orch ${path}: ${r.status}`);
  return (await r.json()) as T;
}

export { ORCH_URL };
