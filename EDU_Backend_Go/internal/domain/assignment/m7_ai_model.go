package assignment

import (
	"time"

	"edu-platform/internal/domain/agent"
)

const (
	AIRequestStatusSuccess = "success"
	AIRequestStatusFailed  = "failed"
)

const (
	AISuggestionTypeFeedbackDraft     = "feedback_draft"
	AISuggestionTypeAssignmentSummary = "assignment_summary"
	AISuggestionTypeWeaknessDiagnosis = "weakness_diagnosis"
	AISuggestionTypeStepInsight       = "step_insight"
	AISuggestionTypeClassInsight      = "class_insight"
	AISuggestionTypeStudentInsight    = "student_insight"
	AISuggestionTypeFAQSuggestion     = "faq_suggestion"
	AISuggestionStatusPending         = "pending"
	AISuggestionStatusConfirmed       = "confirmed"
	AISuggestionStatusDismissed       = "dismissed"
	AISourceTypeSubmission            = "submission"
	AISourceTypeAssignment            = "assignment"
	AISourceTypeStudent               = "student"
	AISourceTypeAgentStep             = "agent_step"
	AISourceTypeAgentClass            = "agent_class"
	AISourceTypeAgentStudent          = "agent_student"
	AIActionSuggestFeedback           = "suggest_feedback"
	AIActionAssignmentSummary         = "assignment_summary"
	AIActionWeaknessDiagnosis         = "weakness_diagnosis"
	AIActionStepInsight               = "step_insight"
	AIActionFAQSuggestion             = "faq_suggestion"
	AIActionConfirmSuggestion         = "confirm_suggestion"
	AIActionDismissSuggestion         = "dismiss_suggestion"
	AIActionSettingsUpdate            = "ai_settings_update"
)

type AIRequest struct {
	ID           uint64    `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	ActorID      uint64    `gorm:"column:actor_id;not null;default:0;index:idx_ai_requests_actor_id" json:"actorId"`
	Action       string    `gorm:"column:action;size:64;not null;default:'';index:idx_ai_requests_action" json:"action"`
	SourceType   string    `gorm:"column:source_type;size:32;not null;default:'';index:idx_ai_requests_source" json:"sourceType"`
	SourceID     uint64    `gorm:"column:source_id;not null;default:0;index:idx_ai_requests_source" json:"sourceId"`
	Model        string    `gorm:"column:model;size:128;not null;default:''" json:"model"`
	PromptTokens int       `gorm:"column:prompt_tokens;not null;default:0" json:"promptTokens"`
	TotalTokens  int       `gorm:"column:total_tokens;not null;default:0" json:"totalTokens"`
	LatencyMS    int64     `gorm:"column:latency_ms;not null;default:0" json:"latencyMs"`
	Status       string    `gorm:"column:status;size:32;not null;default:'success';index:idx_ai_requests_status" json:"status"`
	Error        string    `gorm:"column:error;type:text" json:"error"`
	CreatedAt    time.Time `gorm:"column:created_at;autoCreateTime;index:idx_ai_requests_created_at" json:"createdAt"`
}

func (AIRequest) TableName() string {
	return "ai_requests"
}

type AISuggestion struct {
	ID             uint64     `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	RequestID      uint64     `gorm:"column:request_id;not null;default:0;index:idx_ai_suggestions_request_id" json:"requestId"`
	SuggestionType string     `gorm:"column:suggestion_type;size:64;not null;default:'';index:idx_ai_suggestions_source_status" json:"suggestionType"`
	SourceType     string     `gorm:"column:source_type;size:32;not null;default:'';index:idx_ai_suggestions_source_status" json:"sourceType"`
	SourceID       uint64     `gorm:"column:source_id;not null;default:0;index:idx_ai_suggestions_source_status" json:"sourceId"`
	CreatedBy      uint64     `gorm:"column:created_by;not null;default:0;index:idx_ai_suggestions_created_by" json:"createdBy"`
	Title          string     `gorm:"column:title;size:255;not null;default:''" json:"title"`
	Content        string     `gorm:"column:content;type:text" json:"content"`
	Evidence       JSONMap    `gorm:"column:evidence_json;serializer:json" json:"evidence"`
	Status         string     `gorm:"column:status;size:32;not null;default:'pending';index:idx_ai_suggestions_source_status" json:"status"`
	ConfirmedBy    uint64     `gorm:"column:confirmed_by;not null;default:0" json:"confirmedBy"`
	ConfirmedAt    *time.Time `gorm:"column:confirmed_at" json:"confirmedAt"`
	AdoptedContent string     `gorm:"column:adopted_content;type:text" json:"adoptedContent"`
	CreatedAt      time.Time  `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt      time.Time  `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (AISuggestion) TableName() string {
	return "ai_suggestions"
}

type AIFeatureSetting struct {
	ID        uint64    `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	Enabled   bool      `gorm:"column:enabled;not null;default:true" json:"enabled"`
	UpdatedBy uint64    `gorm:"column:updated_by;not null;default:0" json:"updatedBy"`
	UpdatedAt time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (AIFeatureSetting) TableName() string {
	return "ai_feature_settings"
}

type AIGenerateRequest struct {
	ClassID uint64 `json:"classId"`
}

type AISuggestionActionRequest struct {
	Action string `json:"action"`
}

type AIStatusResponse struct {
	Enabled    bool   `json:"enabled"`
	Configured bool   `json:"configured"`
	Model      string `json:"model"`
}

type AgentStepStatsResponse struct {
	StepID          uint64          `json:"stepId"`
	StepOrder       int             `json:"stepOrder"`
	StepTitle       string          `json:"stepTitle"`
	TotalStudents   int             `json:"totalStudents"`
	CompletedCount  int             `json:"completedCount"`
	CompletionRate  float64         `json:"completionRate"`
	FailedCount     int             `json:"failedCount"`
	StrugglingCount int             `json:"strugglingCount"`
	RecentFailures  []RecentFailure `json:"recentFailures"`
}

type RecentFailure struct {
	StudentID     uint64 `json:"studentId"`
	FailureReason string `json:"failureReason"`
	FailedAt      string `json:"failedAt"`
}

type AgentStepInsightRequest struct {
	ClassID uint64 `json:"classId"`
}

type AgentObservatoryResponse struct {
	ManualID     uint64             `json:"manualId"`
	ClassID      uint64             `json:"classId"`
	Summary      AgentClassSummary  `json:"summary"`
	Steps        []AgentStepAxis    `json:"steps"`
	Students     []AgentStudentAxis `json:"students"`
	Heatmap      []AgentHeatmapCell `json:"heatmap"`
	RiskStudents []AgentRiskStudent `json:"riskStudents"`
}

type AgentClassSummary struct {
	TotalStudents     int     `json:"totalStudents"`
	CompletedCount    int     `json:"completedCount"`
	ActiveCount       int     `json:"activeCount"`
	AvgCompletionRate float64 `json:"avgCompletionRate"`
	AIUsageCount      int     `json:"aiUsageCount"`
}

type AgentStepAxis struct {
	StepID    uint64 `json:"stepId"`
	StepOrder int    `json:"stepOrder"`
	Title     string `json:"title"`
}

type AgentStudentAxis struct {
	StudentID uint64 `json:"studentId"`
	Name      string `json:"name"`
}

type AgentRiskStudent struct {
	StudentID      uint64 `json:"studentId"`
	Name           string `json:"name"`
	StuckStepCount int    `json:"stuckStepCount"`
	LastActiveAt   string `json:"lastActiveAt"`
}

type AgentHeatmapCell struct {
	StudentID    uint64 `json:"studentId"`
	StepID       uint64 `json:"stepId"`
	StepOrder    int    `json:"stepOrder"`
	Status       string `json:"status"`
	AttemptCount int    `json:"attemptCount"`
	FailCount    int    `json:"failCount"`
	AIEventCount int    `json:"aiEventCount"`
}

type AgentCellDetailResponse struct {
	StudentID        uint64                          `json:"studentId"`
	StepID           uint64                          `json:"stepId"`
	Attempts         []AgentStepAttemptSummary       `json:"attempts"`
	RecentMessages   []AgentChatMessageItem          `json:"recentMessages"`
	TerminalEvents   []LabTerminalEventItem          `json:"terminalEvents"`
	Interventions    []agent.AgentInterventionRecord `json:"interventions"`
	SuggestedActions []string                        `json:"suggestedActions"`
}

type AgentStepAttemptSummary struct {
	Success       bool   `json:"success"`
	FailureReason string `json:"failureReason"`
	CreatedAt     string `json:"createdAt"`
}

type AgentChatMessageItem struct {
	Role      string `json:"role"`
	Content   string `json:"content"`
	CreatedAt string `json:"createdAt"`
}

type LabTerminalEventItem struct {
	Command       string `json:"command"`
	OutputSummary string `json:"outputSummary"`
	ExitCode      int    `json:"exitCode"`
	CreatedAt     string `json:"createdAt"`
}

type AgentSkillWeaknessItem struct {
	SkillTag        string          `json:"skillTag"`
	FailureRate     float64         `json:"failureRate"`
	StuckStudentCnt int             `json:"stuckStudentCount"`
	CompletionRate  float64         `json:"completionRate"`
	Steps           []AgentStepAxis `json:"steps"`
}

type AgentStepSkillTagsRequest struct {
	Tags []string `json:"tags"`
}

type FAQPublishRequest struct {
	ClassID uint64 `json:"classId"`
}

type AgentInterventionRequest struct {
	ManualID   uint64 `json:"manualId"`
	ClassID    uint64 `json:"classId"`
	StepID     uint64 `json:"stepId"`
	StudentID  uint64 `json:"studentId"`
	ActionType string `json:"actionType"`
	Title      string `json:"title"`
	Content    string `json:"content"`
}
