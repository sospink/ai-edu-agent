import React, { useEffect, useState } from 'react';
import { ClipboardCheck, Eye, Loader2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { teacherAssignmentApi, type SubmissionListItem } from '@/services/assignment';
import { teacherClassApi } from '@/services/teacherClass';
import type { ClassItem } from '@/services/classroom';
import { ToolbarSearchField, ToolbarSelect } from '@/components/common/ToolbarControls';

const statusMeta: Record<string, { label: string; className: string }> = {
  submitted: { label: '待批改', className: 'bg-cyan-50 text-cyan-700' },
  resubmitted: { label: '重提交', className: 'bg-blue-50 text-blue-700' },
  returned: { label: '已退回', className: 'bg-amber-50 text-amber-700' },
  graded: { label: '已评分', className: 'bg-violet-50 text-violet-700' },
};

const gradeStatusLabel: Record<string, string> = {
  pending: '待验证',
  auto_checked: '已快照',
  reviewed: '已复核',
  published: '已发布',
};

const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString('zh-CN') : '未设置');

const TeacherSubmissionsPage: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<SubmissionListItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [classId, setClassId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const response = await teacherAssignmentApi.getSubmissions({
      page: 1,
      pageSize: 50,
      q: keyword,
      status: status || undefined,
      classId: classId ? Number(classId) : undefined,
    });
    if (response.success && response.data) {
      setItems(response.data.list);
      setTotal(response.data.total);
    } else {
      setItems([]);
      setTotal(0);
      setError(response.error || '获取待批改队列失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    void teacherClassApi.getList({ page: 1, pageSize: 100, status: 1 }).then((response) => {
      if (response.success && response.data) setClasses(response.data.list);
    });
    void loadData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="card-surface overflow-hidden rounded-3xl">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-900 p-6 text-white">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-cyan-100">
            <ClipboardCheck className="h-3.5 w-3.5" />
            M4 批改队列
          </div>
          <h1 className="mt-3 text-2xl font-bold">待批改提交</h1>
          <p className="mt-2 text-sm text-slate-300">查看学生提交、验证快照和评分发布状态。</p>
        </div>

        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row">
          <ToolbarSearchField
            value={keyword}
            onChange={setKeyword}
            onEnter={() => void loadData()}
            placeholder="搜索作业、学生姓名或账号"
            className="flex-1"
          />
          <ToolbarSelect
            ariaLabel="按提交状态筛选"
            value={status || 'all'}
            onChange={(value) => setStatus(value === 'all' ? '' : value)}
            options={[
              { key: 'all', label: '全部提交状态' },
              { key: 'submitted', label: '待批改' },
              { key: 'resubmitted', label: '重提交' },
              { key: 'returned', label: '已退回' },
              { key: 'graded', label: '已评分' },
            ]}
            className="lg:w-52"
          />
          <ToolbarSelect
            ariaLabel="按班级筛选"
            value={classId || 'all'}
            onChange={(value) => setClassId(value === 'all' ? '' : value)}
            options={[
              { key: 'all', label: '全部班级' },
              ...classes.map((item) => ({ key: String(item.id), label: item.name })),
            ]}
            className="lg:w-52"
          />
          <button onClick={() => void loadData()} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" />
            刷新
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex h-48 items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />加载提交队列...</div>
          ) : error ? (
            <div className="rounded-2xl bg-rose-50 p-5 text-sm font-medium text-rose-700">{error}</div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500">当前没有符合条件的提交。</div>
          ) : (
            <div className="card-surface-muted overflow-hidden rounded-2xl">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3">作业 / 学生</th>
                    <th className="px-4 py-3">提交状态</th>
                    <th className="px-4 py-3">评分状态</th>
                    <th className="px-4 py-3">提交时间</th>
                    <th className="px-4 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => {
                    const meta = statusMeta[item.status] || statusMeta.submitted;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="min-w-0 px-4 py-3">
                          <div className="truncate font-bold text-slate-900">{item.assignmentTitle}</div>
                          <div className="truncate text-xs text-slate-400">{item.studentName || item.studentUsername} · 第 {item.attemptNo} 次</div>
                        </td>
                        <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${meta.className}`}>{meta.label}</span></td>
                        <td className="px-4 py-3 text-slate-600">{gradeStatusLabel[item.gradeStatus] || item.gradeStatus}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDateTime(item.submittedAt)}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => navigate(`/teacher/submissions/${item.id}`)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-white">
                            <Eye className="h-3.5 w-3.5" />
                            批改
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 text-xs font-medium text-slate-400">共 {total} 条提交</div>
        </div>
      </div>
    </div>
  );
};

export default TeacherSubmissionsPage;
