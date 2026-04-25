package agent

import "time"

const (
	SourceTypeLesson      = 1
	SourceTypeProjectUnit = 2
)

const (
	AgentEventTypeOpen         = "widget_open"
	AgentEventTypeChat         = "chat_sent"
	AgentEventTypeHintRequest  = "hint_requested"
	AgentEventTypeVerify       = "verify_triggered"
	AgentEventTypeVerifyFail   = "verify_failed"
	AgentEventTypeVerifyPass   = "verify_passed"
	AgentEventTypeStepDone     = "step_completed"
	AgentEventTypeTroubleshoot = "troubleshoot_click"
)

const (
	AgentStepAttemptTypeVerify = "verify"
)

type JSONMap map[string]any

type ContentBlock struct {
	Type       string   `json:"type"`
	Text       string   `json:"text,omitempty"`
	Language   string   `json:"language,omitempty"`
	Code       string   `json:"code,omitempty"`
	Src        string   `json:"src,omitempty"`
	Items      []string `json:"items,omitempty"`
	Executable bool     `json:"executable,omitempty"`
}

type VerificationRule struct {
	Type    string `json:"type"`
	Path    string `json:"path,omitempty"`
	Command string `json:"command,omitempty"`
	Expect  string `json:"expect,omitempty"`
	Value   string `json:"value,omitempty"`
	Port    int    `json:"port,omitempty"`
	Script  string `json:"script,omitempty"`
}

type ChatMessage struct {
	Role      string `json:"role"`
	Content   string `json:"content"`
	Timestamp string `json:"timestamp,omitempty"`
}

type CoachRequest struct {
	ManualID         uint64        `json:"manualId"`
	StepOrder        int           `json:"stepOrder"`
	Question         string        `json:"question"`
	LabSessionID     uint64        `json:"labSessionId,omitempty"`
	ChatHistory      []ChatMessage `json:"chatHistory,omitempty"`
	Escalate         bool          `json:"escalate,omitempty"`
	TroubleshootMode bool          `json:"troubleshootMode,omitempty"`
}

type CoachMeta struct {
	HintLevel    int `json:"hintLevel"`
	FailureCount int `json:"failureCount"`
}

type AgentManual struct {
	ID          uint64      `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	SourceType  int         `gorm:"column:source_type;not null;default:1" json:"sourceType"`
	SourceID    uint64      `gorm:"column:source_id;not null;default:0" json:"sourceId"`
	Title       string      `gorm:"column:title;size:255;not null;default:''" json:"title"`
	Description string      `gorm:"column:description;type:text" json:"description"`
	IsPublished int         `gorm:"column:is_published;not null;default:0" json:"isPublished"`
	CreatorID   uint64      `gorm:"column:creator_id;not null;default:0" json:"creatorId"`
	CreatedAt   time.Time   `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time   `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	Steps       []AgentStep `gorm:"-" json:"steps,omitempty"`
}

func (AgentManual) TableName() string {
	return "agent_manuals"
}

type AgentStep struct {
	ID             uint64            `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	ManualID       uint64            `gorm:"column:manual_id;not null;default:0" json:"manualId"`
	StepOrder      int               `gorm:"column:step_order;not null;default:0" json:"stepOrder"`
	Title          string            `gorm:"column:title;size:255;not null;default:''" json:"title"`
	Content        []ContentBlock    `gorm:"column:content;serializer:json" json:"content"`
	QuickQuestions []string          `gorm:"column:quick_questions;serializer:json" json:"quickQuestions"`
	Verification   *VerificationRule `gorm:"column:verification;serializer:json" json:"verification"`
	SkillTags      []string          `gorm:"-" json:"skillTags,omitempty"`
	CreatedAt      time.Time         `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt      time.Time         `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (AgentStep) TableName() string {
	return "agent_steps"
}

type UserAgentProgress struct {
	ID             uint64        `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	UserID         uint64        `gorm:"column:user_id;not null;default:0" json:"userId"`
	ManualID       uint64        `gorm:"column:manual_id;not null;default:0" json:"manualId"`
	CurrentStep    int           `gorm:"column:current_step;not null;default:0" json:"currentStep"`
	CompletedSteps []int         `gorm:"column:completed_steps;serializer:json" json:"completedSteps"`
	ChatHistory    []ChatMessage `gorm:"column:chat_history;serializer:json" json:"chatHistory"`
	StartedAt      time.Time     `gorm:"column:started_at" json:"startedAt"`
	LastActiveAt   time.Time     `gorm:"column:last_active_at" json:"lastActiveAt"`
}

func (UserAgentProgress) TableName() string {
	return "user_agent_progress"
}

type AgentLearningEvent struct {
	ID        uint64    `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	UserID    uint64    `gorm:"column:user_id;not null;default:0;index:idx_agent_learning_events_user" json:"userId"`
	ManualID  uint64    `gorm:"column:manual_id;not null;default:0;index:idx_agent_learning_events_manual" json:"manualId"`
	StepOrder int       `gorm:"column:step_order;not null;default:0" json:"stepOrder"`
	EventType string    `gorm:"column:event_type;size:64;not null;default:'';index:idx_agent_learning_events_type" json:"eventType"`
	Meta      JSONMap   `gorm:"column:meta_json;serializer:json" json:"meta"`
	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime;index:idx_agent_learning_events_created" json:"createdAt"`
}

func (AgentLearningEvent) TableName() string {
	return "agent_learning_events"
}

type AgentStepAttempt struct {
	ID            uint64    `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	UserID        uint64    `gorm:"column:user_id;not null;default:0;index:idx_agent_step_attempts_user_step" json:"userId"`
	ManualID      uint64    `gorm:"column:manual_id;not null;default:0;index:idx_agent_step_attempts_manual" json:"manualId"`
	StepID        uint64    `gorm:"column:step_id;not null;default:0;index:idx_agent_step_attempts_user_step;index:idx_agent_step_attempts_step" json:"stepId"`
	StepOrder     int       `gorm:"column:step_order;not null;default:0" json:"stepOrder"`
	LabSessionID  uint64    `gorm:"column:lab_session_id;not null;default:0;index:idx_agent_step_attempts_lab_session" json:"labSessionId"`
	AttemptType   string    `gorm:"column:attempt_type;size:32;not null;default:'verify';index:idx_agent_step_attempts_type" json:"attemptType"`
	Success       bool      `gorm:"column:success;not null;default:false;index:idx_agent_step_attempts_success" json:"success"`
	FailureReason string    `gorm:"column:failure_reason;size:512;not null;default:''" json:"failureReason"`
	Evidence      JSONMap   `gorm:"column:evidence_json;serializer:json" json:"evidence"`
	CreatedAt     time.Time `gorm:"column:created_at;autoCreateTime;index:idx_agent_step_attempts_created" json:"createdAt"`
}

func (AgentStepAttempt) TableName() string {
	return "agent_step_attempts"
}

type AgentChatSession struct {
	ID           uint64    `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	UserID       uint64    `gorm:"column:user_id;not null;default:0;uniqueIndex:idx_chat_session_key" json:"userId"`
	ManualID     uint64    `gorm:"column:manual_id;not null;default:0;uniqueIndex:idx_chat_session_key" json:"manualId"`
	StepOrder    int       `gorm:"column:step_order;not null;default:0;uniqueIndex:idx_chat_session_key" json:"stepOrder"`
	LastActiveAt time.Time `gorm:"column:last_active_at" json:"lastActiveAt"`
	CreatedAt    time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt    time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (AgentChatSession) TableName() string {
	return "agent_chat_sessions"
}

type AgentChatMessage struct {
	ID        uint64    `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	SessionID uint64    `gorm:"column:session_id;not null;default:0;index:idx_agent_chat_messages_session" json:"sessionId"`
	Role      string    `gorm:"column:role;size:16;not null;default:''" json:"role"`
	Content   string    `gorm:"column:content;type:text" json:"content"`
	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime;index:idx_agent_chat_messages_created" json:"createdAt"`
}

func (AgentChatMessage) TableName() string {
	return "agent_chat_messages"
}

type AgentReflectionCard struct {
	ID                uint64    `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	UserID            uint64    `gorm:"column:user_id;not null;default:0;uniqueIndex:idx_reflection_user_manual" json:"userId"`
	ManualID          uint64    `gorm:"column:manual_id;not null;default:0;uniqueIndex:idx_reflection_user_manual" json:"manualId"`
	Summary           string    `gorm:"column:summary;type:text" json:"summary"`
	Strengths         JSONMap   `gorm:"column:strengths;serializer:json" json:"strengths"`
	StuckPoints       JSONMap   `gorm:"column:stuck_points;serializer:json" json:"stuckPoints"`
	ReviewSuggestions JSONMap   `gorm:"column:review_suggestions;serializer:json" json:"reviewSuggestions"`
	Evidence          JSONMap   `gorm:"column:evidence_json;serializer:json" json:"evidence"`
	Status            string    `gorm:"column:status;size:32;not null;default:'draft'" json:"status"`
	CreatedAt         time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt         time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (AgentReflectionCard) TableName() string {
	return "agent_reflection_cards"
}

type AgentStepSkillTag struct {
	ID        uint64    `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	ManualID  uint64    `gorm:"column:manual_id;not null;default:0;index:idx_agent_step_skill_tags_manual" json:"manualId"`
	StepID    uint64    `gorm:"column:step_id;not null;default:0;index:idx_agent_step_skill_tags_step" json:"stepId"`
	SkillTag  string    `gorm:"column:skill_tag;size:64;not null;default:'';index:idx_agent_step_skill_tags_tag" json:"skillTag"`
	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (AgentStepSkillTag) TableName() string {
	return "agent_step_skill_tags"
}

type AgentFAQItem struct {
	ID                 uint64     `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	ManualID           uint64     `gorm:"column:manual_id;not null;default:0;index:idx_agent_faq_items_manual" json:"manualId"`
	ClassID            uint64     `gorm:"column:class_id;not null;default:0;index:idx_agent_faq_items_class" json:"classId"`
	StepID             uint64     `gorm:"column:step_id;not null;default:0;index:idx_agent_faq_items_step" json:"stepId"`
	StepOrder          int        `gorm:"column:step_order;not null;default:0" json:"stepOrder"`
	Question           string     `gorm:"column:question;size:512;not null;default:''" json:"question"`
	Answer             string     `gorm:"column:answer;type:text" json:"answer"`
	SourceSuggestionID uint64     `gorm:"column:source_suggestion_id;not null;default:0;index:idx_agent_faq_items_suggestion" json:"sourceSuggestionId"`
	Status             string     `gorm:"column:status;size:32;not null;default:'published'" json:"status"`
	CreatedBy          uint64     `gorm:"column:created_by;not null;default:0" json:"createdBy"`
	PublishedAt        *time.Time `gorm:"column:published_at" json:"publishedAt"`
	CreatedAt          time.Time  `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt          time.Time  `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (AgentFAQItem) TableName() string {
	return "agent_faq_items"
}

type AgentInterventionRecord struct {
	ID         uint64     `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	ManualID   uint64     `gorm:"column:manual_id;not null;default:0;index:idx_agent_interventions_manual" json:"manualId"`
	ClassID    uint64     `gorm:"column:class_id;not null;default:0;index:idx_agent_interventions_class" json:"classId"`
	StepID     uint64     `gorm:"column:step_id;not null;default:0;index:idx_agent_interventions_step" json:"stepId"`
	StudentID  uint64     `gorm:"column:student_id;not null;default:0;index:idx_agent_interventions_student" json:"studentId"`
	TeacherID  uint64     `gorm:"column:teacher_id;not null;default:0;index:idx_agent_interventions_teacher" json:"teacherId"`
	ActionType string     `gorm:"column:action_type;size:32;not null;default:''" json:"actionType"`
	Title      string     `gorm:"column:title;size:128;not null;default:''" json:"title"`
	Content    string     `gorm:"column:content;type:text" json:"content"`
	Status     string     `gorm:"column:status;size:32;not null;default:'pending'" json:"status"`
	ReadAt     *time.Time `gorm:"column:read_at" json:"readAt"`
	CreatedAt  time.Time  `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt  time.Time  `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (AgentInterventionRecord) TableName() string {
	return "agent_intervention_records"
}

type LabTerminalEvent struct {
	ID            uint64    `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	UserID        uint64    `gorm:"column:user_id;not null;default:0;index:idx_lab_terminal_events_user" json:"userId"`
	LabSessionID  uint64    `gorm:"column:lab_session_id;not null;default:0;index:idx_lab_terminal_events_session" json:"labSessionId"`
	ManualID      uint64    `gorm:"column:manual_id;not null;default:0;index:idx_lab_terminal_events_manual" json:"manualId"`
	StepOrder     int       `gorm:"column:step_order;not null;default:0" json:"stepOrder"`
	Command       string    `gorm:"column:command;type:text" json:"command"`
	OutputSummary string    `gorm:"column:output_summary;type:text" json:"outputSummary"`
	ExitCode      int       `gorm:"column:exit_code;not null;default:0" json:"exitCode"`
	CreatedAt     time.Time `gorm:"column:created_at;autoCreateTime;index:idx_lab_terminal_events_created" json:"createdAt"`
}

func (LabTerminalEvent) TableName() string {
	return "lab_terminal_events"
}

type StepAttemptEvidence struct {
	VerificationOutput string `json:"verificationOutput"`
	VerificationCmd    string `json:"verificationCmd"`
	ExitCode           int    `json:"exitCode"`
	LabSessionID       uint64 `json:"labSessionId,omitempty"`
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

type VerifyResult struct {
	Success    bool        `json:"success"`
	Message    string      `json:"message"`
	Details    string      `json:"details,omitempty"`
	CheckItems []CheckItem `json:"checkItems,omitempty"`
}

type CheckItem struct {
	Name    string `json:"name"`
	Status  string `json:"status"`
	Message string `json:"message,omitempty"`
}

type RuntimeSession struct {
	ID            uint64
	UserID        uint64
	ContainerName string
	Status        string
}

type RuntimeCommandResult struct {
	Success  bool
	Output   string
	ExitCode int
	Error    string
}

type PromptEnhanceResult struct {
	Content     string   `json:"content"`
	Score       int      `json:"score"`
	Tokens      int      `json:"tokens"`
	Suggestions []string `json:"suggestions"`
}
