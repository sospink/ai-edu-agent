package openclawview

type ViewScope string

const (
	ScopeAll        ViewScope = "all"
	ScopeLatestTurn ViewScope = "latest_turn"
)

type ThinkingMessage struct {
	ID        string `json:"id"`
	TS        int64  `json:"ts"`
	Source    string `json:"source"`
	Role      string `json:"role"`
	Content   string `json:"content"`
	MessageID string `json:"messageId,omitempty"`
	MsgType   string `json:"msgType,omitempty"`
	FileKey   string `json:"fileKey,omitempty"`
	FileName  string `json:"fileName,omitempty"`
}

type ThinkingView struct {
	Messages []ThinkingMessage `json:"messages"`
}

type ExecutingEvent struct {
	ID          string `json:"id"`
	TS          int64  `json:"ts"`
	Title       string `json:"title"`
	Desc        string `json:"desc"`
	Level       string `json:"level"`
	Source      string `json:"source,omitempty"`
	Kind        string `json:"kind,omitempty"`
	Method      string `json:"method,omitempty"`
	MessageID   string `json:"messageId,omitempty"`
	CardID      string `json:"cardId,omitempty"`
	SessionKey  string `json:"sessionKey,omitempty"`
	QueuedFinal bool   `json:"queuedFinal,omitempty"`
	Replies     int    `json:"replies,omitempty"`
}

type ExecutingToolchainSkill struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Active bool   `json:"active"`
	State  string `json:"state"`
	Source string `json:"source"`
	Detail string `json:"detail"`
}

type ExecutingView struct {
	Status      string                    `json:"status"`
	Progress    int                       `json:"progress"`
	CurrentStep string                    `json:"currentStep"`
	Events      []ExecutingEvent          `json:"events"`
	Toolchain   []ExecutingToolchainSkill `json:"toolchain"`
}

type CompletedArtifact struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Type   string `json:"type"`
	Size   string `json:"size,omitempty"`
	URL    string `json:"url"`
	Source string `json:"source"`
}

type CompletedFinalMessage struct {
	ID      string `json:"id"`
	TS      int64  `json:"ts"`
	Content string `json:"content"`
}

type CompletedStep struct {
	ID     string `json:"id"`
	Title  string `json:"title"`
	Desc   string `json:"desc"`
	TS     int64  `json:"ts"`
	Status string `json:"status"`
}

type CompletedMetrics struct {
	DurationSeconds int `json:"durationSeconds"`
	SuccessRate     int `json:"successRate"`
	TotalSteps      int `json:"totalSteps"`
	TotalEvents     int `json:"totalEvents"`
	ActiveSkills    int `json:"activeSkills"`
}

type CompletedView struct {
	Summary       string                  `json:"summary"`
	Artifacts     []CompletedArtifact     `json:"artifacts"`
	FinalMessages []CompletedFinalMessage `json:"finalMessages"`
	Steps         []CompletedStep         `json:"steps"`
	Metrics       CompletedMetrics        `json:"metrics"`
}

type PhaseResponse struct {
	Phase          string `json:"phase"`
	Progress       int    `json:"progress"`
	EventsCount    int    `json:"eventsCount"`
	ArtifactsCount int    `json:"artifactsCount"`
}
