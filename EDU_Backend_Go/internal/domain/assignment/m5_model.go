package assignment

import "time"

const (
	NotificationTypeReminder       = "assignment_reminder"
	NotificationTypeReturned       = "submission_returned"
	NotificationTypeReopened       = "submission_reopened"
	NotificationTypeGradePublished = "grade_published"
)

const (
	ActionTypeRemind       = "remind"
	ActionTypeReopen       = "reopen"
	ActionTypeReturn       = "return"
	ActionTypePublishGrade = "publish_grade"
)

type Notification struct {
	ID         uint64     `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	UserID     uint64     `gorm:"column:user_id;not null;default:0;index:idx_notifications_user_id" json:"userId"`
	Type       string     `gorm:"column:type;size:64;not null;default:'';index:idx_notifications_type" json:"type"`
	Title      string     `gorm:"column:title;size:128;not null;default:''" json:"title"`
	Content    string     `gorm:"column:content;type:text" json:"content"`
	SourceType string     `gorm:"column:source_type;size:32;not null;default:'';index:idx_notifications_source" json:"sourceType"`
	SourceID   uint64     `gorm:"column:source_id;not null;default:0;index:idx_notifications_source" json:"sourceId"`
	ReadAt     *time.Time `gorm:"column:read_at;index:idx_notifications_read_at" json:"readAt"`
	CreatedAt  time.Time  `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
}

func (Notification) TableName() string {
	return "notifications"
}

type TeacherActionLog struct {
	ID           uint64    `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	TeacherID    uint64    `gorm:"column:teacher_id;not null;default:0;index:idx_teacher_action_logs_teacher_id" json:"teacherId"`
	ActionType   string    `gorm:"column:action_type;size:64;not null;default:'';index:idx_teacher_action_logs_action_type" json:"actionType"`
	TargetType   string    `gorm:"column:target_type;size:32;not null;default:'';index:idx_teacher_action_logs_target" json:"targetType"`
	TargetID     uint64    `gorm:"column:target_id;not null;default:0;index:idx_teacher_action_logs_target" json:"targetId"`
	AssignmentID uint64    `gorm:"column:assignment_id;not null;default:0;index:idx_teacher_action_logs_assignment_id" json:"assignmentId"`
	Note         string    `gorm:"column:note;type:text" json:"note"`
	CreatedAt    time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
}

func (TeacherActionLog) TableName() string {
	return "teacher_action_logs"
}

type SubmissionReopen struct {
	ID            uint64     `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	AssignmentID  uint64     `gorm:"column:assignment_id;not null;default:0;index:idx_submission_reopens_assignment_student" json:"assignmentId"`
	StudentID     uint64     `gorm:"column:student_id;not null;default:0;index:idx_submission_reopens_assignment_student" json:"studentId"`
	GrantedBy     uint64     `gorm:"column:granted_by;not null;default:0;index:idx_submission_reopens_granted_by" json:"grantedBy"`
	ExtraAttempts int        `gorm:"column:extra_attempts;not null;default:1" json:"extraAttempts"`
	UsedAttempts  int        `gorm:"column:used_attempts;not null;default:0" json:"usedAttempts"`
	Reason        string     `gorm:"column:reason;type:text" json:"reason"`
	ExpiresAt     *time.Time `gorm:"column:expires_at;index:idx_submission_reopens_expires_at" json:"expiresAt"`
	CreatedAt     time.Time  `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
}

func (SubmissionReopen) TableName() string {
	return "submission_reopens"
}

type TeachingOverviewResponse struct {
	PendingReview        int64 `json:"pendingReview"`
	OverdueMissing       int64 `json:"overdueMissing"`
	VerificationFailed   int64 `json:"verificationFailed"`
	LabFailed            int64 `json:"labFailed"`
	RiskStudents         int64 `json:"riskStudents"`
	LowCompletionClasses int64 `json:"lowCompletionClasses"`
}

type TodoItem struct {
	Type            string     `json:"type"`
	AssignmentID    uint64     `json:"assignmentId"`
	AssignmentTitle string     `json:"assignmentTitle"`
	SubmissionID    uint64     `json:"submissionId"`
	StudentID       uint64     `json:"studentId"`
	StudentName     string     `json:"studentName"`
	StudentUsername string     `json:"studentUsername"`
	ClassID         uint64     `json:"classId"`
	ClassName       string     `json:"className"`
	Status          string     `json:"status"`
	DueAt           *time.Time `json:"dueAt"`
	UpdatedAt       time.Time  `json:"updatedAt"`
}

type TodoItemsResponse struct {
	List  []TodoItem `json:"list"`
	Total int64      `json:"total"`
}

type RiskStudentItem struct {
	StudentID       uint64     `json:"studentId"`
	StudentName     string     `json:"studentName"`
	StudentUsername string     `json:"studentUsername"`
	ClassID         uint64     `json:"classId"`
	ClassName       string     `json:"className"`
	AssignedCount   int64      `json:"assignedCount"`
	SubmittedCount  int64      `json:"submittedCount"`
	CompletionRate  float64    `json:"completionRate"`
	LastActiveAt    *time.Time `json:"lastActiveAt"`
	RiskReasons     []string   `json:"riskReasons"`
}

type RiskStudentsResponse struct {
	List  []RiskStudentItem `json:"list"`
	Total int64             `json:"total"`
}

type AssignmentProgressItem struct {
	AssignmentID    uint64     `json:"assignmentId"`
	AssignmentTitle string     `json:"assignmentTitle"`
	ClassID         uint64     `json:"classId"`
	ClassName       string     `json:"className"`
	TotalStudents   int64      `json:"totalStudents"`
	Submitted       int64      `json:"submitted"`
	Missing         int64      `json:"missing"`
	PendingReview   int64      `json:"pendingReview"`
	Returned        int64      `json:"returned"`
	Graded          int64      `json:"graded"`
	PublishedGrades int64      `json:"publishedGrades"`
	DueAt           *time.Time `json:"dueAt"`
}

type AssignmentProgressResponse struct {
	List  []AssignmentProgressItem `json:"list"`
	Total int64                    `json:"total"`
}

type TeacherGradeItem struct {
	GradeID         uint64     `json:"gradeId"`
	SubmissionID    uint64     `json:"submissionId"`
	AssignmentID    uint64     `json:"assignmentId"`
	AssignmentTitle string     `json:"assignmentTitle"`
	StudentID       uint64     `json:"studentId"`
	StudentName     string     `json:"studentName"`
	StudentUsername string     `json:"studentUsername"`
	ClassName       string     `json:"className"`
	Score           float64    `json:"score"`
	MaxScore        float64    `json:"maxScore"`
	Status          string     `json:"status"`
	PublishedAt     *time.Time `json:"publishedAt"`
	UpdatedAt       time.Time  `json:"updatedAt"`
}

type TeacherGradesResponse struct {
	List  []TeacherGradeItem `json:"list"`
	Total int64              `json:"total"`
}

type RemindRequest struct {
	AssignmentID uint64   `json:"assignmentId"`
	ClassID      uint64   `json:"classId"`
	StudentIDs   []uint64 `json:"studentIds"`
	Message      string   `json:"message"`
}

type ReopenAssignmentRequest struct {
	ClassID       uint64     `json:"classId"`
	StudentIDs    []uint64   `json:"studentIds"`
	ExtraAttempts int        `json:"extraAttempts"`
	Reason        string     `json:"reason"`
	ExpiresAt     *time.Time `json:"expiresAt"`
}

type ActionResult struct {
	AffectedStudents int `json:"affectedStudents"`
}

type NotificationListResponse struct {
	List   []Notification `json:"list"`
	Total  int64          `json:"total"`
	Unread int64          `json:"unread"`
}

type TeachingQualityOverview struct {
	Assignments     int64 `json:"assignments"`
	PendingReview   int64 `json:"pendingReview"`
	OverdueMissing  int64 `json:"overdueMissing"`
	RiskStudents    int64 `json:"riskStudents"`
	RemindersSent   int64 `json:"remindersSent"`
	ReopenGrants    int64 `json:"reopenGrants"`
	PublishedGrades int64 `json:"publishedGrades"`
}

type TeacherDashboardQuery struct {
	Page         int
	PageSize     int
	Type         string
	Q            string
	Status       string
	AssignmentID uint64
	ClassID      uint64
	GradeStatus  string
}
