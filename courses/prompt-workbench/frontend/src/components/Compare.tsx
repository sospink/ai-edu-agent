import type { Experiment, Translate } from "../types";
import { Overlay } from "./Overlay";
import { ValidationView } from "./Result";

export function Compare({
  records,
  onClose,
  t,
}: {
  records: Experiment[];
  onClose: () => void;
  t: Translate;
}) {
  return (
    <Overlay
      wide
      title={t("双记录对照", "Compare experiments")}
      closeLabel={t("关闭", "Close")}
      onClose={onClose}
    >
      <div className="comparison">
        {records.map((record, index) => (
          <article key={record.id}>
            <div className="compare-heading">
              <span className="compare-letter">{index === 0 ? "A" : "B"}</span>
              <div>
                <h3>{record.model}</h3>
                <small>{new Date(record.createdAt).toLocaleString()}</small>
              </div>
            </div>
            <div className="result-meta">
              <span>{record.latencyMs} ms</span>
              <span>{record.usage?.total_tokens ?? "—"} tokens</span>
              <span>{record.prompt.maxTokens} max</span>
            </div>
            <p className="request-id">Request · {record.requestId}</p>
            {(
              ["instruction", "context", "input", "outputRequirements"] as const
            ).map((key, i) => (
              <div
                key={key}
                className={`compare-field ${record.prompt[key] !== records[1 - index].prompt[key] ? "different" : ""}`}
              >
                <h4>
                  {
                    [
                      t("任务指令", "Instruction"),
                      t("背景与边界", "Context & boundaries"),
                      t("原始报障", "Incident input"),
                      t("输出约束", "Output requirements"),
                    ][i]
                  }
                  {record.prompt[key] !== records[1 - index].prompt[key] && (
                    <span>{t("有差异", "Different")}</span>
                  )}
                </h4>
                <pre>{record.prompt[key] || "—"}</pre>
              </div>
            ))}
            <h4>{t("响应原文", "Raw response")}</h4>
            <pre className="compare-response">{record.response}</pre>
            <ValidationView validation={record.validation} t={t} />
          </article>
        ))}
      </div>
    </Overlay>
  );
}
