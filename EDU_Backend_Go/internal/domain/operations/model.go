package operations

import "time"

const (
	QuotaScopeGlobal = "global"
	QuotaScopeClass  = "class"
	QuotaScopeUser   = "user"
)

const (
	RuntimeEventCreateRequested     = "create_requested"
	RuntimeEventCreateBlockedQuota  = "create_blocked_by_quota"
	RuntimeEventCreated             = "created"
	RuntimeEventReady               = "ready"
	RuntimeEventError               = "error"
	RuntimeEventStoppedByUser       = "stopped_by_user"
	RuntimeEventStoppedByAdmin      = "stopped_by_admin"
	RuntimeEventExpiredRecycled     = "expired_recycled"
	RuntimeEventOrphanRecycled      = "orphan_recycled"
	RuntimeEventRuntimeMissing      = "runtime_missing"
	RuntimeEventRuntimePhaseStopped = "runtime_phase_stopped"
)

const (
	AuditActionLogin          = "login"
	AuditActionLogout         = "logout"
	AuditActionQuotaCreate    = "quota_create"
	AuditActionQuotaUpdate    = "quota_update"
	AuditActionQuotaStatus    = "quota_status"
	AuditActionSessionStop    = "runtime_session_stop"
	AuditActionSessionRecycle = "runtime_session_recycle"
	AuditActionTemplateStatus = "template_status"
	AuditActionPermissionRead = "permission_read"
	AuditResultSuccess        = "success"
	AuditResultFailed         = "failed"
	AuditResultNoop           = "noop"
)

type JSONMap map[string]any

type ResourceQuota struct {
	ID                    uint64    `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	ScopeType             string    `gorm:"column:scope_type;size:32;not null;default:'global';uniqueIndex:idx_resource_quotas_scope" json:"scopeType"`
	ScopeID               uint64    `gorm:"column:scope_id;not null;default:0;uniqueIndex:idx_resource_quotas_scope" json:"scopeId"`
	Name                  string    `gorm:"column:name;size:128;not null;default:''" json:"name"`
	MaxConcurrentSessions int       `gorm:"column:max_concurrent_sessions;not null;default:1" json:"maxConcurrentSessions"`
	MaxSessionMinutes     int       `gorm:"column:max_session_minutes;not null;default:120" json:"maxSessionMinutes"`
	Enabled               bool      `gorm:"column:enabled;not null;default:true;index:idx_resource_quotas_enabled" json:"enabled"`
	CreatedBy             uint64    `gorm:"column:created_by;not null;default:0" json:"createdBy"`
	UpdatedBy             uint64    `gorm:"column:updated_by;not null;default:0" json:"updatedBy"`
	CreatedAt             time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt             time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (ResourceQuota) TableName() string {
	return "resource_quotas"
}

type RuntimeSessionEvent struct {
	ID         uint64    `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	SessionID  uint64    `gorm:"column:session_id;not null;default:0;index:idx_runtime_session_events_session" json:"sessionId"`
	UserID     uint64    `gorm:"column:user_id;not null;default:0;index:idx_runtime_session_events_user" json:"userId"`
	EventType  string    `gorm:"column:event_type;size:64;not null;default:'';index:idx_runtime_session_events_type" json:"eventType"`
	Status     string    `gorm:"column:status;size:32;not null;default:''" json:"status"`
	Message    string    `gorm:"column:message;size:512;not null;default:''" json:"message"`
	Metadata   JSONMap   `gorm:"column:metadata_json;serializer:json" json:"metadata"`
	OperatorID uint64    `gorm:"column:operator_id;not null;default:0;index:idx_runtime_session_events_operator" json:"operatorId"`
	CreatedAt  time.Time `gorm:"column:created_at;autoCreateTime;index:idx_runtime_session_events_created_at" json:"createdAt"`
}

func (RuntimeSessionEvent) TableName() string {
	return "runtime_session_events"
}

type AuditLog struct {
	ID         uint64    `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	ActorID    uint64    `gorm:"column:actor_id;not null;default:0;index:idx_audit_logs_actor" json:"actorId"`
	ActorRole  int       `gorm:"column:actor_role;not null;default:0;index:idx_audit_logs_actor_role" json:"actorRole"`
	Action     string    `gorm:"column:action;size:64;not null;default:'';index:idx_audit_logs_action" json:"action"`
	TargetType string    `gorm:"column:target_type;size:64;not null;default:'';index:idx_audit_logs_target" json:"targetType"`
	TargetID   uint64    `gorm:"column:target_id;not null;default:0;index:idx_audit_logs_target" json:"targetId"`
	Result     string    `gorm:"column:result;size:32;not null;default:'';index:idx_audit_logs_result" json:"result"`
	Message    string    `gorm:"column:message;size:512;not null;default:''" json:"message"`
	Metadata   JSONMap   `gorm:"column:metadata_json;serializer:json" json:"metadata"`
	IP         string    `gorm:"column:ip;size:64;not null;default:''" json:"ip"`
	UserAgent  string    `gorm:"column:user_agent;size:255;not null;default:''" json:"userAgent"`
	CreatedAt  time.Time `gorm:"column:created_at;autoCreateTime;index:idx_audit_logs_created_at" json:"createdAt"`
}

func (AuditLog) TableName() string {
	return "audit_logs"
}
