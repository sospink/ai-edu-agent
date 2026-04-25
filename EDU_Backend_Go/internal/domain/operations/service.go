package operations

import (
	"context"
	"errors"
	"strings"
	"time"

	"go.uber.org/zap"
	"gorm.io/gorm"

	"edu-platform/internal/domain/classroom"
)

const DefaultSessionMinutes = 120

type Service struct {
	db  *gorm.DB
	log *zap.Logger
}

func NewService(db *gorm.DB, log *zap.Logger) *Service {
	return &Service{db: db, log: log}
}

type QuotaInput struct {
	ScopeType             string
	ScopeID               uint64
	Name                  string
	MaxConcurrentSessions int
	MaxSessionMinutes     int
	Enabled               *bool
}

type ResolvedQuota struct {
	Quota                 *ResourceQuota `json:"quota,omitempty"`
	MaxConcurrentSessions int            `json:"maxConcurrentSessions"`
	MaxSessionMinutes     int            `json:"maxSessionMinutes"`
	UnlimitedConcurrent   bool           `json:"unlimitedConcurrent"`
	Source                string         `json:"source"`
}

type QuotaListQuery struct {
	ScopeType string
	Enabled   string
	Q         string
	Page      int
	PageSize  int
}

type QuotaListResponse struct {
	List     []ResourceQuota `json:"list"`
	Total    int64           `json:"total"`
	Page     int             `json:"page"`
	PageSize int             `json:"pageSize"`
}

type AuditListQuery struct {
	ActorID    uint64
	Action     string
	TargetType string
	Result     string
	Q          string
	Page       int
	PageSize   int
}

type AuditListResponse struct {
	List     []AuditLog `json:"list"`
	Total    int64      `json:"total"`
	Page     int        `json:"page"`
	PageSize int        `json:"pageSize"`
}

func (s *Service) EnsureDefaultQuota(ctx context.Context) error {
	if s == nil || s.db == nil {
		return nil
	}
	var count int64
	if err := s.db.WithContext(ctx).Model(&ResourceQuota{}).Where("scope_type = ? AND scope_id = 0", QuotaScopeGlobal).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	return s.db.WithContext(ctx).Create(&ResourceQuota{
		ScopeType:             QuotaScopeGlobal,
		ScopeID:               0,
		Name:                  "全局默认配额",
		MaxConcurrentSessions: 1,
		MaxSessionMinutes:     DefaultSessionMinutes,
		Enabled:               true,
	}).Error
}

func (s *Service) ResolveQuotaForUser(ctx context.Context, userID uint64) (*ResolvedQuota, error) {
	if err := s.EnsureDefaultQuota(ctx); err != nil {
		return nil, err
	}

	var userQuota ResourceQuota
	if err := s.db.WithContext(ctx).
		Where("scope_type = ? AND scope_id = ? AND enabled = ?", QuotaScopeUser, userID, true).
		First(&userQuota).Error; err == nil {
		return resolvedFromQuota(&userQuota, QuotaScopeUser), nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	classIDs, err := s.activeClassIDsForUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	if len(classIDs) > 0 {
		var classQuotas []ResourceQuota
		if err := s.db.WithContext(ctx).
			Where("scope_type = ? AND enabled = ? AND scope_id IN ?", QuotaScopeClass, true, classIDs).
			Order("max_concurrent_sessions ASC, max_session_minutes ASC, id ASC").
			Find(&classQuotas).Error; err != nil {
			return nil, err
		}
		if len(classQuotas) > 0 {
			return resolvedFromQuota(&classQuotas[0], QuotaScopeClass), nil
		}
	}

	var globalQuota ResourceQuota
	if err := s.db.WithContext(ctx).
		Where("scope_type = ? AND scope_id = 0 AND enabled = ?", QuotaScopeGlobal, true).
		First(&globalQuota).Error; err == nil {
		return resolvedFromQuota(&globalQuota, QuotaScopeGlobal), nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	return &ResolvedQuota{
		MaxSessionMinutes:   DefaultSessionMinutes,
		UnlimitedConcurrent: true,
		Source:              "none",
	}, nil
}

func (s *Service) activeClassIDsForUser(ctx context.Context, userID uint64) ([]uint64, error) {
	var rows []struct {
		ClassID uint64 `gorm:"column:class_id"`
	}
	if err := s.db.WithContext(ctx).Table("class_members cm").
		Select("cm.class_id").
		Joins("JOIN classes c ON c.id = cm.class_id AND c.status = ?", classroom.ClassStatusActive).
		Where("cm.user_id = ? AND cm.status = ?", userID, classroom.ClassMemberStatusActive).
		Find(&rows).Error; err != nil {
		return nil, err
	}
	ids := make([]uint64, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.ClassID)
	}
	return ids, nil
}

func resolvedFromQuota(quota *ResourceQuota, source string) *ResolvedQuota {
	minutes := quota.MaxSessionMinutes
	if minutes <= 0 {
		minutes = DefaultSessionMinutes
	}
	return &ResolvedQuota{
		Quota:                 quota,
		MaxConcurrentSessions: quota.MaxConcurrentSessions,
		MaxSessionMinutes:     minutes,
		UnlimitedConcurrent:   quota.MaxConcurrentSessions <= 0,
		Source:                source,
	}
}

func (s *Service) ListQuotas(ctx context.Context, query QuotaListQuery) (*QuotaListResponse, error) {
	if err := s.EnsureDefaultQuota(ctx); err != nil {
		return nil, err
	}
	page, pageSize := normalizePage(query.Page, query.PageSize)
	db := s.db.WithContext(ctx).Model(&ResourceQuota{})
	if query.ScopeType != "" && query.ScopeType != "all" {
		db = db.Where("scope_type = ?", query.ScopeType)
	}
	if query.Enabled == "true" {
		db = db.Where("enabled = ?", true)
	} else if query.Enabled == "false" {
		db = db.Where("enabled = ?", false)
	}
	if strings.TrimSpace(query.Q) != "" {
		like := "%" + strings.TrimSpace(query.Q) + "%"
		db = db.Where("name LIKE ? OR scope_type LIKE ?", like, like)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, err
	}
	var list []ResourceQuota
	if err := db.Order("scope_type ASC, scope_id ASC, id ASC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&list).Error; err != nil {
		return nil, err
	}
	return &QuotaListResponse{List: list, Total: total, Page: page, PageSize: pageSize}, nil
}

func (s *Service) CreateQuota(ctx context.Context, actorID uint64, input QuotaInput) (*ResourceQuota, error) {
	normalized, err := normalizeQuotaInput(input)
	if err != nil {
		return nil, err
	}
	normalized.CreatedBy = actorID
	normalized.UpdatedBy = actorID
	if err := s.db.WithContext(ctx).Create(normalized).Error; err != nil {
		return nil, err
	}
	_ = s.RecordAudit(ctx, AuditLog{ActorID: actorID, Action: AuditActionQuotaCreate, TargetType: "resource_quota", TargetID: normalized.ID, Result: AuditResultSuccess, Message: "创建资源配额", Metadata: quotaMetadata(*normalized)})
	return normalized, nil
}

func (s *Service) UpdateQuota(ctx context.Context, actorID, id uint64, input QuotaInput) (*ResourceQuota, error) {
	var quota ResourceQuota
	if err := s.db.WithContext(ctx).First(&quota, id).Error; err != nil {
		return nil, err
	}
	normalized, err := normalizeQuotaInput(input)
	if err != nil {
		return nil, err
	}
	quota.ScopeType = normalized.ScopeType
	quota.ScopeID = normalized.ScopeID
	quota.Name = normalized.Name
	quota.MaxConcurrentSessions = normalized.MaxConcurrentSessions
	quota.MaxSessionMinutes = normalized.MaxSessionMinutes
	quota.Enabled = normalized.Enabled
	quota.UpdatedBy = actorID
	if err := s.db.WithContext(ctx).Save(&quota).Error; err != nil {
		return nil, err
	}
	_ = s.RecordAudit(ctx, AuditLog{ActorID: actorID, Action: AuditActionQuotaUpdate, TargetType: "resource_quota", TargetID: quota.ID, Result: AuditResultSuccess, Message: "更新资源配额", Metadata: quotaMetadata(quota)})
	return &quota, nil
}

func (s *Service) SetQuotaStatus(ctx context.Context, actorID, id uint64, enabled bool) (*ResourceQuota, error) {
	var quota ResourceQuota
	if err := s.db.WithContext(ctx).First(&quota, id).Error; err != nil {
		return nil, err
	}
	quota.Enabled = enabled
	quota.UpdatedBy = actorID
	if err := s.db.WithContext(ctx).Save(&quota).Error; err != nil {
		return nil, err
	}
	_ = s.RecordAudit(ctx, AuditLog{ActorID: actorID, Action: AuditActionQuotaStatus, TargetType: "resource_quota", TargetID: quota.ID, Result: AuditResultSuccess, Message: "更新资源配额状态", Metadata: quotaMetadata(quota)})
	return &quota, nil
}

func normalizeQuotaInput(input QuotaInput) (*ResourceQuota, error) {
	scopeType := strings.ToLower(strings.TrimSpace(input.ScopeType))
	if scopeType == "" {
		scopeType = QuotaScopeGlobal
	}
	if scopeType != QuotaScopeGlobal && scopeType != QuotaScopeClass && scopeType != QuotaScopeUser {
		return nil, errors.New("配额作用域无效")
	}
	scopeID := input.ScopeID
	if scopeType == QuotaScopeGlobal {
		scopeID = 0
	} else if scopeID == 0 {
		return nil, errors.New("班级或用户配额必须指定对象")
	}
	maxConcurrent := input.MaxConcurrentSessions
	if maxConcurrent < 0 {
		return nil, errors.New("最大并发会话数不能为负数")
	}
	maxMinutes := input.MaxSessionMinutes
	if maxMinutes <= 0 {
		return nil, errors.New("单次运行时长必须大于 0")
	}
	enabled := true
	if input.Enabled != nil {
		enabled = *input.Enabled
	}
	name := strings.TrimSpace(input.Name)
	if name == "" {
		name = scopeType + " 配额"
	}
	return &ResourceQuota{
		ScopeType:             scopeType,
		ScopeID:               scopeID,
		Name:                  name,
		MaxConcurrentSessions: maxConcurrent,
		MaxSessionMinutes:     maxMinutes,
		Enabled:               enabled,
	}, nil
}

func quotaMetadata(quota ResourceQuota) JSONMap {
	return JSONMap{
		"scopeType":             quota.ScopeType,
		"scopeId":               quota.ScopeID,
		"maxConcurrentSessions": quota.MaxConcurrentSessions,
		"maxSessionMinutes":     quota.MaxSessionMinutes,
		"enabled":               quota.Enabled,
	}
}

func (s *Service) RecordRuntimeEvent(ctx context.Context, event RuntimeSessionEvent) error {
	if s == nil || s.db == nil {
		return nil
	}
	return s.db.WithContext(ctx).Create(&event).Error
}

func (s *Service) ListRuntimeEvents(ctx context.Context, sessionID uint64) ([]RuntimeSessionEvent, error) {
	var events []RuntimeSessionEvent
	err := s.db.WithContext(ctx).Where("session_id = ?", sessionID).Order("created_at DESC, id DESC").Find(&events).Error
	return events, err
}

func (s *Service) RecordAudit(ctx context.Context, log AuditLog) error {
	if s == nil || s.db == nil {
		return nil
	}
	if strings.TrimSpace(log.Result) == "" {
		log.Result = AuditResultSuccess
	}
	return s.db.WithContext(ctx).Create(&log).Error
}

func (s *Service) ListAuditLogs(ctx context.Context, query AuditListQuery) (*AuditListResponse, error) {
	page, pageSize := normalizePage(query.Page, query.PageSize)
	db := s.db.WithContext(ctx).Model(&AuditLog{})
	if query.ActorID > 0 {
		db = db.Where("actor_id = ?", query.ActorID)
	}
	if strings.TrimSpace(query.Action) != "" && query.Action != "all" {
		db = db.Where("action = ?", strings.TrimSpace(query.Action))
	}
	if strings.TrimSpace(query.TargetType) != "" && query.TargetType != "all" {
		db = db.Where("target_type = ?", strings.TrimSpace(query.TargetType))
	}
	if strings.TrimSpace(query.Result) != "" && query.Result != "all" {
		db = db.Where("result = ?", strings.TrimSpace(query.Result))
	}
	if strings.TrimSpace(query.Q) != "" {
		like := "%" + strings.TrimSpace(query.Q) + "%"
		db = db.Where("action LIKE ? OR target_type LIKE ? OR message LIKE ?", like, like, like)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, err
	}
	var list []AuditLog
	if err := db.Order("created_at DESC, id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&list).Error; err != nil {
		return nil, err
	}
	return &AuditListResponse{List: list, Total: total, Page: page, PageSize: pageSize}, nil
}

func normalizePage(page, pageSize int) (int, int) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	return page, pageSize
}

func AuditFromRequest(actorID uint64, actorRole int, action, targetType string, targetID uint64, result, message, ip, userAgent string, metadata JSONMap) AuditLog {
	return AuditLog{
		ActorID:    actorID,
		ActorRole:  actorRole,
		Action:     action,
		TargetType: targetType,
		TargetID:   targetID,
		Result:     result,
		Message:    message,
		Metadata:   metadata,
		IP:         ip,
		UserAgent:  userAgent,
		CreatedAt:  time.Now(),
	}
}
