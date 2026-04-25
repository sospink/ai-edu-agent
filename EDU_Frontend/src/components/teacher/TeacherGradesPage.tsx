import React, { useEffect, useMemo, useState } from 'react';
import { Award, Download, Eye, Loader2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { teacherAssignmentApi, type GradeStatus, type TeacherGradeItem } from '@/services/assignment';
import { teacherClassApi } from '@/services/teacherClass';
import type { ClassItem } from '@/services/classroom';
import { ToolbarSearchField, ToolbarSelect } from '@/components/common/ToolbarControls';

const gradeStatusLabel: Record<GradeStatus, string> = {
  pending: '待评分',
  auto_checked: '已快照',
  reviewed: '已复核',
  published: '已发布',
};

const gradeStatusClass: Record<GradeStatus, string> = {
  pending: 'bg-slate-100 text-slate-600',
  auto_checked: 'bg-cyan-50 text-cyan-700',
  reviewed: 'bg-violet-50 text-violet-700',
  published: 'bg-emerald-50 text-emerald-700',
};

const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '未发布');

const TeacherGradesPage: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<TeacherGradeItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [gradeStatus, setGradeStatus] = useState('');
  const [classId, setClassId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const response = await teacherAssignmentApi.grades({
      page: 1,
      pageSize: 80,
      q: keyword,
      gradeStatus,
      classId: classId ? Number(classId) : undefined,
    });
    if (response.success && response.data) {
      setItems(response.data.list);
      setTotal(response.data.total);
    } else {
      setItems([]);
      setTotal(0);
      setError(response.error || '获取成绩簿失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    void teacherClassApi.getList({ page: 1, pageSize: 100, status: 1 }).then((response) => {
      if (response.success && response.data) setClasses(response.data.list);
    });
    void load();
  }, []);

  const averageScore = useMemo(() => {
    if (items.length === 0) return 0;
    const totalScore = items.reduce((sum, item) => sum + (item.maxScore > 0 ? item.score / item.maxScore : 0), 0);
    return Math.round((totalScore / items.length) * 100);
  }, [items]);

  const downloadCSV = () => {
    const rows = [
      ['作业', '班级', '学生', '账号', '分数', '满分', '状态', '发布时间', '更新时间'],
      ...items.map((item) => [
        item.assignmentTitle,
        item.className,
        item.studentName,
        item.studentUsername,
        String(item.score),
        String(item.maxScore),
        gradeStatusLabel[item.status] || item.status,
        formatDateTime(item.publishedAt),
        formatDateTime(item.updatedAt),
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `teacher-grades-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="card-surface overflow-hidden rounded-3xl">
        <div className="border-b border-slate-100 bg-slate-950 p-6 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                <Award className="h-3.5 w-3.5" />
                M5 成绩簿
              </div>
              <h1 className="text-2xl font-bold">教师成绩簿</h1>
              <p className="mt-2 text-sm text-slate-300">按班级、作业、学生和发布状态追踪评分结果。</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold">当前均分 {averageScore}% · {total} 条</div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row">
          <ToolbarSearchField
            value={keyword}
            onChange={setKeyword}
            onEnter={() => void load()}
            placeholder="搜索作业、学生姓名或账号"
            className="flex-1"
          />
          <ToolbarSelect
            ariaLabel="按成绩状态筛选"
            value={gradeStatus || 'all'}
            onChange={(value) => setGradeStatus(value === 'all' ? '' : value)}
            options={[
              { key: 'all', label: '全部成绩状态' },
              { key: 'auto_checked', label: '已快照' },
              { key: 'reviewed', label: '已复核' },
              { key: 'published', label: '已发布' },
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
          <button onClick={() => void load()} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <button onClick={downloadCSV} disabled={items.length === 0} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-bold text-white disabled:bg-slate-300">
            <Download className="h-4 w-4" />
            CSV
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex h-48 items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />加载成绩簿...</div>
          ) : error ? (
            <div className="rounded-2xl bg-rose-50 p-5 text-sm font-medium text-rose-700">{error}</div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500">当前没有符合条件的成绩记录。</div>
          ) : (
            <div className="card-surface-muted overflow-hidden rounded-2xl">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3">作业 / 学生</th>
                    <th className="px-4 py-3">班级</th>
                    <th className="px-4 py-3">得分</th>
                    <th className="px-4 py-3">状态</th>
                    <th className="px-4 py-3">更新时间</th>
                    <th className="px-4 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.gradeId} className="hover:bg-slate-50">
                      <td className="min-w-0 px-4 py-3">
                        <div className="truncate font-bold text-slate-900">{item.assignmentTitle}</div>
                        <div className="truncate text-xs text-slate-400">{item.studentName || item.studentUsername} · @{item.studentUsername}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.className || '-'}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{item.score}/{item.maxScore}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${gradeStatusClass[item.status] || gradeStatusClass.pending}`}>{gradeStatusLabel[item.status] || item.status}</span></td>
                      <td className="px-4 py-3 text-slate-600">{formatDateTime(item.updatedAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => navigate(`/teacher/submissions/${item.submissionId}`)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-white">
                          <Eye className="h-3.5 w-3.5" />
                          提交详情
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherGradesPage;
