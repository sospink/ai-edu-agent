import { FilePenLine, SlidersHorizontal } from "lucide-react";
import type { Prompt, Translate } from "../types";

export function Editor({
  prompt,
  name,
  dirty,
  savedDraft,
  locked,
  onName,
  onChange,
  onSettings,
  t,
}: {
  prompt: Prompt;
  name: string;
  dirty: boolean;
  savedDraft: boolean;
  locked: boolean;
  onName: (name: string) => void;
  onChange: (prompt: Prompt) => void;
  onSettings: () => void;
  t: Translate;
}) {
  const fields = [
    ["instruction", t("任务指令", "Instruction"), "01"],
    ["context", t("背景与边界", "Context & boundaries"), "02"],
    ["input", t("原始报障", "Incident input"), "03"],
    ["outputRequirements", t("输出约束", "Output requirements"), "04"],
  ] as const;
  return (
    <section
      className="editor pane"
      aria-label={t("提示词编辑", "Prompt editor")}
    >
      <div className="pane-heading">
        <div>
          <span className="eyebrow">PROMPT</span>
          <h2>
            <FilePenLine size={18} />
            {t("提示词编辑", "Prompt editor")}
          </h2>
        </div>
        <span className={`status ${dirty ? "amber" : ""}`}>
          {dirty
            ? t("未保存", "Unsaved")
            : savedDraft
              ? t("已保存", "Saved")
              : t("就绪", "Ready")}
        </span>
      </div>
      <label className="name-field">
        <span>{t("草稿名称", "Draft name")}</span>
        <input
          maxLength={120}
          value={name}
          disabled={locked}
          onChange={(e) => onName(e.target.value)}
          placeholder={t("为这次实验命名", "Name this experiment")}
        />
      </label>
      <fieldset disabled={locked} className="prompt-fields">
        {fields.map(([key, label, number]) => (
          <label className={`prompt-field field-${key}`} key={key}>
            <span className="field-heading">
              <span>
                <b>{number}</b>
                {label}
              </span>
              <small>{prompt[key].length}</small>
            </span>
            <textarea
              aria-label={label}
              maxLength={key === "context" || key === "input" ? 64000 : 32000}
              value={prompt[key]}
              onChange={(e) => onChange({ ...prompt, [key]: e.target.value })}
              spellCheck={false}
              placeholder={
                key === "input"
                  ? t(
                      "选择左侧样例，或输入真实报障内容…",
                      "Choose a sample or enter an incident…",
                    )
                  : ""
              }
            />
          </label>
        ))}
      </fieldset>
      <footer className="editor-footer">
        <span>
          {t("校园云服务 · 结构化报障", "Campus cloud · Incident extraction")}
        </span>
        <button className="text-button" onClick={onSettings} disabled={locked}>
          <SlidersHorizontal size={15} />
          {prompt.maxTokens} tokens
        </button>
      </footer>
    </section>
  );
}
