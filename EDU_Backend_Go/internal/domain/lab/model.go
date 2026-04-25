package lab

import (
	"time"

	"edu-platform/internal/domain/publishing"
)

type SessionStatus uint8

const (
	SessionStatusCreating SessionStatus = 0
	SessionStatusRunning  SessionStatus = 1
	SessionStatusStopped  SessionStatus = 2
	SessionStatusError    SessionStatus = 3
)

type SourceType uint8

const (
	SourceTypeCourse  SourceType = 1
	SourceTypeProject SourceType = 2
)

type RuntimeMode uint8

const (
	RuntimeModeClassic  RuntimeMode = 1
	RuntimeModeOpenClaw RuntimeMode = 2
)

const (
	MainContainerName       = "lab"
	IDEContainerName        = "ide"
	PortNameNoVNC           = "novnc"
	PortNameIDE             = "ide"
	PortNameGateway         = "gateway"
	NoVNCPort         int32 = 6080
	SSHPort           int32 = 22
	IDEPort           int32 = 3000
	GatewayPort       int32 = 18789
)

type UserLabSession struct {
	ID                 uint64                          `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	UserID             uint64                          `gorm:"column:user_id;not null" json:"userId"`
	SourceType         SourceType                      `gorm:"column:source_type;not null" json:"sourceType"`
	SourceID           uint64                          `gorm:"column:source_id;not null" json:"sourceId"`
	ContainerID        string                          `gorm:"column:container_id;size:128;not null;default:''" json:"containerId"`
	ContainerName      string                          `gorm:"column:container_name;size:128;not null;default:''" json:"containerName"`
	ImageName          string                          `gorm:"column:image_name;size:256;not null;default:''" json:"imageName"`
	VNCPort            uint                            `gorm:"column:vnc_port;not null;default:0" json:"vncPort"`
	IDEPort            uint                            `gorm:"column:ide_port;not null;default:0" json:"idePort"`
	SSHPort            uint                            `gorm:"column:ssh_port;not null;default:0" json:"sshPort"`
	Status             SessionStatus                   `gorm:"column:status;not null;default:0" json:"status"`
	ErrorMessage       string                          `gorm:"column:error_message;size:512;not null;default:''" json:"errorMessage"`
	ExpiresAt          *time.Time                      `gorm:"column:expires_at" json:"expiresAt"`
	CreatedAt          time.Time                       `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt          time.Time                       `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	RuntimeMode        RuntimeMode                     `gorm:"column:runtime_mode;not null;default:1" json:"runtimeMode"`
	GatewayPort        uint                            `gorm:"column:gateway_port;not null;default:0" json:"gatewayPort"`
	GatewayToken       string                          `gorm:"column:gateway_token;size:128;not null;default:''" json:"gatewayToken"`
	DesktopEnabled     bool                            `gorm:"column:desktop_enabled;not null;default:true" json:"desktopEnabled"`
	AppPorts           []publishing.LabTemplateAppPort `gorm:"column:app_ports;serializer:json" json:"appPorts"`
	DefaultAppPortName string                          `gorm:"column:default_app_port_name;size:32;not null;default:''" json:"defaultAppPortName"`
}

func (UserLabSession) TableName() string {
	return "user_lab_sessions"
}

type URLs struct {
	VNCURL       string   `json:"vncUrl"`
	IDEURL       string   `json:"ideUrl"`
	SSHInfo      string   `json:"sshInfo"`
	GatewayURL   string   `json:"gatewayUrl"`
	GatewayToken string   `json:"gatewayToken"`
	RuntimeMode  string   `json:"runtimeMode"`
	AppURLs      []AppURL `json:"appUrls"`
}

type AppURL struct {
	Name          string `json:"name"`
	Label         string `json:"label"`
	ContainerPort int32  `json:"containerPort"`
	ServicePort   int32  `json:"servicePort"`
	Path          string `json:"path"`
	URL           string `json:"url"`
	IsDefault     bool   `json:"isDefault"`
}

type CreateSessionParams struct {
	UserID     uint64
	SourceType SourceType
	SourceID   uint64
}

type ExecuteResult struct {
	Success  bool   `json:"success"`
	Output   string `json:"output"`
	ExitCode int    `json:"exitCode"`
	Error    string `json:"error,omitempty"`
}
