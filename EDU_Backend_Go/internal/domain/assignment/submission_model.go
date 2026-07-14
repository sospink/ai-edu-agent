package assignment

import "time"

const (
	SubmissionStatusNotStarted  = "not_started"
	SubmissionStatusInProgress  = "in_progress"
	SubmissionStatusSubmitted   = "submitted"
	SubmissionStatusReturned    = "returned"
	SubmissionStatusGraded      = "graded"
	SubmissionStatusResubmitted = "resubmitted"
)

const (
	GradeStatusPending     = "pending"
	GradeStatusAutoChecked = "auto_checked"
	GradeStatusReviewed    = "reviewed"
	GradeStatusPublished   = "published"
)

const (
	CheckTypeLessonProgress = "lesson_progress"
	CheckTypeAgentProgress  = "agent_progress"
	CheckTypeLabSession     = "lab_session"
	CheckTypeLabCommand     = "lab_command"
	CheckTypeManualReview   = "manual_review"
)

type Submission struct {
	ID                     uint64     `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	AssignmentID           uint64     `gorm:"column:assignment_id;not null;default:0;index:idx_submissions_assignment_id" json:"assignmentId"`
	StudentID              uint64     `gorm:"column:student_id;not null;default:0;index:idx_submissions_student_id" json:"studentId"`
	AttemptNo              int        `gorm:"column:attempt_no;not null;default:1" json:"attemptNo"`
	Status                 string     `gorm:"column:status;size:32;not null;default:'submitted';index:idx_submissions_status" json:"status"`
	ContentText            string     `gorm:"column:content_text;type:text" json:"contentText"`
	LabSessionID           uint64     `gorm:"column:lab_session_id;not null;default:0;index:idx_submissions_lab_session_id" json:"labSessionId"`
	LegacyRuntimeSessionID string     `gorm:"column:openclaw_session_id;size:128;not null;default:''" json:"-"`
	AgentManualID          uint64     `gorm:"column:agent_manual_id;not null;default:0;index:idx_submissions_agent_manual_id" json:"agentManualId"`
	SubmittedAt            *time.Time `gorm:"column:submitted_at" json:"submittedAt"`
	ReturnedAt             *time.Time `gorm:"column:returned_at" json:"returnedAt"`
	GradedAt               *time.Time `gorm:"column:graded_at" json:"gradedAt"`
	CreatedAt              time.Time  `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt              time.Time  `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (Submission) TableName() string {
	return "submissions"
}

type SubmissionFile struct {
	ID           uint64    `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	SubmissionID uint64    `gorm:"column:submission_id;not null;default:0;index:idx_submission_files_submission_id" json:"submissionId"`
	FileType     string    `gorm:"column:file_type;size:32;not null;default:'file'" json:"fileType"`
	Title        string    `gorm:"column:title;size:255;not null;default:''" json:"title"`
	URL          string    `gorm:"column:url;size:1024;not null;default:''" json:"url"`
	Metadata     JSONMap   `gorm:"column:metadata_json;serializer:json" json:"metadata"`
	CreatedAt    time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
}

func (SubmissionFile) TableName() string {
	return "submission_files"
}

type SubmissionCheck struct {
	ID           uint64    `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	SubmissionID uint64    `gorm:"column:submission_id;not null;default:0;index:idx_submission_checks_submission_id" json:"submissionId"`
	CheckType    string    `gorm:"column:check_type;size:32;not null;default:'';index:idx_submission_checks_check_type" json:"checkType"`
	Status       string    `gorm:"column:status;size:32;not null;default:'pending';index:idx_submission_checks_status" json:"status"`
	Score        float64   `gorm:"column:score;not null;default:0" json:"score"`
	MaxScore     float64   `gorm:"column:max_score;not null;default:0" json:"maxScore"`
	Command      string    `gorm:"column:command;type:text" json:"command"`
	Output       string    `gorm:"column:output;type:text" json:"output"`
	Error        string    `gorm:"column:error;type:text" json:"error"`
	Metadata     JSONMap   `gorm:"column:metadata_json;serializer:json" json:"metadata"`
	CreatedAt    time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
}

func (SubmissionCheck) TableName() string {
	return "submission_checks"
}

type Rubric struct {
	ID           uint64    `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	AssignmentID uint64    `gorm:"column:assignment_id;not null;default:0;uniqueIndex:idx_rubrics_assignment_id" json:"assignmentId"`
	Title        string    `gorm:"column:title;size:128;not null;default:'作业评分 Rubric'" json:"title"`
	TotalScore   float64   `gorm:"column:total_score;not null;default:100" json:"totalScore"`
	CreatedAt    time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt    time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (Rubric) TableName() string {
	return "rubrics"
}

type RubricItem struct {
	ID          uint64    `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	RubricID    uint64    `gorm:"column:rubric_id;not null;default:0;index:idx_rubric_items_rubric_id" json:"rubricId"`
	Title       string    `gorm:"column:title;size:128;not null;default:''" json:"title"`
	Description string    `gorm:"column:description;size:1024;not null;default:''" json:"description"`
	MaxScore    float64   `gorm:"column:max_score;not null;default:0" json:"maxScore"`
	SortOrder   int       `gorm:"column:sort_order;not null;default:0" json:"sortOrder"`
	CreatedAt   time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (RubricItem) TableName() string {
	return "rubric_items"
}

type RubricScore struct {
	RubricItemID uint64  `json:"rubricItemId"`
	Title        string  `json:"title"`
	Score        float64 `json:"score"`
	MaxScore     float64 `json:"maxScore"`
}

type Grade struct {
	ID           uint64        `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	SubmissionID uint64        `gorm:"column:submission_id;not null;default:0;uniqueIndex:idx_grades_submission_id" json:"submissionId"`
	StudentID    uint64        `gorm:"column:student_id;not null;default:0;index:idx_grades_student_id" json:"studentId"`
	AssignmentID uint64        `gorm:"column:assignment_id;not null;default:0;index:idx_grades_assignment_id" json:"assignmentId"`
	Score        float64       `gorm:"column:score;not null;default:0" json:"score"`
	MaxScore     float64       `gorm:"column:max_score;not null;default:100" json:"maxScore"`
	Status       string        `gorm:"column:status;size:32;not null;default:'pending';index:idx_grades_status" json:"status"`
	GradedBy     uint64        `gorm:"column:graded_by;not null;default:0;index:idx_grades_graded_by" json:"gradedBy"`
	RubricScores []RubricScore `gorm:"column:rubric_scores_json;serializer:json" json:"rubricScores"`
	PublishedAt  *time.Time    `gorm:"column:published_at" json:"publishedAt"`
	CreatedAt    time.Time     `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt    time.Time     `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (Grade) TableName() string {
	return "grades"
}

type TeacherFeedback struct {
	ID           uint64    `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	SubmissionID uint64    `gorm:"column:submission_id;not null;default:0;index:idx_teacher_feedback_submission_id" json:"submissionId"`
	TeacherID    uint64    `gorm:"column:teacher_id;not null;default:0;index:idx_teacher_feedback_teacher_id" json:"teacherId"`
	Content      string    `gorm:"column:content;type:text" json:"content"`
	Visibility   string    `gorm:"column:visibility;size:32;not null;default:'student'" json:"visibility"`
	CreatedAt    time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt    time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (TeacherFeedback) TableName() string {
	return "teacher_feedback"
}

type JSONMap map[string]interface{}

type RubricDetail struct {
	Rubric
	Items []RubricItem `json:"items"`
}

type SubmissionProgress struct {
	TotalStudents   int64 `json:"totalStudents"`
	Submitted       int64 `json:"submitted"`
	PendingReview   int64 `json:"pendingReview"`
	Returned        int64 `json:"returned"`
	Graded          int64 `json:"graded"`
	PublishedGrades int64 `json:"publishedGrades"`
}

type StudentSubmissionState struct {
	Status         string             `json:"status"`
	Latest         *SubmissionDetail  `json:"latest,omitempty"`
	History        []SubmissionDetail `json:"history"`
	GradeStatus    string             `json:"gradeStatus"`
	Grade          *Grade             `json:"grade,omitempty"`
	Feedback       *TeacherFeedback   `json:"feedback,omitempty"`
	CanSubmit      bool               `json:"canSubmit"`
	DisabledReason string             `json:"disabledReason,omitempty"`
}

type SubmissionFileInput struct {
	FileType string  `json:"fileType"`
	Title    string  `json:"title"`
	URL      string  `json:"url"`
	Metadata JSONMap `json:"metadata"`
}

type CreateSubmissionRequest struct {
	ContentText   string                `json:"contentText"`
	LabSessionID  uint64                `json:"labSessionId"`
	AgentManualID uint64                `json:"agentManualId"`
	Files         []SubmissionFileInput `json:"files"`
}

type RubricScoreInput struct {
	RubricItemID uint64  `json:"rubricItemId"`
	Score        float64 `json:"score"`
}

type GradeSubmissionRequest struct {
	Scores         []RubricScoreInput `json:"scores"`
	Feedback       string             `json:"feedback"`
	AISuggestionID uint64             `json:"aiSuggestionId"`
}

type ReturnSubmissionRequest struct {
	Feedback       string `json:"feedback"`
	AISuggestionID uint64 `json:"aiSuggestionId"`
}

type RunChecksRequest struct {
	Command string `json:"command"`
}

type SubmissionListQuery struct {
	Page         int
	PageSize     int
	Q            string
	Status       string
	AssignmentID uint64
	ClassID      uint64
}

type SubmissionListItem struct {
	Submission
	AssignmentTitle string  `json:"assignmentTitle"`
	StudentName     string  `json:"studentName"`
	StudentUsername string  `json:"studentUsername"`
	GradeStatus     string  `json:"gradeStatus"`
	Score           float64 `json:"score"`
	MaxScore        float64 `json:"maxScore"`
}

type SubmissionListResponse struct {
	List  []SubmissionListItem `json:"list"`
	Total int64                `json:"total"`
}

type SubmissionDetail struct {
	Submission
	AssignmentTitle string            `json:"assignmentTitle,omitempty"`
	StudentName     string            `json:"studentName,omitempty"`
	StudentUsername string            `json:"studentUsername,omitempty"`
	Files           []SubmissionFile  `json:"files"`
	Checks          []SubmissionCheck `json:"checks"`
	Grade           *Grade            `json:"grade,omitempty"`
	Feedback        *TeacherFeedback  `json:"feedback,omitempty"`
	Rubric          RubricDetail      `json:"rubric,omitempty"`
}

type StudentGradeItem struct {
	AssignmentID    uint64           `json:"assignmentId"`
	AssignmentTitle string           `json:"assignmentTitle"`
	SubmissionID    uint64           `json:"submissionId"`
	Status          string           `json:"status"`
	Score           *float64         `json:"score,omitempty"`
	MaxScore        *float64         `json:"maxScore,omitempty"`
	RubricScores    []RubricScore    `json:"rubricScores,omitempty"`
	Feedback        *TeacherFeedback `json:"feedback,omitempty"`
	PublishedAt     *time.Time       `json:"publishedAt,omitempty"`
}

type StudentGradesResponse struct {
	List []StudentGradeItem `json:"list"`
}
