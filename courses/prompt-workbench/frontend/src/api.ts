import type {
  Config,
  Draft,
  Experiment,
  Prompt,
  Sample,
  Validation,
} from "./types";
import { getCurrentLocale } from "./locale";

function localeHeaders() {
  const locale = getCurrentLocale() === "en" ? "en-US" : "zh-CN";
  return { "X-Locale": locale, "Accept-Language": locale };
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function check(response: Response) {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body?.detail;
    throw new ApiError(
      response.status,
      typeof detail === "string" ? detail : `HTTP ${response.status}`,
    );
  }
  return response;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // 相对路径保留 Lab 子路径；凭证由同源服务端管理，浏览器不处理模型密钥。
  const response = await check(
    await fetch(`./api/${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
        ...localeHeaders(),
      },
    }),
  );
  return response.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string; version: string }>("health"),
  config: (signal?: AbortSignal) => request<Config>("config", { signal }),
  samples: (signal?: AbortSignal) => request<Sample[]>("samples", { signal }),
  drafts: () => request<Draft[]>("drafts"),
  experiments: () => request<Experiment[]>("experiments"),
  experiment: (id: string) =>
    request<Experiment>(`experiments/${encodeURIComponent(id)}`),
  save: (draft: Prompt & { id?: string; name: string }) =>
    request<Draft>("drafts", { method: "POST", body: JSON.stringify(draft) }),
  remove: (kind: "drafts" | "experiments", id: string) =>
    request<{ deleted: boolean }>(`${kind}/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  run: (prompt: Prompt & { draftId?: string }, signal: AbortSignal) =>
    request<Experiment>("run", {
      method: "POST",
      body: JSON.stringify(prompt),
      signal,
    }),
  validate: (text: string, input: string) =>
    request<Validation>("validate", {
      method: "POST",
      body: JSON.stringify({ text, input }),
    }),
  export: async () =>
    (
      await check(await fetch("./api/export", { headers: localeHeaders() }))
    ).blob(),
};
