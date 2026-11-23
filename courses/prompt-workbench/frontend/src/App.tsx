import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  Languages,
  LoaderCircle,
  Play,
  RefreshCw,
  Save,
  SlidersHorizontal,
  Square,
  TerminalSquare,
  X,
} from "lucide-react";
import { api, ApiError } from "./api";
import { getCurrentLocale, setCurrentLocale } from "./locale";
import {
  newPrompt,
  promptOf,
  type Config,
  type Draft,
  type Experiment,
  type Prompt,
  type Sample,
  type Validation,
} from "./types";
import { Editor } from "./components/Editor";
import { Library } from "./components/Library";
import { Result } from "./components/Result";
import { Overlay } from "./components/Overlay";
import { Compare } from "./components/Compare";

type Confirmation = { message: string; action: () => void | Promise<void> };

export default function App() {
  const [lang, setLang] = useState(getCurrentLocale);
  const t = useCallback(
    (zh: string, en: string) => (lang === "zh" ? zh : en),
    [lang],
  );
  const [config, setConfig] = useState<Config | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [prompt, setPrompt] = useState<Prompt>(newPrompt);
  const [name, setName] = useState("");
  const [draftId, setDraftId] = useState<string>();
  const [saved, setSaved] = useState(
    JSON.stringify({ prompt: newPrompt(), name: "" }),
  );
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [response, setResponse] = useState("");
  const [validation, setValidation] = useState<Validation | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [comparison, setComparison] = useState<Experiment[] | null>(null);
  const [settings, setSettings] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [loading, setLoading] = useState(true);
  const [localeLoading, setLocaleLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [validating, setValidating] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const operation = useRef(false);
  const loadedLocale = useRef(lang);
  const localeRequest = useRef(0);
  const dirty = JSON.stringify({ prompt, name }) !== saved;
  const responseDirty = !!experiment && response !== experiment.response;
  const locked = loading || localeLoading || busy || running || validating;

  function notify(message: string, error = false) {
    setNotice({ message, error });
  }
  function errorText(error: unknown): string {
    if (error instanceof ApiError && [401, 403].includes(error.status))
      return t(
        "当前实验环境未授权或凭证已过期，请重新进入实验。",
        "This lab is unauthorized or has expired. Reopen the lab.",
      );
    return error instanceof Error
      ? error.message
      : t("请求失败，请重试。", "Request failed. Please retry.");
  }
  async function refresh() {
    const requestId = ++localeRequest.current;
    setLoading(true);
    setLoadError("");
    setNotice(null);
    try {
      const [health, nextConfig, nextSamples, nextDrafts, nextExperiments] =
        await Promise.all([
          api.health(),
          api.config(),
          api.samples(),
          api.drafts(),
          api.experiments(),
        ]);
      if (health.status !== "ok")
        throw new Error(t("服务暂不可用", "Service unavailable"));
      if (requestId === localeRequest.current) {
        setConfig(nextConfig);
        setSamples(nextSamples);
      }
      setDrafts(nextDrafts);
      setExperiments(nextExperiments);
      setSelected((current) =>
        current.filter((id) => nextExperiments.some((e) => e.id === id)),
      );
    } catch (error) {
      setLoadError(errorText(error));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
    return () => controller.current?.abort();
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    document.title = t("提示词工作台", "Prompt Workbench");
    if (loadedLocale.current === lang) return;
    loadedLocale.current = lang;
    const requestId = ++localeRequest.current;
    const abort = new AbortController();
    setLocaleLoading(true);
    // 只刷新语言相关资料，不替换编辑表单、响应、历史或对比选择。
    void Promise.all([api.samples(abort.signal), api.config(abort.signal)])
      .then(([nextSamples, nextConfig]) => {
        if (requestId !== localeRequest.current || abort.signal.aborted) return;
        setSamples(nextSamples);
        setConfig(nextConfig);
      })
      .catch((error: unknown) => {
        if (!abort.signal.aborted && requestId === localeRequest.current) {
          notify(
            t(
              "语言资料刷新失败，请点击刷新重试：",
              "Unable to refresh localized data. Click Refresh to retry: ",
            ) + errorText(error),
            true,
          );
        }
      })
      .finally(() => {
        if (requestId === localeRequest.current) setLocaleLoading(false);
      });
    return () => abort.abort();
  }, [lang, t]);
  useEffect(() => {
    function protect(event: BeforeUnloadEvent) {
      if (dirty || responseDirty || running) {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty, responseDirty, running]);
  useEffect(() => {
    if (!notice || notice.error) return;
    const timeout = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function perform(action: () => Promise<void>) {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    try {
      await action();
    } catch (error) {
      notify(errorText(error), true);
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  function guard(action: () => void, protectResponse = false) {
    if (protectResponse ? responseDirty : dirty) {
      setConfirmation({
        message: protectResponse
          ? t(
              "放弃响应的本地修改？历史原始响应不会改变。",
              "Discard local response edits? The original history response is unchanged.",
            )
          : t(
              "当前提示词尚未保存，放弃修改并继续？",
              "Discard unsaved prompt changes and continue?",
            ),
        action,
      });
    } else action();
  }
  function loadPrompt(next: Prompt, nextName: string, id?: string) {
    const clean = promptOf(next);
    setPrompt(clean);
    setName(nextName);
    setDraftId(id);
    setSaved(JSON.stringify({ prompt: clean, name: nextName }));
  }
  function showExperiment(record: Experiment) {
    setExperiment(record);
    setResponse(record.response);
    setValidation(record.validation);
  }
  function saveDraft() {
    void perform(async () => {
      const record = await api.save({
        ...prompt,
        name: name.trim(),
        ...(draftId ? { id: draftId } : {}),
      });
      setDrafts((current) => [
        record,
        ...current.filter((d) => d.id !== record.id),
      ]);
      loadPrompt(record, record.name, record.id);
      notify(t("草稿已保存", "Draft saved"));
    });
  }
  async function run() {
    if (controller.current || operation.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setRunning(true);
    setNotice(null);
    try {
      const record = await api.run(
        { ...prompt, ...(draftId ? { draftId } : {}) },
        abort.signal,
      );
      // 取消后即使传输层已收到响应，也不把本次结果写入客户端成功历史。
      if (!abort.signal.aborted) {
        showExperiment(record);
        setExperiments((current) =>
          [record, ...current.filter((e) => e.id !== record.id)].slice(0, 100),
        );
        notify(t("运行成功，结果已记录", "Run finished and recorded"));
      }
    } catch (error) {
      if (abort.signal.aborted) notify(t("请求已取消", "Request canceled"));
      else notify(errorText(error), true);
    } finally {
      controller.current = null;
      setRunning(false);
    }
  }
  function remove(kind: "drafts" | "experiments", id: string) {
    setConfirmation({
      message:
        kind === "drafts"
          ? t(
              "永久删除这份草稿？当前编辑内容会保留为未保存草稿。",
              "Permanently delete this draft? Current edits will remain as an unsaved draft.",
            )
          : t(
              "永久删除这条运行记录？此操作无法撤销。",
              "Permanently delete this run? This cannot be undone.",
            ),
      action: () =>
        perform(async () => {
          await api.remove(kind, id);
          if (kind === "drafts") {
            setDrafts((current) => current.filter((d) => d.id !== id));
            if (draftId === id) {
              setDraftId(undefined);
              setSaved("");
            }
          } else {
            setExperiments((current) => current.filter((e) => e.id !== id));
            setSelected((current) => current.filter((value) => value !== id));
            if (experiment?.id === id) {
              setExperiment(null);
              setResponse("");
              setValidation(null);
            }
          }
          notify(t("已删除", "Deleted"));
        }),
    });
  }
  async function validate() {
    if (!experiment || validating) return;
    setValidating(true);
    try {
      setValidation(await api.validate(response, experiment.prompt.input));
      notify(t("校验已更新", "Validation updated"));
    } catch (error) {
      notify(errorText(error), true);
    } finally {
      setValidating(false);
    }
  }
  function exportZip() {
    void perform(async () => {
      const blob = await api.export();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "prompt-workbench.zip";
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify(t("导出文件已下载", "Export downloaded"));
    });
  }
  const validTokens =
    Number.isInteger(prompt.maxTokens) &&
    prompt.maxTokens >= 1 &&
    prompt.maxTokens <= (config?.maxOutputTokens ?? 4096);
  const runnable =
    !!config?.configured &&
    !loadError &&
    !!prompt.instruction.trim() &&
    !!prompt.input.trim() &&
    !!prompt.outputRequirements.trim() &&
    validTokens;
  const runReason = !config?.configured
    ? t("模型服务尚未配置", "Model service is not configured")
    : !runnable
      ? t(
          "请填写指令、报障、输出约束，并检查参数",
          "Fill instruction, incident and output requirements; check parameters",
        )
      : t("运行实验", "Run experiment");

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <TerminalSquare size={23} />
          </span>
          <div>
            <h1>{t("提示词工作台", "Prompt Workbench")}</h1>
            <p>
              {t(
                "校园云服务 / 报障结构化",
                "Campus cloud / Incident extraction",
              )}
            </p>
          </div>
        </div>
        <div className="top-actions">
          <button
            className="icon"
            aria-label={t("切换为英文", "Switch to Chinese")}
            title={t("切换为英文", "Switch to Chinese")}
            onClick={() => {
              const next = lang === "zh" ? "en" : "zh";
              setCurrentLocale(next);
              setLang(next);
            }}
          >
            <Languages size={18} />
            <span>{lang === "zh" ? "EN" : "中"}</span>
          </button>
          <button
            className="icon"
            title={t("参数设置", "Parameters")}
            aria-label={t("参数设置", "Parameters")}
            onClick={() => setSettings(true)}
            disabled={locked}
          >
            <SlidersHorizontal size={18} />
          </button>
          <button
            className="secondary export-button"
            aria-label={t("导出", "Export")}
            title={t("导出", "Export")}
            onClick={() => {
              if (dirty || responseDirty)
                setConfirmation({
                  message: t(
                    "导出仅包含服务端已保存的内容，不包含当前未保存编辑。继续导出？",
                    "Export contains server-saved content only, excluding current unsaved edits. Continue?",
                  ),
                  action: exportZip,
                });
              else exportZip();
            }}
            disabled={locked || !!loadError}
          >
            <Download size={16} />
            <span>{t("导出", "Export")}</span>
          </button>
          <button
            className="secondary"
            onClick={saveDraft}
            disabled={locked || !name.trim() || !validTokens || !!loadError}
          >
            <Save size={16} />
            <span>{t("保存", "Save")}</span>
          </button>
          {running ? (
            <button
              className="primary cancel"
              onClick={() => controller.current?.abort()}
            >
              <Square size={15} />
              {t("取消", "Cancel")}
            </button>
          ) : (
            <button
              className="primary"
              title={runReason}
              onClick={() => guard(() => void run(), true)}
              disabled={locked || !runnable}
            >
              <Play size={16} fill="currentColor" />
              {t("运行", "Run")}
            </button>
          )}
        </div>
      </header>
      <div className="connection-bar">
        <span>
          <i
            className={`dot ${config?.configured && !loadError ? "green" : "orange"}`}
          />
          {loading || localeLoading
            ? t("连接中…", "Connecting…")
            : loadError
              ? t("连接失败", "Connection failed")
              : config?.configured
                ? config.model
                : t("模型未配置", "Model not configured")}
        </span>
        <span className="connection-actions">
          {busy && <LoaderCircle size={14} className="spin" />}
          <button
            className="text-button"
            onClick={() => void refresh()}
            disabled={locked}
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} />
            {t("刷新", "Refresh")}
          </button>
        </span>
      </div>
      {loadError && (
        <div className="connection-error" role="alert">
          <strong>{t("无法读取工作台数据", "Unable to load workspace")}</strong>
          <p>{loadError}</p>
          <button
            className="secondary"
            onClick={() => void refresh()}
            disabled={loading}
          >
            {t("重试连接", "Retry connection")}
          </button>
        </div>
      )}
      {loading && !config ? (
        <main
          className="loading-workspace"
          aria-busy="true"
          aria-label={t("加载工作台", "Loading workspace")}
        >
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton" />
        </main>
      ) : (
        <main className="workspace">
          <Library
            samples={samples}
            drafts={drafts}
            experiments={experiments}
            selected={selected}
            activeDraft={draftId}
            activeExperiment={experiment?.id}
            locked={locked || !!loadError}
            t={t}
            onNew={() => guard(() => loadPrompt(newPrompt(), ""))}
            onSample={(sample) =>
              guard(() => {
                loadPrompt(
                  {
                    ...newPrompt(),
                    input: sample.input,
                    maxTokens: Math.min(4096, config?.maxOutputTokens ?? 4096),
                  },
                  sample.title,
                );
                setSaved("");
              })
            }
            onDraft={(draft) =>
              guard(() => loadPrompt(draft, draft.name, draft.id))
            }
            onHistory={(id) =>
              guard(
                () =>
                  void perform(async () =>
                    showExperiment(await api.experiment(id)),
                  ),
                true,
              )
            }
            onDelete={remove}
            onSelect={(id) =>
              setSelected((current) =>
                current.includes(id)
                  ? current.filter((value) => value !== id)
                  : [...current, id].slice(0, 2),
              )
            }
            onCompare={() =>
              void perform(async () =>
                setComparison(
                  await Promise.all(selected.map((id) => api.experiment(id))),
                ),
              )
            }
          />
          <Editor
            prompt={prompt}
            name={name}
            dirty={dirty}
            savedDraft={!!draftId}
            locked={locked}
            onName={setName}
            onChange={setPrompt}
            onSettings={() => setSettings(true)}
            t={t}
          />
          <Result
            experiment={experiment}
            response={response}
            validation={validation}
            edited={responseDirty}
            running={running}
            validating={validating}
            locked={locked}
            t={t}
            onResponse={(text) => {
              setResponse(text);
              setValidation(null);
            }}
            onValidate={() => void validate()}
            onCopy={() =>
              void perform(async () => {
                await navigator.clipboard.writeText(response);
                notify(t("已复制响应", "Response copied"));
              })
            }
            onRestore={() =>
              experiment &&
              guard(() => {
                setPrompt(promptOf(experiment.prompt));
                setDraftId(undefined);
                setName(t("历史实验副本", "Copy of experiment"));
                setSaved("");
              })
            }
          />
        </main>
      )}
      {settings && (
        <Overlay
          drawer
          title={t("运行参数", "Run parameters")}
          closeLabel={t("关闭", "Close")}
          onClose={() => setSettings(false)}
        >
          <div className="setting-model">
            <span className="eyebrow">MODEL</span>
            <h3>{config?.model || "—"}</h3>
            <span className={`status ${config?.configured ? "" : "amber"}`}>
              {config?.configured
                ? t("已连接", "Connected")
                : t("未配置", "Not configured")}
            </span>
          </div>
          <label className="setting-field">
            {t("最大输出 Token", "Maximum output tokens")}
            <input
              type="number"
              min={1}
              max={config?.maxOutputTokens ?? 4096}
              step={1}
              value={prompt.maxTokens || ""}
              disabled={locked || !config?.capabilities.maxTokens}
              onChange={(e) =>
                setPrompt({ ...prompt, maxTokens: Number(e.target.value) })
              }
            />
          </label>
          <p className={validTokens ? "muted" : "field-error"}>
            {t("可用范围", "Allowed range")}: 1–
            {config?.maxOutputTokens ?? 4096}
          </p>
          <div className="unsupported">
            <span>Temperature</span>
            <span>{t("当前模型不开放", "Unavailable for this model")}</span>
          </div>
          <div className="unsupported">
            <span>Top P</span>
            <span>{t("当前模型不开放", "Unavailable for this model")}</span>
          </div>
          <button
            className="primary setting-done"
            onClick={() => setSettings(false)}
            disabled={!validTokens}
          >
            {t("完成", "Done")}
          </button>
        </Overlay>
      )}
      {confirmation && (
        <Overlay
          title={t("确认操作", "Confirm action")}
          closeLabel={t("取消", "Cancel")}
          onClose={() => setConfirmation(null)}
        >
          <p className="confirm-message">{confirmation.message}</p>
          <div className="dialog-actions">
            <button className="secondary" onClick={() => setConfirmation(null)}>
              {t("取消", "Cancel")}
            </button>
            <button
              className="primary"
              onClick={() => {
                const action = confirmation.action;
                setConfirmation(null);
                void action();
              }}
            >
              {t("确认", "Confirm")}
            </button>
          </div>
        </Overlay>
      )}
      {comparison && (
        <Compare
          records={comparison}
          onClose={() => setComparison(null)}
          t={t}
        />
      )}
      {notice && (
        <div
          className={`toast ${notice.error ? "error" : ""}`}
          role={notice.error ? "alert" : "status"}
        >
          <span>{notice.message}</span>
          <button
            className="icon"
            aria-label={t("关闭反馈", "Dismiss notification")}
            onClick={() => setNotice(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}
