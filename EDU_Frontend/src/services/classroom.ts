import i18n, { getCurrentLocale } from '@/i18n';

export enum TermStatus {
  PLANNING = 0,
  ACTIVE = 1,
  ARCHIVED = 2,
}

export enum ClassStatus {
  ACTIVE = 1,
  DISABLED = 2,
  ARCHIVED = 3,
}

export enum ClassMemberStatus {
  ACTIVE = 1,
  REMOVED = 2,
}

export interface TermItem {
  id: number;
  name: string;
  code: string;
  startAt?: string | null;
  endAt?: string | null;
  status: TermStatus;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  classCount: number;
}

export interface ClassItem {
  id: number;
  termId: number;
  termName: string;
  termCode: string;
  termStatus: TermStatus;
  name: string;
  code: string;
  description: string;
  ownerTeacherId: number;
  ownerTeacherName: string;
  status: ClassStatus;
  memberCount: number;
  activeMemberCount: number;
  pendingTaskCount: number;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClassDetail extends ClassItem {
  termStartAt?: string | null;
  termEndAt?: string | null;
}

export interface ClassMemberItem {
  id: number;
  classId: number;
  userId: number;
  username: string;
  fullName: string;
  email: string;
  studentId: string;
  roleType: number;
  status: ClassMemberStatus;
  joinedAt?: string | null;
  removedAt?: string | null;
}

export interface ImportMatchedUser {
  id: number;
  username: string;
  fullName: string;
  email: string;
  studentId: string;
}

export interface ImportRowResult {
  rowNumber: number;
  matchedBy: string;
  status: 'imported' | 'skipped' | 'failed';
  reason: string;
  user?: ImportMatchedUser;
}

export interface ImportMembersResult {
  summary: {
    total: number;
    imported: number;
    skipped: number;
    failed: number;
  };
  rows: ImportRowResult[];
}

export interface ClassroomListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  termId?: number;
  status?: number;
}

export interface ClassroomListResponse {
  list: ClassItem[];
  total: number;
  page: number;
  pageSize: number;
}

export const ensureArray = <T>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : []);

export const normalizeClassroomListResponse = (
  value: Partial<ClassroomListResponse> | null | undefined,
): ClassroomListResponse => ({
  list: ensureArray(value?.list),
  total: typeof value?.total === 'number' ? value.total : 0,
  page: typeof value?.page === 'number' ? value.page : 1,
  pageSize: typeof value?.pageSize === 'number' ? value.pageSize : 10,
});

export interface CreateTermDTO {
  name: string;
  code: string;
  startAt?: string | null;
  endAt?: string | null;
  status?: TermStatus;
}

export interface UpdateTermDTO {
  name?: string;
  code?: string;
  startAt?: string | null;
  endAt?: string | null;
}

export interface CreateClassDTO {
  termId: number;
  name: string;
  code: string;
  description?: string;
}

export interface UpdateClassDTO {
  termId?: number;
  name?: string;
  code?: string;
  description?: string;
}

export const buildQuery = (query: object) => {
  const params = new URLSearchParams();
  Object.entries(query as Record<string, string | number | undefined>).forEach(([key, value]) => {
    if (value === undefined || value === '') return;
    params.set(key, String(value));
  });
  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
};

export const getTermStatusMeta = (status: TermStatus) => {
  switch (status) {
    case TermStatus.ACTIVE:
      return { label: i18n.t('adminClasses:termActive'), className: 'bg-emerald-50 text-emerald-700' };
    case TermStatus.ARCHIVED:
      return { label: i18n.t('adminClasses:termArchived'), className: 'bg-slate-100 text-slate-600' };
    default:
      return { label: i18n.t('adminClasses:termPlanning'), className: 'bg-amber-50 text-amber-700' };
  }
};

export const getClassStatusMeta = (status: ClassStatus) => {
  switch (status) {
    case ClassStatus.DISABLED:
      return { label: i18n.t('student:classDisabled'), className: 'bg-rose-50 text-rose-700' };
    case ClassStatus.ARCHIVED:
      return { label: i18n.t('student:classArchived'), className: 'bg-slate-100 text-slate-600' };
    default:
      return { label: i18n.t('student:classActive'), className: 'bg-primary-50 text-primary-700' };
  }
};

export const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  return new Date(value).toLocaleString(getCurrentLocale(), { hour12: false });
};

export const formatDate = (value?: string | null) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(getCurrentLocale());
};
