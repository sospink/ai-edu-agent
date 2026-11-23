import {
  Check,
  CircleCheck,
  CircleX,
  Copy,
  FileJson,
  FlaskConical,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import type { Experiment, Translate, Validation } from "../types";

export function ValidationView({
  validation,
  t,
}: {
  validation: Validation;
  t: Translate;
}) {
  return (
    <div className="validation">
      <div className="validation-title">
        <ShieldCheck size={17} />
        <strong>{t("结构与证据校验", "Structure & evidence")}</strong>
        <span className={`status ${validation.valid ? "" : "amber"}`}>
          {validation.valid ? t("通过", "Passed") : t("需修正", "Needs review")}
        </span>
      </div>
      <ul className="checks">
        {validation.checks.map((check, i) => (
          <li key={i} className={check.passed ? "passed" : "failed"}>
            {check.passed ? <CircleCheck size={15} /> : <CircleX size={15} />}
            <span>{check.name}</span>
          </li>
        ))}
      </ul>
      {!!validation.issues.length && (
        <ul className="issues">
          {validation.issues.map((issue, i) => (
            <li key={i}>
              <code>{issue.path}</code> {issue.message}
            </li>
          ))}
        </ul>
      )}
      <p className="review-note">
        {t(
          "服务与症状的语义仍需人工复核；校验通过不代表所有事实均正确。",
          "Service and symptom semantics still require human review. Passing checks does not establish that every fact is correct.",
        )}
      </p>
    </div>
  );
}

export function Result({
  experiment,
  response,
  validation,
  edited,
  running,
  validating,
  locked,
  t,
  onResponse,
  onValidate,
  onCopy,
  onRestore,
}: {
  experiment: Experiment | null;
  response: string;
  validation: Validation | null;
  edited: boolean;
  running: boolean;
  validating: boolean;
  locked: boolean;
  t: Translate;
  onResponse: (text: string) => void;
  onValidate: () => void;
  onCopy: () => void;
  onRestore: () => void;
}) {
  let formatted: string | null = null;
  try {
    formatted = JSON.stringify(JSON.parse(response), null, 2);
  } catch {
    /* 原文保留在编辑区，结构错误由服务端校验返回。 */
  }
  return (
    <section className="result pane" aria-label={t("运行结果", "Run result")}>
      <div className="pane-heading">
        <div>
          <span className="eyebrow">RESPONSE</span>
          <h2>
            <FlaskConical size={18} />
            {t("运行结果", "Run result")}
          </h2>
        </div>
        {experiment && <span className="status">LIVE</span>}
      </div>
      {running ? (
        <div className="result-empty" role="status">
          <LoaderCircle className="spin" size={32} />
          <h3>{t("正在运行", "Running experiment")}</h3>
          <p>{t("等待模型响应…", "Waiting for the model…")}</p>
        </div>
      ) : !experiment ? (
        <div className="result-empty">
          <FileJson size={38} strokeWidth={1.3} />
          <h3>{t("等待第一次实验", "Ready for an experiment")}</h3>
          <p>{t("运行结果将在这里显示", "Your response will appear here")}</p>
          <div className="schema-preview">
            <span>service</span>
            <span>symptom</span>
            <span>evidence[]</span>
            <span>missing_fields[]</span>
          </div>
        </div>
      ) : (
        <>
          <div className="result-meta">
            <span>{experiment.model}</span>
            <span>{(experiment.latencyMs / 1000).toFixed(2)}s</span>
            <span>{experiment.usage?.total_tokens ?? "—"} tokens</span>
          </div>
          <p className="request-id" title={experiment.requestId}>
            Request · {experiment.requestId || "—"}
          </p>
          <div className="response-toolbar">
            <label htmlFor="response-text">
              {t("响应原文", "Raw response")}
              {edited && (
                <span className="edited">
                  {" "}
                  · {t("本地修改", "Local edits")}
                </span>
              )}
            </label>
            <button
              className="icon"
              title={t("复制响应", "Copy response")}
              aria-label={t("复制响应", "Copy response")}
              onClick={onCopy}
              disabled={!response}
            >
              <Copy size={16} />
            </button>
          </div>
          <textarea
            id="response-text"
            className="response-text"
            spellCheck={false}
            value={response}
            disabled={locked || validating}
            onChange={(e) => onResponse(e.target.value)}
          />
          <div className="response-actions">
            <button
              className="secondary"
              onClick={onValidate}
              disabled={locked || validating || !response.trim()}
            >
              {validating ? (
                <LoaderCircle className="spin" size={15} />
              ) : (
                <Check size={15} />
              )}
              {t("校验 JSON", "Validate JSON")}
            </button>
            <button
              className="text-button"
              onClick={onRestore}
              disabled={locked}
            >
              {t("载入本次提示词", "Load this prompt")}
            </button>
          </div>
          {validation ? (
            <ValidationView validation={validation} t={t} />
          ) : (
            <p className="empty-small">
              {t(
                "响应已修改，请重新校验。历史原始记录保持不变。",
                "Response edited. Validate again. The original history record is unchanged.",
              )}
            </p>
          )}
          <details className="json-view">
            <summary>
              <FileJson size={15} />
              {t("格式化 JSON", "Formatted JSON")}
            </summary>
            {formatted ? (
              <pre>{formatted}</pre>
            ) : (
              <p className="empty-small">
                {t(
                  "当前响应不是合法 JSON",
                  "The current response is not valid JSON",
                )}
              </p>
            )}
          </details>
        </>
      )}
    </section>
  );
}
