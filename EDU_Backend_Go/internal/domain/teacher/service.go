package teacher

import (
	"context"
	"strings"
	"time"

	"go.uber.org/zap"
	"gorm.io/gorm"

	"edu-platform/internal/domain/agent"
	"edu-platform/internal/domain/assignment"
	"edu-platform/internal/domain/classroom"
	"edu-platform/internal/domain/user"
)

type Service struct {
	db     *gorm.DB
	logger *zap.Logger
}

func NewService(db *gorm.DB, logger *zap.Logger) *Service {
	return &Service{db: db, logger: logger}
}

type ManualListQuery struct {
	Page       int
	PageSize   int
	Q          string
	SourceType *int
	Published  *int
}

type ManualListItem struct {
	ID          uint64    `json:"id"`
	SourceType  int       `json:"sourceType"`
	SourceID    uint64    `json:"sourceId"`
	SourceName  string    `json:"sourceName"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	IsPublished int       `json:"isPublished"`
	CreatorID   uint64    `json:"creatorId"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type ProgressView string

const (
	ProgressViewCourse  ProgressView = "course"
	ProgressViewProject ProgressView = "project"
)

type ProgressListQuery struct {
	View     ProgressView
	Page     int
	PageSize int
	Q        string
}

type ProgressSummary struct {
	Total      int64 `json:"total"`
	InProgress int64 `json:"inProgress"`
	Completed  int64 `json:"completed"`
}

type ProgressListItem struct {
	Type              string     `json:"type"`
	ResourceID        uint64     `json:"resourceId"`
	ResourceTitle     string     `json:"resourceTitle"`
	UserID            uint64     `json:"userId"`
	Username          string     `json:"username"`
	FullName          string     `json:"fullName"`
	Status            int        `json:"status"`
	ProgressPercent   int        `json:"progressPercent"`
	CompletedCount    int        `json:"completedCount"`
	TotalCount        int        `json:"totalCount"`
	LastActiveAt      *time.Time `json:"lastActiveAt"`
	CompletedAt       *time.Time `json:"completedAt"`
	CurrentResourceID uint64     `json:"currentResourceId"`
}

func (s *Service) ListManuals(ctx context.Context, actorID uint64, roleType int, query ManualListQuery) ([]ManualListItem, int64, error) {
	db := s.db.WithContext(ctx).Model(&agent.AgentManual{})
	if strings.TrimSpace(query.Q) != "" {
		like := "%" + strings.TrimSpace(query.Q) + "%"
		db = db.Where("(title LIKE ? OR description LIKE ?)", like, like)
	}
	if query.SourceType != nil {
		db = db.Where("source_type = ?", *query.SourceType)
	}
	if query.Published != nil {
		db = db.Where("is_published = ?", *query.Published)
	}
	if roleType < int(user.RoleAdmin) {
		if s.hasAssignmentManualScopeTables() {
			db = db.Where(`
				creator_id = ? OR EXISTS (
					SELECT 1
					FROM assignment_resources AS ar
					JOIN teaching_assignments AS ta ON ta.id = ar.assignment_id AND ta.status <> ?
					JOIN assignment_classes AS ac ON ac.assignment_id = ta.id
					JOIN classes AS cls ON cls.id = ac.class_id AND cls.status = ?
					JOIN class_teachers AS ct ON ct.class_id = cls.id AND ct.teacher_id = ? AND ct.status = ?
					WHERE ar.manual_id = agent_manuals.id
				)`,
				actorID,
				assignment.AssignmentStatusArchived,
				classroom.ClassStatusActive,
				actorID,
				classroom.ClassTeacherStatusActive,
			)
		} else {
			db = db.Where("creator_id = ?", actorID)
		}
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var manuals []agent.AgentManual
	if err := db.Order("updated_at DESC").Offset((query.Page - 1) * query.PageSize).Limit(query.PageSize).Find(&manuals).Error; err != nil {
		return nil, 0, err
	}

	lessonIDs := make([]uint64, 0)
	unitIDs := make([]uint64, 0)
	for _, manual := range manuals {
		if manual.SourceType == agent.SourceTypeLesson {
			lessonIDs = append(lessonIDs, manual.SourceID)
		}
		if manual.SourceType == agent.SourceTypeProjectUnit {
			unitIDs = append(unitIDs, manual.SourceID)
		}
	}

	lessonNames := make(map[uint64]string)
	if len(lessonIDs) > 0 {
		type lessonRow struct {
			ID    uint64 `gorm:"column:id"`
			Title string `gorm:"column:title"`
		}
		var rows []lessonRow
		if err := s.db.WithContext(ctx).Table("course_lessons").Select("id, title").Where("id IN ?", lessonIDs).Find(&rows).Error; err != nil {
			return nil, 0, err
		}
		for _, row := range rows {
			lessonNames[row.ID] = row.Title
		}
	}

	unitNames := make(map[uint64]string)
	if len(unitIDs) > 0 {
		type unitRow struct {
			ID    uint64 `gorm:"column:id"`
			Title string `gorm:"column:title"`
		}
		var rows []unitRow
		if err := s.db.WithContext(ctx).Table("project_units").Select("id, title").Where("id IN ?", unitIDs).Find(&rows).Error; err != nil {
			return nil, 0, err
		}
		for _, row := range rows {
			unitNames[row.ID] = row.Title
		}
	}

	items := make([]ManualListItem, 0, len(manuals))
	for _, manual := range manuals {
		sourceName := "未关联资源"
		if manual.SourceType == agent.SourceTypeLesson {
			if name := lessonNames[manual.SourceID]; strings.TrimSpace(name) != "" {
				sourceName = name
			}
		}
		if manual.SourceType == agent.SourceTypeProjectUnit {
			if name := unitNames[manual.SourceID]; strings.TrimSpace(name) != "" {
				sourceName = name
			}
		}
		items = append(items, ManualListItem{
			ID:          manual.ID,
			SourceType:  manual.SourceType,
			SourceID:    manual.SourceID,
			SourceName:  sourceName,
			Title:       manual.Title,
			Description: manual.Description,
			IsPublished: manual.IsPublished,
			CreatorID:   manual.CreatorID,
			CreatedAt:   manual.CreatedAt,
			UpdatedAt:   manual.UpdatedAt,
		})
	}
	return items, total, nil
}

func (s *Service) hasAssignmentManualScopeTables() bool {
	migrator := s.db.Migrator()
	return migrator.HasTable("assignment_resources") &&
		migrator.HasTable("teaching_assignments") &&
		migrator.HasTable("assignment_classes") &&
		migrator.HasTable("classes") &&
		migrator.HasTable("class_teachers")
}

func (s *Service) ListProgress(ctx context.Context, actorID uint64, roleType int, query ProgressListQuery) ([]ProgressListItem, int64, ProgressSummary, error) {
	switch query.View {
	case ProgressViewProject:
		return s.listProjectProgress(ctx, actorID, roleType, query)
	default:
		return s.listCourseProgress(ctx, actorID, roleType, query)
	}
}

func (s *Service) listCourseProgress(ctx context.Context, actorID uint64, roleType int, query ProgressListQuery) ([]ProgressListItem, int64, ProgressSummary, error) {
	type courseRow struct {
		ResourceID        uint64     `gorm:"column:resource_id"`
		ResourceTitle     string     `gorm:"column:resource_title"`
		UserID            uint64     `gorm:"column:user_id"`
		Username          string     `gorm:"column:username"`
		FullName          string     `gorm:"column:full_name"`
		Status            int        `gorm:"column:status"`
		ProgressPercent   int        `gorm:"column:progress_percent"`
		CompletedCount    int        `gorm:"column:completed_count"`
		TotalCount        int        `gorm:"column:total_count"`
		LastActiveAt      *time.Time `gorm:"column:last_active_at"`
		CompletedAt       *time.Time `gorm:"column:completed_at"`
		CurrentResourceID uint64     `gorm:"column:current_resource_id"`
	}

	base := s.db.WithContext(ctx).Table("user_course_enrollments AS e").
		Select(`
			c.id AS resource_id,
			c.title AS resource_title,
			u.id AS user_id,
			u.username AS username,
			u.full_name AS full_name,
			e.status AS status,
			e.progress_percent AS progress_percent,
			e.completed_lessons_count AS completed_count,
			COALESCE(lesson_stats.total_lessons, 0) AS total_count,
			e.last_active_at AS last_active_at,
			e.completed_at AS completed_at,
			e.last_lesson_id AS current_resource_id`).
		Joins("JOIN sys_users AS u ON u.id = e.user_id").
		Joins("JOIN courses AS c ON c.id = e.course_id").
		Joins(`
			LEFT JOIN (
				SELECT cs.course_id, COUNT(cl.id) AS total_lessons
				FROM course_lessons cl
				JOIN course_stages cs ON cs.id = cl.stage_id
				GROUP BY cs.course_id
			) AS lesson_stats ON lesson_stats.course_id = c.id`)

	if roleType < int(user.RoleAdmin) {
		base = base.Where(`
			EXISTS (
				SELECT 1
				FROM class_members AS cm
				JOIN classes AS cls ON cls.id = cm.class_id AND cls.status = ?
				JOIN class_teachers AS ct ON ct.class_id = cls.id AND ct.teacher_id = ? AND ct.status = ?
				WHERE cm.user_id = e.user_id AND cm.status = ?
			)`,
			classroom.ClassStatusActive,
			actorID,
			classroom.ClassTeacherStatusActive,
			classroom.ClassMemberStatusActive,
		)
	}
	if strings.TrimSpace(query.Q) != "" {
		like := "%" + strings.TrimSpace(query.Q) + "%"
		base = base.Where("(u.username LIKE ? OR u.full_name LIKE ? OR c.title LIKE ?)", like, like, like)
	}

	var total int64
	if err := base.Count(&total).Error; err != nil {
		return nil, 0, ProgressSummary{}, err
	}

	var rows []courseRow
	if err := base.Order("e.last_active_at DESC").Offset((query.Page - 1) * query.PageSize).Limit(query.PageSize).Find(&rows).Error; err != nil {
		return nil, 0, ProgressSummary{}, err
	}

	var summary ProgressSummary
	if err := base.Session(&gorm.Session{}).Count(&summary.Total).Error; err != nil {
		return nil, 0, ProgressSummary{}, err
	}
	if err := base.Session(&gorm.Session{}).Where("e.status = 1").Count(&summary.InProgress).Error; err != nil {
		return nil, 0, ProgressSummary{}, err
	}
	if err := base.Session(&gorm.Session{}).Where("e.status = 2").Count(&summary.Completed).Error; err != nil {
		return nil, 0, ProgressSummary{}, err
	}

	items := make([]ProgressListItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, ProgressListItem{
			Type:              "course",
			ResourceID:        row.ResourceID,
			ResourceTitle:     row.ResourceTitle,
			UserID:            row.UserID,
			Username:          row.Username,
			FullName:          row.FullName,
			Status:            row.Status,
			ProgressPercent:   row.ProgressPercent,
			CompletedCount:    row.CompletedCount,
			TotalCount:        row.TotalCount,
			LastActiveAt:      row.LastActiveAt,
			CompletedAt:       row.CompletedAt,
			CurrentResourceID: row.CurrentResourceID,
		})
	}
	return items, total, summary, nil
}

func (s *Service) listProjectProgress(ctx context.Context, actorID uint64, roleType int, query ProgressListQuery) ([]ProgressListItem, int64, ProgressSummary, error) {
	type projectRow struct {
		ResourceID        uint64     `gorm:"column:resource_id"`
		ResourceTitle     string     `gorm:"column:resource_title"`
		UserID            uint64     `gorm:"column:user_id"`
		Username          string     `gorm:"column:username"`
		FullName          string     `gorm:"column:full_name"`
		Status            int        `gorm:"column:status"`
		ProgressPercent   int        `gorm:"column:progress_percent"`
		CompletedCount    int        `gorm:"column:completed_count"`
		TotalCount        int        `gorm:"column:total_count"`
		LastActiveAt      *time.Time `gorm:"column:last_active_at"`
		CompletedAt       *time.Time `gorm:"column:completed_at"`
		CurrentResourceID uint64     `gorm:"column:current_resource_id"`
	}

	base := s.db.WithContext(ctx).Table("user_project_progress AS p").
		Select(`
			pr.id AS resource_id,
			pr.title AS resource_title,
			u.id AS user_id,
			u.username AS username,
			u.full_name AS full_name,
			p.status AS status,
			p.progress_percent AS progress_percent,
			p.finished_units_count AS completed_count,
			COALESCE(unit_stats.total_units, 0) AS total_count,
			p.last_active_at AS last_active_at,
			p.completed_at AS completed_at,
			p.current_unit_id AS current_resource_id`).
		Joins("JOIN sys_users AS u ON u.id = p.user_id").
		Joins("JOIN projects AS pr ON pr.id = p.project_id AND pr.deleted_at IS NULL").
		Joins("LEFT JOIN (SELECT project_id, COUNT(*) AS total_units FROM project_units GROUP BY project_id) AS unit_stats ON unit_stats.project_id = pr.id")

	if roleType < int(user.RoleAdmin) {
		base = base.Where("pr.created_by = ?", actorID)
	}
	if strings.TrimSpace(query.Q) != "" {
		like := "%" + strings.TrimSpace(query.Q) + "%"
		base = base.Where("(u.username LIKE ? OR u.full_name LIKE ? OR pr.title LIKE ?)", like, like, like)
	}

	var total int64
	if err := base.Count(&total).Error; err != nil {
		return nil, 0, ProgressSummary{}, err
	}

	var rows []projectRow
	if err := base.Order("p.last_active_at DESC").Offset((query.Page - 1) * query.PageSize).Limit(query.PageSize).Find(&rows).Error; err != nil {
		return nil, 0, ProgressSummary{}, err
	}

	var summary ProgressSummary
	if err := base.Session(&gorm.Session{}).Count(&summary.Total).Error; err != nil {
		return nil, 0, ProgressSummary{}, err
	}
	if err := base.Session(&gorm.Session{}).Where("p.status = 1").Count(&summary.InProgress).Error; err != nil {
		return nil, 0, ProgressSummary{}, err
	}
	if err := base.Session(&gorm.Session{}).Where("p.status = 2").Count(&summary.Completed).Error; err != nil {
		return nil, 0, ProgressSummary{}, err
	}

	items := make([]ProgressListItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, ProgressListItem{
			Type:              "project",
			ResourceID:        row.ResourceID,
			ResourceTitle:     row.ResourceTitle,
			UserID:            row.UserID,
			Username:          row.Username,
			FullName:          row.FullName,
			Status:            row.Status,
			ProgressPercent:   row.ProgressPercent,
			CompletedCount:    row.CompletedCount,
			TotalCount:        row.TotalCount,
			LastActiveAt:      row.LastActiveAt,
			CompletedAt:       row.CompletedAt,
			CurrentResourceID: row.CurrentResourceID,
		})
	}
	return items, total, summary, nil
}
