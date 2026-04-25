package assignment

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"go.uber.org/zap"
	"gorm.io/gorm"

	"edu-platform/internal/domain/agent"
	"edu-platform/internal/domain/classroom"
	"edu-platform/internal/domain/course"
	"edu-platform/internal/domain/operations"
	"edu-platform/internal/domain/project"
	"edu-platform/internal/domain/user"
	apperrors "edu-platform/pkg/errors"
)

type Service struct {
	db                *gorm.DB
	logger            *zap.Logger
	aiClient          *agent.AIClient
	operationsService *operations.Service
}

func NewService(db *gorm.DB, logger *zap.Logger) *Service {
	return &Service{db: db, logger: logger}
}

func (s *Service) SetAIClient(client *agent.AIClient) {
	s.aiClient = client
}

func (s *Service) SetOperationsService(service *operations.Service) {
	s.operationsService = service
}

func (s *Service) ListForTeacher(ctx context.Context, actorID uint64, roleType int, query AssignmentListQuery) (*AssignmentListResponse, error) {
	db := s.baseListQuery(ctx, query)
	if roleType < int(user.RoleAdmin) {
		db = db.Where("ta.creator_id = ? OR EXISTS (SELECT 1 FROM assignment_classes ac JOIN classes c ON c.id = ac.class_id WHERE ac.assignment_id = ta.id AND c.owner_teacher_id = ?)", actorID, actorID)
	}
	return s.scanList(ctx, db, query)
}

func (s *Service) ListForStudent(ctx context.Context, studentID uint64, query AssignmentListQuery) (*AssignmentListResponse, error) {
	db := s.baseListQuery(ctx, query).
		Where("ta.status IN ?", []AssignmentStatus{AssignmentStatusPublished, AssignmentStatusClosed}).
		Where(`EXISTS (
			SELECT 1
			FROM assignment_classes ac
			JOIN classes c ON c.id = ac.class_id AND c.status = ?
			JOIN class_members cm ON cm.class_id = ac.class_id
			WHERE ac.assignment_id = ta.id
			  AND cm.user_id = ?
			  AND cm.status = ?
			  AND (? = 0 OR ac.class_id = ?)
		)`, classroom.ClassStatusActive, studentID, classroom.ClassMemberStatusActive, query.ClassID, query.ClassID)
	return s.scanList(ctx, db, query)
}

func (s *Service) ListForAdmin(ctx context.Context, query AssignmentListQuery) (*AssignmentListResponse, error) {
	return s.scanList(ctx, s.baseListQuery(ctx, query), query)
}

func (s *Service) GetForTeacher(ctx context.Context, actorID uint64, roleType int, id uint64) (*AssignmentDetail, error) {
	record, err := s.findAssignment(ctx, id)
	if err != nil {
		return nil, err
	}
	if err := s.ensureTeacherCanManage(ctx, actorID, roleType, record); err != nil {
		return nil, err
	}
	detail, err := s.buildDetail(ctx, record)
	if err != nil {
		return nil, err
	}
	progress, err := s.loadSubmissionProgress(ctx, record.ID)
	if err != nil {
		return nil, err
	}
	detail.SubmissionProgress = progress
	return detail, nil
}

func (s *Service) GetForStudent(ctx context.Context, studentID, id uint64) (*AssignmentDetail, error) {
	record, err := s.findAssignment(ctx, id)
	if err != nil {
		return nil, err
	}
	if record.Status != AssignmentStatusPublished && record.Status != AssignmentStatusClosed {
		return nil, apperrors.NotFound("作业不存在或尚未发布")
	}
	var count int64
	if err := s.db.WithContext(ctx).Table("assignment_classes ac").
		Joins("JOIN classes c ON c.id = ac.class_id AND c.status = ?", classroom.ClassStatusActive).
		Joins("JOIN class_members cm ON cm.class_id = ac.class_id").
		Where("ac.assignment_id = ? AND cm.user_id = ? AND cm.status = ?", id, studentID, classroom.ClassMemberStatusActive).
		Count(&count).Error; err != nil {
		return nil, err
	}
	if count == 0 {
		return nil, apperrors.Forbidden("无权查看该作业")
	}
	detail, err := s.buildDetail(ctx, record)
	if err != nil {
		return nil, err
	}
	state, err := s.loadStudentSubmissionState(ctx, studentID, record)
	if err != nil {
		return nil, err
	}
	detail.StudentSubmission = state
	return detail, nil
}

func (s *Service) Create(ctx context.Context, actorID uint64, roleType int, req UpsertAssignmentRequest) (*AssignmentDetail, error) {
	normalized, err := normalizeRequest(req)
	if err != nil {
		return nil, err
	}
	if err := s.ensureClassScope(ctx, actorID, roleType, normalized.ClassIDs, false); err != nil {
		return nil, err
	}

	record := &TeachingAssignment{
		Title:       normalized.Title,
		Description: normalized.Description,
		Status:      AssignmentStatusDraft,
		CreatorID:   actorID,
		DueAt:       normalized.DueAt,
	}
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(record).Error; err != nil {
			return err
		}
		if err := s.replaceChildren(ctx, tx, record.ID, normalized); err != nil {
			return err
		}
		return s.replaceRubric(ctx, tx, record.ID, normalized.RubricItems)
	}); err != nil {
		return nil, err
	}
	return s.buildDetail(ctx, record)
}

func (s *Service) Update(ctx context.Context, actorID uint64, roleType int, id uint64, req UpsertAssignmentRequest) (*AssignmentDetail, error) {
	normalized, err := normalizeRequest(req)
	if err != nil {
		return nil, err
	}
	record, err := s.findAssignment(ctx, id)
	if err != nil {
		return nil, err
	}
	if err := s.ensureTeacherCanManage(ctx, actorID, roleType, record); err != nil {
		return nil, err
	}
	if err := s.ensureClassScope(ctx, actorID, roleType, normalized.ClassIDs, false); err != nil {
		return nil, err
	}

	record.Title = normalized.Title
	record.Description = normalized.Description
	record.DueAt = normalized.DueAt
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(record).Error; err != nil {
			return err
		}
		if err := s.replaceChildren(ctx, tx, record.ID, normalized); err != nil {
			return err
		}
		return s.replaceRubric(ctx, tx, record.ID, normalized.RubricItems)
	}); err != nil {
		return nil, err
	}
	return s.buildDetail(ctx, record)
}

func (s *Service) Publish(ctx context.Context, actorID uint64, roleType int, id uint64) (*AssignmentDetail, error) {
	record, err := s.findAssignment(ctx, id)
	if err != nil {
		return nil, err
	}
	if err := s.ensureTeacherCanManage(ctx, actorID, roleType, record); err != nil {
		return nil, err
	}
	check := s.CheckPublish(ctx, actorID, roleType, record.ID)
	if !check.CanPublish {
		return nil, &BlockedError{Result: check}
	}
	now := time.Now()
	record.Status = AssignmentStatusPublished
	record.PublishedAt = &now
	record.ClosedAt = nil
	if err := s.db.WithContext(ctx).Save(record).Error; err != nil {
		return nil, err
	}
	return s.buildDetail(ctx, record)
}

func (s *Service) Close(ctx context.Context, actorID uint64, roleType int, id uint64) (*AssignmentDetail, error) {
	record, err := s.findAssignment(ctx, id)
	if err != nil {
		return nil, err
	}
	if err := s.ensureTeacherCanManage(ctx, actorID, roleType, record); err != nil {
		return nil, err
	}
	now := time.Now()
	record.Status = AssignmentStatusClosed
	record.ClosedAt = &now
	if err := s.db.WithContext(ctx).Save(record).Error; err != nil {
		return nil, err
	}
	return s.buildDetail(ctx, record)
}

func (s *Service) Draft(ctx context.Context, actorID uint64, roleType int, id uint64) (*AssignmentDetail, error) {
	record, err := s.findAssignment(ctx, id)
	if err != nil {
		return nil, err
	}
	if err := s.ensureTeacherCanManage(ctx, actorID, roleType, record); err != nil {
		return nil, err
	}
	record.Status = AssignmentStatusDraft
	record.PublishedAt = nil
	record.ClosedAt = nil
	if err := s.db.WithContext(ctx).Save(record).Error; err != nil {
		return nil, err
	}
	return s.buildDetail(ctx, record)
}

func (s *Service) Overview(ctx context.Context) (*AssignmentOverview, error) {
	overview := &AssignmentOverview{}
	db := s.db.WithContext(ctx).Model(&TeachingAssignment{})
	if err := db.Count(&overview.Total).Error; err != nil {
		return nil, err
	}
	statusTargets := []struct {
		status AssignmentStatus
		value  *int64
	}{
		{AssignmentStatusDraft, &overview.Draft},
		{AssignmentStatusPublished, &overview.Published},
		{AssignmentStatusClosed, &overview.Closed},
		{AssignmentStatusArchived, &overview.Archived},
	}
	for _, target := range statusTargets {
		if err := db.Session(&gorm.Session{}).Where("status = ?", target.status).Count(target.value).Error; err != nil {
			return nil, err
		}
	}
	if err := db.Session(&gorm.Session{}).
		Where("status = ? AND due_at IS NOT NULL AND due_at < ?", AssignmentStatusPublished, time.Now()).
		Count(&overview.Overdue).Error; err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Model(&Submission{}).Count(&overview.Submitted).Error; err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Model(&Submission{}).Where("status IN ?", []string{SubmissionStatusSubmitted, SubmissionStatusResubmitted}).Count(&overview.PendingReview).Error; err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Model(&Submission{}).Where("status = ?", SubmissionStatusReturned).Count(&overview.Returned).Error; err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Model(&Submission{}).Where("status = ?", SubmissionStatusGraded).Count(&overview.Graded).Error; err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Model(&Grade{}).Where("status = ?", GradeStatusPublished).Count(&overview.PublishedGrades).Error; err != nil {
		return nil, err
	}
	return overview, nil
}

func (s *Service) CheckPublish(ctx context.Context, actorID uint64, roleType int, assignmentID uint64) PublishCheckResult {
	result := PublishCheckResult{
		CanPublish: false,
		Errors:     []AssignmentIssue{},
		Warnings:   []AssignmentIssue{},
	}

	classes, err := s.loadClassItems(ctx, assignmentID)
	if err != nil {
		result.Errors = append(result.Errors, issue("ASSIGNMENT_CLASS_LOAD_FAILED", "班级", "读取作业班级失败", assignmentID, ""))
		return finalizeCheck(result)
	}
	if len(classes) == 0 {
		result.Errors = append(result.Errors, issue("ASSIGNMENT_CLASS_REQUIRED", "班级", "作业必须绑定至少一个班级", assignmentID, ""))
	}
	for _, item := range classes {
		if item.Status != int(classroom.ClassStatusActive) {
			result.Errors = append(result.Errors, issue("ASSIGNMENT_CLASS_INACTIVE", "班级", "作业绑定的班级不是启用状态", item.ClassID, item.Name))
		}
		if roleType < int(user.RoleAdmin) && item.OwnerTeacherID != actorID {
			result.Errors = append(result.Errors, issue("ASSIGNMENT_CLASS_FORBIDDEN", "班级", "只能发布自己主教师班级关联的作业", item.ClassID, item.Name))
		}
	}

	resources, err := s.loadResourceItems(ctx, assignmentID)
	if err != nil {
		result.Errors = append(result.Errors, issue("ASSIGNMENT_RESOURCE_LOAD_FAILED", "资源", "读取作业资源失败", assignmentID, ""))
		return finalizeCheck(result)
	}
	if len(resources) == 0 {
		result.Errors = append(result.Errors, issue("ASSIGNMENT_RESOURCE_REQUIRED", "资源", "作业必须绑定至少一个已发布资源", assignmentID, ""))
	}
	for _, resource := range resources {
		result.Errors = append(result.Errors, s.validateResource(ctx, resource.AssignmentResource)...)
	}
	return finalizeCheck(result)
}

func (s *Service) baseListQuery(ctx context.Context, query AssignmentListQuery) *gorm.DB {
	db := s.db.WithContext(ctx).Table("teaching_assignments ta").
		Select(`ta.*, COALESCE(u.full_name, u.username, '') AS creator_name,
			(SELECT COUNT(*) FROM assignment_classes ac WHERE ac.assignment_id = ta.id) AS class_count,
			(SELECT COUNT(*) FROM assignment_resources ar WHERE ar.assignment_id = ta.id) AS resource_count,
			(SELECT COUNT(DISTINCT cm.user_id) FROM assignment_classes ac JOIN class_members cm ON cm.class_id = ac.class_id AND cm.status = ? WHERE ac.assignment_id = ta.id) AS student_count`,
			classroom.ClassMemberStatusActive).
		Joins("LEFT JOIN sys_users u ON u.id = ta.creator_id")
	if strings.TrimSpace(query.Q) != "" {
		keyword := "%" + strings.TrimSpace(query.Q) + "%"
		db = db.Where("ta.title LIKE ? OR ta.description LIKE ?", keyword, keyword)
	}
	if query.Status != nil {
		db = db.Where("ta.status = ?", *query.Status)
	}
	return db
}

func (s *Service) scanList(ctx context.Context, db *gorm.DB, query AssignmentListQuery) (*AssignmentListResponse, error) {
	page, pageSize := normalizePage(query.Page, query.PageSize)
	var total int64
	if err := db.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		return nil, err
	}
	var list []AssignmentListItem
	if err := db.Order("ta.updated_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Scan(&list).Error; err != nil {
		return nil, err
	}
	for i := range list {
		list[i].CanEnter = list[i].Status == AssignmentStatusPublished
	}
	return &AssignmentListResponse{List: list, Total: total}, nil
}

func (s *Service) findAssignment(ctx context.Context, id uint64) (*TeachingAssignment, error) {
	var record TeachingAssignment
	if err := s.db.WithContext(ctx).First(&record, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("作业不存在")
		}
		return nil, err
	}
	return &record, nil
}

func (s *Service) buildDetail(ctx context.Context, record *TeachingAssignment) (*AssignmentDetail, error) {
	classes, err := s.loadClassItems(ctx, record.ID)
	if err != nil {
		return nil, err
	}
	resources, err := s.loadResourceItems(ctx, record.ID)
	if err != nil {
		return nil, err
	}
	rubric, err := s.loadRubricDetail(ctx, record.ID)
	if err != nil {
		return nil, err
	}
	var rule AssignmentRule
	err = s.db.WithContext(ctx).Where("assignment_id = ?", record.ID).First(&rule).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		rule = defaultRule(record.ID)
	} else if err != nil {
		return nil, err
	}
	var creator user.User
	creatorName := ""
	if err := s.db.WithContext(ctx).First(&creator, record.CreatorID).Error; err == nil {
		creatorName = displayName(creator)
	}
	return &AssignmentDetail{
		TeachingAssignment: *record,
		CreatorName:        creatorName,
		Classes:            classes,
		Resources:          resources,
		Rule:               rule,
		Rubric:             rubric,
		CanEnter:           record.Status == AssignmentStatusPublished,
	}, nil
}

func (s *Service) loadClassItems(ctx context.Context, assignmentID uint64) ([]AssignmentClassItem, error) {
	var rows []AssignmentClassItem
	err := s.db.WithContext(ctx).Table("assignment_classes ac").
		Select(`c.id AS class_id, c.name, c.code, c.status, c.owner_teacher_id,
			(SELECT COUNT(*) FROM class_members cm WHERE cm.class_id = c.id AND cm.status = ?) AS active_member_count`, classroom.ClassMemberStatusActive).
		Joins("JOIN classes c ON c.id = ac.class_id").
		Where("ac.assignment_id = ?", assignmentID).
		Order("c.name ASC").
		Scan(&rows).Error
	if rows == nil {
		rows = []AssignmentClassItem{}
	}
	return rows, err
}

func (s *Service) loadResourceItems(ctx context.Context, assignmentID uint64) ([]AssignmentResourceItem, error) {
	var resources []AssignmentResource
	if err := s.db.WithContext(ctx).Where("assignment_id = ?", assignmentID).Order("sort_order ASC, id ASC").Find(&resources).Error; err != nil {
		return nil, err
	}
	items := make([]AssignmentResourceItem, 0, len(resources))
	for _, resource := range resources {
		title, status := s.resolveResourceTitle(ctx, resource)
		items = append(items, AssignmentResourceItem{
			AssignmentResource: resource,
			Title:              title,
			Status:             status,
		})
	}
	return items, nil
}

func (s *Service) replaceChildren(ctx context.Context, tx *gorm.DB, assignmentID uint64, req UpsertAssignmentRequest) error {
	if err := tx.WithContext(ctx).Where("assignment_id = ?", assignmentID).Delete(&AssignmentClass{}).Error; err != nil {
		return err
	}
	if err := tx.WithContext(ctx).Where("assignment_id = ?", assignmentID).Delete(&AssignmentResource{}).Error; err != nil {
		return err
	}
	if err := tx.WithContext(ctx).Where("assignment_id = ?", assignmentID).Delete(&AssignmentRule{}).Error; err != nil {
		return err
	}
	if len(req.ClassIDs) > 0 {
		classes := make([]AssignmentClass, 0, len(req.ClassIDs))
		seen := make(map[uint64]struct{}, len(req.ClassIDs))
		for _, classID := range req.ClassIDs {
			if classID == 0 {
				continue
			}
			if _, ok := seen[classID]; ok {
				continue
			}
			seen[classID] = struct{}{}
			classes = append(classes, AssignmentClass{AssignmentID: assignmentID, ClassID: classID})
		}
		if len(classes) > 0 {
			if err := tx.WithContext(ctx).Create(&classes).Error; err != nil {
				return err
			}
		}
	}
	if len(req.Resources) > 0 {
		resources := make([]AssignmentResource, 0, len(req.Resources))
		for index, item := range req.Resources {
			sortOrder := item.SortOrder
			if sortOrder == 0 {
				sortOrder = index + 1
			}
			resources = append(resources, AssignmentResource{
				AssignmentID: assignmentID,
				ResourceType: normalizeResourceType(item.ResourceType),
				ResourceID:   item.ResourceID,
				UnitID:       item.UnitID,
				LessonID:     item.LessonID,
				ManualID:     item.ManualID,
				SortOrder:    sortOrder,
			})
		}
		if err := tx.WithContext(ctx).Create(&resources).Error; err != nil {
			return err
		}
	}
	rule := defaultRule(assignmentID)
	if req.Rule != nil {
		rule.AttemptLimit = req.Rule.AttemptLimit
		rule.AllowLate = req.Rule.AllowLate
		if req.Rule.AllowReturn != nil {
			rule.AllowReturn = *req.Rule.AllowReturn
		}
		rule.AllowResubmit = req.Rule.AllowResubmit
		rule.ScoreMode = strings.TrimSpace(req.Rule.ScoreMode)
	}
	rule = normalizeRule(rule)
	return tx.WithContext(ctx).Create(&rule).Error
}

func (s *Service) replaceRubric(ctx context.Context, tx *gorm.DB, assignmentID uint64, inputs []RubricItemInput) error {
	items := normalizeRubricItems(inputs)
	var total float64
	for _, item := range items {
		total += item.MaxScore
	}
	if total <= 0 {
		total = 100
	}
	var existing []Rubric
	if err := tx.WithContext(ctx).Where("assignment_id = ?", assignmentID).Find(&existing).Error; err != nil {
		return err
	}
	for _, item := range existing {
		if err := tx.WithContext(ctx).Where("rubric_id = ?", item.ID).Delete(&RubricItem{}).Error; err != nil {
			return err
		}
	}
	if err := tx.WithContext(ctx).Where("assignment_id = ?", assignmentID).Delete(&Rubric{}).Error; err != nil {
		return err
	}
	rubric := &Rubric{AssignmentID: assignmentID, Title: "作业评分 Rubric", TotalScore: total}
	if err := tx.WithContext(ctx).Create(rubric).Error; err != nil {
		return err
	}
	rubricItems := make([]RubricItem, 0, len(items))
	for index, item := range items {
		sortOrder := item.SortOrder
		if sortOrder <= 0 {
			sortOrder = index + 1
		}
		rubricItems = append(rubricItems, RubricItem{
			RubricID:    rubric.ID,
			Title:       item.Title,
			Description: item.Description,
			MaxScore:    item.MaxScore,
			SortOrder:   sortOrder,
		})
	}
	if len(rubricItems) == 0 {
		return nil
	}
	return tx.WithContext(ctx).Create(&rubricItems).Error
}

func (s *Service) ensureTeacherCanManage(ctx context.Context, actorID uint64, roleType int, record *TeachingAssignment) error {
	if roleType >= int(user.RoleAdmin) || record.CreatorID == actorID {
		return nil
	}
	var count int64
	if err := s.db.WithContext(ctx).Table("assignment_classes ac").
		Joins("JOIN classes c ON c.id = ac.class_id").
		Where("ac.assignment_id = ? AND c.owner_teacher_id = ?", record.ID, actorID).
		Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	return apperrors.Forbidden("无权管理该作业")
}

func (s *Service) ensureClassScope(ctx context.Context, actorID uint64, roleType int, classIDs []uint64, requireActive bool) error {
	for _, classID := range classIDs {
		if classID == 0 {
			continue
		}
		var record classroom.Class
		if err := s.db.WithContext(ctx).First(&record, classID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return apperrors.BadRequest("绑定班级不存在")
			}
			return err
		}
		if roleType < int(user.RoleAdmin) && record.OwnerTeacherID != actorID {
			return apperrors.Forbidden("只能绑定自己主教师班级")
		}
		if requireActive && record.Status != classroom.ClassStatusActive {
			return apperrors.BadRequest("停用班级不能用于发布作业")
		}
	}
	return nil
}

func (s *Service) validateResource(ctx context.Context, resource AssignmentResource) []AssignmentIssue {
	switch normalizeResourceType(resource.ResourceType) {
	case ResourceTypeCourse:
		var record course.Course
		if err := s.db.WithContext(ctx).First(&record, resource.ResourceID).Error; err != nil {
			return []AssignmentIssue{issue("ASSIGNMENT_RESOURCE_NOT_FOUND", "课程", "课程资源不存在", resource.ResourceID, "")}
		}
		if record.Status != course.CourseStatusPublished {
			return []AssignmentIssue{issue("ASSIGNMENT_RESOURCE_UNPUBLISHED", "课程", "课程尚未发布，不能发布作业", record.ID, record.Title)}
		}
	case ResourceTypeCourseLesson:
		lessonID := resource.LessonID
		if lessonID == 0 {
			lessonID = resource.ResourceID
		}
		var lesson course.CourseLesson
		if err := s.db.WithContext(ctx).First(&lesson, lessonID).Error; err != nil {
			return []AssignmentIssue{issue("ASSIGNMENT_RESOURCE_NOT_FOUND", "课时", "课时资源不存在", lessonID, "")}
		}
		var parent course.Course
		if err := s.db.WithContext(ctx).First(&parent, lesson.CourseID).Error; err != nil || parent.Status != course.CourseStatusPublished {
			return []AssignmentIssue{issue("ASSIGNMENT_RESOURCE_UNPUBLISHED", "课时", "课时所属课程尚未发布，不能发布作业", lesson.ID, lesson.Title)}
		}
	case ResourceTypeProject:
		var record project.Project
		if err := s.db.WithContext(ctx).First(&record, resource.ResourceID).Error; err != nil {
			return []AssignmentIssue{issue("ASSIGNMENT_RESOURCE_NOT_FOUND", "项目", "项目资源不存在", resource.ResourceID, "")}
		}
		if record.Status != project.ProjectStatusPublished {
			return []AssignmentIssue{issue("ASSIGNMENT_RESOURCE_UNPUBLISHED", "项目", "项目尚未发布，不能发布作业", record.ID, record.Title)}
		}
	case ResourceTypeProjectUnit:
		unitID := resource.UnitID
		if unitID == 0 {
			unitID = resource.ResourceID
		}
		var unit project.ProjectUnit
		if err := s.db.WithContext(ctx).First(&unit, unitID).Error; err != nil {
			return []AssignmentIssue{issue("ASSIGNMENT_RESOURCE_NOT_FOUND", "项目单元", "项目单元不存在", unitID, "")}
		}
		var parent project.Project
		if err := s.db.WithContext(ctx).First(&parent, unit.ProjectID).Error; err != nil || parent.Status != project.ProjectStatusPublished {
			return []AssignmentIssue{issue("ASSIGNMENT_RESOURCE_UNPUBLISHED", "项目单元", "项目单元所属项目尚未发布，不能发布作业", unit.ID, unit.Title)}
		}
	case ResourceTypeManual:
		manualID := resource.ManualID
		if manualID == 0 {
			manualID = resource.ResourceID
		}
		var manual agent.AgentManual
		if err := s.db.WithContext(ctx).First(&manual, manualID).Error; err != nil {
			return []AssignmentIssue{issue("ASSIGNMENT_RESOURCE_NOT_FOUND", "Agent 手册", "Agent 手册不存在", manualID, "")}
		}
		if manual.IsPublished != 1 {
			return []AssignmentIssue{issue("ASSIGNMENT_RESOURCE_UNPUBLISHED", "Agent 手册", "Agent 手册尚未发布，不能发布作业", manual.ID, manual.Title)}
		}
	case ResourceTypeClassicLab:
		if resource.ResourceID == 0 {
			return []AssignmentIssue{issue("ASSIGNMENT_RESOURCE_INVALID", "Classic Lab", "Classic Lab 必须关联课程或项目资源", 0, "")}
		}
		if ok, title := s.hasPublishedCourseOrProject(ctx, resource.ResourceID); !ok {
			return []AssignmentIssue{issue("ASSIGNMENT_RESOURCE_UNPUBLISHED", "Classic Lab", "Classic Lab 关联资源尚未发布，不能发布作业", resource.ResourceID, title)}
		}
	case ResourceTypeOpenClawProject:
		var record project.Project
		if err := s.db.WithContext(ctx).First(&record, resource.ResourceID).Error; err != nil {
			return []AssignmentIssue{issue("ASSIGNMENT_RESOURCE_NOT_FOUND", "OpenClaw", "OpenClaw 项目不存在", resource.ResourceID, "")}
		}
		if record.Status != project.ProjectStatusPublished {
			return []AssignmentIssue{issue("ASSIGNMENT_RESOURCE_UNPUBLISHED", "OpenClaw", "OpenClaw 项目尚未发布，不能发布作业", record.ID, record.Title)}
		}
		tags, err := s.projectTags(ctx, record.ID)
		if err != nil || !project.HasOpenClawTag(tags) {
			return []AssignmentIssue{issue("ASSIGNMENT_OPENCLAW_TAG_REQUIRED", "OpenClaw", "OpenClaw 作业资源必须绑定带 OpenClaw 标签的项目", record.ID, record.Title)}
		}
	default:
		return []AssignmentIssue{issue("ASSIGNMENT_RESOURCE_TYPE_INVALID", "资源", "不支持的作业资源类型", resource.ResourceID, resource.ResourceType)}
	}
	return nil
}

func (s *Service) resolveResourceTitle(ctx context.Context, resource AssignmentResource) (string, int) {
	switch normalizeResourceType(resource.ResourceType) {
	case ResourceTypeCourse:
		var record course.Course
		if err := s.db.WithContext(ctx).First(&record, resource.ResourceID).Error; err == nil {
			return record.Title, int(record.Status)
		}
	case ResourceTypeCourseLesson:
		lessonID := resource.LessonID
		if lessonID == 0 {
			lessonID = resource.ResourceID
		}
		var record course.CourseLesson
		if err := s.db.WithContext(ctx).First(&record, lessonID).Error; err == nil {
			return record.Title, 1
		}
	case ResourceTypeProject, ResourceTypeOpenClawProject:
		var record project.Project
		if err := s.db.WithContext(ctx).First(&record, resource.ResourceID).Error; err == nil {
			return record.Title, int(record.Status)
		}
	case ResourceTypeProjectUnit:
		unitID := resource.UnitID
		if unitID == 0 {
			unitID = resource.ResourceID
		}
		var record project.ProjectUnit
		if err := s.db.WithContext(ctx).First(&record, unitID).Error; err == nil {
			return record.Title, 1
		}
	case ResourceTypeManual:
		manualID := resource.ManualID
		if manualID == 0 {
			manualID = resource.ResourceID
		}
		var record agent.AgentManual
		if err := s.db.WithContext(ctx).First(&record, manualID).Error; err == nil {
			return record.Title, record.IsPublished
		}
	case ResourceTypeClassicLab:
		if ok, title := s.hasPublishedCourseOrProject(ctx, resource.ResourceID); ok || title != "" {
			return title, boolStatus(ok)
		}
	}
	return "未知资源", 0
}

func (s *Service) hasPublishedCourseOrProject(ctx context.Context, resourceID uint64) (bool, string) {
	var courseRecord course.Course
	if err := s.db.WithContext(ctx).First(&courseRecord, resourceID).Error; err == nil {
		return courseRecord.Status == course.CourseStatusPublished, courseRecord.Title
	}
	var projectRecord project.Project
	if err := s.db.WithContext(ctx).First(&projectRecord, resourceID).Error; err == nil {
		return projectRecord.Status == project.ProjectStatusPublished, projectRecord.Title
	}
	return false, ""
}

func (s *Service) projectTags(ctx context.Context, projectID uint64) ([]project.Tag, error) {
	var tags []project.Tag
	err := s.db.WithContext(ctx).Table("tags").
		Select("tags.*").
		Joins("JOIN project_tags pt ON pt.tag_id = tags.id").
		Where("pt.project_id = ?", projectID).
		Find(&tags).Error
	return tags, err
}

func normalizeRequest(req UpsertAssignmentRequest) (UpsertAssignmentRequest, error) {
	req.Title = strings.TrimSpace(req.Title)
	req.Description = strings.TrimSpace(req.Description)
	req.RubricItems = normalizeRubricItems(req.RubricItems)
	if req.Title == "" {
		return req, apperrors.BadRequest("作业标题不能为空")
	}
	for i := range req.Resources {
		req.Resources[i].ResourceType = normalizeResourceType(req.Resources[i].ResourceType)
		if req.Resources[i].ResourceType == "" {
			return req, apperrors.BadRequest("作业资源类型不能为空")
		}
	}
	return req, nil
}

func normalizeRubricItems(items []RubricItemInput) []RubricItemInput {
	normalized := make([]RubricItemInput, 0, len(items))
	for index, item := range items {
		title := strings.TrimSpace(item.Title)
		if title == "" {
			continue
		}
		maxScore := item.MaxScore
		if maxScore <= 0 {
			maxScore = 10
		}
		sortOrder := item.SortOrder
		if sortOrder <= 0 {
			sortOrder = index + 1
		}
		normalized = append(normalized, RubricItemInput{
			Title:       title,
			Description: strings.TrimSpace(item.Description),
			MaxScore:    maxScore,
			SortOrder:   sortOrder,
		})
	}
	if len(normalized) == 0 {
		return []RubricItemInput{{Title: "完成质量", MaxScore: 100, SortOrder: 1}}
	}
	return normalized
}

func normalizeResourceType(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func normalizeRule(rule AssignmentRule) AssignmentRule {
	if rule.AttemptLimit <= 0 {
		rule.AttemptLimit = 1
	}
	rule.ScoreMode = strings.TrimSpace(rule.ScoreMode)
	if rule.ScoreMode == "" {
		rule.ScoreMode = "completion"
	}
	return rule
}

func defaultRule(assignmentID uint64) AssignmentRule {
	return AssignmentRule{
		AssignmentID:  assignmentID,
		AttemptLimit:  1,
		AllowLate:     false,
		AllowReturn:   true,
		AllowResubmit: false,
		ScoreMode:     "completion",
	}
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

func displayName(record user.User) string {
	if strings.TrimSpace(record.FullName) != "" {
		return record.FullName
	}
	return record.Username
}

func boolStatus(ok bool) int {
	if ok {
		return 1
	}
	return 0
}

func issue(code, scope, message string, resourceID uint64, ref string) AssignmentIssue {
	return AssignmentIssue{
		Code:        code,
		Scope:       scope,
		Message:     message,
		ResourceID:  resourceID,
		ResourceRef: ref,
	}
}

func finalizeCheck(result PublishCheckResult) PublishCheckResult {
	result.CanPublish = len(result.Errors) == 0
	if result.CanPublish {
		result.Summary = "发布检查通过"
		return result
	}
	result.Summary = fmt.Sprintf("发布检查发现 %d 个阻断项", len(result.Errors))
	return result
}
