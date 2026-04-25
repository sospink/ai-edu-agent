package assignment

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"

	"edu-platform/internal/domain/classroom"
	"edu-platform/internal/domain/lab"
	"edu-platform/internal/domain/user"
	apperrors "edu-platform/pkg/errors"
)

const riskInactiveDays = 7

func (s *Service) TeachingOverview(ctx context.Context, actorID uint64, roleType int) (*TeachingOverviewResponse, error) {
	var pending, overdue, verificationFailed, labFailed int64
	if err := s.scopedSubmissions(ctx, actorID, roleType).
		Where("s.status IN ?", []string{SubmissionStatusSubmitted, SubmissionStatusResubmitted}).
		Count(&pending).Error; err != nil {
		return nil, err
	}
	if err := s.overdueMissingQuery(ctx, actorID, roleType, TeacherDashboardQuery{}).Count(&overdue).Error; err != nil {
		return nil, err
	}
	if err := s.verificationFailedQuery(ctx, actorID, roleType, TeacherDashboardQuery{}).Count(&verificationFailed).Error; err != nil {
		return nil, err
	}
	if err := s.labFailedQuery(ctx, actorID, roleType, TeacherDashboardQuery{}).Count(&labFailed).Error; err != nil {
		return nil, err
	}
	risks, _, err := s.RiskStudents(ctx, actorID, roleType, TeacherDashboardQuery{Page: 1, PageSize: 1})
	if err != nil {
		return nil, err
	}
	progress, err := s.AssignmentProgress(ctx, actorID, roleType, TeacherDashboardQuery{Page: 1, PageSize: 100})
	if err != nil {
		return nil, err
	}
	var lowClasses int64
	for _, item := range progress.List {
		if item.TotalStudents >= 2 && item.TotalStudents > 0 && float64(item.Submitted)/float64(item.TotalStudents) < 0.5 {
			lowClasses++
		}
	}
	return &TeachingOverviewResponse{
		PendingReview:        pending,
		OverdueMissing:       overdue,
		VerificationFailed:   verificationFailed,
		LabFailed:            labFailed,
		RiskStudents:         risks.Total,
		LowCompletionClasses: lowClasses,
	}, nil
}

func (s *Service) TodoItems(ctx context.Context, actorID uint64, roleType int, query TeacherDashboardQuery) (*TodoItemsResponse, error) {
	page, pageSize := normalizePage(query.Page, query.PageSize)
	items := make([]TodoItem, 0)
	appendRows := func(db *gorm.DB, todoType string, offset, limit int) error {
		var rows []TodoItem
		if err := s.db.WithContext(ctx).
			Table("(?) AS todo_rows", db).
			Order("todo_rows.updated_at DESC").
			Offset(offset).
			Limit(limit).
			Scan(&rows).Error; err != nil {
			return err
		}
		for i := range rows {
			rows[i].Type = todoType
		}
		items = append(items, rows...)
		return nil
	}

	var total int64
	switch strings.TrimSpace(query.Type) {
	case "overdue_missing":
		db := s.overdueMissingQuery(ctx, actorID, roleType, query)
		if err := db.Count(&total).Error; err != nil {
			return nil, err
		}
		if err := appendRows(db, "overdue_missing", (page-1)*pageSize, pageSize); err != nil {
			return nil, err
		}
	case "verification_failed":
		db := s.verificationFailedQuery(ctx, actorID, roleType, query)
		if err := db.Count(&total).Error; err != nil {
			return nil, err
		}
		if err := appendRows(db, "verification_failed", (page-1)*pageSize, pageSize); err != nil {
			return nil, err
		}
	case "lab_failed":
		db := s.labFailedQuery(ctx, actorID, roleType, query)
		if err := db.Count(&total).Error; err != nil {
			return nil, err
		}
		if err := appendRows(db, "lab_failed", (page-1)*pageSize, pageSize); err != nil {
			return nil, err
		}
	case "pending_review":
		db := s.pendingReviewQuery(ctx, actorID, roleType, query)
		if err := db.Count(&total).Error; err != nil {
			return nil, err
		}
		if err := appendRows(db, "pending_review", (page-1)*pageSize, pageSize); err != nil {
			return nil, err
		}
	default:
		queries := []struct {
			typ string
			db  *gorm.DB
		}{
			{typ: "pending_review", db: s.pendingReviewQuery(ctx, actorID, roleType, query)},
			{typ: "overdue_missing", db: s.overdueMissingQuery(ctx, actorID, roleType, query)},
			{typ: "verification_failed", db: s.verificationFailedQuery(ctx, actorID, roleType, query)},
			{typ: "lab_failed", db: s.labFailedQuery(ctx, actorID, roleType, query)},
		}
		limit := page * pageSize
		for _, item := range queries {
			var count int64
			if err := item.db.Count(&count).Error; err != nil {
				return nil, err
			}
			total += count
			if err := appendRows(item.db, item.typ, 0, limit); err != nil {
				return nil, err
			}
		}
		sort.SliceStable(items, func(i, j int) bool {
			return items[i].UpdatedAt.After(items[j].UpdatedAt)
		})
		start := (page - 1) * pageSize
		if start >= len(items) {
			items = []TodoItem{}
		} else {
			end := start + pageSize
			if end > len(items) {
				end = len(items)
			}
			items = items[start:end]
		}
	}
	return &TodoItemsResponse{List: items, Total: total}, nil
}

func (s *Service) RiskStudents(ctx context.Context, actorID uint64, roleType int, query TeacherDashboardQuery) (*RiskStudentsResponse, int64, error) {
	type row struct {
		StudentID       uint64 `gorm:"column:student_id"`
		StudentName     string `gorm:"column:student_name"`
		StudentUsername string `gorm:"column:student_username"`
		ClassID         uint64 `gorm:"column:class_id"`
		ClassName       string `gorm:"column:class_name"`
		AssignedCount   int64  `gorm:"column:assigned_count"`
		SubmittedCount  int64  `gorm:"column:submitted_count"`
		ReturnedCount   int64  `gorm:"column:returned_count"`
		FailedChecks    int64  `gorm:"column:failed_checks"`
		MissingOverdue  int64  `gorm:"column:missing_overdue"`
	}
	db := s.db.WithContext(ctx).Table("class_members cm").
		Select(`cm.user_id AS student_id, COALESCE(u.full_name, u.username, '') AS student_name, u.username AS student_username,
			c.id AS class_id, c.name AS class_name,
			COUNT(DISTINCT ta.id) AS assigned_count,
			COUNT(DISTINCT s.assignment_id) AS submitted_count,
			COUNT(DISTINCT CASE WHEN s.status = ? THEN s.id END) AS returned_count,
			COUNT(DISTINCT CASE WHEN sc.status = 'failed' THEN sc.id END) AS failed_checks,
			COUNT(DISTINCT CASE WHEN ta.due_at IS NOT NULL AND ta.due_at < ? AND s.id IS NULL THEN ta.id END) AS missing_overdue`,
			SubmissionStatusReturned, time.Now()).
		Joins("JOIN classes c ON c.id = cm.class_id").
		Joins("JOIN sys_users u ON u.id = cm.user_id").
		Joins("JOIN assignment_classes ac ON ac.class_id = cm.class_id").
		Joins("JOIN teaching_assignments ta ON ta.id = ac.assignment_id AND ta.status IN ?", []AssignmentStatus{AssignmentStatusPublished, AssignmentStatusClosed}).
		Joins("LEFT JOIN submissions s ON s.assignment_id = ta.id AND s.student_id = cm.user_id").
		Joins("LEFT JOIN submission_checks sc ON sc.submission_id = s.id").
		Where("cm.status = ?", classroom.ClassMemberStatusActive).
		Group("cm.user_id, c.id")
	if roleType < int(user.RoleAdmin) {
		db = db.Where("ta.creator_id = ? OR c.owner_teacher_id = ?", actorID, actorID)
	}
	if query.ClassID > 0 {
		db = db.Where("c.id = ?", query.ClassID)
	}
	if strings.TrimSpace(query.Q) != "" {
		like := "%" + strings.TrimSpace(query.Q) + "%"
		db = db.Where("u.username LIKE ? OR u.full_name LIKE ? OR c.name LIKE ?", like, like, like)
	}
	var rows []row
	if err := db.Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	lastActive, err := s.loadLastActiveMap(ctx)
	if err != nil {
		return nil, 0, err
	}
	cutoff := time.Now().AddDate(0, 0, -riskInactiveDays)
	items := make([]RiskStudentItem, 0, len(rows))
	for _, row := range rows {
		reasons := make([]string, 0)
		rate := 0.0
		if row.AssignedCount > 0 {
			rate = float64(row.SubmittedCount) / float64(row.AssignedCount)
		}
		if row.AssignedCount >= 2 && rate < 0.5 {
			reasons = append(reasons, "作业完成率低于 50%")
		}
		if row.MissingOverdue > 0 {
			reasons = append(reasons, "存在逾期未交")
		}
		if row.FailedChecks > 0 {
			reasons = append(reasons, "存在验证失败")
		}
		if row.ReturnedCount > 0 {
			reasons = append(reasons, "退回后尚未重交")
		}
		activeAt := lastActive[row.StudentID]
		if activeAt == nil || activeAt.Before(cutoff) {
			reasons = append(reasons, "超过 7 天无提交或 Lab 活跃")
		}
		if len(reasons) == 0 {
			continue
		}
		items = append(items, RiskStudentItem{
			StudentID:       row.StudentID,
			StudentName:     row.StudentName,
			StudentUsername: row.StudentUsername,
			ClassID:         row.ClassID,
			ClassName:       row.ClassName,
			AssignedCount:   row.AssignedCount,
			SubmittedCount:  row.SubmittedCount,
			CompletionRate:  rate,
			LastActiveAt:    activeAt,
			RiskReasons:     reasons,
		})
	}
	total := int64(len(items))
	page, pageSize := normalizePage(query.Page, query.PageSize)
	start := (page - 1) * pageSize
	if start >= len(items) {
		return &RiskStudentsResponse{List: []RiskStudentItem{}, Total: total}, total, nil
	}
	end := start + pageSize
	if end > len(items) {
		end = len(items)
	}
	return &RiskStudentsResponse{List: items[start:end], Total: total}, total, nil
}

func (s *Service) AssignmentProgress(ctx context.Context, actorID uint64, roleType int, query TeacherDashboardQuery) (*AssignmentProgressResponse, error) {
	page, pageSize := normalizePage(query.Page, query.PageSize)
	db := s.db.WithContext(ctx).Table("teaching_assignments ta").
		Select(`ta.id AS assignment_id, ta.title AS assignment_title, c.id AS class_id, c.name AS class_name, ta.due_at,
			COUNT(DISTINCT cm.user_id) AS total_students,
			COUNT(DISTINCT s.id) AS submitted,
			COUNT(DISTINCT CASE WHEN s.status IN ? THEN s.id END) AS pending_review,
			COUNT(DISTINCT CASE WHEN s.status = ? THEN s.id END) AS returned,
			COUNT(DISTINCT CASE WHEN s.status = ? THEN s.id END) AS graded,
			COUNT(DISTINCT CASE WHEN g.status = ? THEN g.id END) AS published_grades`,
			[]string{SubmissionStatusSubmitted, SubmissionStatusResubmitted}, SubmissionStatusReturned, SubmissionStatusGraded, GradeStatusPublished).
		Joins("JOIN assignment_classes ac ON ac.assignment_id = ta.id").
		Joins("JOIN classes c ON c.id = ac.class_id").
		Joins("JOIN class_members cm ON cm.class_id = c.id AND cm.status = ?", classroom.ClassMemberStatusActive).
		Joins("LEFT JOIN submissions s ON s.assignment_id = ta.id AND s.student_id = cm.user_id").
		Joins("LEFT JOIN grades g ON g.submission_id = s.id").
		Where("ta.status IN ?", []AssignmentStatus{AssignmentStatusPublished, AssignmentStatusClosed}).
		Group("ta.id, c.id")
	if roleType < int(user.RoleAdmin) {
		db = db.Where("ta.creator_id = ? OR c.owner_teacher_id = ?", actorID, actorID)
	}
	if query.AssignmentID > 0 {
		db = db.Where("ta.id = ?", query.AssignmentID)
	}
	if query.ClassID > 0 {
		db = db.Where("c.id = ?", query.ClassID)
	}
	if strings.TrimSpace(query.Q) != "" {
		like := "%" + strings.TrimSpace(query.Q) + "%"
		db = db.Where("ta.title LIKE ? OR c.name LIKE ?", like, like)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, err
	}
	var list []AssignmentProgressItem
	if err := db.Order("ta.updated_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Scan(&list).Error; err != nil {
		return nil, err
	}
	for i := range list {
		list[i].Missing = list[i].TotalStudents - list[i].Submitted
		if list[i].Missing < 0 {
			list[i].Missing = 0
		}
	}
	return &AssignmentProgressResponse{List: list, Total: total}, nil
}

func (s *Service) ListTeacherGrades(ctx context.Context, actorID uint64, roleType int, query TeacherDashboardQuery) (*TeacherGradesResponse, error) {
	page, pageSize := normalizePage(query.Page, query.PageSize)
	db := s.db.WithContext(ctx).Table("grades g").
		Select(`g.id AS grade_id, g.submission_id, g.assignment_id, ta.title AS assignment_title,
			g.student_id, COALESCE(u.full_name, u.username, '') AS student_name, u.username AS student_username,
			COALESCE(c.name, '') AS class_name, g.score, g.max_score, g.status, g.published_at, g.updated_at`).
		Joins("JOIN submissions s ON s.id = g.submission_id").
		Joins("JOIN teaching_assignments ta ON ta.id = g.assignment_id").
		Joins("JOIN sys_users u ON u.id = g.student_id").
		Joins("LEFT JOIN assignment_classes ac ON ac.assignment_id = ta.id").
		Joins("LEFT JOIN classes c ON c.id = ac.class_id").
		Joins("LEFT JOIN class_members cm ON cm.class_id = c.id AND cm.user_id = g.student_id")
	if roleType < int(user.RoleAdmin) {
		db = db.Where("ta.creator_id = ? OR c.owner_teacher_id = ?", actorID, actorID)
	}
	if query.AssignmentID > 0 {
		db = db.Where("g.assignment_id = ?", query.AssignmentID)
	}
	if query.ClassID > 0 {
		db = db.Where("c.id = ?", query.ClassID)
	}
	if strings.TrimSpace(query.GradeStatus) != "" {
		db = db.Where("g.status = ?", strings.TrimSpace(query.GradeStatus))
	}
	if strings.TrimSpace(query.Q) != "" {
		like := "%" + strings.TrimSpace(query.Q) + "%"
		db = db.Where("ta.title LIKE ? OR u.username LIKE ? OR u.full_name LIKE ?", like, like, like)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, err
	}
	var list []TeacherGradeItem
	if err := db.Order("g.updated_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Scan(&list).Error; err != nil {
		return nil, err
	}
	return &TeacherGradesResponse{List: list, Total: total}, nil
}

func (s *Service) RemindStudents(ctx context.Context, actorID uint64, roleType int, req RemindRequest) (*ActionResult, error) {
	targets, err := s.resolveStudentTargets(ctx, actorID, roleType, req.AssignmentID, req.ClassID, req.StudentIDs)
	if err != nil {
		return nil, err
	}
	message := strings.TrimSpace(req.Message)
	if message == "" {
		message = "老师提醒你查看并处理当前作业。"
	}
	if len(targets) == 0 {
		return &ActionResult{}, nil
	}
	notifications := make([]Notification, 0, len(targets))
	for _, target := range targets {
		notifications = append(notifications, Notification{
			UserID:     target.StudentID,
			Type:       NotificationTypeReminder,
			Title:      "作业提醒",
			Content:    message,
			SourceType: "assignment",
			SourceID:   req.AssignmentID,
		})
	}
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&notifications).Error; err != nil {
			return err
		}
		return s.createActionLog(ctx, tx, actorID, ActionTypeRemind, "assignment", req.AssignmentID, req.AssignmentID, message)
	}); err != nil {
		return nil, err
	}
	return &ActionResult{AffectedStudents: len(targets)}, nil
}

func (s *Service) ReopenAssignment(ctx context.Context, actorID uint64, roleType int, assignmentID uint64, req ReopenAssignmentRequest) (*ActionResult, error) {
	record, err := s.findAssignment(ctx, assignmentID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureTeacherCanManage(ctx, actorID, roleType, record); err != nil {
		return nil, err
	}
	extra := req.ExtraAttempts
	if extra <= 0 {
		extra = 1
	}
	targets, err := s.resolveStudentTargets(ctx, actorID, roleType, assignmentID, req.ClassID, req.StudentIDs)
	if err != nil {
		return nil, err
	}
	reason := strings.TrimSpace(req.Reason)
	if reason == "" {
		reason = "老师已为你重开本次作业提交。"
	}
	reopens := make([]SubmissionReopen, 0, len(targets))
	notifications := make([]Notification, 0, len(targets))
	for _, target := range targets {
		reopens = append(reopens, SubmissionReopen{
			AssignmentID:  assignmentID,
			StudentID:     target.StudentID,
			GrantedBy:     actorID,
			ExtraAttempts: extra,
			Reason:        reason,
			ExpiresAt:     req.ExpiresAt,
		})
		notifications = append(notifications, Notification{
			UserID:     target.StudentID,
			Type:       NotificationTypeReopened,
			Title:      "作业已重开",
			Content:    reason,
			SourceType: "assignment",
			SourceID:   assignmentID,
		})
	}
	if len(reopens) == 0 {
		return &ActionResult{}, nil
	}
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&reopens).Error; err != nil {
			return err
		}
		if err := tx.Create(&notifications).Error; err != nil {
			return err
		}
		return s.createActionLog(ctx, tx, actorID, ActionTypeReopen, "assignment", assignmentID, assignmentID, reason)
	}); err != nil {
		return nil, err
	}
	return &ActionResult{AffectedStudents: len(reopens)}, nil
}

func (s *Service) ListStudentNotifications(ctx context.Context, studentID uint64, query TeacherDashboardQuery) (*NotificationListResponse, error) {
	page, pageSize := normalizePage(query.Page, query.PageSize)
	db := s.db.WithContext(ctx).Model(&Notification{}).Where("user_id = ?", studentID)
	var total, unread int64
	if err := db.Count(&total).Error; err != nil {
		return nil, err
	}
	if err := db.Session(&gorm.Session{}).Where("read_at IS NULL").Count(&unread).Error; err != nil {
		return nil, err
	}
	var list []Notification
	if err := db.Order("created_at DESC, id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&list).Error; err != nil {
		return nil, err
	}
	return &NotificationListResponse{List: list, Total: total, Unread: unread}, nil
}

func (s *Service) MarkStudentNotificationRead(ctx context.Context, studentID, notificationID uint64) (*Notification, error) {
	var item Notification
	if err := s.db.WithContext(ctx).Where("id = ? AND user_id = ?", notificationID, studentID).First(&item).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("通知不存在")
		}
		return nil, err
	}
	now := time.Now()
	item.ReadAt = &now
	if err := s.db.WithContext(ctx).Save(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func (s *Service) TeachingQualityOverview(ctx context.Context) (*TeachingQualityOverview, error) {
	result := &TeachingQualityOverview{}
	if err := s.db.WithContext(ctx).Model(&TeachingAssignment{}).Where("status IN ?", []AssignmentStatus{AssignmentStatusPublished, AssignmentStatusClosed}).Count(&result.Assignments).Error; err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Model(&Submission{}).Where("status IN ?", []string{SubmissionStatusSubmitted, SubmissionStatusResubmitted}).Count(&result.PendingReview).Error; err != nil {
		return nil, err
	}
	if err := s.overdueMissingQuery(ctx, 0, int(user.RoleAdmin), TeacherDashboardQuery{}).Count(&result.OverdueMissing).Error; err != nil {
		return nil, err
	}
	risks, _, err := s.RiskStudents(ctx, 0, int(user.RoleAdmin), TeacherDashboardQuery{Page: 1, PageSize: 1})
	if err != nil {
		return nil, err
	}
	result.RiskStudents = risks.Total
	if err := s.db.WithContext(ctx).Model(&TeacherActionLog{}).Where("action_type = ?", ActionTypeRemind).Count(&result.RemindersSent).Error; err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Model(&SubmissionReopen{}).Count(&result.ReopenGrants).Error; err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Model(&Grade{}).Where("status = ?", GradeStatusPublished).Count(&result.PublishedGrades).Error; err != nil {
		return nil, err
	}
	return result, nil
}

type studentTarget struct {
	StudentID uint64
}

func (s *Service) resolveStudentTargets(ctx context.Context, actorID uint64, roleType int, assignmentID, classID uint64, studentIDs []uint64) ([]studentTarget, error) {
	if assignmentID > 0 {
		record, err := s.findAssignment(ctx, assignmentID)
		if err != nil {
			return nil, err
		}
		if err := s.ensureTeacherCanManage(ctx, actorID, roleType, record); err != nil {
			return nil, err
		}
	}
	if classID > 0 {
		if err := s.ensureClassScope(ctx, actorID, roleType, []uint64{classID}, false); err != nil {
			return nil, err
		}
	}
	db := s.db.WithContext(ctx).Table("class_members cm").
		Select("DISTINCT cm.user_id AS student_id").
		Where("cm.status = ?", classroom.ClassMemberStatusActive)
	if assignmentID > 0 {
		db = db.Joins("JOIN assignment_classes ac ON ac.class_id = cm.class_id AND ac.assignment_id = ?", assignmentID)
	}
	if classID > 0 {
		db = db.Where("cm.class_id = ?", classID)
	}
	if len(studentIDs) > 0 {
		db = db.Where("cm.user_id IN ?", studentIDs)
	}
	var targets []studentTarget
	if err := db.Scan(&targets).Error; err != nil {
		return nil, err
	}
	return targets, nil
}

func (s *Service) createActionLog(ctx context.Context, tx *gorm.DB, teacherID uint64, actionType, targetType string, targetID, assignmentID uint64, note string) error {
	return tx.WithContext(ctx).Create(&TeacherActionLog{
		TeacherID:    teacherID,
		ActionType:   actionType,
		TargetType:   targetType,
		TargetID:     targetID,
		AssignmentID: assignmentID,
		Note:         strings.TrimSpace(note),
	}).Error
}

func (s *Service) notifyStudent(ctx context.Context, tx *gorm.DB, studentID uint64, typ, title, content string, assignmentID uint64) error {
	return tx.WithContext(ctx).Create(&Notification{
		UserID:     studentID,
		Type:       typ,
		Title:      title,
		Content:    strings.TrimSpace(content),
		SourceType: "assignment",
		SourceID:   assignmentID,
	}).Error
}

func (s *Service) pendingReviewQuery(ctx context.Context, actorID uint64, roleType int, query TeacherDashboardQuery) *gorm.DB {
	db := s.scopedSubmissions(ctx, actorID, roleType).
		Select(`s.id AS submission_id, s.assignment_id, ta.title AS assignment_title, s.student_id,
			COALESCE(u.full_name, u.username, '') AS student_name, u.username AS student_username,
			COALESCE(c.id, 0) AS class_id, COALESCE(c.name, '') AS class_name, s.status, ta.due_at, s.updated_at`).
		Where("s.status IN ?", []string{SubmissionStatusSubmitted, SubmissionStatusResubmitted})
	return applyTodoFilters(db, query)
}

func (s *Service) overdueMissingQuery(ctx context.Context, actorID uint64, roleType int, query TeacherDashboardQuery) *gorm.DB {
	db := s.db.WithContext(ctx).Table("teaching_assignments ta").
		Select(`0 AS submission_id, ta.id AS assignment_id, ta.title AS assignment_title, cm.user_id AS student_id,
			COALESCE(u.full_name, u.username, '') AS student_name, u.username AS student_username,
			c.id AS class_id, c.name AS class_name, 'missing' AS status, ta.due_at, ta.updated_at`).
		Joins("JOIN assignment_classes ac ON ac.assignment_id = ta.id").
		Joins("JOIN classes c ON c.id = ac.class_id").
		Joins("JOIN class_members cm ON cm.class_id = c.id AND cm.status = ?", classroom.ClassMemberStatusActive).
		Joins("JOIN sys_users u ON u.id = cm.user_id").
		Joins("LEFT JOIN submissions s ON s.assignment_id = ta.id AND s.student_id = cm.user_id").
		Where("ta.status IN ? AND ta.due_at IS NOT NULL AND ta.due_at < ? AND s.id IS NULL", []AssignmentStatus{AssignmentStatusPublished, AssignmentStatusClosed}, time.Now())
	if roleType < int(user.RoleAdmin) {
		db = db.Where("ta.creator_id = ? OR c.owner_teacher_id = ?", actorID, actorID)
	}
	return applyTodoFilters(db, query)
}

func (s *Service) verificationFailedQuery(ctx context.Context, actorID uint64, roleType int, query TeacherDashboardQuery) *gorm.DB {
	db := s.scopedSubmissions(ctx, actorID, roleType).
		Select(`s.id AS submission_id, s.assignment_id, ta.title AS assignment_title, s.student_id,
			COALESCE(u.full_name, u.username, '') AS student_name, u.username AS student_username,
			COALESCE(c.id, 0) AS class_id, COALESCE(c.name, '') AS class_name, sc.status, ta.due_at, sc.created_at AS updated_at`).
		Joins("JOIN submission_checks sc ON sc.submission_id = s.id").
		Where("sc.status = ?", "failed")
	return applyTodoFilters(db, query)
}

func (s *Service) labFailedQuery(ctx context.Context, actorID uint64, roleType int, query TeacherDashboardQuery) *gorm.DB {
	db := s.db.WithContext(ctx).Table("user_lab_sessions ls").
		Select(`0 AS submission_id, ta.id AS assignment_id, ta.title AS assignment_title, ls.user_id AS student_id,
			COALESCE(u.full_name, u.username, '') AS student_name, u.username AS student_username,
			COALESCE(c.id, 0) AS class_id, COALESCE(c.name, '') AS class_name, 'lab_failed' AS status, ta.due_at, ls.updated_at`).
		Joins(`JOIN assignment_resources ar ON ar.resource_id = ls.source_id AND (
			(ls.source_type = ? AND ar.resource_type IN ?) OR
			(ls.source_type = ? AND ar.resource_type IN ?)
		)`, lab.SourceTypeCourse, []string{ResourceTypeCourse, ResourceTypeCourseLesson, ResourceTypeClassicLab}, lab.SourceTypeProject, []string{ResourceTypeProject, ResourceTypeProjectUnit, ResourceTypeOpenClawProject}).
		Joins("JOIN teaching_assignments ta ON ta.id = ar.assignment_id").
		Joins("JOIN assignment_classes ac ON ac.assignment_id = ta.id").
		Joins("JOIN classes c ON c.id = ac.class_id").
		Joins("JOIN class_members cm ON cm.class_id = c.id AND cm.user_id = ls.user_id AND cm.status = ?", classroom.ClassMemberStatusActive).
		Joins("JOIN sys_users u ON u.id = ls.user_id").
		Where("ls.status = ?", lab.SessionStatusError)
	if roleType < int(user.RoleAdmin) {
		db = db.Where("ta.creator_id = ? OR c.owner_teacher_id = ?", actorID, actorID)
	}
	return applyTodoFilters(db, query)
}

func (s *Service) scopedSubmissions(ctx context.Context, actorID uint64, roleType int) *gorm.DB {
	db := s.db.WithContext(ctx).Table("submissions s").
		Joins("JOIN teaching_assignments ta ON ta.id = s.assignment_id").
		Joins("JOIN sys_users u ON u.id = s.student_id").
		Joins("LEFT JOIN assignment_classes ac ON ac.assignment_id = ta.id").
		Joins("LEFT JOIN classes c ON c.id = ac.class_id").
		Joins("LEFT JOIN class_members cm ON cm.class_id = c.id AND cm.user_id = s.student_id")
	if roleType < int(user.RoleAdmin) {
		db = db.Where("ta.creator_id = ? OR c.owner_teacher_id = ?", actorID, actorID)
	}
	return db
}

func applyTodoFilters(db *gorm.DB, query TeacherDashboardQuery) *gorm.DB {
	if query.AssignmentID > 0 {
		db = db.Where("ta.id = ?", query.AssignmentID)
	}
	if query.ClassID > 0 {
		db = db.Where("c.id = ?", query.ClassID)
	}
	if strings.TrimSpace(query.Status) != "" {
		db = db.Where("s.status = ?", strings.TrimSpace(query.Status))
	}
	if strings.TrimSpace(query.Q) != "" {
		like := "%" + strings.TrimSpace(query.Q) + "%"
		db = db.Where("ta.title LIKE ? OR u.full_name LIKE ? OR u.username LIKE ? OR c.name LIKE ?", like, like, like, like)
	}
	return db
}

func (s *Service) loadLastActiveMap(ctx context.Context) (map[uint64]*time.Time, error) {
	result := make(map[uint64]*time.Time)
	type row struct {
		UserID uint64         `gorm:"column:user_id"`
		LastAt sql.NullString `gorm:"column:last_at"`
	}
	var submissionRows []row
	if err := s.db.WithContext(ctx).Table("submissions").Select("student_id AS user_id, MAX(updated_at) AS last_at").Group("student_id").Scan(&submissionRows).Error; err != nil {
		return nil, err
	}
	for _, item := range submissionRows {
		lastAt, ok := parseDBTime(item.LastAt)
		if ok {
			result[item.UserID] = lastAt
		}
	}
	var labRows []row
	if err := s.db.WithContext(ctx).Table("user_lab_sessions").Select("user_id, MAX(updated_at) AS last_at").Group("user_id").Scan(&labRows).Error; err != nil {
		return nil, err
	}
	for _, item := range labRows {
		lastAt, ok := parseDBTime(item.LastAt)
		if !ok {
			continue
		}
		current := result[item.UserID]
		if current == nil || lastAt.After(*current) {
			result[item.UserID] = lastAt
		}
	}
	return result, nil
}

func parseDBTime(value sql.NullString) (*time.Time, bool) {
	if !value.Valid {
		return nil, false
	}
	raw := strings.TrimSpace(value.String)
	if raw == "" {
		return nil, false
	}
	layouts := []string{
		time.RFC3339Nano,
		"2006-01-02 15:04:05.999999999-07:00",
		"2006-01-02 15:04:05.999999-07:00",
		"2006-01-02 15:04:05-07:00",
		"2006-01-02 15:04:05.999999999Z07:00",
		"2006-01-02 15:04:05.999999Z07:00",
		"2006-01-02 15:04:05Z07:00",
		"2006-01-02 15:04:05.999999999",
		"2006-01-02 15:04:05.999999",
		"2006-01-02 15:04:05",
	}
	for _, layout := range layouts {
		parsed, err := time.Parse(layout, raw)
		if err == nil {
			return &parsed, true
		}
	}
	return nil, false
}

func (s *Service) availableReopenAttempts(ctx context.Context, studentID, assignmentID uint64) (int, error) {
	var reopens []SubmissionReopen
	now := time.Now()
	if err := s.db.WithContext(ctx).
		Where("assignment_id = ? AND student_id = ? AND (expires_at IS NULL OR expires_at > ?)", assignmentID, studentID, now).
		Find(&reopens).Error; err != nil {
		return 0, err
	}
	total := 0
	for _, item := range reopens {
		remaining := item.ExtraAttempts - item.UsedAttempts
		if remaining > 0 {
			total += remaining
		}
	}
	return total, nil
}

func (s *Service) consumeReopenAttempt(ctx context.Context, tx *gorm.DB, studentID, assignmentID uint64) error {
	var reopen SubmissionReopen
	now := time.Now()
	err := tx.WithContext(ctx).
		Where("assignment_id = ? AND student_id = ? AND used_attempts < extra_attempts AND (expires_at IS NULL OR expires_at > ?)", assignmentID, studentID, now).
		Order("created_at ASC, id ASC").
		First(&reopen).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return apperrors.BadRequest("当前没有可用的重开提交授权")
	}
	if err != nil {
		return err
	}
	reopen.UsedAttempts++
	return tx.WithContext(ctx).Save(&reopen).Error
}

func (s *Service) submissionRequiresReopen(ctx context.Context, studentID uint64, assignment *TeachingAssignment, rule AssignmentRule) (bool, error) {
	var count int64
	if err := s.db.WithContext(ctx).Model(&Submission{}).
		Where("assignment_id = ? AND student_id = ?", assignment.ID, studentID).
		Count(&count).Error; err != nil {
		return false, err
	}
	if count == 0 {
		return false, nil
	}
	available, err := s.availableReopenAttempts(ctx, studentID, assignment.ID)
	if err != nil {
		return false, err
	}
	if int(count) >= rule.AttemptLimit || !rule.AllowResubmit {
		return available > 0, nil
	}
	latest, err := s.latestSubmission(ctx, studentID, assignment.ID)
	if err != nil {
		return false, err
	}
	if latest.Status != SubmissionStatusReturned {
		return available > 0, nil
	}
	return false, nil
}

func formatAssignmentNotification(prefix, title string) string {
	title = strings.TrimSpace(title)
	if title == "" {
		return prefix
	}
	return fmt.Sprintf("%s：%s", prefix, title)
}
