import React from 'react';
import { AlertCircle, CheckCircle2, Clock3, Eye, ShieldCheck, XCircle } from 'lucide-react';
import PageDrawer from '@/components/common/PageDrawer';
import type { PublishCheckResult, CheckIssue } from '@/services/publishing';

interface PublishCheckDrawerProps {
  isOpen: boolean;
  title: string;
  result: PublishCheckResult | null;
  loading?: boolean;
  preview?: React.ReactNode;
  onClose: () => void;
}

const IssueList: React.FC<{ title: string; items: CheckIssue[]; tone: 'error' | 'warning' }> = ({ title, items, tone }) => {
  const Icon = tone === 'error' ? XCircle : AlertCircle;
  const boxClass = tone === 'error' ? 'border-rose-100 bg-rose-50 text-rose-700' : 'border-amber-100 bg-amber-50 text-amber-700';

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
        {title}：暂无
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-bold text-slate-800">{title} ({items.length})</div>
      {items.map((item, index) => (
        <div key={`${item.code}-${item.resourceId || index}`} className={`rounded-2xl border px-4 py-3 ${boxClass}`}>
          <div className="flex items-start gap-3">
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-semibold">{item.scope || item.code}</div>
              <div className="mt-1 text-sm leading-relaxed">{item.message}</div>
              {item.resourceName && <div className="mt-1 text-xs opacity-80">关联资源：{item.resourceName}</div>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const PublishCheckDrawer: React.FC<PublishCheckDrawerProps> = ({ isOpen, title, result, loading, preview, onClose }) => {
  return (
    <PageDrawer isOpen={isOpen} onClose={onClose} panelClassName="max-w-3xl">
      <div className="flex min-h-full flex-col bg-slate-50">
        <div className="border-b border-slate-200 bg-white px-8 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary-500">
                <ShieldCheck className="h-4 w-4" />
                发布治理
              </div>
              <h2 className="mt-2 text-2xl font-black text-slate-900">{title}</h2>
              <p className="mt-2 text-sm text-slate-500">发布前检查会覆盖结构、手册、验证规则、Lab 模板和关键运行入口。</p>
            </div>
            {result && (
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${result.canPublish ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                {result.canPublish ? '可发布' : '需修复'}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-8">
          {loading && (
            <div className="card-surface rounded-3xl p-8 text-center text-sm text-slate-500">
              正在运行发布检查...
            </div>
          )}

          {!loading && result && (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="card-surface rounded-2xl p-4">
                  <div className="text-xs font-bold text-slate-400">阻断项</div>
                  <div className="mt-2 text-2xl font-black text-rose-600">{result.errors.length}</div>
                </div>
                <div className="card-surface rounded-2xl p-4">
                  <div className="text-xs font-bold text-slate-400">警告项</div>
                  <div className="mt-2 text-2xl font-black text-amber-500">{result.warnings.length}</div>
                </div>
                <div className="card-surface rounded-2xl p-4">
                  <div className="text-xs font-bold text-slate-400">检查时间</div>
                  <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <Clock3 className="h-4 w-4 text-slate-400" />
                    {result.checkedAt ? new Date(result.checkedAt).toLocaleString('zh-CN') : '刚刚'}
                  </div>
                </div>
              </div>

              <div className="card-surface rounded-3xl p-5">
                <div className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  检查摘要
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {Object.entries(result.summary || {}).map(([key, value]) => (
                    <div key={key} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                      <span className="font-semibold text-slate-500">{key}</span>
                      <span className="ml-2 text-slate-900">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <IssueList title="发布阻断" items={result.errors || []} tone="error" />
              <IssueList title="发布警告" items={result.warnings || []} tone="warning" />
            </>
          )}

          {preview && (
            <div className="card-surface rounded-3xl p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800">
                <Eye className="h-4 w-4 text-primary-500" />
                学生视角预览
              </div>
              {preview}
            </div>
          )}
        </div>
      </div>
    </PageDrawer>
  );
};

export default PublishCheckDrawer;
