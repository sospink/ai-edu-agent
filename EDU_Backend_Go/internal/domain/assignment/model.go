package assignment

import "time"

type AssignmentStatus int

const (
	AssignmentStatusDraft     AssignmentStatus = 0
	AssignmentStatusPublished AssignmentStatus = 1
	AssignmentStatusClosed    AssignmentStatus = 2
	AssignmentStatusArchived  AssignmentStatus = 3
)

const (
	ResourceTypeCourse       = "course"
	ResourceTypeCourseLesson = "course_lesson"
	ResourceTypeProject      = "project"
	ResourceTypeProjectUnit  = "project_unit"
	ResourceTypeManual       = "manual"
	ResourceTypeClassicLab   = "classic_lab"
)

type TeachingAssignment struct {
	ID          uint64           `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	Title       string           `gorm:"column:title;size:128;not null;default:''" json:"title"`
	Description string           `gorm:"column:description;size:1024;not null;default:''" json:"description"`
	Status      AssignmentStatus `gorm:"column:status;not null;default:0;index:idx_teaching_assignments_status" json:"status"`
	CreatorID   uint64           `gorm:"column:creator_id;not null;default:0;index:idx_teaching_assignments_creator_id" json:"creatorId"`
	DueAt       *time.Time       `gorm:"column:due_at;index:idx_teaching_assignments_due_at" json:"dueAt"`
	PublishedAt *time.Time       `gorm:"column:published_at" json:"publishedAt"`
	ClosedAt    *time.Time       `gorm:"column:closed_at" json:"closedAt"`
	CreatedAt   time.Time        `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time        `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (TeachingAssignment) TableName() string {
	return "teaching_assignments"
}

type AssignmentResource struct {
	ID           uint64    `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	AssignmentID uint64    `gorm:"column:assignment_id;not null;default:0;index:idx_assignment_resources_assignment_id" json:"assignmentId"`
	ResourceType string    `gorm:"column:resource_type;size:32;not null;default:'';index:idx_assignment_resources_type" json:"resourceType"`
	ResourceID   uint64    `gorm:"column:resource_id;not null;default:0;index:idx_assignment_resources_resource_id" json:"resourceId"`
	UnitID       uint64    `gorm:"column:unit_id;not null;default:0" json:"unitId"`
	LessonID     uint64    `gorm:"column:lesson_id;not null;default:0" json:"lessonId"`
	ManualID     uint64    `gorm:"column:manual_id;not null;default:0" json:"manualId"`
	SortOrder    int       `gorm:"column:sort_order;not null;default:0" json:"sortOrder"`
	CreatedAt    time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt    time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (AssignmentResource) TableName() string {
	return "assignment_resources"
}

type AssignmentClass struct {
	ID           uint64    `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	AssignmentID uint64    `gorm:"column:assignment_id;not null;default:0;uniqueIndex:idx_assignment_classes_assignment_class;index:idx_assignment_classes_assignment_id" json:"assignmentId"`
	ClassID      uint64    `gorm:"column:class_id;not null;default:0;uniqueIndex:idx_assignment_classes_assignment_class;index:idx_assignment_classes_class_id" json:"classId"`
	CreatedAt    time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
}

func (AssignmentClass) TableName() string {
	return "assignment_classes"
}

type AssignmentRule struct {
	ID            uint64    `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	AssignmentID  uint64    `gorm:"column:assignment_id;not null;default:0;uniqueIndex:idx_assignment_rules_assignment_id" json:"assignmentId"`
	AttemptLimit  int       `gorm:"column:attempt_limit;not null;default:1" json:"attemptLimit"`
	AllowLate     bool      `gorm:"column:allow_late;not null;default:false" json:"allowLate"`
	AllowReturn   bool      `gorm:"column:allow_return;not null;default:true" json:"allowReturn"`
	AllowResubmit bool      `gorm:"column:allow_resubmit;not null;default:false" json:"allowResubmit"`
	ScoreMode     string    `gorm:"column:score_mode;size:32;not null;default:'completion'" json:"scoreMode"`
	CreatedAt     time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt     time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (AssignmentRule) TableName() string {
	return "assignment_rules"
}

type AssignmentResourceInput struct {
	ResourceType string `json:"resourceType"`
	ResourceID   uint64 `json:"resourceId"`
	UnitID       uint64 `json:"unitId"`
	LessonID     uint64 `json:"lessonId"`
	ManualID     uint64 `json:"manualId"`
	SortOrder    int    `json:"sortOrder"`
}

type AssignmentRuleInput struct {
	AttemptLimit  int    `json:"attemptLimit"`
	AllowLate     bool   `json:"allowLate"`
	AllowReturn   *bool  `json:"allowReturn"`
	AllowResubmit bool   `json:"allowResubmit"`
	ScoreMode     string `json:"scoreMode"`
}

type RubricItemInput struct {
	Title       string  `json:"title"`
	Description string  `json:"description"`
	MaxScore    float64 `json:"maxScore"`
	SortOrder   int     `json:"sortOrder"`
}

type UpsertAssignmentRequest struct {
	Title       string                    `json:"title"`
	Description string                    `json:"description"`
	DueAt       *time.Time                `json:"dueAt"`
	ClassIDs    []uint64                  `json:"classIds"`
	Resources   []AssignmentResourceInput `json:"resources"`
	Rule        *AssignmentRuleInput      `json:"rule"`
	RubricItems []RubricItemInput         `json:"rubricItems"`
}

type AssignmentListQuery struct {
	Page     int
	PageSize int
	Q        string
	Status   *AssignmentStatus
	ClassID  uint64
}

type AssignmentListItem struct {
	TeachingAssignment
	CreatorName   string `json:"creatorName"`
	ClassCount    int64  `json:"classCount"`
	ResourceCount int64  `json:"resourceCount"`
	StudentCount  int64  `json:"studentCount"`
	CanEnter      bool   `json:"canEnter"`
}

type AssignmentClassItem struct {
	ClassID           uint64 `json:"classId"`
	Name              string `json:"name"`
	Code              string `json:"code"`
	Status            int    `json:"status"`
	OwnerTeacherID    uint64 `json:"ownerTeacherId"`
	ActiveMemberCount int64  `json:"activeMemberCount"`
}

type AssignmentResourceItem struct {
	AssignmentResource
	Title  string `json:"title"`
	Status int    `json:"status"`
}

type AssignmentDetail struct {
	TeachingAssignment
	CreatorName        string                   `json:"creatorName"`
	Classes            []AssignmentClassItem    `json:"classes"`
	Resources          []AssignmentResourceItem `json:"resources"`
	Rule               AssignmentRule           `json:"rule"`
	Rubric             RubricDetail             `json:"rubric"`
	SubmissionProgress *SubmissionProgress      `json:"submissionProgress,omitempty"`
	StudentSubmission  *StudentSubmissionState  `json:"studentSubmission,omitempty"`
	CanEnter           bool                     `json:"canEnter"`
}

type AssignmentListResponse struct {
	List  []AssignmentListItem `json:"list"`
	Total int64                `json:"total"`
}

type AssignmentIssue struct {
	Code        string `json:"code"`
	Scope       string `json:"scope"`
	Message     string `json:"message"`
	ResourceID  uint64 `json:"resourceId,omitempty"`
	ResourceRef string `json:"resourceRef,omitempty"`
}

type PublishCheckResult struct {
	CanPublish bool              `json:"canPublish"`
	Errors     []AssignmentIssue `json:"errors"`
	Warnings   []AssignmentIssue `json:"warnings"`
	Summary    string            `json:"summary"`
}

type BlockedError struct {
	Result PublishCheckResult
}

func (e *BlockedError) Error() string {
	return "作业发布检查未通过"
}

func (e *BlockedError) StatusCode() int {
	return 409
}

func (e *BlockedError) Code() string {
	return "ASSIGNMENT_PUBLISH_BLOCKED"
}

func (e *BlockedError) Payload() any {
	return e.Result
}

type AssignmentOverview struct {
	Total           int64 `json:"total"`
	Draft           int64 `json:"draft"`
	Published       int64 `json:"published"`
	Closed          int64 `json:"closed"`
	Archived        int64 `json:"archived"`
	Overdue         int64 `json:"overdue"`
	Submitted       int64 `json:"submitted"`
	PendingReview   int64 `json:"pendingReview"`
	Returned        int64 `json:"returned"`
	Graded          int64 `json:"graded"`
	PublishedGrades int64 `json:"publishedGrades"`
}
