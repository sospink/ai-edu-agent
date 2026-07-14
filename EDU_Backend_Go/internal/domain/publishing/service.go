package publishing

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"time"

	"go.uber.org/zap"
	"gorm.io/gorm"
	"k8s.io/apimachinery/pkg/api/resource"

	"edu-platform/internal/domain/agent"
	"edu-platform/internal/domain/course"
	"edu-platform/internal/domain/operations"
	"edu-platform/internal/domain/project"
	"edu-platform/internal/domain/user"
	apperrors "edu-platform/pkg/errors"
)

const (
	ContentTypeCourse  = "course"
	ContentTypeProject = "project"
	ContentTypeManual  = "manual"

	AuditActionCheck          = "check"
	AuditActionPublish        = "publish"
	AuditActionArchive        = "archive"
	AuditActionDraft          = "draft"
	AuditActionTemplateCreate = "template_create"
	AuditActionTemplateUpdate = "template_update"
	AuditActionTemplateStatus = "template_status"

	AuditResultSuccess = "success"
	AuditResultBlocked = "blocked"
	AuditResultWarning = "warning"
)

type Service struct {
	db         *gorm.DB
	logger     *zap.Logger
	operations *operations.Service
}

func NewService(db *gorm.DB, logger *zap.Logger) *Service {
	return &Service{
		db:         db,
		logger:     logger,
		operations: operations.NewService(db, logger),
	}
}

type LabTemplateInput struct {
	Name               string
	Code               string
	Description        string
	EnvImage           string
	IDEImage           string
	MainCPURequest     string
	MainMemoryRequest  string
	MainCPULimit       string
	MainMemoryLimit    string
	IDECPURequest      string
	IDEMemoryRequest   string
	IDECPULimit        string
	IDEMemoryLimit     string
	DesktopEnabled     *bool
	AppPorts           []LabTemplateAppPort
	DefaultAppPortName string
	ExposedPorts       []LabTemplateExposedPort
	Status             LabTemplateStatus
}

type AuditListQuery struct {
	Page        int
	PageSize    int
	ContentType string
	Action      string
	Result      string
}

func (s *Service) ListLabTemplates(ctx context.Context, activeOnly bool) ([]LabTemplate, error) {
	db := s.db.WithContext(ctx).Model(&LabTemplate{}).Order("updated_at DESC")
	if activeOnly {
		db = db.Where("status = ?", LabTemplateStatusActive)
	}
	var templates []LabTemplate
	if err := db.Find(&templates).Error; err != nil {
		return nil, err
	}
	for idx := range templates {
		hydrateLabTemplatePortFields(&templates[idx])
	}
	return templates, nil
}

func (s *Service) CreateLabTemplate(ctx context.Context, actorID uint64, input LabTemplateInput) (*LabTemplate, error) {
	normalized, err := normalizeLabTemplateInput(input)
	if err != nil {
		return nil, err
	}
	var existing LabTemplate
	err = s.db.WithContext(ctx).Where("code = ?", normalized.Code).First(&existing).Error
	if err == nil {
		return nil, apperrors.BadRequest("Lab 模板编码已存在")
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	normalized.CreatedBy = actorID
	if err := s.db.WithContext(ctx).Create(normalized).Error; err != nil {
		return nil, err
	}
	_ = s.RecordAudit(ctx, PublishAuditLog{
		ContentType:  "lab_template",
		ContentID:    normalized.ID,
		ContentTitle: normalized.Name,
		Action:       AuditActionTemplateCreate,
		ActorID:      actorID,
		Result:       AuditResultSuccess,
		Message:      "Lab 模板已创建",
		Snapshot:     labTemplateSnapshot(*normalized),
	})
	return normalized, nil
}

func (s *Service) UpdateLabTemplate(ctx context.Context, actorID, id uint64, input LabTemplateInput) (*LabTemplate, error) {
	var template LabTemplate
	if err := s.db.WithContext(ctx).First(&template, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("Lab 模板不存在")
		}
		return nil, err
	}
	normalized, err := normalizeLabTemplateInput(input)
	if err != nil {
		return nil, err
	}
	if normalized.Code != template.Code {
		var existing LabTemplate
		err = s.db.WithContext(ctx).Where("code = ? AND id <> ?", normalized.Code, id).First(&existing).Error
		if err == nil {
			return nil, apperrors.BadRequest("Lab 模板编码已存在")
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
	}
	template.Name = normalized.Name
	template.Code = normalized.Code
	template.Description = normalized.Description
	template.LegacyRuntimeMode = normalized.LegacyRuntimeMode
	template.EnvImage = normalized.EnvImage
	template.IDEImage = normalized.IDEImage
	template.MainCPURequest = normalized.MainCPURequest
	template.MainMemoryRequest = normalized.MainMemoryRequest
	template.MainCPULimit = normalized.MainCPULimit
	template.MainMemoryLimit = normalized.MainMemoryLimit
	template.IDECPURequest = normalized.IDECPURequest
	template.IDEMemoryRequest = normalized.IDEMemoryRequest
	template.IDECPULimit = normalized.IDECPULimit
	template.IDEMemoryLimit = normalized.IDEMemoryLimit
	template.DesktopEnabled = normalized.DesktopEnabled
	template.AppPorts = normalized.AppPorts
	template.DefaultAppPortName = normalized.DefaultAppPortName
	template.ExposedPorts = normalized.ExposedPorts
	template.Status = normalized.Status
	if err := s.db.WithContext(ctx).Save(&template).Error; err != nil {
		return nil, err
	}
	_ = s.RecordAudit(ctx, PublishAuditLog{
		ContentType:  "lab_template",
		ContentID:    template.ID,
		ContentTitle: template.Name,
		Action:       AuditActionTemplateUpdate,
		ActorID:      actorID,
		Result:       AuditResultSuccess,
		Message:      "Lab 模板已更新",
		Snapshot:     labTemplateSnapshot(template),
	})
	_ = s.operations.RecordAudit(ctx, operations.AuditLog{
		ActorID:    actorID,
		Action:     operations.AuditActionTemplateStatus,
		TargetType: "lab_template",
		TargetID:   template.ID,
		Result:     operations.AuditResultSuccess,
		Message:    "Lab 模板状态已更新",
		Metadata: operations.JSONMap{
			"status": template.Status,
			"name":   template.Name,
			"code":   template.Code,
		},
	})
	return &template, nil
}

func (s *Service) UpdateLabTemplateStatus(ctx context.Context, actorID, id uint64, status LabTemplateStatus) (*LabTemplate, error) {
	if status != LabTemplateStatusActive && status != LabTemplateStatusDisabled {
		return nil, apperrors.BadRequest("无效的模板状态")
	}
	var template LabTemplate
	if err := s.db.WithContext(ctx).First(&template, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("Lab 模板不存在")
		}
		return nil, err
	}
	template.Status = status
	if err := s.db.WithContext(ctx).Save(&template).Error; err != nil {
		return nil, err
	}
	_ = s.RecordAudit(ctx, PublishAuditLog{
		ContentType:  "lab_template",
		ContentID:    template.ID,
		ContentTitle: template.Name,
		Action:       AuditActionTemplateStatus,
		ActorID:      actorID,
		Result:       AuditResultSuccess,
		Message:      "Lab 模板状态已更新",
		Snapshot:     labTemplateSnapshot(template),
	})
	return &template, nil
}

func (s *Service) ListAuditLogs(ctx context.Context, query AuditListQuery) ([]PublishAuditLog, int64, error) {
	db := s.db.WithContext(ctx).Model(&PublishAuditLog{})
	if strings.TrimSpace(query.ContentType) != "" {
		db = db.Where("content_type = ?", strings.TrimSpace(query.ContentType))
	}
	if strings.TrimSpace(query.Action) != "" {
		db = db.Where("action = ?", strings.TrimSpace(query.Action))
	}
	if strings.TrimSpace(query.Result) != "" {
		db = db.Where("result = ?", strings.TrimSpace(query.Result))
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var logs []PublishAuditLog
	if err := db.Order("created_at DESC").Offset((query.Page - 1) * query.PageSize).Limit(query.PageSize).Find(&logs).Error; err != nil {
		return nil, 0, err
	}
	return logs, total, nil
}

func (s *Service) CheckCourse(ctx context.Context, actorID uint64, roleType int, courseID uint64) (*PublishCheckResult, error) {
	var record course.Course
	if err := s.db.WithContext(ctx).First(&record, courseID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("课程不存在")
		}
		return nil, err
	}
	if err := ensureOwner(actorID, roleType, record.CreatorID, "无权检查该课程"); err != nil {
		return nil, err
	}

	result := newCheckResult(ContentTypeCourse, record.ID)
	var stages []course.CourseStage
	if err := s.db.WithContext(ctx).Where("course_id = ?", record.ID).Order("sort_order ASC").Find(&stages).Error; err != nil {
		return nil, err
	}
	var lessons []course.CourseLesson
	if err := s.db.WithContext(ctx).Where("course_id = ?", record.ID).Order("sort_order ASC").Find(&lessons).Error; err != nil {
		return nil, err
	}

	if strings.TrimSpace(record.Title) == "" {
		result.Errors = append(result.Errors, issue("COURSE_TITLE_REQUIRED", "基础信息", "课程标题不能为空", record.ID, record.Title))
	}
	if strings.TrimSpace(record.Slug) == "" {
		result.Errors = append(result.Errors, issue("COURSE_SLUG_REQUIRED", "基础信息", "课程 Slug 不能为空", record.ID, record.Title))
	}
	if len(stages) == 0 {
		result.Errors = append(result.Errors, issue("COURSE_STAGE_REQUIRED", "课程结构", "课程至少需要一个阶段", record.ID, record.Title))
	}
	if len(lessons) == 0 {
		result.Errors = append(result.Errors, issue("COURSE_LESSON_REQUIRED", "课程结构", "课程至少需要一个课时", record.ID, record.Title))
	}

	labLessons := filterCourseLabLessons(lessons)
	template, templateErr := s.activeLabTemplate(ctx, record.LabTemplateID)
	if record.LabTemplateID > 0 && templateErr != nil {
		result.Errors = append(result.Errors, issue("COURSE_TEMPLATE_INVALID", "Lab 模板", templateErr.Error(), record.LabTemplateID, ""))
	}
	if len(labLessons) > 0 && template == nil && strings.TrimSpace(record.EnvImage) == "" {
		result.Errors = append(result.Errors, issue("COURSE_LAB_IMAGE_REQUIRED", "Lab 运行时", "包含实验/挑战课时时，必须配置实验镜像或绑定启用中的 Lab 模板", record.ID, record.Title))
	}

	manualCoverage, verificationCoverage, err := s.checkCourseManuals(ctx, labLessons, result)
	if err != nil {
		return nil, err
	}
	materialWarnings, err := s.courseMaterialWarnings(ctx, lessons)
	if err != nil {
		return nil, err
	}
	result.Warnings = append(result.Warnings, materialWarnings...)
	result.Summary = JSONMap{
		"stageCount":           len(stages),
		"lessonCount":          len(lessons),
		"labLessonCount":       len(labLessons),
		"manualCoverage":       manualCoverage,
		"verificationCoverage": verificationCoverage,
		"hasEnvImage":          strings.TrimSpace(record.EnvImage) != "",
		"hasActiveTemplate":    template != nil,
	}
	result.Snapshot = JSONMap{
		"title":         record.Title,
		"slug":          record.Slug,
		"status":        record.Status,
		"envImage":      record.EnvImage,
		"ideImage":      record.IDEImage,
		"labTemplateId": record.LabTemplateID,
		"labTemplate":   nullableTemplateSnapshot(template),
	}
	return s.persistCheck(ctx, actorID, result)
}

func (s *Service) CheckProject(ctx context.Context, actorID uint64, roleType int, projectID uint64) (*PublishCheckResult, error) {
	var record project.Project
	if err := s.db.WithContext(ctx).First(&record, projectID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("项目不存在")
		}
		return nil, err
	}
	if err := ensureOwner(actorID, roleType, record.CreatedBy, "无权检查该项目"); err != nil {
		return nil, err
	}
	var units []project.ProjectUnit
	if err := s.db.WithContext(ctx).Where("project_id = ?", record.ID).Order("sort_order ASC").Find(&units).Error; err != nil {
		return nil, err
	}
	tags, err := s.projectTags(ctx, record.ID)
	if err != nil {
		return nil, err
	}
	result := newCheckResult(ContentTypeProject, record.ID)
	for _, tag := range tags {
		if project.IsRetiredProjectTag(tag.Name) {
			result.Errors = append(result.Errors, issue("PROJECT_TYPE_RETIRED", "项目类型", "该历史项目类型已下架，不能重新发布", record.ID, record.Title))
			break
		}
	}
	if strings.TrimSpace(record.Title) == "" {
		result.Errors = append(result.Errors, issue("PROJECT_TITLE_REQUIRED", "基础信息", "项目标题不能为空", record.ID, record.Title))
	}
	if strings.TrimSpace(record.Slug) == "" {
		result.Errors = append(result.Errors, issue("PROJECT_SLUG_REQUIRED", "基础信息", "项目 Slug 不能为空", record.ID, record.Title))
	}
	if len(units) == 0 {
		result.Errors = append(result.Errors, issue("PROJECT_UNIT_REQUIRED", "项目结构", "项目至少需要一个单元", record.ID, record.Title))
	}
	labUnits := filterProjectLabUnits(units)
	template, templateErr := s.activeLabTemplate(ctx, record.LabTemplateID)
	if record.LabTemplateID > 0 && templateErr != nil {
		result.Errors = append(result.Errors, issue("PROJECT_TEMPLATE_INVALID", "Lab 模板", templateErr.Error(), record.LabTemplateID, ""))
	}
	if len(labUnits) > 0 && template == nil && strings.TrimSpace(record.EnvImage) == "" {
		result.Errors = append(result.Errors, issue("PROJECT_LAB_IMAGE_REQUIRED", "Lab 运行时", "项目包含实验/挑战单元时，必须配置实验镜像或绑定启用中的 Lab 模板", record.ID, record.Title))
	}

	manualCoverage, verificationCoverage, err := s.checkProjectManuals(ctx, labUnits, result)
	if err != nil {
		return nil, err
	}
	result.Summary = JSONMap{
		"unitCount":            len(units),
		"labUnitCount":         len(labUnits),
		"manualCoverage":       manualCoverage,
		"verificationCoverage": verificationCoverage,
		"hasEnvImage":          strings.TrimSpace(record.EnvImage) != "",
		"hasActiveTemplate":    template != nil,
	}
	result.Snapshot["title"] = record.Title
	result.Snapshot["slug"] = record.Slug
	result.Snapshot["status"] = record.Status
	result.Snapshot["envImage"] = record.EnvImage
	result.Snapshot["ideImage"] = record.IDEImage
	result.Snapshot["labTemplateId"] = record.LabTemplateID
	result.Snapshot["labTemplate"] = nullableTemplateSnapshot(template)
	result.Snapshot["tags"] = tags
	return s.persistCheck(ctx, actorID, result)
}

func (s *Service) CheckManual(ctx context.Context, actorID uint64, roleType int, manualID uint64) (*PublishCheckResult, error) {
	var manual agent.AgentManual
	if err := s.db.WithContext(ctx).First(&manual, manualID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("手册不存在")
		}
		return nil, err
	}
	if err := ensureOwner(actorID, roleType, manual.CreatorID, "无权检查该手册"); err != nil {
		return nil, err
	}

	result := newCheckResult(ContentTypeManual, manual.ID)
	var steps []agent.AgentStep
	if err := s.db.WithContext(ctx).Where("manual_id = ?", manual.ID).Order("step_order ASC").Find(&steps).Error; err != nil {
		return nil, err
	}
	if strings.TrimSpace(manual.Title) == "" {
		result.Errors = append(result.Errors, issue("MANUAL_TITLE_REQUIRED", "基础信息", "手册标题不能为空", manual.ID, manual.Title))
	}
	if len(steps) == 0 {
		result.Errors = append(result.Errors, issue("MANUAL_STEP_REQUIRED", "手册步骤", "手册至少需要一个步骤", manual.ID, manual.Title))
	}
	validVerificationCount := 0
	for _, step := range steps {
		if strings.TrimSpace(step.Title) == "" {
			result.Warnings = append(result.Warnings, warn("MANUAL_STEP_TITLE_EMPTY", "手册步骤", "存在未命名步骤，建议发布前补齐标题", step.ID, manual.Title))
		}
		if !hasValidContent(step.Content) {
			result.Errors = append(result.Errors, issue("MANUAL_STEP_CONTENT_REQUIRED", "手册步骤", "步骤内容不能为空", step.ID, step.Title))
		}
		if validVerification(step.Verification) {
			validVerificationCount++
		}
	}
	if validVerificationCount == 0 {
		result.Errors = append(result.Errors, issue("MANUAL_VERIFICATION_REQUIRED", "自动验证", "手册至少需要一个有效验证规则", manual.ID, manual.Title))
	}
	result.Summary = JSONMap{
		"stepCount":              len(steps),
		"validVerificationCount": validVerificationCount,
	}
	result.Snapshot = JSONMap{
		"title":       manual.Title,
		"sourceType":  manual.SourceType,
		"sourceId":    manual.SourceID,
		"isPublished": manual.IsPublished,
	}
	return s.persistCheck(ctx, actorID, result)
}

func (s *Service) PublishCourse(ctx context.Context, actorID uint64, roleType int, courseID uint64) (*course.Course, error) {
	check, err := s.CheckCourse(ctx, actorID, roleType, courseID)
	if err != nil {
		return nil, err
	}
	record, err := s.courseByID(ctx, courseID)
	if err != nil {
		return nil, err
	}
	if !check.CanPublish {
		_ = s.recordContentAudit(ctx, ContentTypeCourse, courseID, record.Title, AuditActionPublish, actorID, AuditResultBlocked, "课程发布被发布检查阻断", check)
		return nil, &BlockedError{Result: check}
	}
	record.Status = course.CourseStatusPublished
	if err := s.db.WithContext(ctx).Save(record).Error; err != nil {
		return nil, err
	}
	result := AuditResultSuccess
	message := "课程已发布"
	if len(check.Warnings) > 0 {
		result = AuditResultWarning
		message = "课程已发布，存在发布检查警告"
	}
	_ = s.recordContentAudit(ctx, ContentTypeCourse, courseID, record.Title, AuditActionPublish, actorID, result, message, check)
	return record, nil
}

func (s *Service) SetCourseStatus(ctx context.Context, actorID uint64, roleType int, courseID uint64, status course.CourseStatus) (*course.Course, error) {
	if status == course.CourseStatusPublished {
		return s.PublishCourse(ctx, actorID, roleType, courseID)
	}
	record, err := s.courseByID(ctx, courseID)
	if err != nil {
		return nil, err
	}
	if err := ensureOwner(actorID, roleType, record.CreatorID, "无权管理该课程"); err != nil {
		return nil, err
	}
	record.Status = status
	if err := s.db.WithContext(ctx).Save(record).Error; err != nil {
		return nil, err
	}
	action := AuditActionDraft
	message := "课程已设为草稿"
	if status == course.CourseStatusArchived {
		action = AuditActionArchive
		message = "课程已下架"
	}
	_ = s.RecordAudit(ctx, PublishAuditLog{
		ContentType:  ContentTypeCourse,
		ContentID:    courseID,
		ContentTitle: record.Title,
		Action:       action,
		ActorID:      actorID,
		Result:       AuditResultSuccess,
		Message:      message,
		Snapshot: JSONMap{
			"status": status,
		},
	})
	return record, nil
}

func (s *Service) PublishProject(ctx context.Context, actorID uint64, roleType int, projectID uint64) (*project.Project, error) {
	check, err := s.CheckProject(ctx, actorID, roleType, projectID)
	if err != nil {
		return nil, err
	}
	record, err := s.projectByID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if !check.CanPublish {
		_ = s.recordContentAudit(ctx, ContentTypeProject, projectID, record.Title, AuditActionPublish, actorID, AuditResultBlocked, "项目发布被发布检查阻断", check)
		return nil, &BlockedError{Result: check}
	}
	record.Status = project.ProjectStatusPublished
	if err := s.db.WithContext(ctx).Save(record).Error; err != nil {
		return nil, err
	}
	result := AuditResultSuccess
	message := "项目已发布"
	if len(check.Warnings) > 0 {
		result = AuditResultWarning
		message = "项目已发布，存在发布检查警告"
	}
	_ = s.recordContentAudit(ctx, ContentTypeProject, projectID, record.Title, AuditActionPublish, actorID, result, message, check)
	return record, nil
}

func (s *Service) SetProjectStatus(ctx context.Context, actorID uint64, roleType int, projectID uint64, status project.ProjectStatus) (*project.Project, error) {
	if status == project.ProjectStatusPublished {
		return s.PublishProject(ctx, actorID, roleType, projectID)
	}
	record, err := s.projectByID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if err := ensureOwner(actorID, roleType, record.CreatedBy, "无权管理该项目"); err != nil {
		return nil, err
	}
	record.Status = status
	if err := s.db.WithContext(ctx).Save(record).Error; err != nil {
		return nil, err
	}
	action := AuditActionDraft
	message := "项目已设为草稿"
	if status == project.ProjectStatusArchived {
		action = AuditActionArchive
		message = "项目已下架"
	}
	_ = s.RecordAudit(ctx, PublishAuditLog{
		ContentType:  ContentTypeProject,
		ContentID:    projectID,
		ContentTitle: record.Title,
		Action:       action,
		ActorID:      actorID,
		Result:       AuditResultSuccess,
		Message:      message,
		Snapshot: JSONMap{
			"status": status,
		},
	})
	return record, nil
}

func (s *Service) UpdateManual(ctx context.Context, actorID uint64, roleType int, manualID uint64, title, description string, isPublished *int) (*agent.AgentManual, error) {
	var manual agent.AgentManual
	if err := s.db.WithContext(ctx).First(&manual, manualID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("手册不存在")
		}
		return nil, err
	}
	if err := ensureOwner(actorID, roleType, manual.CreatorID, "无权管理该手册"); err != nil {
		return nil, err
	}
	manual.Title = strings.TrimSpace(title)
	manual.Description = description
	if err := s.db.WithContext(ctx).Save(&manual).Error; err != nil {
		return nil, err
	}
	if isPublished != nil && *isPublished == 1 {
		check, err := s.CheckManual(ctx, actorID, roleType, manualID)
		if err != nil {
			return nil, err
		}
		if !check.CanPublish {
			_ = s.recordContentAudit(ctx, ContentTypeManual, manualID, manual.Title, AuditActionPublish, actorID, AuditResultBlocked, "手册发布被发布检查阻断", check)
			return nil, &BlockedError{Result: check}
		}
		manual.IsPublished = 1
		result := AuditResultSuccess
		message := "手册已发布"
		if len(check.Warnings) > 0 {
			result = AuditResultWarning
			message = "手册已发布，存在发布检查警告"
		}
		_ = s.recordContentAudit(ctx, ContentTypeManual, manualID, manual.Title, AuditActionPublish, actorID, result, message, check)
	} else if isPublished != nil {
		manual.IsPublished = *isPublished
		_ = s.RecordAudit(ctx, PublishAuditLog{
			ContentType:  ContentTypeManual,
			ContentID:    manualID,
			ContentTitle: manual.Title,
			Action:       AuditActionDraft,
			ActorID:      actorID,
			Result:       AuditResultSuccess,
			Message:      "手册已设为草稿",
			Snapshot: JSONMap{
				"isPublished": manual.IsPublished,
			},
		})
	}
	if err := s.db.WithContext(ctx).Save(&manual).Error; err != nil {
		return nil, err
	}
	return &manual, nil
}

func (s *Service) RecordAudit(ctx context.Context, log PublishAuditLog) error {
	if log.CreatedAt.IsZero() {
		log.CreatedAt = time.Now()
	}
	return s.db.WithContext(ctx).Create(&log).Error
}

func (s *Service) recordContentAudit(ctx context.Context, contentType string, contentID uint64, title string, action string, actorID uint64, result string, message string, check *PublishCheckResult) error {
	log := PublishAuditLog{
		ContentType:  contentType,
		ContentID:    contentID,
		ContentTitle: title,
		Action:       action,
		ActorID:      actorID,
		Result:       result,
		Message:      message,
	}
	if check != nil {
		log.CheckID = check.CheckID
		log.Errors = check.Errors
		log.Warnings = check.Warnings
		log.Snapshot = check.Snapshot
	}
	return s.RecordAudit(ctx, log)
}

func (s *Service) courseByID(ctx context.Context, id uint64) (*course.Course, error) {
	var record course.Course
	if err := s.db.WithContext(ctx).First(&record, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("课程不存在")
		}
		return nil, err
	}
	return &record, nil
}

func (s *Service) projectByID(ctx context.Context, id uint64) (*project.Project, error) {
	var record project.Project
	if err := s.db.WithContext(ctx).First(&record, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("项目不存在")
		}
		return nil, err
	}
	return &record, nil
}

func (s *Service) activeLabTemplate(ctx context.Context, id uint64) (*LabTemplate, error) {
	if id == 0 {
		return nil, nil
	}
	var template LabTemplate
	if err := s.db.WithContext(ctx).First(&template, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("绑定的 Lab 模板不存在")
		}
		return nil, err
	}
	if template.Status != LabTemplateStatusActive {
		return nil, errors.New("绑定的 Lab 模板已停用")
	}
	if strings.TrimSpace(template.EnvImage) == "" {
		return nil, errors.New("绑定的 Lab 模板未配置实验镜像")
	}
	return &template, nil
}

func (s *Service) projectTags(ctx context.Context, projectID uint64) ([]project.Tag, error) {
	var tags []project.Tag
	err := s.db.WithContext(ctx).
		Table("tags").
		Select("tags.*").
		Joins("JOIN project_tags ON project_tags.tag_id = tags.id").
		Where("project_tags.project_id = ?", projectID).
		Find(&tags).Error
	return tags, err
}

func (s *Service) checkCourseManuals(ctx context.Context, lessons []course.CourseLesson, result *PublishCheckResult) (int, int, error) {
	manualCoverage := 0
	verificationCoverage := 0
	for _, lesson := range lessons {
		manual, steps, err := s.manualWithSteps(ctx, agent.SourceTypeLesson, lesson.ID)
		if err != nil {
			return 0, 0, err
		}
		if manual == nil {
			result.Errors = append(result.Errors, issue("COURSE_LESSON_MANUAL_REQUIRED", "Agent 手册", "实验/挑战课时必须关联已发布 Agent 手册", lesson.ID, lesson.Title))
			continue
		}
		manualCoverage++
		if manual.IsPublished != 1 {
			result.Errors = append(result.Errors, issue("COURSE_LESSON_MANUAL_UNPUBLISHED", "Agent 手册", "关联手册尚未发布", manual.ID, manual.Title))
			continue
		}
		if hasAnyValidVerification(steps) {
			verificationCoverage++
		} else {
			result.Errors = append(result.Errors, issue("COURSE_LESSON_VERIFICATION_REQUIRED", "自动验证", "实验/挑战课时的已发布手册必须至少包含一个有效验证规则", manual.ID, manual.Title))
		}
	}
	return manualCoverage, verificationCoverage, nil
}

func (s *Service) checkProjectManuals(ctx context.Context, units []project.ProjectUnit, result *PublishCheckResult) (int, int, error) {
	manualCoverage := 0
	verificationCoverage := 0
	for _, unit := range units {
		manual, steps, err := s.manualWithSteps(ctx, agent.SourceTypeProjectUnit, unit.ID)
		if err != nil {
			return 0, 0, err
		}
		if manual == nil {
			result.Errors = append(result.Errors, issue("PROJECT_UNIT_MANUAL_REQUIRED", "Agent 手册", "实验/挑战单元必须关联已发布 Agent 手册", unit.ID, unit.Title))
			continue
		}
		manualCoverage++
		if manual.IsPublished != 1 {
			result.Errors = append(result.Errors, issue("PROJECT_UNIT_MANUAL_UNPUBLISHED", "Agent 手册", "关联手册尚未发布", manual.ID, manual.Title))
			continue
		}
		if hasAnyValidVerification(steps) {
			verificationCoverage++
		} else {
			result.Errors = append(result.Errors, issue("PROJECT_UNIT_VERIFICATION_REQUIRED", "自动验证", "实验/挑战单元的已发布手册必须至少包含一个有效验证规则", manual.ID, manual.Title))
		}
	}
	return manualCoverage, verificationCoverage, nil
}

func (s *Service) manualWithSteps(ctx context.Context, sourceType int, sourceID uint64) (*agent.AgentManual, []agent.AgentStep, error) {
	var manual agent.AgentManual
	err := s.db.WithContext(ctx).Where("source_type = ? AND source_id = ?", sourceType, sourceID).First(&manual).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil, nil
	}
	if err != nil {
		return nil, nil, err
	}
	var steps []agent.AgentStep
	if err := s.db.WithContext(ctx).Where("manual_id = ?", manual.ID).Order("step_order ASC").Find(&steps).Error; err != nil {
		return nil, nil, err
	}
	return &manual, steps, nil
}

func (s *Service) courseMaterialWarnings(ctx context.Context, lessons []course.CourseLesson) ([]CheckIssue, error) {
	warnings := make([]CheckIssue, 0)
	for _, lesson := range lessons {
		if lesson.Type != 4 {
			continue
		}
		var count int64
		if err := s.db.WithContext(ctx).Model(&course.LessonMaterial{}).Where("lesson_id = ?", lesson.ID).Count(&count).Error; err != nil {
			return nil, err
		}
		if count == 0 {
			warnings = append(warnings, warn("COURSE_TEXT_LESSON_MATERIAL_EMPTY", "课程素材", "文本课时未配置素材，学生预览可能缺少学习资料", lesson.ID, lesson.Title))
		}
	}
	return warnings, nil
}

func (s *Service) persistCheck(ctx context.Context, actorID uint64, result *PublishCheckResult) (*PublishCheckResult, error) {
	result.CanPublish = len(result.Errors) == 0
	result.CheckedAt = time.Now()
	if result.Errors == nil {
		result.Errors = []CheckIssue{}
	}
	if result.Warnings == nil {
		result.Warnings = []CheckIssue{}
	}
	check := &ContentPublishCheck{
		ContentType: result.ContentType,
		ContentID:   result.ContentID,
		ActorID:     actorID,
		CanPublish:  result.CanPublish,
		Errors:      result.Errors,
		Warnings:    result.Warnings,
		Summary:     result.Summary,
		Snapshot:    result.Snapshot,
	}
	if err := s.db.WithContext(ctx).Create(check).Error; err != nil {
		return nil, err
	}
	result.CheckID = check.ID
	return result, nil
}

func normalizeLabTemplateInput(input LabTemplateInput) (*LabTemplate, error) {
	template := &LabTemplate{
		Name:               strings.TrimSpace(input.Name),
		Code:               strings.TrimSpace(input.Code),
		Description:        strings.TrimSpace(input.Description),
		LegacyRuntimeMode:  "classic",
		EnvImage:           strings.TrimSpace(input.EnvImage),
		IDEImage:           strings.TrimSpace(input.IDEImage),
		MainCPURequest:     defaultString(input.MainCPURequest, "250m"),
		MainMemoryRequest:  defaultString(input.MainMemoryRequest, "512Mi"),
		MainCPULimit:       defaultString(input.MainCPULimit, "2"),
		MainMemoryLimit:    defaultString(input.MainMemoryLimit, "2Gi"),
		IDECPURequest:      defaultString(input.IDECPURequest, "100m"),
		IDEMemoryRequest:   defaultString(input.IDEMemoryRequest, "256Mi"),
		IDECPULimit:        defaultString(input.IDECPULimit, "1"),
		IDEMemoryLimit:     defaultString(input.IDEMemoryLimit, "1Gi"),
		DefaultAppPortName: strings.TrimSpace(strings.ToLower(input.DefaultAppPortName)),
		Status:             input.Status,
	}
	normalizedExposedPorts, err := normalizeLabTemplateExposedPorts(input, strings.TrimSpace(input.IDEImage) != "")
	if err != nil {
		return nil, err
	}
	template.ExposedPorts = normalizedExposedPorts
	applyExposedPortsToTemplate(template)
	if template.Status == 0 {
		template.Status = LabTemplateStatusActive
	}
	if template.Name == "" || template.Code == "" {
		return nil, apperrors.BadRequest("模板名称和编码不能为空")
	}
	if template.EnvImage == "" {
		return nil, apperrors.BadRequest("模板必须配置实验环境镜像")
	}
	if template.Status != LabTemplateStatusActive && template.Status != LabTemplateStatusDisabled {
		return nil, apperrors.BadRequest("无效的模板状态")
	}
	for label, value := range map[string]string{
		"主容器 CPU Request": template.MainCPURequest,
		"主容器内存 Request":   template.MainMemoryRequest,
		"主容器 CPU Limit":   template.MainCPULimit,
		"主容器内存 Limit":     template.MainMemoryLimit,
		"IDE CPU Request": template.IDECPURequest,
		"IDE 内存 Request":  template.IDEMemoryRequest,
		"IDE CPU Limit":   template.IDECPULimit,
		"IDE 内存 Limit":    template.IDEMemoryLimit,
	} {
		if _, err := resource.ParseQuantity(value); err != nil {
			return nil, apperrors.BadRequest(label + " 资源格式不正确")
		}
	}
	return template, nil
}

var labTemplateAppPortNamePattern = regexp.MustCompile(`^[a-z0-9-]{1,10}$`)

const (
	labTemplatePortTypeNoVNC = "novnc"
	labTemplatePortTypeWeb   = "web"
)

func normalizeLabTemplateExposedPorts(input LabTemplateInput, ideEnabled bool) ([]LabTemplateExposedPort, error) {
	ports := input.ExposedPorts
	if len(ports) == 0 {
		defaultName := strings.TrimSpace(strings.ToLower(input.DefaultAppPortName))
		if defaultName != "" && !hasLegacyAppPort(input.AppPorts, defaultName) {
			return nil, apperrors.BadRequest("默认应用端口必须指向已配置的端口")
		}
		ports = legacyExposedPorts(input)
	}
	if len(ports) == 0 {
		return nil, apperrors.BadRequest("至少需要配置一个镜像暴露端口")
	}
	out := make([]LabTemplateExposedPort, 0, len(ports))
	usedNames := map[string]bool{}
	usedPorts := map[int32]bool{}
	reservedNames := map[string]bool{
		"novnc": true, "desktop": true, "ssh": true, "terminal": true, "ide": true, "gateway": true,
	}
	noVNCCount := 0
	webCount := 0
	defaultCount := 0
	hasExplicitDefault := false
	for _, port := range ports {
		portType := strings.TrimSpace(strings.ToLower(port.Type))
		if portType == "" {
			portType = labTemplatePortTypeWeb
		}
		if portType != labTemplatePortTypeNoVNC && portType != labTemplatePortTypeWeb {
			return nil, apperrors.BadRequest("镜像暴露端口类型只能是 Desktop/noVNC 或 Web 应用")
		}
		if port.ContainerPort < 1 || port.ContainerPort > 65535 {
			return nil, apperrors.BadRequest("镜像暴露端口范围必须是 1-65535")
		}
		if portType == labTemplatePortTypeWeb && port.ContainerPort > 45535 {
			return nil, apperrors.BadRequest("Web 应用端口范围必须是 1-45535")
		}
		if port.ContainerPort == 22 || port.ContainerPort == 18789 {
			return nil, apperrors.BadRequest("镜像暴露端口不能使用系统保留端口")
		}
		if ideEnabled && port.ContainerPort == 3000 {
			return nil, apperrors.BadRequest("IDE 镜像启用时镜像暴露端口不能使用 3000，请清空 IDE 镜像或改用其他端口")
		}
		if usedPorts[port.ContainerPort] {
			return nil, apperrors.BadRequest("镜像暴露端口号不能重复")
		}
		usedPorts[port.ContainerPort] = true
		if port.IsDefault {
			defaultCount++
			hasExplicitDefault = true
			if defaultCount > 1 {
				return nil, apperrors.BadRequest("默认入口只能选择一个")
			}
		}
		if portType == labTemplatePortTypeNoVNC {
			noVNCCount++
			if noVNCCount > 1 {
				return nil, apperrors.BadRequest("Desktop/noVNC 入口最多配置 1 个")
			}
			label := strings.TrimSpace(port.Label)
			if label == "" {
				label = "Desktop"
			}
			out = append(out, LabTemplateExposedPort{
				Type:          labTemplatePortTypeNoVNC,
				Name:          labTemplatePortTypeNoVNC,
				Label:         label,
				ContainerPort: port.ContainerPort,
				Path:          "",
				IsDefault:     port.IsDefault,
			})
			continue
		}
		webCount++
		if webCount > 10 {
			return nil, apperrors.BadRequest("Web 应用端口最多配置 10 个")
		}
		name := strings.TrimSpace(strings.ToLower(port.Name))
		label := strings.TrimSpace(port.Label)
		path := strings.TrimSpace(port.Path)
		if path == "" {
			path = "/"
		}
		if !labTemplateAppPortNamePattern.MatchString(name) {
			return nil, apperrors.BadRequest("应用端口标识只能包含小写字母、数字和连字符，长度 1-10")
		}
		if reservedNames[name] {
			return nil, apperrors.BadRequest("应用端口标识不能使用系统保留名称")
		}
		if usedNames[name] {
			return nil, apperrors.BadRequest("应用端口标识不能重复")
		}
		if label == "" {
			label = name
		}
		if !strings.HasPrefix(path, "/") {
			return nil, apperrors.BadRequest("应用端口默认路径必须以 / 开头")
		}
		usedNames[name] = true
		out = append(out, LabTemplateExposedPort{
			Type:          labTemplatePortTypeWeb,
			Name:          name,
			Label:         label,
			ContainerPort: port.ContainerPort,
			Path:          path,
			IsDefault:     port.IsDefault,
		})
	}
	if !hasExplicitDefault {
		hasNoVNC := false
		for _, port := range out {
			if port.Type == labTemplatePortTypeNoVNC {
				hasNoVNC = true
				break
			}
		}
		if !hasNoVNC {
			for idx := range out {
				if out[idx].Type == labTemplatePortTypeWeb {
					out[idx].IsDefault = true
					break
				}
			}
		}
	}
	return out, nil
}

func legacyExposedPorts(input LabTemplateInput) []LabTemplateExposedPort {
	desktopEnabled := true
	if input.DesktopEnabled != nil {
		desktopEnabled = *input.DesktopEnabled
	}
	ports := make([]LabTemplateExposedPort, 0, len(input.AppPorts)+1)
	if desktopEnabled {
		ports = append(ports, LabTemplateExposedPort{
			Type:          labTemplatePortTypeNoVNC,
			Name:          labTemplatePortTypeNoVNC,
			Label:         "Desktop",
			ContainerPort: 6080,
		})
	}
	defaultName := strings.TrimSpace(strings.ToLower(input.DefaultAppPortName))
	for _, port := range input.AppPorts {
		name := strings.TrimSpace(strings.ToLower(port.Name))
		ports = append(ports, LabTemplateExposedPort{
			Type:          labTemplatePortTypeWeb,
			Name:          name,
			Label:         port.Label,
			ContainerPort: port.ContainerPort,
			Path:          port.Path,
			IsDefault:     defaultName != "" && name == defaultName,
		})
	}
	return ports
}

func hasLegacyAppPort(ports []LabTemplateAppPort, name string) bool {
	for _, port := range ports {
		if strings.TrimSpace(strings.ToLower(port.Name)) == name {
			return true
		}
	}
	return false
}

func applyExposedPortsToTemplate(template *LabTemplate) {
	template.DesktopEnabled = false
	template.AppPorts = []LabTemplateAppPort{}
	template.DefaultAppPortName = ""
	for _, port := range template.ExposedPorts {
		switch port.Type {
		case labTemplatePortTypeNoVNC:
			template.DesktopEnabled = true
		case labTemplatePortTypeWeb:
			template.AppPorts = append(template.AppPorts, LabTemplateAppPort{
				Name:          port.Name,
				Label:         port.Label,
				ContainerPort: port.ContainerPort,
				Path:          port.Path,
			})
			if port.IsDefault {
				template.DefaultAppPortName = port.Name
			}
		}
	}
}

func hydrateLabTemplatePortFields(template *LabTemplate) {
	if len(template.ExposedPorts) == 0 {
		input := LabTemplateInput{
			DesktopEnabled:     &template.DesktopEnabled,
			AppPorts:           template.AppPorts,
			DefaultAppPortName: template.DefaultAppPortName,
		}
		template.ExposedPorts = legacyExposedPorts(input)
		normalized, err := normalizeLabTemplateExposedPorts(LabTemplateInput{ExposedPorts: template.ExposedPorts}, strings.TrimSpace(template.IDEImage) != "")
		if err == nil {
			template.ExposedPorts = normalized
		}
		return
	}
	applyExposedPortsToTemplate(template)
}

func newCheckResult(contentType string, contentID uint64) *PublishCheckResult {
	return &PublishCheckResult{
		ContentType: contentType,
		ContentID:   contentID,
		Errors:      []CheckIssue{},
		Warnings:    []CheckIssue{},
		Summary:     JSONMap{},
		Snapshot:    JSONMap{},
	}
}

func issue(code, scope, message string, resourceID uint64, resourceName string) CheckIssue {
	return CheckIssue{Code: code, Severity: "error", Scope: scope, Message: message, ResourceID: resourceID, ResourceName: resourceName}
}

func warn(code, scope, message string, resourceID uint64, resourceName string) CheckIssue {
	return CheckIssue{Code: code, Severity: "warning", Scope: scope, Message: message, ResourceID: resourceID, ResourceName: resourceName}
}

func ensureOwner(actorID uint64, roleType int, ownerID uint64, message string) error {
	if roleType >= int(user.RoleAdmin) || actorID == ownerID {
		return nil
	}
	return apperrors.Forbidden(message)
}

func filterCourseLabLessons(lessons []course.CourseLesson) []course.CourseLesson {
	filtered := make([]course.CourseLesson, 0)
	for _, lesson := range lessons {
		if lesson.Type == 1 || lesson.Type == 2 {
			filtered = append(filtered, lesson)
		}
	}
	return filtered
}

func filterProjectLabUnits(units []project.ProjectUnit) []project.ProjectUnit {
	filtered := make([]project.ProjectUnit, 0)
	for _, unit := range units {
		if unit.Type == 1 || unit.Type == 2 {
			filtered = append(filtered, unit)
		}
	}
	return filtered
}

func hasAnyValidVerification(steps []agent.AgentStep) bool {
	for _, step := range steps {
		if validVerification(step.Verification) {
			return true
		}
	}
	return false
}

func validVerification(rule *agent.VerificationRule) bool {
	if rule == nil {
		return false
	}
	switch strings.TrimSpace(rule.Type) {
	case "file_exists":
		return strings.TrimSpace(rule.Path) != ""
	case "command_output":
		if strings.TrimSpace(rule.Command) == "" {
			return false
		}
		expect := strings.TrimSpace(rule.Expect)
		return expect == "" || expect == "not_empty" || strings.TrimSpace(rule.Value) != ""
	case "service_running":
		return rule.Port > 0
	case "custom":
		return strings.TrimSpace(rule.Script) != ""
	default:
		return strings.TrimSpace(rule.Command) != "" || strings.TrimSpace(rule.Path) != "" || strings.TrimSpace(rule.Script) != "" || rule.Port > 0
	}
}

func hasValidContent(blocks []agent.ContentBlock) bool {
	for _, block := range blocks {
		if strings.TrimSpace(block.Text) != "" ||
			strings.TrimSpace(block.Code) != "" ||
			strings.TrimSpace(block.Src) != "" ||
			len(block.Items) > 0 {
			return true
		}
	}
	return false
}

func defaultString(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return strings.TrimSpace(value)
}

func labTemplateSnapshot(template LabTemplate) JSONMap {
	return JSONMap{
		"id":                 template.ID,
		"name":               template.Name,
		"code":               template.Code,
		"envImage":           template.EnvImage,
		"ideImage":           template.IDEImage,
		"mainCpuRequest":     template.MainCPURequest,
		"mainMemoryRequest":  template.MainMemoryRequest,
		"mainCpuLimit":       template.MainCPULimit,
		"mainMemoryLimit":    template.MainMemoryLimit,
		"ideCpuRequest":      template.IDECPURequest,
		"ideMemoryRequest":   template.IDEMemoryRequest,
		"ideCpuLimit":        template.IDECPULimit,
		"ideMemoryLimit":     template.IDEMemoryLimit,
		"desktopEnabled":     template.DesktopEnabled,
		"appPorts":           template.AppPorts,
		"defaultAppPortName": template.DefaultAppPortName,
		"exposedPorts":       template.ExposedPorts,
		"status":             template.Status,
	}
}

func nullableTemplateSnapshot(template *LabTemplate) any {
	if template == nil {
		return nil
	}
	return labTemplateSnapshot(*template)
}
