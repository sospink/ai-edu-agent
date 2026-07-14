import { createScopedApi } from './api';
import type { ApiResponse } from '@/types';

export type AssignmentStatus = 0 | 1 | 2 | 3;
export type AssignmentResourceType =
  | 'course'
  | 'course_lesson'
  | 'project'
  | 'project_unit'
  | 'manual'
  | 'classic_lab';

export interface AssignmentResourceInput {
  resourceType: AssignmentResourceType;
  resourceId: number;
  unitId?: number;
  lessonId?: number;
  manualId?: number;
  sortOrder?: number;
}

export interface AssignmentRuleInput {
  attemptLimit: number;
  allowLate: boolean;
  allowReturn?: boolean;
  allowResubmit: boolean;
  scoreMode: string;
}

export interface RubricItemInput {
  title: string;
  description?: string;
  maxScore: number;
  sortOrder?: number;
}

export interface UpsertAssignmentRequest {
  title: string;
  description?: string;
  dueAt?: string | null;
  classIds: number[];
  resources: AssignmentResourceInput[];
  rule?: AssignmentRuleInput;
  rubricItems?: RubricItemInput[];
}

export interface AssignmentClassItem {
  classId: number;
  name: string;
  code: string;
  status: number;
  ownerTeacherId: number;
  activeMemberCount: number;
}

export interface AssignmentResourceItem {
  id: number;
  assignmentId: number;
  resourceType: AssignmentResourceType;
  resourceId: number;
  unitId: number;
  lessonId: number;
  manualId: number;
  sortOrder: number;
  title: string;
  status: number;
}

export interface AssignmentRule {
  id: number;
  assignmentId: number;
  attemptLimit: number;
  allowLate: boolean;
  allowReturn: boolean;
  allowResubmit: boolean;
  scoreMode: string;
}

export interface AssignmentListItem {
  id: number;
  title: string;
  description: string;
  status: AssignmentStatus;
  creatorId: number;
  creatorName: string;
  dueAt?: string | null;
  publishedAt?: string | null;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  classCount: number;
  resourceCount: number;
  studentCount: number;
  canEnter: boolean;
}

export interface AssignmentDetail extends AssignmentListItem {
  classes: AssignmentClassItem[];
  resources: AssignmentResourceItem[];
  rule: AssignmentRule;
  rubric: RubricDetail;
  submissionProgress?: SubmissionProgress;
  studentSubmission?: StudentSubmissionState;
}

export interface AssignmentListResponse {
  list: AssignmentListItem[];
  total: number;
}

export interface AssignmentIssue {
  code: string;
  scope: string;
  message: string;
  resourceId?: number;
  resourceRef?: string;
}

export interface AssignmentPublishCheckResult {
  canPublish: boolean;
  errors: AssignmentIssue[];
  warnings: AssignmentIssue[];
  summary: string;
}

export interface AssignmentOverview {
  total: number;
  draft: number;
  published: number;
  closed: number;
  archived: number;
  overdue: number;
  submitted: number;
  pendingReview: number;
  returned: number;
  graded: number;
  publishedGrades: number;
}

export type SubmissionStatus = 'not_started' | 'in_progress' | 'submitted' | 'returned' | 'graded' | 'resubmitted';
export type GradeStatus = 'pending' | 'auto_checked' | 'reviewed' | 'published';
export type SubmissionCheckType = 'lesson_progress' | 'agent_progress' | 'lab_session' | 'lab_command' | 'manual_review';

export interface RubricItem {
  id: number;
  rubricId: number;
  title: string;
  description: string;
  maxScore: number;
  sortOrder: number;
}

export interface RubricDetail {
  id?: number;
  assignmentId: number;
  title: string;
  totalScore: number;
  items: RubricItem[];
}

export interface SubmissionProgress {
  totalStudents: number;
  submitted: number;
  pendingReview: number;
  returned: number;
  graded: number;
  publishedGrades: number;
}

export interface SubmissionFileInput {
  fileType: string;
  title?: string;
  url: string;
  metadata?: Record<string, unknown>;
}

export interface CreateSubmissionRequest {
  contentText: string;
  labSessionId?: number;
  agentManualId?: number;
  files?: SubmissionFileInput[];
}

export interface SubmissionFile {
  id: number;
  submissionId: number;
  fileType: string;
  title: string;
  url: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface SubmissionCheck {
  id: number;
  submissionId: number;
  checkType: SubmissionCheckType;
  status: string;
  score: number;
  maxScore: number;
  command: string;
  output: string;
  error: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface RubricScore {
  rubricItemId: number;
  title: string;
  score: number;
  maxScore: number;
}

export interface Grade {
  id: number;
  submissionId: number;
  studentId: number;
  assignmentId: number;
  score: number;
  maxScore: number;
  status: GradeStatus;
  gradedBy: number;
  rubricScores: RubricScore[];
  publishedAt?: string | null;
}

export interface TeacherFeedback {
  id: number;
  submissionId: number;
  teacherId: number;
  content: string;
  visibility: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubmissionDetail {
  id: number;
  assignmentId: number;
  assignmentTitle?: string;
  studentId: number;
  studentName?: string;
  studentUsername?: string;
  attemptNo: number;
  status: SubmissionStatus;
  contentText: string;
  labSessionId: number;
  agentManualId: number;
  submittedAt?: string | null;
  returnedAt?: string | null;
  gradedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  files: SubmissionFile[];
  checks: SubmissionCheck[];
  grade?: Grade;
  feedback?: TeacherFeedback;
  rubric: RubricDetail;
}

export interface StudentSubmissionState {
  status: SubmissionStatus;
  latest?: SubmissionDetail;
  history: SubmissionDetail[];
  gradeStatus: GradeStatus;
  grade?: Grade;
  feedback?: TeacherFeedback;
  canSubmit: boolean;
  disabledReason?: string;
}

export interface SubmissionListItem {
  id: number;
  assignmentId: number;
  assignmentTitle: string;
  studentId: number;
  studentName: string;
  studentUsername: string;
  attemptNo: number;
  status: SubmissionStatus;
  contentText: string;
  submittedAt?: string | null;
  updatedAt: string;
  gradeStatus: GradeStatus;
  score: number;
  maxScore: number;
}

export interface SubmissionListResponse {
  list: SubmissionListItem[];
  total: number;
}

export interface GradeSubmissionRequest {
  scores: Array<{ rubricItemId: number; score: number }>;
  feedback?: string;
  aiSuggestionId?: number;
}

export type AISuggestionType = 'feedback_draft' | 'assignment_summary' | 'weakness_diagnosis' | 'step_insight' | 'class_insight' | 'student_insight' | 'faq_suggestion';
export type AISourceType = 'submission' | 'assignment' | 'student' | 'agent_step' | 'agent_class' | 'agent_student';
export type AISuggestionStatus = 'pending' | 'confirmed' | 'dismissed';

export interface AISuggestion {
  id: number;
  requestId: number;
  suggestionType: AISuggestionType;
  sourceType: AISourceType;
  sourceId: number;
  createdBy: number;
  title: string;
  content: string;
  evidence?: Record<string, unknown>;
  status: AISuggestionStatus;
  confirmedBy: number;
  confirmedAt?: string | null;
  adoptedContent: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIStatus {
  enabled: boolean;
  configured: boolean;
  model: string;
}

export interface AgentStepRecentFailure {
  studentId: number;
  failureReason: string;
  failedAt: string;
}

export interface AgentStepStatsItem {
  stepId: number;
  stepOrder: number;
  stepTitle: string;
  totalStudents: number;
  completedCount: number;
  completionRate: number;
  failedCount: number;
  strugglingCount: number;
  recentFailures: AgentStepRecentFailure[];
}

export interface AgentClassSummary {
  totalStudents: number;
  completedCount: number;
  activeCount: number;
  avgCompletionRate: number;
  aiUsageCount: number;
}

export interface AgentStepAxis {
  stepId: number;
  stepOrder: number;
  title: string;
}

export interface AgentStudentAxis {
  studentId: number;
  name: string;
}

export interface AgentHeatmapCell {
  studentId: number;
  stepId: number;
  stepOrder: number;
  status: 'green' | 'yellow' | 'orange' | 'red' | 'gray';
  attemptCount: number;
  failCount: number;
  aiEventCount: number;
}

export interface AgentRiskStudent {
  studentId: number;
  name: string;
  stuckStepCount: number;
  lastActiveAt?: string;
}

export interface AgentObservatoryResponse {
  manualId: number;
  classId: number;
  summary: AgentClassSummary;
  steps: AgentStepAxis[];
  students: AgentStudentAxis[];
  heatmap: AgentHeatmapCell[];
  riskStudents: AgentRiskStudent[];
}

export interface AgentSkillWeaknessItem {
  skillTag: string;
  failureRate: number;
  stuckStudentCount: number;
  completionRate: number;
  steps: AgentStepAxis[];
}

export interface AgentFAQItem {
  id: number;
  manualId: number;
  classId: number;
  stepId: number;
  stepOrder: number;
  question: string;
  answer: string;
  status: string;
}

export interface AgentInterventionRecord {
  id: number;
  manualId: number;
  classId: number;
  stepId: number;
  studentId: number;
  teacherId?: number;
  actionType: string;
  title: string;
  content: string;
  status: string;
  readAt?: string | null;
  createdAt: string;
}

export interface AgentStepAttemptSummary {
  success: boolean;
  failureReason: string;
  createdAt: string;
}

export interface AgentChatMessageItem {
  role: string;
  content: string;
  createdAt: string;
}

export interface LabTerminalEventItem {
  command: string;
  outputSummary: string;
  exitCode: number;
  createdAt: string;
}

export interface AgentCellDetailResponse {
  studentId: number;
  stepId: number;
  attempts: AgentStepAttemptSummary[];
  recentMessages: AgentChatMessageItem[];
  terminalEvents: LabTerminalEventItem[];
  interventions: AgentInterventionRecord[];
  suggestedActions: string[];
}

export interface AgentReflectionCard {
  id: number;
  userId: number;
  manualId: number;
  summary: string;
  strengths?: { items?: string[] };
  stuckPoints?: { items?: string[] };
  reviewSuggestions?: { items?: string[] };
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentGradeItem {
  assignmentId: number;
  assignmentTitle: string;
  submissionId: number;
  status: GradeStatus;
  score?: number;
  maxScore?: number;
  rubricScores?: RubricScore[];
  feedback?: TeacherFeedback;
  publishedAt?: string | null;
}

export interface StudentGradesResponse {
  list: StudentGradeItem[];
}

export type TodoItemType = 'pending_review' | 'overdue_missing' | 'verification_failed' | 'lab_failed';

export interface TeachingOverview {
  pendingReview: number;
  overdueMissing: number;
  verificationFailed: number;
  labFailed: number;
  riskStudents: number;
  lowCompletionClasses: number;
}

export interface TeacherTodoItem {
  type: TodoItemType;
  assignmentId: number;
  assignmentTitle: string;
  submissionId: number;
  studentId: number;
  studentName: string;
  studentUsername: string;
  classId: number;
  className: string;
  status: string;
  dueAt?: string | null;
  updatedAt: string;
}

export interface TeacherTodoItemsResponse {
  list: TeacherTodoItem[];
  total: number;
}

export interface RiskStudentItem {
  studentId: number;
  studentName: string;
  studentUsername: string;
  classId: number;
  className: string;
  assignedCount: number;
  submittedCount: number;
  completionRate: number;
  lastActiveAt?: string | null;
  riskReasons: string[];
}

export interface RiskStudentsResponse {
  list: RiskStudentItem[];
  total: number;
}

export interface AssignmentProgressItem {
  assignmentId: number;
  assignmentTitle: string;
  classId: number;
  className: string;
  totalStudents: number;
  submitted: number;
  missing: number;
  pendingReview: number;
  returned: number;
  graded: number;
  publishedGrades: number;
  dueAt?: string | null;
}

export interface AssignmentProgressResponse {
  list: AssignmentProgressItem[];
  total: number;
}

export interface TeacherGradeItem {
  gradeId: number;
  submissionId: number;
  assignmentId: number;
  assignmentTitle: string;
  studentId: number;
  studentName: string;
  studentUsername: string;
  className: string;
  score: number;
  maxScore: number;
  status: GradeStatus;
  publishedAt?: string | null;
  updatedAt: string;
}

export interface TeacherGradesResponse {
  list: TeacherGradeItem[];
  total: number;
}

export interface TeacherActionResult {
  affectedStudents: number;
}

export interface StudentNotification {
  id: number;
  userId: number;
  type: string;
  title: string;
  content: string;
  sourceType: string;
  sourceId: number;
  readAt?: string | null;
  createdAt: string;
}

export interface StudentNotificationsResponse {
  list: StudentNotification[];
  total: number;
  unread: number;
}

export interface TeachingQualityOverview {
  assignments: number;
  pendingReview: number;
  overdueMissing: number;
  riskStudents: number;
  remindersSent: number;
  reopenGrants: number;
  publishedGrades: number;
}

const teacherApi = createScopedApi('/teacher');
const studentApi = createScopedApi('/student');
const adminApi = createScopedApi('/admin');

const buildQuery = (query: Record<string, string | number | undefined> = {}) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === '') return;
    params.set(key, String(value));
  });
  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
};

const normalizeList = (response: ApiResponse<AssignmentListResponse>): ApiResponse<AssignmentListResponse> => ({
  ...response,
  data: {
    list: response.data?.list || [],
    total: response.data?.total || 0,
  },
});

export const teacherAssignmentApi = {
  async getList(query: { page?: number; pageSize?: number; q?: string; status?: number } = {}) {
    return normalizeList(await teacherApi.get<AssignmentListResponse>(`/assignments${buildQuery(query)}`));
  },
  create(data: UpsertAssignmentRequest) {
    return teacherApi.post<AssignmentDetail>('/assignments', data);
  },
  getById(id: number) {
    return teacherApi.get<AssignmentDetail>(`/assignments/${id}`);
  },
  update(id: number, data: UpsertAssignmentRequest) {
    return teacherApi.put<AssignmentDetail>(`/assignments/${id}`, data);
  },
  publish(id: number) {
    return teacherApi.post<AssignmentDetail>(`/assignments/${id}/publish`, {});
  },
  close(id: number) {
    return teacherApi.post<AssignmentDetail>(`/assignments/${id}/close`, {});
  },
  draft(id: number) {
    return teacherApi.post<AssignmentDetail>(`/assignments/${id}/draft`, {});
  },
  async getSubmissions(query: { page?: number; pageSize?: number; q?: string; status?: string; assignmentId?: number; classId?: number } = {}) {
    return normalizeSubmissionList(await teacherApi.get<SubmissionListResponse>(`/submissions${buildQuery(query)}`));
  },
  getSubmission(id: number) {
    return teacherApi.get<SubmissionDetail>(`/submissions/${id}`);
  },
  runChecks(id: number, command?: string) {
    return teacherApi.post<SubmissionDetail>(`/submissions/${id}/checks/run`, { command: command || '' });
  },
  gradeSubmission(id: number, data: GradeSubmissionRequest) {
    return teacherApi.post<SubmissionDetail>(`/submissions/${id}/grade`, data);
  },
  returnSubmission(id: number, feedback: string, aiSuggestionId?: number) {
    return teacherApi.post<SubmissionDetail>(`/submissions/${id}/return`, { feedback, aiSuggestionId });
  },
  publishGrade(id: number) {
    return teacherApi.post<SubmissionDetail>(`/grades/${id}/publish`, {});
  },
  aiStatus() {
    return teacherApi.get<AIStatus>('/ai/status');
  },
  suggestFeedback(submissionId: number) {
    return teacherApi.post<AISuggestion>(`/submissions/${submissionId}/ai/suggest-feedback`, {});
  },
  assignmentSummary(assignmentId: number, classId?: number) {
    return teacherApi.post<AISuggestion>(`/assignments/${assignmentId}/ai/summary`, classId ? { classId } : {});
  },
  weaknessDiagnosis(studentId: number, classId: number) {
    return teacherApi.post<AISuggestion>(`/students/${studentId}/ai/weakness`, { classId });
  },
  updateAISuggestion(id: number, action: 'confirm' | 'dismiss') {
    return teacherApi.patch<AISuggestion>(`/ai-suggestions/${id}`, { action });
  },
  agentStepStats(query: { sourceType: number; sourceId: number; classId: number }) {
    return teacherApi.get<AgentStepStatsItem[]>(`/agent-step-stats${buildQuery(query)}`);
  },
  agentStepInsight(stepId: number, classId: number) {
    return teacherApi.post<AISuggestion>(`/agent-steps/${stepId}/ai/insight`, { classId });
  },
  agentObservatory(query: { manualId: number; classId: number }) {
    return teacherApi.get<AgentObservatoryResponse>(`/agent-observatory${buildQuery(query)}`);
  },
  agentCellDetail(query: { manualId: number; classId: number; studentId: number; stepId: number }) {
    return teacherApi.get<AgentCellDetailResponse>(`/agent-observatory/cell-detail${buildQuery(query)}`);
  },
  agentSkillWeakness(query: { manualId: number; classId: number }) {
    return teacherApi.get<AgentSkillWeaknessItem[]>(`/agent-skill-weakness${buildQuery(query)}`);
  },
  updateAgentStepSkillTags(stepId: number, tags: string[]) {
    return teacherApi.put<{ skillTag: string }[]>(`/agent-steps/${stepId}/skill-tags`, { tags });
  },
  agentFAQSuggestion(stepId: number, classId: number) {
    return teacherApi.post<AISuggestion>(`/agent-steps/${stepId}/ai/faq-suggestion`, { classId });
  },
  publishFAQ(suggestionId: number, classId: number) {
    return teacherApi.post<AgentFAQItem>(`/ai-suggestions/${suggestionId}/publish-faq`, { classId });
  },
  agentFAQ(query: { manualId: number; classId: number; stepId?: number; status?: 'published' | 'archived' | 'all' }) {
    return teacherApi.get<AgentFAQItem[]>(`/agent-faq${buildQuery(query)}`);
  },
  archiveFAQ(id: number) {
    return teacherApi.patch<AgentFAQItem>(`/agent-faq/${id}/archive`, {});
  },
  createAgentIntervention(data: {
    manualId: number;
    classId: number;
    stepId?: number;
    studentId?: number;
    actionType: 'student_reminder' | 'class_broadcast' | 'material_note';
    title: string;
    content: string;
  }) {
    return teacherApi.post<AgentInterventionRecord[]>('/agent-interventions', data);
  },
  agentInterventions(query: { manualId: number; classId: number; stepId?: number }) {
    return teacherApi.get<AgentInterventionRecord[]>(`/agent-interventions${buildQuery(query)}`);
  },
  reflectionCard(studentId: number, manualId: number) {
    return teacherApi.get<AgentReflectionCard>(`/students/${studentId}/reflection-card${buildQuery({ manualId })}`);
  },
  teachingOverview() {
    return teacherApi.get<TeachingOverview>('/dashboard/teaching-overview');
  },
  async todoItems(query: { page?: number; pageSize?: number; type?: TodoItemType | ''; q?: string; status?: string; assignmentId?: number; classId?: number } = {}) {
    return normalizeTodoItems(await teacherApi.get<TeacherTodoItemsResponse>(`/dashboard/todo-items${buildQuery(query)}`));
  },
  async riskStudents(query: { page?: number; pageSize?: number; q?: string; classId?: number } = {}) {
    return normalizeRiskStudents(await teacherApi.get<RiskStudentsResponse>(`/dashboard/risk-students${buildQuery(query)}`));
  },
  async assignmentProgress(query: { page?: number; pageSize?: number; q?: string; assignmentId?: number; classId?: number } = {}) {
    return normalizeAssignmentProgress(await teacherApi.get<AssignmentProgressResponse>(`/dashboard/assignment-progress${buildQuery(query)}`));
  },
  async grades(query: { page?: number; pageSize?: number; q?: string; gradeStatus?: string; assignmentId?: number; classId?: number } = {}) {
    return normalizeTeacherGrades(await teacherApi.get<TeacherGradesResponse>(`/grades${buildQuery(query)}`));
  },
  remindStudents(data: { assignmentId: number; classId?: number; studentIds?: number[]; message?: string }) {
    return teacherApi.post<TeacherActionResult>('/notifications/remind', data);
  },
  reopenAssignment(id: number, data: { classId?: number; studentIds?: number[]; extraAttempts?: number; reason?: string; expiresAt?: string | null }) {
    return teacherApi.post<TeacherActionResult>(`/assignments/${id}/reopen`, data);
  },
};

export const studentAssignmentApi = {
  async getList(query: { page?: number; pageSize?: number; q?: string; status?: number; classId?: number } = {}) {
    return normalizeList(await studentApi.get<AssignmentListResponse>(`/assignments${buildQuery(query)}`));
  },
  getById(id: number) {
    return studentApi.get<AssignmentDetail>(`/assignments/${id}`);
  },
  submit(assignmentId: number, data: CreateSubmissionRequest) {
    return studentApi.post<SubmissionDetail>(`/assignments/${assignmentId}/submissions`, data);
  },
  getSubmission(id: number) {
    return studentApi.get<SubmissionDetail>(`/submissions/${id}`);
  },
  grades() {
    return studentApi.get<StudentGradesResponse>('/grades');
  },
  async notifications(query: { page?: number; pageSize?: number } = {}) {
    return normalizeStudentNotifications(await studentApi.get<StudentNotificationsResponse>(`/notifications${buildQuery(query)}`));
  },
  markNotificationRead(id: number) {
    return studentApi.post<StudentNotification>(`/notifications/${id}/read`, {});
  },
};

export const adminAssignmentApi = {
  overview() {
    return adminApi.get<AssignmentOverview>('/assignments/overview');
  },
  async getList(query: { page?: number; pageSize?: number; q?: string; status?: number } = {}) {
    return normalizeList(await adminApi.get<AssignmentListResponse>(`/assignments${buildQuery(query)}`));
  },
  teachingQualityOverview() {
    return adminApi.get<TeachingQualityOverview>('/teaching-quality/overview');
  },
};

const normalizeSubmissionList = (response: ApiResponse<SubmissionListResponse>): ApiResponse<SubmissionListResponse> => ({
  ...response,
  data: {
    list: response.data?.list || [],
    total: response.data?.total || 0,
  },
});

const normalizeTodoItems = (response: ApiResponse<TeacherTodoItemsResponse>): ApiResponse<TeacherTodoItemsResponse> => ({
  ...response,
  data: {
    list: response.data?.list || [],
    total: response.data?.total || 0,
  },
});

const normalizeRiskStudents = (response: ApiResponse<RiskStudentsResponse>): ApiResponse<RiskStudentsResponse> => ({
  ...response,
  data: {
    list: response.data?.list || [],
    total: response.data?.total || 0,
  },
});

const normalizeAssignmentProgress = (response: ApiResponse<AssignmentProgressResponse>): ApiResponse<AssignmentProgressResponse> => ({
  ...response,
  data: {
    list: response.data?.list || [],
    total: response.data?.total || 0,
  },
});

const normalizeTeacherGrades = (response: ApiResponse<TeacherGradesResponse>): ApiResponse<TeacherGradesResponse> => ({
  ...response,
  data: {
    list: response.data?.list || [],
    total: response.data?.total || 0,
  },
});

const normalizeStudentNotifications = (response: ApiResponse<StudentNotificationsResponse>): ApiResponse<StudentNotificationsResponse> => ({
  ...response,
  data: {
    list: response.data?.list || [],
    total: response.data?.total || 0,
    unread: response.data?.unread || 0,
  },
});
