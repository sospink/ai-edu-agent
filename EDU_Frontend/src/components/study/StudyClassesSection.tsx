import React, { useEffect, useState } from 'react';
import { BookMarked, Loader2, LogIn, School2 } from 'lucide-react';
import type { User } from '@/types';
import { RoleType } from '@/types';
import { studentClassApi } from '@/services/studentClass';
import type { ClassItem } from '@/services/classroom';
import { formatDate, getClassStatusMeta } from '@/services/classroom';
import { useTranslation } from 'react-i18next';
import { localizeSeededClassName, localizeSeededTermName } from '@/utils/seededContentLocale';

interface StudyClassesSectionProps {
  currentUser: User | null;
  onLoginRequired: () => void;
}

const StudyClassesSection: React.FC<StudyClassesSectionProps> = ({ currentUser, onLoginRequired }) => {
  const { t, i18n } = useTranslation('student');
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
        setError(response.error || t('loadClassesFailed'));
      }
      setLoading(false);
    };
    void load();
  }, [currentUser?.id, currentUser?.roleType, i18n.language]);

  return (
    <section className="card-surface mb-10 rounded-[28px] p-6 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-bold text-primary-700">
            <School2 className="h-3.5 w-3.5" />
            {t('myClasses')}
          </div>
          <h3 className="mt-4 text-2xl font-black tracking-tight text-slate-900">{t('classOverview')}</h3>
          <p className="mt-2 text-sm text-slate-500">{t('classOverviewDesc')}</p>
        </div>
        {!currentUser && (
          <button
            onClick={onLoginRequired}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <LogIn className="h-4 w-4" />
            {t('loginToView')}
          </button>
        )}
      </div>

      {!currentUser && (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-5 py-8 text-center text-sm text-slate-500">
          {t('classLoginHint')}
        </div>
      )}

      {currentUser && currentUser.roleType !== RoleType.STUDENT && (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-5 py-8 text-center text-sm text-slate-500">
          {t('studentOnlyClasses')}
        </div>
      )}

      {currentUser && currentUser.roleType === RoleType.STUDENT && loading && (
        <div className="mt-6 flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-5 py-8 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('syncingClasses')}
        </div>
      )}

      {currentUser && currentUser.roleType === RoleType.STUDENT && !loading && error && (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50/90 px-5 py-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {currentUser && currentUser.roleType === RoleType.STUDENT && !loading && !error && items.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-5 py-8 text-center text-sm text-slate-500">
          {t('noClasses')}
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
                    <h4 className="mt-2 text-lg font-bold text-slate-900">{localizeSeededClassName(item.name, i18n.language)}</h4>
                    <p className="mt-1 text-sm text-slate-500">{localizeSeededTermName(item.termName, i18n.language)}</p>
                  </div>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.className}`}>
                    {statusMeta.label}
                  </span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs text-slate-400">{t('primaryTeacher')}</div>
                    <div className="mt-1 font-semibold text-slate-700">{item.ownerTeacherName || '—'}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs text-slate-400">{t('memberCount')}</div>
                    <div className="mt-1 font-semibold text-slate-700">{item.activeMemberCount} / {item.memberCount}</div>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                  <BookMarked className="h-3.5 w-3.5" />
                  {t('syncedAt', { date: formatDate(item.updatedAt) })}
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
