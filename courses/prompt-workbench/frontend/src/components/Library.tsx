import { useState } from "react";
import {
  BookOpen,
  Clock3,
  Files,
  GitCompareArrows,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import type { Draft, Experiment, Sample, Translate } from "../types";

export function Library({
  samples,
  drafts,
  experiments,
  selected,
  activeDraft,
  activeExperiment,
  locked,
  t,
  onSample,
  onDraft,
  onHistory,
  onDelete,
  onSelect,
  onNew,
  onCompare,
}: {
  samples: Sample[];
  drafts: Draft[];
  experiments: Experiment[];
  selected: string[];
  activeDraft?: string;
  activeExperiment?: string;
  locked: boolean;
  t: Translate;
  onSample: (sample: Sample) => void;
  onDraft: (draft: Draft) => void;
  onHistory: (id: string) => void;
  onDelete: (kind: "drafts" | "experiments", id: string) => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onCompare: () => void;
}) {
  const [query, setQuery] = useState("");
  const matches = (text: string) =>
    text.toLowerCase().includes(query.toLowerCase());
  const visibleDrafts = drafts.filter((d) => matches(d.name + d.input));
  const visibleSamples = samples.filter((s) => matches(s.title + s.input));
  const visibleExperiments = experiments.filter((e) =>
    matches(e.prompt.input + e.model + e.id),
  );
  return (
    <aside className="library" aria-label={t("实验资料", "Experiment library")}>
      <div className="library-title">
        <span className="eyebrow">LIBRARY</span>
        <button
          className="icon"
          title={t("新建草稿", "New draft")}
          aria-label={t("新建草稿", "New draft")}
          onClick={onNew}
          disabled={locked}
        >
          <Plus size={19} />
        </button>
      </div>
      <label className="search">
        <Search size={16} />
        <input
          aria-label={t("搜索资料", "Search library")}
          placeholder={t("搜索样例、草稿、历史", "Search library")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <details open>
        <summary>
          <BookOpen size={16} />
          {t("报障样例", "Incident samples")}
          <span>{samples.length}</span>
        </summary>
        {visibleSamples.map((s, i) => (
          <button
            className="sample-row"
            key={s.id}
            disabled={locked}
            onClick={() => onSample(s)}
            title={s.description}
          >
            <span className="sample-number">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span>
              <strong>{s.title}</strong>
              <small>{s.description}</small>
            </span>
          </button>
        ))}
        {!visibleSamples.length && (
          <p className="empty-small">
            {t("暂无匹配样例", "No matching samples")}
          </p>
        )}
      </details>
      <details open>
        <summary>
          <Files size={16} />
          {t("我的草稿", "My drafts")}
          <span>{drafts.length}</span>
        </summary>
        {visibleDrafts.map((d) => (
          <div
            className={`library-row ${activeDraft === d.id ? "active" : ""}`}
            key={d.id}
          >
            <button
              className="row-main"
              onClick={() => onDraft(d)}
              disabled={locked}
            >
              <strong>{d.name}</strong>
              <small>{new Date(d.updatedAt).toLocaleString()}</small>
            </button>
            <button
              className="icon subtle"
              title={t("删除草稿", "Delete draft")}
              aria-label={`${t("删除草稿", "Delete draft")} ${d.name}`}
              disabled={locked}
              onClick={() => onDelete("drafts", d.id)}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {!visibleDrafts.length && (
          <p className="empty-small">
            {t("暂无匹配草稿", "No matching drafts")}
          </p>
        )}
      </details>
      <details open>
        <summary>
          <Clock3 size={16} />
          {t("运行历史", "Run history")}
          <span>{experiments.length}</span>
        </summary>
        <div className="history-tools">
          <small>{t("最近 100 条", "Latest 100 runs")}</small>
          <button
            className="text-button"
            disabled={selected.length !== 2 || locked}
            onClick={onCompare}
          >
            <GitCompareArrows size={15} />
            {t("对比", "Compare")} {selected.length}/2
          </button>
        </div>
        {visibleExperiments.map((e) => (
          <div
            className={`library-row ${activeExperiment === e.id ? "active" : ""}`}
            key={e.id}
          >
            <input
              type="checkbox"
              aria-label={`${t("选择对比", "Select for comparison")} ${e.id}`}
              checked={selected.includes(e.id)}
              disabled={
                locked || (selected.length === 2 && !selected.includes(e.id))
              }
              onChange={() => onSelect(e.id)}
            />
            <button
              className="row-main"
              disabled={locked}
              onClick={() => onHistory(e.id)}
            >
              <strong>{e.prompt.input || e.id}</strong>
              <small>
                <i
                  className={`dot ${e.validation.valid ? "green" : "orange"}`}
                />
                {new Date(e.createdAt).toLocaleString()}
              </small>
            </button>
            <button
              className="icon subtle"
              title={t("删除记录", "Delete run")}
              aria-label={`${t("删除记录", "Delete run")} ${e.id}`}
              disabled={locked}
              onClick={() => onDelete("experiments", e.id)}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {!visibleExperiments.length && (
          <p className="empty-small">
            {t("暂无匹配运行记录", "No matching runs")}
          </p>
        )}
      </details>
    </aside>
  );
}
