package publishing

import "time"

type LabTemplateStatus int

const (
	LabTemplateStatusActive   LabTemplateStatus = 1
	LabTemplateStatusDisabled LabTemplateStatus = 2
)

type LabTemplateAppPort struct {
	Name          string `json:"name"`
	Label         string `json:"label"`
	ContainerPort int32  `json:"containerPort"`
	Path          string `json:"path"`
}

type LabTemplateExposedPort struct {
	Type          string `json:"type"`
	Name          string `json:"name"`
	Label         string `json:"label"`
	ContainerPort int32  `json:"containerPort"`
	Path          string `json:"path"`
	IsDefault     bool   `json:"isDefault"`
}

type LabTemplate struct {
	ID                 uint64                   `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	Name               string                   `gorm:"column:name;size:128;not null;default:''" json:"name"`
	Code               string                   `gorm:"column:code;size:128;uniqueIndex;not null;default:''" json:"code"`
	Description        string                   `gorm:"column:description;size:512;not null;default:''" json:"description"`
	RuntimeMode        string                   `gorm:"column:runtime_mode;size:32;not null;default:'classic'" json:"runtimeMode"`
	EnvImage           string                   `gorm:"column:env_image;size:256;not null;default:''" json:"envImage"`
	IDEImage           string                   `gorm:"column:ide_image;size:256;not null;default:''" json:"ideImage"`
	MainCPURequest     string                   `gorm:"column:main_cpu_request;size:32;not null;default:'250m'" json:"mainCpuRequest"`
	MainMemoryRequest  string                   `gorm:"column:main_memory_request;size:32;not null;default:'512Mi'" json:"mainMemoryRequest"`
	MainCPULimit       string                   `gorm:"column:main_cpu_limit;size:32;not null;default:'2'" json:"mainCpuLimit"`
	MainMemoryLimit    string                   `gorm:"column:main_memory_limit;size:32;not null;default:'2Gi'" json:"mainMemoryLimit"`
	IDECPURequest      string                   `gorm:"column:ide_cpu_request;size:32;not null;default:'100m'" json:"ideCpuRequest"`
	IDEMemoryRequest   string                   `gorm:"column:ide_memory_request;size:32;not null;default:'256Mi'" json:"ideMemoryRequest"`
	IDECPULimit        string                   `gorm:"column:ide_cpu_limit;size:32;not null;default:'1'" json:"ideCpuLimit"`
	IDEMemoryLimit     string                   `gorm:"column:ide_memory_limit;size:32;not null;default:'1Gi'" json:"ideMemoryLimit"`
	DesktopEnabled     bool                     `gorm:"column:desktop_enabled;not null;default:true" json:"desktopEnabled"`
	AppPorts           []LabTemplateAppPort     `gorm:"column:app_ports;serializer:json" json:"appPorts"`
	DefaultAppPortName string                   `gorm:"column:default_app_port_name;size:32;not null;default:''" json:"defaultAppPortName"`
	ExposedPorts       []LabTemplateExposedPort `gorm:"column:exposed_ports;serializer:json" json:"exposedPorts"`
	Status             LabTemplateStatus        `gorm:"column:status;not null;default:1" json:"status"`
	CreatedBy          uint64                   `gorm:"column:created_by;not null;default:0" json:"createdBy"`
	CreatedAt          time.Time                `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt          time.Time                `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (LabTemplate) TableName() string {
	return "lab_templates"
}

type JSONMap map[string]any

type CheckIssue struct {
	Code         string `json:"code"`
	Severity     string `json:"severity"`
	Message      string `json:"message"`
	Scope        string `json:"scope,omitempty"`
	ResourceID   uint64 `json:"resourceId,omitempty"`
	ResourceName string `json:"resourceName,omitempty"`
}

type PublishCheckResult struct {
	CheckID     uint64       `json:"checkId,omitempty"`
	ContentType string       `json:"contentType"`
	ContentID   uint64       `json:"contentId"`
	CanPublish  bool         `json:"canPublish"`
	Errors      []CheckIssue `json:"errors"`
	Warnings    []CheckIssue `json:"warnings"`
	Summary     JSONMap      `json:"summary"`
	Snapshot    JSONMap      `json:"snapshot"`
	CheckedAt   time.Time    `json:"checkedAt"`
}

type ContentPublishCheck struct {
	ID          uint64       `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	ContentType string       `gorm:"column:content_type;size:32;index;not null;default:''" json:"contentType"`
	ContentID   uint64       `gorm:"column:content_id;index;not null;default:0" json:"contentId"`
	ActorID     uint64       `gorm:"column:actor_id;index;not null;default:0" json:"actorId"`
	CanPublish  bool         `gorm:"column:can_publish;not null;default:false" json:"canPublish"`
	Errors      []CheckIssue `gorm:"column:errors;serializer:json" json:"errors"`
	Warnings    []CheckIssue `gorm:"column:warnings;serializer:json" json:"warnings"`
	Summary     JSONMap      `gorm:"column:summary;serializer:json" json:"summary"`
	Snapshot    JSONMap      `gorm:"column:snapshot;serializer:json" json:"snapshot"`
	CreatedAt   time.Time    `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
}

func (ContentPublishCheck) TableName() string {
	return "content_publish_checks"
}

type PublishAuditLog struct {
	ID           uint64       `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	ContentType  string       `gorm:"column:content_type;size:32;index;not null;default:''" json:"contentType"`
	ContentID    uint64       `gorm:"column:content_id;index;not null;default:0" json:"contentId"`
	ContentTitle string       `gorm:"column:content_title;size:255;not null;default:''" json:"contentTitle"`
	Action       string       `gorm:"column:action;size:32;index;not null;default:''" json:"action"`
	ActorID      uint64       `gorm:"column:actor_id;index;not null;default:0" json:"actorId"`
	Result       string       `gorm:"column:result;size:32;not null;default:''" json:"result"`
	Message      string       `gorm:"column:message;size:512;not null;default:''" json:"message"`
	CheckID      uint64       `gorm:"column:check_id;not null;default:0" json:"checkId"`
	Errors       []CheckIssue `gorm:"column:errors;serializer:json" json:"errors"`
	Warnings     []CheckIssue `gorm:"column:warnings;serializer:json" json:"warnings"`
	Snapshot     JSONMap      `gorm:"column:snapshot;serializer:json" json:"snapshot"`
	CreatedAt    time.Time    `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
}

func (PublishAuditLog) TableName() string {
	return "publish_audit_logs"
}

type BlockedError struct {
	Result *PublishCheckResult
}

func (e *BlockedError) Error() string {
	return "发布检查未通过"
}

func (e *BlockedError) StatusCode() int {
	return 409
}

func (e *BlockedError) Code() string {
	return "PUBLISH_CHECK_FAILED"
}

func (e *BlockedError) Payload() any {
	return e.Result
}
