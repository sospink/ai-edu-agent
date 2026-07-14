package assignment

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"edu-platform/internal/domain/agent"
	"edu-platform/internal/domain/classroom"
	"edu-platform/internal/domain/course"
	"edu-platform/internal/domain/lab"
	"edu-platform/internal/domain/user"
	apperrors "edu-platform/pkg/errors"
)

func (s *Service) CreateStudentSubmission(ctx context.Context, studentID, assignmentID uint64, req CreateSubmissionRequest) (*SubmissionDetail, error) {
	record, err := s.findAssignment(ctx, assignmentID)
	if err != nil {
		return nil, err
	}
	if record.Status != AssignmentStatusPublished {
		return nil, apperrors.BadRequest("作业未发布或已关闭，暂不能提交")
	}
	if err := s.ensureStudentCanAccess(ctx, studentID, assignmentID); err != nil {
		return nil, err
	}
	rule, err := s.loadRule(ctx, assignmentID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureSubmissionAllowed(ctx, studentID, record, rule); err != nil {
		return nil, err
	}
	consumeReopen, err := s.submissionRequiresReopen(ctx, studentID, record, rule)
	if err != nil {
		return nil, err
	}

	attemptNo, err := s.nextAttemptNo(ctx, studentID, assignmentID)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	status := SubmissionStatusSubmitted
	if attemptNo > 1 {
		status = SubmissionStatusResubmitted
	}
	submission := &Submission{
		AssignmentID:  assignmentID,
		StudentID:     studentID,
		AttemptNo:     attemptNo,
		Status:        status,
		ContentText:   strings.TrimSpace(req.ContentText),
		LabSessionID:  req.LabSessionID,
		AgentManualID: req.AgentManualID,
		SubmittedAt:   &now,
	}
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(submission).Error; err != nil {
			return err
		}
		files := normalizeSubmissionFiles(submission.ID, req.Files)
		if len(files) > 0 {
			if err := tx.Create(&files).Error; err != nil {
				return err
			}
		}
		checks, err := s.buildSubmissionSnapshot(ctx, submission, record)
		if err != nil {
			return err
		}
		if len(checks) > 0 {
			if err := tx.Create(&checks).Error; err != nil {
				return err
			}
		}
		if consumeReopen {
			if err := s.consumeReopenAttempt(ctx, tx, studentID, assignmentID); err != nil {
				return err
			}
		}
		rubric, err := s.ensureRubric(ctx, tx, assignmentID)
		if err != nil {
			return err
		}
		grade := &Grade{
			SubmissionID: submission.ID,
			StudentID:    studentID,
			AssignmentID: assignmentID,
			MaxScore:     rubric.TotalScore,
			Status:       GradeStatusAutoChecked,
		}
		return tx.Create(grade).Error
	}); err != nil {
		return nil, err
	}
	return s.GetStudentSubmission(ctx, studentID, submission.ID)
}

func (s *Service) GetStudentSubmission(ctx context.Context, studentID, submissionID uint64) (*SubmissionDetail, error) {
	detail, err := s.loadSubmissionDetail(ctx, submissionID)
	if err != nil {
		return nil, err
	}
	if detail.StudentID != studentID {
		return nil, apperrors.Forbidden("无权查看该提交")
	}
	if err := s.ensureStudentCanAccess(ctx, studentID, detail.AssignmentID); err != nil {
		return nil, err
	}
	detail = hideUnpublishedGrade(detail)
	return detail, nil
}

func (s *Service) ListStudentGrades(ctx context.Context, studentID uint64) (*StudentGradesResponse, error) {
	var assignments []TeachingAssignment
	if err := s.db.WithContext(ctx).
		Where("status IN ?", []AssignmentStatus{AssignmentStatusPublished, AssignmentStatusClosed}).
		Where("EXISTS (SELECT 1 FROM assignment_classes ac JOIN class_members cm ON cm.class_id = ac.class_id WHERE ac.assignment_id = teaching_assignments.id AND cm.user_id = ? AND cm.status = ?)", studentID, classroom.ClassMemberStatusActive).
		Order("updated_at DESC, id DESC").
		Find(&assignments).Error; err != nil {
		return nil, err
	}

	items := make([]StudentGradeItem, 0, len(assignments))
	for _, assignment := range assignments {
		latest, err := s.latestSubmission(ctx, studentID, assignment.ID)
		if errors.Is(err, gorm.ErrRecordNotFound) {
			items = append(items, StudentGradeItem{
				AssignmentID:    assignment.ID,
				AssignmentTitle: assignment.Title,
				Status:          GradeStatusPending,
			})
			continue
		}
		if err != nil {
			return nil, err
		}
		item := StudentGradeItem{
			AssignmentID:    assignment.ID,
			AssignmentTitle: assignment.Title,
			SubmissionID:    latest.ID,
			Status:          GradeStatusPending,
		}
		grade, err := s.loadGrade(ctx, latest.ID)
		if err == nil && grade.Status == GradeStatusPublished {
			item.Status = GradeStatusPublished
			item.Score = &grade.Score
			item.MaxScore = &grade.MaxScore
			item.RubricScores = grade.RubricScores
			item.PublishedAt = grade.PublishedAt
			if feedback, feedbackErr := s.loadFeedback(ctx, latest.ID); feedbackErr == nil {
				item.Feedback = feedback
			}
		} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		items = append(items, item)
	}
	return &StudentGradesResponse{List: items}, nil
}

func (s *Service) ListTeacherSubmissions(ctx context.Context, actorID uint64, roleType int, query SubmissionListQuery) (*SubmissionListResponse, error) {
	page, pageSize := normalizePage(query.Page, query.PageSize)
	db := s.teacherSubmissionBaseQuery(ctx, actorID, roleType, query)
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, err
	}
	var list []SubmissionListItem
	if err := db.Order("s.updated_at DESC, s.id DESC").Limit(pageSize).Offset((page - 1) * pageSize).Scan(&list).Error; err != nil {
		return nil, err
	}
	return &SubmissionListResponse{List: list, Total: total}, nil
}

func (s *Service) GetTeacherSubmission(ctx context.Context, actorID uint64, roleType int, submissionID uint64) (*SubmissionDetail, error) {
	detail, err := s.loadSubmissionDetail(ctx, submissionID)
	if err != nil {
		return nil, err
	}
	assignment, err := s.findAssignment(ctx, detail.AssignmentID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureTeacherCanManage(ctx, actorID, roleType, assignment); err != nil {
		return nil, err
	}
	return detail, nil
}

func (s *Service) RunTeacherChecks(ctx context.Context, actorID uint64, roleType int, submissionID uint64, req RunChecksRequest) (*SubmissionDetail, error) {
	detail, err := s.GetTeacherSubmission(ctx, actorID, roleType, submissionID)
	if err != nil {
		return nil, err
	}
	command := strings.TrimSpace(req.Command)
	check := SubmissionCheck{
		SubmissionID: submissionID,
		CheckType:    CheckTypeManualReview,
		Status:       "passed",
		Output:       "教师已重新检查提交证据",
		Metadata: JSONMap{
			"teacherId": actorID,
			"rerun":     true,
		},
	}
	if command != "" {
		check.CheckType = CheckTypeLabCommand
		check.Status = "pending"
		check.Command = command
		check.Output = "已记录重新验证命令，等待运行时执行结果回填"
	}
	if err := s.db.WithContext(ctx).Create(&check).Error; err != nil {
		return nil, err
	}
	if grade, err := s.loadGrade(ctx, submissionID); err == nil && grade.Status == GradeStatusPending {
		grade.Status = GradeStatusAutoChecked
		_ = s.db.WithContext(ctx).Save(grade).Error
	}
	return s.loadSubmissionDetail(ctx, detail.ID)
}

func (s *Service) GradeTeacherSubmission(ctx context.Context, actorID uint64, roleType int, submissionID uint64, req GradeSubmissionRequest) (*SubmissionDetail, error) {
	detail, err := s.GetTeacherSubmission(ctx, actorID, roleType, submissionID)
	if err != nil {
		return nil, err
	}
	rubric, err := s.ensureRubric(ctx, s.db, detail.AssignmentID)
	if err != nil {
		return nil, err
	}
	scoreMap := make(map[uint64]float64, len(req.Scores))
	for _, score := range req.Scores {
		scoreMap[score.RubricItemID] = score.Score
	}
	var total, maxScore float64
	rubricScores := make([]RubricScore, 0, len(rubric.Items))
	for _, item := range rubric.Items {
		score := scoreMap[item.ID]
		if score < 0 {
			score = 0
		}
		if score > item.MaxScore {
			score = item.MaxScore
		}
		total += score
		maxScore += item.MaxScore
		rubricScores = append(rubricScores, RubricScore{
			RubricItemID: item.ID,
			Title:        item.Title,
			Score:        score,
			MaxScore:     item.MaxScore,
		})
	}
	if maxScore <= 0 {
		maxScore = rubric.TotalScore
	}
	now := time.Now()
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		grade, err := s.loadGrade(ctx, submissionID)
		if errors.Is(err, gorm.ErrRecordNotFound) {
			grade = &Grade{SubmissionID: submissionID, StudentID: detail.StudentID, AssignmentID: detail.AssignmentID}
			if err := tx.Create(grade).Error; err != nil {
				return err
			}
		} else if err != nil {
			return err
		}
		grade.Score = total
		grade.MaxScore = maxScore
		grade.Status = GradeStatusReviewed
		grade.GradedBy = actorID
		grade.RubricScores = rubricScores
		if err := tx.Save(grade).Error; err != nil {
			return err
		}
		if strings.TrimSpace(req.Feedback) != "" {
			if err := s.upsertFeedback(ctx, tx, submissionID, actorID, strings.TrimSpace(req.Feedback)); err != nil {
				return err
			}
		}
		if err := s.AdoptAISuggestionForSubmission(ctx, tx, actorID, submissionID, req.AISuggestionID, strings.TrimSpace(req.Feedback)); err != nil {
			return err
		}
		submission := Submission{ID: submissionID}
		if err := tx.First(&submission).Error; err != nil {
			return err
		}
		submission.Status = SubmissionStatusGraded
		submission.GradedAt = &now
		return tx.Save(&submission).Error
	}); err != nil {
		return nil, err
	}
	return s.loadSubmissionDetail(ctx, submissionID)
}

func (s *Service) ReturnTeacherSubmission(ctx context.Context, actorID uint64, roleType int, submissionID uint64, req ReturnSubmissionRequest) (*SubmissionDetail, error) {
	detail, err := s.GetTeacherSubmission(ctx, actorID, roleType, submissionID)
	if err != nil {
		return nil, err
	}
	rule, err := s.loadRule(ctx, detail.AssignmentID)
	if err != nil {
		return nil, err
	}
	if !rule.AllowReturn {
		return nil, apperrors.BadRequest("该作业未开启退回反馈")
	}
	now := time.Now()
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		submission := Submission{ID: submissionID}
		if err := tx.First(&submission).Error; err != nil {
			return err
		}
		submission.Status = SubmissionStatusReturned
		submission.ReturnedAt = &now
		if err := tx.Save(&submission).Error; err != nil {
			return err
		}
		if err := s.upsertFeedback(ctx, tx, submissionID, actorID, strings.TrimSpace(req.Feedback)); err != nil {
			return err
		}
		if err := s.AdoptAISuggestionForSubmission(ctx, tx, actorID, submissionID, req.AISuggestionID, strings.TrimSpace(req.Feedback)); err != nil {
			return err
		}
		if err := s.notifyStudent(ctx, tx, detail.StudentID, NotificationTypeReturned, "提交已退回", formatAssignmentNotification("老师退回了你的提交", detail.AssignmentTitle), detail.AssignmentID); err != nil {
			return err
		}
		return s.createActionLog(ctx, tx, actorID, ActionTypeReturn, "submission", submissionID, detail.AssignmentID, strings.TrimSpace(req.Feedback))
	}); err != nil {
		return nil, err
	}
	return s.loadSubmissionDetail(ctx, submissionID)
}

func (s *Service) PublishTeacherGrade(ctx context.Context, actorID uint64, roleType int, gradeID uint64) (*SubmissionDetail, error) {
	var grade Grade
	if err := s.db.WithContext(ctx).First(&grade, gradeID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("成绩不存在")
		}
		return nil, err
	}
	detail, err := s.GetTeacherSubmission(ctx, actorID, roleType, grade.SubmissionID)
	if err != nil {
		return nil, err
	}
	if grade.Status != GradeStatusReviewed && grade.Status != GradeStatusPublished {
		return nil, apperrors.BadRequest("请先完成评分后再发布成绩")
	}
	now := time.Now()
	grade.Status = GradeStatusPublished
	grade.PublishedAt = &now
	grade.GradedBy = actorID
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(&grade).Error; err != nil {
			return err
		}
		if err := s.notifyStudent(ctx, tx, detail.StudentID, NotificationTypeGradePublished, "成绩已发布", formatAssignmentNotification("老师发布了你的成绩", detail.AssignmentTitle), detail.AssignmentID); err != nil {
			return err
		}
		return s.createActionLog(ctx, tx, actorID, ActionTypePublishGrade, "grade", grade.ID, detail.AssignmentID, "")
	}); err != nil {
		return nil, err
	}
	return s.loadSubmissionDetail(ctx, detail.ID)
}

func (s *Service) teacherSubmissionBaseQuery(ctx context.Context, actorID uint64, roleType int, query SubmissionListQuery) *gorm.DB {
	db := s.db.WithContext(ctx).Table("submissions s").
		Select(`s.*, ta.title AS assignment_title, u.full_name AS student_name, u.username AS student_username,
			COALESCE(g.status, ?) AS grade_status, COALESCE(g.score, 0) AS score, COALESCE(g.max_score, 0) AS max_score`, GradeStatusPending).
		Joins("JOIN teaching_assignments ta ON ta.id = s.assignment_id").
		Joins("JOIN sys_users u ON u.id = s.student_id").
		Joins("LEFT JOIN grades g ON g.submission_id = s.id")
	if roleType < int(user.RoleAdmin) {
		db = db.Where("ta.creator_id = ? OR EXISTS (SELECT 1 FROM assignment_classes ac JOIN classes c ON c.id = ac.class_id WHERE ac.assignment_id = ta.id AND c.owner_teacher_id = ?)", actorID, actorID)
	}
	if query.AssignmentID > 0 {
		db = db.Where("s.assignment_id = ?", query.AssignmentID)
	}
	if query.ClassID > 0 {
		db = db.Where("EXISTS (SELECT 1 FROM assignment_classes ac JOIN class_members cm ON cm.class_id = ac.class_id WHERE ac.assignment_id = s.assignment_id AND cm.user_id = s.student_id AND ac.class_id = ?)", query.ClassID)
	}
	if strings.TrimSpace(query.Status) != "" {
		db = db.Where("s.status = ?", strings.TrimSpace(query.Status))
	}
	if strings.TrimSpace(query.Q) != "" {
		like := "%" + strings.TrimSpace(query.Q) + "%"
		db = db.Where("ta.title LIKE ? OR u.full_name LIKE ? OR u.username LIKE ?", like, like, like)
	}
	return db
}

func (s *Service) ensureStudentCanAccess(ctx context.Context, studentID, assignmentID uint64) error {
	var count int64
	if err := s.db.WithContext(ctx).Table("assignment_classes ac").
		Joins("JOIN class_members cm ON cm.class_id = ac.class_id").
		Where("ac.assignment_id = ? AND cm.user_id = ? AND cm.status = ?", assignmentID, studentID, classroom.ClassMemberStatusActive).
		Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return apperrors.Forbidden("无权访问该作业")
	}
	return nil
}

func (s *Service) ensureSubmissionAllowed(ctx context.Context, studentID uint64, assignment *TeachingAssignment, rule AssignmentRule) error {
	availableReopens, err := s.availableReopenAttempts(ctx, studentID, assignment.ID)
	if err != nil {
		return err
	}
	if assignment.DueAt != nil && assignment.DueAt.Before(time.Now()) && !rule.AllowLate && availableReopens <= 0 {
		return apperrors.BadRequest("作业已截止，当前规则不允许迟交")
	}
	var count int64
	if err := s.db.WithContext(ctx).Model(&Submission{}).
		Where("assignment_id = ? AND student_id = ?", assignment.ID, studentID).
		Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return nil
	}
	if !rule.AllowResubmit && availableReopens <= 0 {
		return apperrors.BadRequest("该作业不允许重复提交")
	}
	if int(count) >= rule.AttemptLimit+availableReopens {
		return apperrors.BadRequest("已达到作业尝试次数上限")
	}
	var latest Submission
	if err := s.db.WithContext(ctx).
		Where("assignment_id = ? AND student_id = ?", assignment.ID, studentID).
		Order("attempt_no DESC, id DESC").
		First(&latest).Error; err != nil {
		return err
	}
	if latest.Status != SubmissionStatusReturned && availableReopens <= 0 {
		return apperrors.BadRequest("当前提交尚未退回，不能重复提交")
	}
	return nil
}

func (s *Service) nextAttemptNo(ctx context.Context, studentID, assignmentID uint64) (int, error) {
	var latest Submission
	err := s.db.WithContext(ctx).
		Where("assignment_id = ? AND student_id = ?", assignmentID, studentID).
		Order("attempt_no DESC, id DESC").
		First(&latest).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return 1, nil
	}
	if err != nil {
		return 0, err
	}
	return latest.AttemptNo + 1, nil
}

func (s *Service) buildSubmissionSnapshot(ctx context.Context, submission *Submission, assignment *TeachingAssignment) ([]SubmissionCheck, error) {
	resources, err := s.loadResourceItems(ctx, assignment.ID)
	if err != nil {
		return nil, err
	}
	checks := []SubmissionCheck{}
	for _, resource := range resources {
		lessonID := resource.LessonID
		if lessonID == 0 && resource.ResourceType == ResourceTypeCourseLesson {
			lessonID = resource.ResourceID
		}
		if lessonID > 0 {
			checks = append(checks, s.lessonProgressCheck(ctx, submission.ID, submission.StudentID, lessonID))
		}
		manualID := resource.ManualID
		if manualID == 0 && resource.ResourceType == ResourceTypeManual {
			manualID = resource.ResourceID
		}
		if manualID == 0 {
			manualID = submission.AgentManualID
		}
		if manualID > 0 {
			checks = append(checks, s.agentProgressCheck(ctx, submission.ID, submission.StudentID, manualID))
		}
	}
	if submission.LabSessionID > 0 {
		checks = append(checks, s.labSessionCheck(ctx, submission))
	}
	checks = append(checks, SubmissionCheck{
		SubmissionID: submission.ID,
		CheckType:    CheckTypeManualReview,
		Status:       "pending",
		Output:       "等待教师批改",
	})
	return checks, nil
}

func (s *Service) lessonProgressCheck(ctx context.Context, submissionID, studentID, lessonID uint64) SubmissionCheck {
	check := SubmissionCheck{
		SubmissionID: submissionID,
		CheckType:    CheckTypeLessonProgress,
		Status:       "pending",
		MaxScore:     1,
		Metadata:     JSONMap{"lessonId": lessonID},
	}
	var record course.UserLessonRecord
	err := s.db.WithContext(ctx).Where("user_id = ? AND lesson_id = ?", studentID, lessonID).First(&record).Error
	if err == nil {
		check.Metadata["recordStatus"] = record.Status
		check.Metadata["score"] = record.Score
		if record.Status == course.LessonRecordStatusCompleted {
			check.Status = "passed"
			check.Score = 1
			check.Output = "课时学习记录已完成"
		} else {
			check.Output = "课时学习记录尚未完成"
		}
	} else if errors.Is(err, gorm.ErrRecordNotFound) {
		check.Output = "未找到课时学习记录"
	} else {
		check.Status = "failed"
		check.Error = err.Error()
	}
	return check
}

func (s *Service) agentProgressCheck(ctx context.Context, submissionID, studentID, manualID uint64) SubmissionCheck {
	check := SubmissionCheck{
		SubmissionID: submissionID,
		CheckType:    CheckTypeAgentProgress,
		Status:       "pending",
		MaxScore:     1,
		Metadata:     JSONMap{"manualId": manualID},
	}
	var progress agent.UserAgentProgress
	err := s.db.WithContext(ctx).Where("user_id = ? AND manual_id = ?", studentID, manualID).First(&progress).Error
	if err == nil {
		check.Metadata["currentStep"] = progress.CurrentStep
		check.Metadata["completedSteps"] = progress.CompletedSteps
		if len(progress.CompletedSteps) > 0 {
			check.Status = "passed"
			check.Score = 1
			check.Output = fmt.Sprintf("已完成 %d 个 Agent 步骤", len(progress.CompletedSteps))
		} else {
			check.Output = "尚未完成 Agent 步骤"
		}
	} else if errors.Is(err, gorm.ErrRecordNotFound) {
		check.Output = "未找到 Agent 学习进度"
	} else {
		check.Status = "failed"
		check.Error = err.Error()
	}
	return check
}

func (s *Service) labSessionCheck(ctx context.Context, submission *Submission) SubmissionCheck {
	check := SubmissionCheck{
		SubmissionID: submission.ID,
		CheckType:    CheckTypeLabSession,
		Status:       "pending",
		MaxScore:     1,
		Metadata:     JSONMap{"labSessionId": submission.LabSessionID},
	}
	var session lab.UserLabSession
	err := s.db.WithContext(ctx).Where("id = ? AND user_id = ?", submission.LabSessionID, submission.StudentID).First(&session).Error
	if err == nil {
		check.Metadata["sessionStatus"] = session.Status
		check.Score = 1
		check.Status = "passed"
		check.Output = "已绑定学生 Lab 会话"
	} else if errors.Is(err, gorm.ErrRecordNotFound) {
		check.Output = "提交时未找到对应 Lab 会话"
	} else {
		check.Status = "failed"
		check.Error = err.Error()
	}
	return check
}

func (s *Service) loadSubmissionDetail(ctx context.Context, submissionID uint64) (*SubmissionDetail, error) {
	var submission Submission
	if err := s.db.WithContext(ctx).First(&submission, submissionID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("提交不存在")
		}
		return nil, err
	}
	detail := &SubmissionDetail{Submission: submission}
	var assignment TeachingAssignment
	if err := s.db.WithContext(ctx).First(&assignment, submission.AssignmentID).Error; err == nil {
		detail.AssignmentTitle = assignment.Title
	}
	var student user.User
	if err := s.db.WithContext(ctx).First(&student, submission.StudentID).Error; err == nil {
		detail.StudentName = displayName(student)
		detail.StudentUsername = student.Username
	}
	if err := s.db.WithContext(ctx).Where("submission_id = ?", submissionID).Order("id ASC").Find(&detail.Files).Error; err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Where("submission_id = ?", submissionID).Order("id ASC").Find(&detail.Checks).Error; err != nil {
		return nil, err
	}
	if grade, err := s.loadGrade(ctx, submissionID); err == nil {
		detail.Grade = grade
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if feedback, err := s.loadFeedback(ctx, submissionID); err == nil {
		detail.Feedback = feedback
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	rubric, err := s.loadRubricDetail(ctx, submission.AssignmentID)
	if err != nil {
		return nil, err
	}
	detail.Rubric = rubric
	return detail, nil
}

func (s *Service) loadRubricDetail(ctx context.Context, assignmentID uint64) (RubricDetail, error) {
	var rubric Rubric
	err := s.db.WithContext(ctx).Where("assignment_id = ?", assignmentID).First(&rubric).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return RubricDetail{
			Rubric: Rubric{AssignmentID: assignmentID, Title: "作业评分 Rubric", TotalScore: 100},
			Items:  []RubricItem{{Title: "完成质量", MaxScore: 100, SortOrder: 1}},
		}, nil
	}
	if err != nil {
		return RubricDetail{}, err
	}
	var items []RubricItem
	if err := s.db.WithContext(ctx).Where("rubric_id = ?", rubric.ID).Order("sort_order ASC, id ASC").Find(&items).Error; err != nil {
		return RubricDetail{}, err
	}
	if len(items) == 0 {
		items = []RubricItem{{RubricID: rubric.ID, Title: "完成质量", MaxScore: rubric.TotalScore, SortOrder: 1}}
	}
	return RubricDetail{Rubric: rubric, Items: items}, nil
}

func (s *Service) ensureRubric(ctx context.Context, tx *gorm.DB, assignmentID uint64) (RubricDetail, error) {
	detail, err := s.loadRubricDetail(ctx, assignmentID)
	if err != nil {
		return RubricDetail{}, err
	}
	if detail.ID != 0 {
		return detail, nil
	}
	if err := s.replaceRubric(ctx, tx, assignmentID, nil); err != nil {
		return RubricDetail{}, err
	}
	return s.loadRubricDetail(ctx, assignmentID)
}

func (s *Service) loadRule(ctx context.Context, assignmentID uint64) (AssignmentRule, error) {
	var rule AssignmentRule
	err := s.db.WithContext(ctx).Where("assignment_id = ?", assignmentID).First(&rule).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return defaultRule(assignmentID), nil
	}
	return normalizeRule(rule), err
}

func (s *Service) loadGrade(ctx context.Context, submissionID uint64) (*Grade, error) {
	var grade Grade
	if err := s.db.WithContext(ctx).Where("submission_id = ?", submissionID).First(&grade).Error; err != nil {
		return nil, err
	}
	return &grade, nil
}

func (s *Service) loadFeedback(ctx context.Context, submissionID uint64) (*TeacherFeedback, error) {
	var feedback TeacherFeedback
	if err := s.db.WithContext(ctx).Where("submission_id = ? AND visibility = ?", submissionID, "student").Order("updated_at DESC, id DESC").First(&feedback).Error; err != nil {
		return nil, err
	}
	return &feedback, nil
}

func (s *Service) latestSubmission(ctx context.Context, studentID, assignmentID uint64) (*Submission, error) {
	var submission Submission
	if err := s.db.WithContext(ctx).
		Where("assignment_id = ? AND student_id = ?", assignmentID, studentID).
		Order("attempt_no DESC, id DESC").
		First(&submission).Error; err != nil {
		return nil, err
	}
	return &submission, nil
}

func (s *Service) loadStudentSubmissionState(ctx context.Context, studentID uint64, assignment *TeachingAssignment) (*StudentSubmissionState, error) {
	var submissions []Submission
	if err := s.db.WithContext(ctx).
		Where("assignment_id = ? AND student_id = ?", assignment.ID, studentID).
		Order("attempt_no DESC, id DESC").
		Find(&submissions).Error; err != nil {
		return nil, err
	}
	rule, err := s.loadRule(ctx, assignment.ID)
	if err != nil {
		return nil, err
	}
	state := &StudentSubmissionState{
		Status:      SubmissionStatusNotStarted,
		History:     []SubmissionDetail{},
		GradeStatus: GradeStatusPending,
		CanSubmit:   assignment.Status == AssignmentStatusPublished,
	}
	availableReopens, _ := s.availableReopenAttempts(ctx, studentID, assignment.ID)
	if assignment.DueAt != nil && assignment.DueAt.Before(time.Now()) && !rule.AllowLate && availableReopens <= 0 {
		state.CanSubmit = false
		state.DisabledReason = "作业已截止，当前规则不允许迟交"
	}
	if len(submissions) >= rule.AttemptLimit+availableReopens {
		state.CanSubmit = false
		state.DisabledReason = "已达到作业尝试次数上限"
	}
	for index, submission := range submissions {
		detail, err := s.loadSubmissionDetail(ctx, submission.ID)
		if err != nil {
			return nil, err
		}
		detail = hideUnpublishedGrade(detail)
		state.History = append(state.History, *detail)
		if index == 0 {
			state.Status = submission.Status
			state.Latest = detail
			if detail.Grade != nil {
				state.GradeStatus = detail.Grade.Status
				state.Grade = detail.Grade
			}
			state.Feedback = detail.Feedback
			if submission.Status != SubmissionStatusReturned && len(submissions) > 0 && availableReopens <= 0 {
				state.CanSubmit = false
				if state.DisabledReason == "" {
					state.DisabledReason = "当前提交尚未退回，不能重复提交"
				}
			}
		}
	}
	if len(submissions) > 0 && !rule.AllowResubmit && availableReopens <= 0 {
		state.CanSubmit = false
		if state.DisabledReason == "" {
			state.DisabledReason = "该作业不允许重复提交"
		}
	}
	return state, nil
}

func (s *Service) loadSubmissionProgress(ctx context.Context, assignmentID uint64) (*SubmissionProgress, error) {
	progress := &SubmissionProgress{}
	if err := s.db.WithContext(ctx).Table("assignment_classes ac").
		Joins("JOIN class_members cm ON cm.class_id = ac.class_id AND cm.status = ?", classroom.ClassMemberStatusActive).
		Where("ac.assignment_id = ?", assignmentID).
		Count(&progress.TotalStudents).Error; err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Model(&Submission{}).Where("assignment_id = ?", assignmentID).Count(&progress.Submitted).Error; err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Model(&Submission{}).Where("assignment_id = ? AND status IN ?", assignmentID, []string{SubmissionStatusSubmitted, SubmissionStatusResubmitted}).Count(&progress.PendingReview).Error; err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Model(&Submission{}).Where("assignment_id = ? AND status = ?", assignmentID, SubmissionStatusReturned).Count(&progress.Returned).Error; err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Model(&Submission{}).Where("assignment_id = ? AND status = ?", assignmentID, SubmissionStatusGraded).Count(&progress.Graded).Error; err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Model(&Grade{}).Where("assignment_id = ? AND status = ?", assignmentID, GradeStatusPublished).Count(&progress.PublishedGrades).Error; err != nil {
		return nil, err
	}
	return progress, nil
}

func hideUnpublishedGrade(detail *SubmissionDetail) *SubmissionDetail {
	if detail == nil || detail.Grade == nil || detail.Grade.Status == GradeStatusPublished {
		return detail
	}
	detail.Grade = &Grade{
		ID:           detail.Grade.ID,
		SubmissionID: detail.Grade.SubmissionID,
		StudentID:    detail.Grade.StudentID,
		AssignmentID: detail.Grade.AssignmentID,
		Status:       GradeStatusPending,
	}
	if detail.Status != SubmissionStatusReturned {
		detail.Feedback = nil
	}
	return detail
}

func normalizeSubmissionFiles(submissionID uint64, inputs []SubmissionFileInput) []SubmissionFile {
	files := make([]SubmissionFile, 0, len(inputs))
	for _, input := range inputs {
		url := strings.TrimSpace(input.URL)
		if url == "" {
			continue
		}
		fileType := strings.TrimSpace(input.FileType)
		if fileType == "" {
			fileType = "file"
		}
		files = append(files, SubmissionFile{
			SubmissionID: submissionID,
			FileType:     fileType,
			Title:        strings.TrimSpace(input.Title),
			URL:          url,
			Metadata:     input.Metadata,
		})
	}
	return files
}

func (s *Service) upsertFeedback(ctx context.Context, tx *gorm.DB, submissionID, teacherID uint64, content string) error {
	if content == "" {
		content = "请根据批改意见修改后重新提交。"
	}
	var feedback TeacherFeedback
	err := tx.WithContext(ctx).Where("submission_id = ? AND teacher_id = ? AND visibility = ?", submissionID, teacherID, "student").First(&feedback).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		feedback = TeacherFeedback{SubmissionID: submissionID, TeacherID: teacherID, Content: content, Visibility: "student"}
		return tx.WithContext(ctx).Create(&feedback).Error
	}
	if err != nil {
		return err
	}
	feedback.Content = content
	return tx.WithContext(ctx).Save(&feedback).Error
}
