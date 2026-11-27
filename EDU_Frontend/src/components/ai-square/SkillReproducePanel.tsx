import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Check,
  Code2,
  Copy,
  Download,
  FileCode2,
  FlaskConical,
  Terminal,
} from 'lucide-react';
import {
  buildCurlSnippet,
  buildPythonSnippet,
  buildSkillMarkdown,
} from '@/data/agentHubSkills';
import type { AgentHubSkill } from '@/types/agentHub';
import { copyText } from '@/utils/clipboard';

interface SkillReproducePanelProps {
  skill: AgentHubSkill;
  inputValues: Record<string, string>;
}

export const SkillReproducePanel: React.FC<SkillReproducePanelProps> = ({
  skill,
  inputValues,
}) => {
  const navigate = useNavigate();
  const [codeLang, setCodeLang] = useState<'python' | 'curl'>('python');
  const [copiedMd, setCopiedMd] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const skillMarkdown = useMemo(() => buildSkillMarkdown(skill), [skill]);
  const apiSnippet = useMemo(
    () =>
      codeLang === 'python'
        ? buildPythonSnippet(skill, inputValues)
        : buildCurlSnippet(skill, inputValues),
    [codeLang, skill, inputValues]
  );

  const handleCopyMarkdown = async () => {
    const ok = await copyText(skillMarkdown);
    if (ok) {
      setCopiedMd(true);
      setTimeout(() => setCopiedMd(false), 2000);
    }
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([skillMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${skill.slug}.SKILL.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyCode = async () => {
    const ok = await copyText(apiSnippet);
    if (ok) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 卡片 1：标准 SKILL.md 导出 */}
        <section className="flex flex-col rounded-3xl border border-white/70 bg-white/85 p-6 shadow-[0_8px_28px_rgba(15,23,42,0.05)] backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <FileCode2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">标准 SKILL.md 能力包</h3>
                <p className="text-xs text-slate-500">可直接导入本地 Agent / IDE / OpenClaw 工作区</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyMarkdown}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {copiedMd ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedMd ? '已复制' : '复制'}
              </button>
              <button
                type="button"
                onClick={handleDownloadMarkdown}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
              >
                <Download className="h-3.5 w-3.5" />
                下载 .md
              </button>
            </div>
          </div>

          <pre className="mt-4 max-h-[380px] flex-1 overflow-auto whitespace-pre-wrap rounded-2xl bg-[#0d1117] p-4 font-mono text-xs leading-relaxed text-slate-100">
            {skillMarkdown}
          </pre>
        </section>

        {/* 卡片 2：DeepSeek / 百炼 API 调用脚本 */}
        <section className="flex flex-col rounded-3xl border border-white/70 bg-white/85 p-6 shadow-[0_8px_28px_rgba(15,23,42,0.05)] backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <Terminal className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">一键复现调用代码</h3>
                <p className="text-xs text-slate-500">已自动填入你在 Playground 中的最新输入参数</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-full bg-slate-100 p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setCodeLang('python')}
                  className={`rounded-full px-3 py-1 transition ${
                    codeLang === 'python' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Python
                </button>
                <button
                  type="button"
                  onClick={() => setCodeLang('curl')}
                  className={`rounded-full px-3 py-1 transition ${
                    codeLang === 'curl' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  cURL
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-700"
              >
                {copiedCode ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedCode ? '已复制' : '复制代码'}
              </button>
            </div>
          </div>

          <pre className="mt-4 max-h-[380px] flex-1 overflow-auto rounded-2xl bg-[#0d1117] p-4 font-mono text-xs leading-relaxed text-slate-100">
            {apiSnippet}
          </pre>
        </section>
      </div>

      {/* 底部卡片 3：动手改造挑战 + 关联课程直达 */}
      <section className="rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-50/80 via-white to-violet-50/70 p-6 shadow-sm md:p-7">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-primary-700 shadow-sm">
              <FlaskConical className="h-3.5 w-3.5" />
              课后动手改造挑战
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-700 md:text-base">
              {skill.labChallenge}
            </p>
            <div className="mt-3 inline-flex items-center gap-2 text-xs text-slate-500">
              <BookOpen className="h-3.5 w-3.5 text-primary-600" />
              配套课程：<strong className="text-slate-800">{skill.relatedCourseTitle}</strong>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate('/study')}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-primary-600"
            >
              <Code2 className="h-4 w-4" />
              前往学习中心复现
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
