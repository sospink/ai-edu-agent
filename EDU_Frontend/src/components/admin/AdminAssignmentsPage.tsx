import React, { useEffect, useState } from 'react';
import { ClipboardList, Loader2, RefreshCw, TrendingUp } from 'lucide-react';
import { adminAssignmentApi, type AssignmentListItem, type AssignmentOverview, type TeachingQualityOverview } from '@/services/assignment';
import { ToolbarSearchField, ToolbarSelect } from '@/components/common/ToolbarControls';

const statusMeta: Record<number, { label: string; className: string }> = {
  0: { label: '草稿', className: 'bg-slate-100 text-slate-600' },
  1: { label: '已发布', className: 'bg-emerald-50 text-emerald-700' },
  2: { label: '已关闭', className: 'bg-amber-50 text-amber-700' },
  3: { label: '已归档', className: 'bg-zinc-100 text-zinc-500' },
};

const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString('zh-CN') : '未设置');

const AdminAssignmentsPage: React.FC = () => {
  const [overview, setOverview] = useState<AssignmentOverview | null>(null);
  const [quality, setQuality] = useState<TeachingQualityOverview | null>(null);
  const [assignments, setAssignments] = useState<AssignmentListItem[]>([]);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const [overviewResp, qualityResp, listResp] = await Promise.all([
      adminAssignmentApi.overview(),
      adminAssignmentApi.teachingQualityOverview(),
      adminAssignmentApi.getList({ page: 1, pageSize: 50, q: keyword, status: statusFilter ? Number(statusFilter) : undefined }),
    ]);
    if (overviewResp.success && overviewResp.data) {
      setOverview(overviewResp.data);
    }
    if (qualityResp.success && qualityResp.data) {
      setQuality(qualityResp.data);
    }
    if (listResp.success && listResp.data) {
      setAssignments(listResp.data.list);
    } else {
      setAssignments([]);
      setError(listResp.error || '获取作业观测列表失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="card-surface overflow-hidden rounded-3xl">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-900 p-6 text-white">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-sky-100">
            <ClipboardList className="h-3.5 w-3.5" />
            M3 作业观测
          </div>
          <h1 className="mt-3 text-2xl font-bold">作业任务分布</h1>
          <p className="mt-2 text-sm text-slate-300">管理员首版只读观测，不代替教师编辑作业。</p>
        </div>

        <div className="grid gap-3 p-5 md:grid-cols-5">
          {[
            ['全部', overview?.total || 0],
            ['草稿', overview?.draft || 0],
            ['已发布', overview?.published || 0],
            ['已关闭', overview?.closed || 0],
            ['已逾期', overview?.overdue || 0],
            ['已提交', overview?.submitted || 0],
            ['待批改', overview?.pendingReview || 0],
            ['已退回', overview?.returned || 0],
            ['已评分', overview?.graded || 0],
            ['成绩发布', overview?.publishedGrades || 0],
          ].map(([label, value]) => (
            <div key={label} className="card-surface-muted rounded-2xl p-4">
              <div className="text-xs font-bold text-slate-400">{label}</div>
              <div className="mt-2 text-2xl font-black text-slate-900">{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card-surface overflow-hidden rounded-3xl">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <TrendingUp className="h-4 w-4 text-sky-600" />
          <div>
            <h2 className="font-bold text-slate-900">教学质量观测</h2>
            <p className="mt-1 text-xs text-slate-500">M5 管理端只读聚合，不接管教师提醒、退回、评分或重开。</p>
          </div>
        </div>
        <div className="grid gap-3 p-5 md:grid-cols-6">
          {[
            ['有效作业', quality?.assignments || 0],
            ['待批改', quality?.pendingReview || 0],
            ['逾期未交', quality?.overdueMissing || 0],
            ['风险学生', quality?.riskStudents || 0],
            ['提醒次数', quality?.remindersSent || 0],
            ['重开授权', quality?.reopenGrants || 0],
            ['成绩发布', quality?.publishedGrades || 0],
          ].map(([label, value]) => (
            <div key={label} className="card-surface-muted rounded-2xl p-4">
              <div className="text-xs font-bold text-slate-400">{label}</div>
              <div className="mt-2 text-2xl font-black text-slate-900">{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card-surface rounded-3xl">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row">
          <ToolbarSearchField
            value={keyword}
            onChange={setKeyword}
            onEnter={() => void loadData()}
            placeholder="搜索作业"
            className="flex-1"
          />
          <ToolbarSelect
            ariaLabel="按作业状态筛选"
            value={statusFilter || 'all'}
            onChange={(value) => setStatusFilter(value === 'all' ? '' : value)}
            options={[
              { key: 'all', label: '全部状态' },
              { key: '0', label: '草稿' },
              { key: '1', label: '已发布' },
              { key: '2', label: '已关闭' },
            ]}
            className="md:w-52"
          />
          <button onClick={() => void loadData()} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" />
            刷新
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex h-44 items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />加载作业观测数据...</div>
          ) : error ? (
            <div className="rounded-2xl bg-rose-50 p-4 text-sm font-medium text-rose-700">{error}</div>
          ) : assignments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">暂无作业任务。</div>
          ) : (
            <div className="card-surface-muted overflow-hidden rounded-2xl">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3">作业</th>
                    <th className="px-4 py-3">状态</th>
                    <th className="px-4 py-3">教师</th>
                    <th className="px-4 py-3">班级/学生</th>
                    <th className="px-4 py-3">截止</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignments.map((item) => {
                    const meta = statusMeta[item.status] || statusMeta[0];
                    return (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3"><div className="font-bold text-slate-900">{item.title}</div><div className="text-xs text-slate-400">{item.resourceCount} 个资源</div></td>
                        <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${meta.className}`}>{meta.label}</span></td>
                        <td className="px-4 py-3 text-slate-600">{item.creatorName || `#${item.creatorId}`}</td>
                        <td className="px-4 py-3 text-slate-600">{item.classCount} 班 / {item.studentCount} 人</td>
                        <td className="px-4 py-3 text-slate-600">{formatDateTime(item.dueAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAssignmentsPage;
