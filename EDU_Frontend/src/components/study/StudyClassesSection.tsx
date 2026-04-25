import React, { useEffect, useState } from 'react';
import { BookMarked, Loader2, LogIn, School2 } from 'lucide-react';
import type { User } from '@/types';
import { RoleType } from '@/types';
import { studentClassApi } from '@/services/studentClass';
import type { ClassItem } from '@/services/classroom';
import { formatDate, getClassStatusMeta } from '@/services/classroom';

interface StudyClassesSectionProps {
  currentUser: User | null;
  onLoginRequired: () => void;
}

const StudyClassesSection: React.FC<StudyClassesSectionProps> = ({ currentUser, onLoginRequired }) => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ClassItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser || currentUser.roleType !== RoleType.STUDENT) {
      setItems([]);
      setError(null);
      return;
    }
    const load = async () => {
      setLoading(true);
      setError(null);
      const response = await studentClassApi.getMyClasses();
      if (response.success && response.data) {
        setItems(response.data);
      } else {
        setItems([]);
        setError(response.error || '获取我的班级失败');
      }
      setLoading(false);
    };
    void load();
  }, [currentUser]);

  return (
    <section className="card-surface mb-10 rounded-[28px] p-6 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-bold text-primary-700">
            <School2 className="h-3.5 w-3.5" />
            我的班级
          </div>
          <h3 className="mt-4 text-2xl font-black tracking-tight text-slate-900">教学组织视图</h3>
          <p className="mt-2 text-sm text-slate-500">在这里快速确认当前归属班级、任课教师和班级状态。</p>
        </div>
        {!currentUser && (
          <button
            onClick={onLoginRequired}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <LogIn className="h-4 w-4" />
            登录后查看
          </button>
        )}
      </div>

      {!currentUser && (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-5 py-8 text-center text-sm text-slate-500">
          学生登录后会在这里看到所属班级与当前学期信息。
        </div>
      )}

      {currentUser && currentUser.roleType !== RoleType.STUDENT && (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-5 py-8 text-center text-sm text-slate-500">
          当前账号不是学生角色，学习中心不展示班级归属卡片。
        </div>
      )}

      {currentUser && currentUser.roleType === RoleType.STUDENT && loading && (
        <div className="mt-6 flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-5 py-8 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在同步我的班级...
        </div>
      )}

      {currentUser && currentUser.roleType === RoleType.STUDENT && !loading && error && (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50/90 px-5 py-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {currentUser && currentUser.roleType === RoleType.STUDENT && !loading && !error && items.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-5 py-8 text-center text-sm text-slate-500">
          当前还没有加入任何班级，后续教师导入后会自动出现在这里。
        </div>
      )}

      {currentUser && currentUser.roleType === RoleType.STUDENT && !loading && !error && items.length > 0 && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {items.map((item) => {
            const statusMeta = getClassStatusMeta(item.status);
            return (
              <article
                key={item.id}
                className="card-surface-muted rounded-3xl p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">{item.termCode}</div>
                    <h4 className="mt-2 text-lg font-bold text-slate-900">{item.name}</h4>
                    <p className="mt-1 text-sm text-slate-500">{item.termName}</p>
                  </div>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.className}`}>
                    {statusMeta.label}
                  </span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs text-slate-400">主教师</div>
                    <div className="mt-1 font-semibold text-slate-700">{item.ownerTeacherName || '—'}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs text-slate-400">成员规模</div>
                    <div className="mt-1 font-semibold text-slate-700">{item.activeMemberCount} / {item.memberCount}</div>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                  <BookMarked className="h-3.5 w-3.5" />
                  最近同步于 {formatDate(item.updatedAt)}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default StudyClassesSection;
