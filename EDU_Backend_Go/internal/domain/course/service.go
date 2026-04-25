package course

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"go.uber.org/zap"
	"gorm.io/gorm"

	apperrors "edu-platform/pkg/errors"
)

type Service struct {
	repo       *Repository
	logger     *zap.Logger
	uploadRoot string
}

func NewService(db *gorm.DB, logger *zap.Logger, uploadRoot string) *Service {
	return &Service{
		repo:       NewRepository(db),
		logger:     logger,
		uploadRoot: uploadRoot,
	}
}

func (s *Service) List(page, pageSize int, keyword string, status, difficulty *int) ([]Course, int64, error) {
	return s.repo.ListCourses(ListQuery{
		Page:       page,
		PageSize:   pageSize,
		Keyword:    strings.TrimSpace(keyword),
		Status:     status,
		Difficulty: difficulty,
	})
}

func (s *Service) ListAssignedForStudent(ctx context.Context, studentID, classID uint64) ([]AssignedCourse, error) {
	if classID == 0 {
		return []AssignedCourse{}, nil
	}
	items := make([]AssignedCourse, 0)
	err := s.repo.db.WithContext(ctx).Raw(`
		SELECT
			c.id,
			c.title,
			c.slug,
			c.description,
			c.icon_url,
			c.cover_color,
			c.difficulty,
			c.total_lessons,
			c.total_skills,
			c.estimated_hours,
			c.status,
			c.env_image,
			c.ide_image,
			c.lab_template_id,
			c.creator_id,
			c.created_at,
			c.updated_at,
			COALESCE(
				ROUND(
					CASE
						WHEN COALESCE(progress.total_lessons, 0) = 0 THEN 0
						ELSE progress.completed_lessons * 100.0 / progress.total_lessons
					END
				),
				0
			) AS user_progress
		FROM courses AS c
		JOIN (
			SELECT DISTINCT
				CASE
					WHEN ar.resource_type = 'course' THEN ar.resource_id
					WHEN ar.resource_type = 'course_lesson' THEN cl_ref.course_id
					ELSE 0
				END AS course_id
			FROM assignment_resources AS ar
			JOIN teaching_assignments AS ta ON ta.id = ar.assignment_id AND ta.status IN (1, 2)
			JOIN assignment_classes AS ac ON ac.assignment_id = ta.id AND ac.class_id = ?
			JOIN classes AS cls ON cls.id = ac.class_id AND cls.status = 1
			JOIN class_members AS cm ON cm.class_id = cls.id AND cm.user_id = ? AND cm.status = 1
			LEFT JOIN course_lessons AS cl_ref ON ar.resource_type = 'course_lesson'
				AND cl_ref.id = CASE WHEN ar.lesson_id > 0 THEN ar.lesson_id ELSE ar.resource_id END
			WHERE ar.resource_type IN ('course', 'course_lesson')
		) AS assigned ON assigned.course_id = c.id
		LEFT JOIN (
			SELECT
				cl.course_id,
				COUNT(DISTINCT cl.id) AS total_lessons,
				COUNT(DISTINCT CASE WHEN ulr.status = 2 THEN cl.id END) AS completed_lessons
			FROM course_lessons AS cl
			LEFT JOIN user_lesson_records AS ulr ON ulr.lesson_id = cl.id AND ulr.user_id = ?
			GROUP BY cl.course_id
		) AS progress ON progress.course_id = c.id
		WHERE c.status = 1
		ORDER BY c.updated_at DESC, c.id DESC
	`, classID, studentID, studentID).Scan(&items).Error
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (s *Service) ListForTeacher(actorID uint64, roleType int, page, pageSize int, keyword string, status, difficulty *int) ([]Course, int64, error) {
	var creatorID *uint64
	if roleType < 10 {
		creatorID = &actorID
	}
	return s.repo.ListCourses(ListQuery{
		Page:       page,
		PageSize:   pageSize,
		Keyword:    strings.TrimSpace(keyword),
		Status:     status,
		Difficulty: difficulty,
		CreatorID:  creatorID,
	})
}

func (s *Service) FindByIDForTeacher(actorID uint64, roleType int, id uint64) (*CourseDetail, error) {
	course, err := s.FindCourseEntity(id)
	if err != nil {
		return nil, err
	}
	if err := ensureTeacherCourseReadable(actorID, roleType, course.CreatorID); err != nil {
		return nil, err
	}
	return s.buildCourseDetail(course)
}

func (s *Service) FindByID(id uint64) (*CourseDetail, error) {
	course, err := s.repo.FindCourseByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("课程不存在")
		}
		return nil, err
	}
	return s.buildCourseDetail(course)
}

func (s *Service) FindBySlug(slug string) (*CourseDetail, error) {
	course, err := s.repo.FindCourseBySlug(strings.TrimSpace(slug))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("课程不存在")
		}
		return nil, err
	}
	return s.buildCourseDetail(course)
}

func (s *Service) GetCourseStages(courseID uint64) ([]CourseStage, error) {
	if _, err := s.repo.FindCourseByID(courseID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("课程不存在")
		}
		return nil, err
	}
	return s.repo.FindCourseStages(courseID)
}

func (s *Service) GetCourseStagesForTeacher(actorID uint64, roleType int, courseID uint64) ([]CourseStage, error) {
	course, err := s.FindCourseEntity(courseID)
	if err != nil {
		return nil, err
	}
	if err := ensureTeacherCourseReadable(actorID, roleType, course.CreatorID); err != nil {
		return nil, err
	}
	return s.repo.FindCourseStages(courseID)
}

func (s *Service) GetCourseLessons(courseID uint64) ([]CourseLessonDetail, error) {
	if _, err := s.repo.FindCourseByID(courseID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("课程不存在")
		}
		return nil, err
	}
	lessons, err := s.repo.FindCourseLessons(courseID)
	if err != nil {
		return nil, err
	}
	return s.attachLessonSkills(lessons)
}

func (s *Service) GetCourseLessonsForTeacher(actorID uint64, roleType int, courseID uint64) ([]CourseLessonDetail, error) {
	course, err := s.FindCourseEntity(courseID)
	if err != nil {
		return nil, err
	}
	if err := ensureTeacherCourseReadable(actorID, roleType, course.CreatorID); err != nil {
		return nil, err
	}
	return s.GetCourseLessons(courseID)
}

func (s *Service) GetStageLessons(stageID uint64) ([]CourseLessonDetail, error) {
	lessons, err := s.repo.FindStageLessons(stageID)
	if err != nil {
		return nil, err
	}
	return s.attachLessonSkills(lessons)
}

func (s *Service) GetStageLessonsForTeacher(actorID uint64, roleType int, stageID uint64) ([]CourseLessonDetail, error) {
	course, err := s.FindCourseEntityByStageID(stageID)
	if err != nil {
		return nil, err
	}
	if err := ensureTeacherCourseReadable(actorID, roleType, course.CreatorID); err != nil {
		return nil, err
	}
	return s.GetStageLessons(stageID)
}

func (s *Service) GetLessonByID(lessonID uint64) (*CourseLesson, error) {
	lesson, err := s.repo.FindLessonByID(lessonID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("课时不存在")
		}
		return nil, err
	}
	return lesson, nil
}

func (s *Service) GetLessonByIDForTeacher(actorID uint64, roleType int, lessonID uint64) (*CourseLesson, error) {
	course, err := s.FindCourseEntityByLessonID(lessonID)
	if err != nil {
		return nil, err
	}
	if err := ensureTeacherCourseReadable(actorID, roleType, course.CreatorID); err != nil {
		return nil, err
	}
	return s.GetLessonByID(lessonID)
}

func (s *Service) GetLessonMaterials(lessonID uint64) ([]LessonMaterial, error) {
	if _, err := s.repo.FindLessonByID(lessonID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("课时不存在")
		}
		return nil, err
	}
	return s.repo.FindLessonMaterials(lessonID)
}

func (s *Service) GetLessonMaterialsForTeacher(actorID uint64, roleType int, lessonID uint64) ([]LessonMaterial, error) {
	course, err := s.FindCourseEntityByLessonID(lessonID)
	if err != nil {
		return nil, err
	}
	if err := ensureTeacherCourseReadable(actorID, roleType, course.CreatorID); err != nil {
		return nil, err
	}
	return s.repo.FindLessonMaterials(lessonID)
}

func (s *Service) EnrollCourse(userID, courseID uint64) (*UserCourseEnrollment, error) {
	if _, err := s.repo.FindCourseByID(courseID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("课程不存在")
		}
		return nil, err
	}

	enrollment, err := s.repo.FindEnrollment(userID, courseID)
	if err == nil {
		enrollment.LastActiveAt = time.Now()
		if saveErr := s.repo.SaveEnrollment(enrollment); saveErr != nil {
			return nil, saveErr
		}
		return enrollment, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	now := time.Now()
	enrollment = &UserCourseEnrollment{
		UserID:                userID,
		CourseID:              courseID,
		Status:                EnrollmentStatusInProgress,
		ProgressPercent:       0,
		CompletedLessonsCount: 0,
		LastLessonID:          0,
		LastActiveAt:          now,
		JoinedAt:              now,
	}
	if err := s.repo.SaveEnrollment(enrollment); err != nil {
		return nil, err
	}
	return enrollment, nil
}

func (s *Service) GetUserLessonRecords(userID, courseID uint64) ([]UserLessonRecord, error) {
	if _, err := s.repo.FindCourseByID(courseID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("课程不存在")
		}
		return nil, err
	}
	return s.repo.FindUserLessonRecords(userID, courseID)
}

func (s *Service) StartLesson(userID, lessonID uint64) (*UserLessonRecord, error) {
	lesson, err := s.repo.FindLessonByID(lessonID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("课时不存在")
		}
		return nil, err
	}

	record, err := s.repo.FindLessonRecord(userID, lessonID)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	now := time.Now()
	if err != nil && errors.Is(err, gorm.ErrRecordNotFound) {
		record = &UserLessonRecord{
			UserID:    userID,
			CourseID:  lesson.CourseID,
			LessonID:  lessonID,
			Status:    LessonRecordStatusInProgress,
			StartedAt: nowPtr(now),
		}
	} else if record.Status == LessonRecordStatusNotStarted {
		record.Status = LessonRecordStatusInProgress
		record.StartedAt = nowPtr(now)
	}

	if err := s.repo.SaveLessonRecord(record); err != nil {
		return nil, err
	}
	return record, nil
}

func (s *Service) CompleteLesson(userID, lessonID uint64, score *int) (*CompleteLessonPayload, error) {
	lesson, err := s.repo.FindLessonByID(lessonID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("课时不存在")
		}
		return nil, err
	}

	record, err := s.repo.FindLessonRecord(userID, lessonID)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	now := time.Now()
	if err != nil && errors.Is(err, gorm.ErrRecordNotFound) {
		record = &UserLessonRecord{
			UserID:     userID,
			CourseID:   lesson.CourseID,
			LessonID:   lessonID,
			Status:     LessonRecordStatusCompleted,
			Score:      0,
			StartedAt:  nowPtr(now),
			FinishedAt: nowPtr(now),
		}
	} else {
		record.Status = LessonRecordStatusCompleted
		record.FinishedAt = nowPtr(now)
		if record.StartedAt == nil {
			record.StartedAt = nowPtr(now)
		}
	}
	if score != nil {
		record.Score = *score
	}
	if err := s.repo.SaveLessonRecord(record); err != nil {
		return nil, err
	}

	if err := s.touchActivityLog(userID); err != nil {
		return nil, err
	}
	if err := s.updateEnrollmentProgress(userID, lesson.CourseID, lesson.ID); err != nil {
		return nil, err
	}

	return &CompleteLessonPayload{
		Record:   record,
		EarnedXP: lesson.Points,
	}, nil
}

func (s *Service) GetUserEnrollments(userID uint64) ([]EnrollmentWithCourse, error) {
	enrollments, err := s.repo.FindUserEnrollments(userID)
	if err != nil {
		return nil, err
	}
	courseIDs := make([]uint64, 0, len(enrollments))
	seen := make(map[uint64]struct{})
	for _, enrollment := range enrollments {
		if _, ok := seen[enrollment.CourseID]; ok {
			continue
		}
		seen[enrollment.CourseID] = struct{}{}
		courseIDs = append(courseIDs, enrollment.CourseID)
	}

	courses, err := s.repo.FindCoursesByIDs(courseIDs)
	if err != nil {
		return nil, err
	}
	courseMap := make(map[uint64]*Course, len(courses))
	for i := range courses {
		course := courses[i]
		courseMap[course.ID] = &course
	}

	result := make([]EnrollmentWithCourse, 0, len(enrollments))
	for _, enrollment := range enrollments {
		result = append(result, EnrollmentWithCourse{
			UserCourseEnrollment: enrollment,
			Course:               courseMap[enrollment.CourseID],
		})
	}
	return result, nil
}

func (s *Service) GetContinueLearning(userID uint64) (*ContinueLearningPayload, error) {
	enrollment, err := s.repo.FindLatestInProgressEnrollment(userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	course, err := s.repo.FindCourseByID(enrollment.CourseID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	var nextLesson *CourseLesson
	if enrollment.LastLessonID > 0 {
		lastLesson, lastErr := s.repo.FindLessonByID(enrollment.LastLessonID)
		if lastErr == nil {
			nextLesson, _ = s.repo.FindNextLessonByCourseAndSortOrder(course.ID, lastLesson.SortOrder)
		}
	}
	if nextLesson == nil {
		nextLesson, _ = s.repo.FindFirstLessonByCourse(course.ID)
	}

	return &ContinueLearningPayload{
		Enrollment: enrollment,
		Course:     course,
		NextLesson: nextLesson,
	}, nil
}

func (s *Service) GetUserActivityLogs(userID uint64, days int) ([]UserActivityLog, error) {
	if days <= 0 {
		days = 365
	}
	startDate := time.Now().AddDate(0, 0, -days).Format("2006-01-02")
	return s.repo.FindActivityLogs(userID, startDate)
}

type CreateCourseParams struct {
	Title          string
	Slug           string
	Description    string
	IconURL        string
	CoverColor     string
	Difficulty     int
	Status         CourseStatus
	EstimatedHours int
	EnvImage       string
	IDEImage       string
	LabTemplateID  uint64
	CreatorID      uint64
}

type UpdateCourseParams struct {
	Title          *string
	Slug           *string
	Description    *string
	IconURL        *string
	CoverColor     *string
	Difficulty     *int
	Status         *CourseStatus
	EstimatedHours *int
	EnvImage       *string
	IDEImage       *string
	LabTemplateID  *uint64
}

func (s *Service) CreateCourse(params CreateCourseParams) (*Course, error) {
	if strings.TrimSpace(params.Title) == "" || strings.TrimSpace(params.Slug) == "" {
		return nil, apperrors.BadRequest("课程名称和 Slug 不能为空")
	}
	if _, err := s.repo.FindCourseBySlug(strings.TrimSpace(params.Slug)); err == nil {
		return nil, apperrors.BadRequest("Slug 已存在")
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	course := &Course{
		Title:          strings.TrimSpace(params.Title),
		Slug:           strings.TrimSpace(params.Slug),
		Description:    strings.TrimSpace(params.Description),
		IconURL:        strings.TrimSpace(params.IconURL),
		CoverColor:     strings.TrimSpace(params.CoverColor),
		Difficulty:     params.Difficulty,
		Status:         params.Status,
		EstimatedHours: params.EstimatedHours,
		EnvImage:       strings.TrimSpace(params.EnvImage),
		IDEImage:       strings.TrimSpace(params.IDEImage),
		LabTemplateID:  params.LabTemplateID,
		CreatorID:      params.CreatorID,
	}
	if course.CoverColor == "" {
		course.CoverColor = "#3b82f6"
	}
	if err := s.repo.CreateCourse(course); err != nil {
		return nil, err
	}
	return course, nil
}

func (s *Service) FindCourseEntity(id uint64) (*Course, error) {
	course, err := s.repo.FindCourseByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("课程不存在")
		}
		return nil, err
	}
	return course, nil
}

func (s *Service) FindCourseEntityByStageID(stageID uint64) (*Course, error) {
	course, err := s.repo.FindCourseByStageID(stageID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("课程不存在")
		}
		return nil, err
	}
	return course, nil
}

func (s *Service) FindCourseEntityByLessonID(lessonID uint64) (*Course, error) {
	course, err := s.repo.FindCourseByLessonID(lessonID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("课程不存在")
		}
		return nil, err
	}
	return course, nil
}

func (s *Service) FindCourseEntityByMaterialID(materialID uint64) (*Course, error) {
	course, err := s.repo.FindCourseByMaterialID(materialID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("课程不存在")
		}
		return nil, err
	}
	return course, nil
}

func (s *Service) UpdateCourse(id uint64, params UpdateCourseParams) (*Course, error) {
	course, err := s.repo.FindCourseByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("课程不存在")
		}
		return nil, err
	}
	if params.Slug != nil && strings.TrimSpace(*params.Slug) != "" && strings.TrimSpace(*params.Slug) != course.Slug {
		if _, slugErr := s.repo.FindCourseBySlug(strings.TrimSpace(*params.Slug)); slugErr == nil {
			return nil, apperrors.BadRequest("Slug 已存在")
		} else if !errors.Is(slugErr, gorm.ErrRecordNotFound) {
			return nil, slugErr
		}
	}
	if params.Title != nil {
		course.Title = strings.TrimSpace(*params.Title)
	}
	if params.Slug != nil && strings.TrimSpace(*params.Slug) != "" {
		course.Slug = strings.TrimSpace(*params.Slug)
	}
	if params.Description != nil {
		course.Description = strings.TrimSpace(*params.Description)
	}
	if params.IconURL != nil {
		course.IconURL = strings.TrimSpace(*params.IconURL)
	}
	if params.CoverColor != nil {
		course.CoverColor = strings.TrimSpace(*params.CoverColor)
	}
	if params.Difficulty != nil {
		course.Difficulty = *params.Difficulty
	}
	if params.Status != nil {
		course.Status = *params.Status
	}
	if params.EstimatedHours != nil {
		course.EstimatedHours = *params.EstimatedHours
	}
	if params.EnvImage != nil {
		course.EnvImage = strings.TrimSpace(*params.EnvImage)
	}
	if params.IDEImage != nil {
		course.IDEImage = strings.TrimSpace(*params.IDEImage)
	}
	if params.LabTemplateID != nil {
		course.LabTemplateID = *params.LabTemplateID
	}
	if err := s.repo.SaveCourse(course); err != nil {
		return nil, err
	}
	return course, nil
}

func (s *Service) DeleteCourse(id uint64) error {
	if _, err := s.repo.FindCourseByID(id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apperrors.NotFound("课程不存在")
		}
		return err
	}
	stages, err := s.repo.FindCourseStages(id)
	if err != nil {
		return err
	}
	for _, stage := range stages {
		lessons, lessonErr := s.repo.FindStageLessons(stage.ID)
		if lessonErr != nil {
			return lessonErr
		}
		for _, lesson := range lessons {
			if deleteErr := s.deleteLessonAssets(lesson.ID); deleteErr != nil {
				return deleteErr
			}
		}
		if deleteErr := s.repo.DeleteLessonsByStageID(stage.ID); deleteErr != nil {
			return deleteErr
		}
	}
	if err := s.repo.DeleteStagesByCourseID(id); err != nil {
		return err
	}
	return s.repo.DeleteCourse(id)
}

func (s *Service) UpdateCourseStatus(id uint64, status CourseStatus) (*Course, error) {
	return s.UpdateCourse(id, UpdateCourseParams{Status: &status})
}

type CreateStageParams struct {
	CourseID    uint64
	Title       string
	Description string
	SortOrder   int
	LevelLabel  string
}

type UpdateStageParams struct {
	Title       *string
	Description *string
	SortOrder   *int
	LevelLabel  *string
}

func (s *Service) CreateStage(params CreateStageParams) (*CourseStage, error) {
	if strings.TrimSpace(params.Title) == "" {
		return nil, apperrors.BadRequest("阶段名称不能为空")
	}
	if _, err := s.repo.FindCourseByID(params.CourseID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("课程不存在")
		}
		return nil, err
	}
	stage := &CourseStage{
		CourseID:    params.CourseID,
		Title:       strings.TrimSpace(params.Title),
		Description: strings.TrimSpace(params.Description),
		SortOrder:   params.SortOrder,
		LevelLabel:  strings.TrimSpace(params.LevelLabel),
	}
	if err := s.repo.CreateStage(stage); err != nil {
		return nil, err
	}
	return stage, nil
}

func (s *Service) UpdateStage(id uint64, params UpdateStageParams) (*CourseStage, error) {
	stage, err := s.repo.FindStageByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("阶段不存在")
		}
		return nil, err
	}
	if params.Title != nil {
		stage.Title = strings.TrimSpace(*params.Title)
	}
	if params.Description != nil {
		stage.Description = strings.TrimSpace(*params.Description)
	}
	if params.SortOrder != nil {
		stage.SortOrder = *params.SortOrder
	}
	if params.LevelLabel != nil {
		stage.LevelLabel = strings.TrimSpace(*params.LevelLabel)
	}
	if err := s.repo.SaveStage(stage); err != nil {
		return nil, err
	}
	return stage, nil
}

func (s *Service) DeleteStage(id uint64) error {
	if _, err := s.repo.FindStageByID(id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apperrors.NotFound("阶段不存在")
		}
		return err
	}
	lessons, err := s.repo.FindStageLessons(id)
	if err != nil {
		return err
	}
	for _, lesson := range lessons {
		if deleteErr := s.deleteLessonAssets(lesson.ID); deleteErr != nil {
			return deleteErr
		}
	}
	if err := s.repo.DeleteLessonsByStageID(id); err != nil {
		return err
	}
	return s.repo.DeleteStage(id)
}

func (s *Service) ReorderStages(courseID uint64, orders []struct {
	ID        uint64
	SortOrder int
}) ([]CourseStage, error) {
	for _, item := range orders {
		sortOrder := item.SortOrder
		if _, err := s.UpdateStage(item.ID, UpdateStageParams{SortOrder: &sortOrder}); err != nil {
			return nil, err
		}
	}
	return s.GetCourseStages(courseID)
}

type CreateLessonParams struct {
	CourseID        uint64
	StageID         uint64
	Title           string
	Type            int
	DurationMinutes int
	LabIdentifier   string
	Points          int
	SortOrder       int
	SkillIDs        []uint64
}

type UpdateLessonParams struct {
	Title           *string
	Type            *int
	DurationMinutes *int
	LabIdentifier   *string
	Points          *int
	SortOrder       *int
	SkillIDs        *[]uint64
}

func (s *Service) CreateLesson(params CreateLessonParams) (*CourseLesson, error) {
	if strings.TrimSpace(params.Title) == "" {
		return nil, apperrors.BadRequest("课时标题不能为空")
	}
	stage, err := s.repo.FindStageByID(params.StageID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("阶段不存在")
		}
		return nil, err
	}
	lesson := &CourseLesson{
		CourseID:        params.CourseID,
		StageID:         stage.ID,
		Title:           strings.TrimSpace(params.Title),
		Type:            params.Type,
		DurationMinutes: params.DurationMinutes,
		LabIdentifier:   strings.TrimSpace(params.LabIdentifier),
		Points:          params.Points,
		SortOrder:       params.SortOrder,
	}
	if lesson.CourseID == 0 {
		lesson.CourseID = stage.CourseID
	}
	if err := s.repo.CreateLesson(lesson); err != nil {
		return nil, err
	}
	if len(params.SkillIDs) > 0 {
		if err := s.repo.ReplaceLessonSkills(lesson.ID, params.SkillIDs); err != nil {
			return nil, err
		}
	}
	if err := s.refreshCourseStats(lesson.CourseID); err != nil {
		return nil, err
	}
	return lesson, nil
}

func (s *Service) UpdateLesson(id uint64, params UpdateLessonParams) (*CourseLesson, error) {
	lesson, err := s.repo.FindLessonByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("课时不存在")
		}
		return nil, err
	}
	if params.Title != nil {
		lesson.Title = strings.TrimSpace(*params.Title)
	}
	if params.Type != nil {
		lesson.Type = *params.Type
	}
	if params.DurationMinutes != nil {
		lesson.DurationMinutes = *params.DurationMinutes
	}
	if params.LabIdentifier != nil {
		lesson.LabIdentifier = strings.TrimSpace(*params.LabIdentifier)
	}
	if params.Points != nil {
		lesson.Points = *params.Points
	}
	if params.SortOrder != nil {
		lesson.SortOrder = *params.SortOrder
	}
	if err := s.repo.SaveLesson(lesson); err != nil {
		return nil, err
	}
	if params.SkillIDs != nil {
		if err := s.repo.ReplaceLessonSkills(lesson.ID, *params.SkillIDs); err != nil {
			return nil, err
		}
	}
	if err := s.refreshCourseStats(lesson.CourseID); err != nil {
		return nil, err
	}
	return lesson, nil
}

func (s *Service) DeleteLesson(id uint64) error {
	lesson, err := s.repo.FindLessonByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apperrors.NotFound("课时不存在")
		}
		return err
	}
	if err := s.deleteLessonAssets(id); err != nil {
		return err
	}
	if err := s.repo.DeleteLesson(id); err != nil {
		return err
	}
	return s.refreshCourseStats(lesson.CourseID)
}

func (s *Service) ReorderLessons(stageID uint64, orders []struct {
	ID        uint64
	SortOrder int
}) ([]CourseLessonDetail, error) {
	for _, item := range orders {
		sortOrder := item.SortOrder
		if _, err := s.UpdateLesson(item.ID, UpdateLessonParams{SortOrder: &sortOrder}); err != nil {
			return nil, err
		}
	}
	return s.GetStageLessons(stageID)
}

func (s *Service) GetAllSkills() ([]Skill, error) {
	return s.repo.FindAllSkills()
}

func (s *Service) GetSkillsByCategory(category string) ([]Skill, error) {
	return s.repo.FindSkillsByCategory(strings.TrimSpace(category))
}

func (s *Service) CreateSkill(name, category string) (*Skill, error) {
	if strings.TrimSpace(name) == "" {
		return nil, apperrors.BadRequest("技能名称不能为空")
	}
	if _, err := s.repo.FindSkillByName(strings.TrimSpace(name)); err == nil {
		return nil, apperrors.BadRequest("技能已存在")
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if strings.TrimSpace(category) == "" {
		category = "General"
	}
	skill := &Skill{Name: strings.TrimSpace(name), Category: strings.TrimSpace(category)}
	if err := s.repo.CreateSkill(skill); err != nil {
		return nil, err
	}
	return skill, nil
}

func (s *Service) UpdateSkill(id uint64, name, category *string) (*Skill, error) {
	skill, err := s.repo.FindSkillByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("技能不存在")
		}
		return nil, err
	}
	if name != nil && strings.TrimSpace(*name) != "" {
		skill.Name = strings.TrimSpace(*name)
	}
	if category != nil && strings.TrimSpace(*category) != "" {
		skill.Category = strings.TrimSpace(*category)
	}
	if err := s.repo.SaveSkill(skill); err != nil {
		return nil, err
	}
	return skill, nil
}

func (s *Service) DeleteSkill(id uint64) error {
	if _, err := s.repo.FindSkillByID(id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apperrors.NotFound("技能不存在")
		}
		return err
	}
	if err := s.repo.DeleteLessonSkillsBySkillID(id); err != nil {
		return err
	}
	return s.repo.DeleteSkill(id)
}

type CreateMaterialParams struct {
	LessonID  uint64
	Title     string
	Type      int
	FileURL   string
	FileName  string
	FileSize  int64
	SortOrder int
}

type UpdateMaterialParams struct {
	Title     *string
	SortOrder *int
}

func (s *Service) CreateMaterial(params CreateMaterialParams) (*LessonMaterial, error) {
	if _, err := s.repo.FindLessonByID(params.LessonID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("课时不存在")
		}
		return nil, err
	}
	material := &LessonMaterial{
		LessonID:  params.LessonID,
		Title:     strings.TrimSpace(params.Title),
		Type:      params.Type,
		FileURL:   strings.TrimSpace(params.FileURL),
		FileName:  strings.TrimSpace(params.FileName),
		FileSize:  params.FileSize,
		SortOrder: params.SortOrder,
	}
	if material.Title == "" {
		material.Title = material.FileName
	}
	if err := s.repo.CreateMaterial(material); err != nil {
		return nil, err
	}
	return material, nil
}

func (s *Service) UpdateMaterial(id uint64, params UpdateMaterialParams) (*LessonMaterial, error) {
	material, err := s.repo.FindMaterialByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("资料不存在")
		}
		return nil, err
	}
	if params.Title != nil {
		material.Title = strings.TrimSpace(*params.Title)
	}
	if params.SortOrder != nil {
		material.SortOrder = *params.SortOrder
	}
	if err := s.repo.SaveMaterial(material); err != nil {
		return nil, err
	}
	return material, nil
}

func (s *Service) DeleteMaterial(id uint64) error {
	material, err := s.repo.FindMaterialByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apperrors.NotFound("资料不存在")
		}
		return err
	}
	if err := s.removeUploadedFile(material.FileURL); err != nil {
		s.logger.Warn("remove material file failed", zap.Error(err), zap.String("fileUrl", material.FileURL))
	}
	return s.repo.DeleteMaterial(id)
}

func (s *Service) ReorderMaterials(lessonID uint64, orders []struct {
	ID        uint64
	SortOrder int
}) ([]LessonMaterial, error) {
	for _, item := range orders {
		sortOrder := item.SortOrder
		if _, err := s.UpdateMaterial(item.ID, UpdateMaterialParams{SortOrder: &sortOrder}); err != nil {
			return nil, err
		}
	}
	return s.GetLessonMaterials(lessonID)
}

func (s *Service) buildCourseDetail(course *Course) (*CourseDetail, error) {
	stages, err := s.repo.FindCourseStages(course.ID)
	if err != nil {
		return nil, err
	}
	lessons, err := s.repo.FindCourseLessons(course.ID)
	if err != nil {
		return nil, err
	}
	lessonDetails, err := s.attachLessonSkills(lessons)
	if err != nil {
		return nil, err
	}

	stageLessonMap := make(map[uint64][]CourseLessonDetail)
	for _, lesson := range lessonDetails {
		stageLessonMap[lesson.StageID] = append(stageLessonMap[lesson.StageID], lesson)
	}

	stageDetails := make([]CourseStageDetail, 0, len(stages))
	for _, stage := range stages {
		lessons := stageLessonMap[stage.ID]
		if lessons == nil {
			lessons = make([]CourseLessonDetail, 0)
		}
		stageDetails = append(stageDetails, CourseStageDetail{
			CourseStage: stage,
			Lessons:     lessons,
		})
	}

	return &CourseDetail{
		Course: *course,
		Stages: stageDetails,
	}, nil
}

func ensureTeacherCourseReadable(actorID uint64, roleType int, creatorID uint64) error {
	if roleType >= 10 || creatorID == actorID {
		return nil
	}
	return apperrors.Forbidden("无权查看该课程")
}

func (s *Service) attachLessonSkills(lessons []CourseLesson) ([]CourseLessonDetail, error) {
	lessonIDs := make([]uint64, 0, len(lessons))
	for _, lesson := range lessons {
		lessonIDs = append(lessonIDs, lesson.ID)
	}
	skillMap, err := s.repo.FindSkillsByLessonIDs(lessonIDs)
	if err != nil {
		return nil, err
	}

	result := make([]CourseLessonDetail, 0, len(lessons))
	for _, lesson := range lessons {
		skills := skillMap[lesson.ID]
		if skills == nil {
			skills = make([]Skill, 0)
		}
		result = append(result, CourseLessonDetail{
			CourseLesson: lesson,
			Skills:       skills,
		})
	}
	return result, nil
}

func (s *Service) refreshCourseStats(courseID uint64) error {
	lessons, err := s.repo.FindCourseLessons(courseID)
	if err != nil {
		return err
	}
	totalLessons := len(lessons)
	totalMinutes := 0
	uniqueSkillIDs := make(map[uint64]struct{})
	for _, lesson := range lessons {
		totalMinutes += lesson.DurationMinutes
		relations, relErr := s.repo.FindLessonSkillRelations(lesson.ID)
		if relErr != nil {
			return relErr
		}
		for _, relation := range relations {
			uniqueSkillIDs[relation.SkillID] = struct{}{}
		}
	}
	estimatedHours := 0
	if totalMinutes > 0 {
		estimatedHours = (totalMinutes + 59) / 60
	}
	course, err := s.repo.FindCourseByID(courseID)
	if err != nil {
		return err
	}
	course.TotalLessons = totalLessons
	course.TotalSkills = len(uniqueSkillIDs)
	if course.EstimatedHours == 0 || totalMinutes > 0 {
		course.EstimatedHours = estimatedHours
	}
	return s.repo.SaveCourse(course)
}

func (s *Service) deleteLessonAssets(lessonID uint64) error {
	materials, err := s.repo.FindLessonMaterials(lessonID)
	if err != nil {
		return err
	}
	for _, material := range materials {
		if removeErr := s.removeUploadedFile(material.FileURL); removeErr != nil {
			s.logger.Warn("remove lesson material file failed", zap.Error(removeErr), zap.String("fileUrl", material.FileURL))
		}
	}
	if err := s.repo.DeleteMaterialsByLessonID(lessonID); err != nil {
		return err
	}
	return s.repo.DeleteLessonSkillsByLessonID(lessonID)
}

func (s *Service) removeUploadedFile(fileURL string) error {
	if strings.TrimSpace(fileURL) == "" || !strings.HasPrefix(fileURL, "/uploads/") {
		return nil
	}
	relative := strings.TrimPrefix(fileURL, "/uploads/")
	relative = filepath.Clean(relative)
	if relative == "." || strings.HasPrefix(relative, "..") {
		return fmt.Errorf("unsafe upload path: %s", fileURL)
	}
	absolutePath := filepath.Join(s.uploadRoot, relative)
	if _, err := os.Stat(absolutePath); err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	return os.Remove(absolutePath)
}

func (s *Service) updateEnrollmentProgress(userID, courseID, lastLessonID uint64) error {
	course, err := s.repo.FindCourseByID(courseID)
	if err != nil {
		return err
	}

	completedCount, err := s.repo.CountCompletedLessonRecords(userID, courseID)
	if err != nil {
		return err
	}

	progressPercent := 0
	if course.TotalLessons > 0 {
		progressPercent = int((completedCount * 100) / int64(course.TotalLessons))
	}
	isCompleted := course.TotalLessons > 0 && int(completedCount) >= course.TotalLessons

	enrollment, err := s.repo.FindEnrollment(userID, courseID)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	now := time.Now()
	if err != nil && errors.Is(err, gorm.ErrRecordNotFound) {
		enrollment = &UserCourseEnrollment{
			UserID:                userID,
			CourseID:              courseID,
			Status:                EnrollmentStatusInProgress,
			ProgressPercent:       progressPercent,
			CompletedLessonsCount: int(completedCount),
			LastLessonID:          lastLessonID,
			LastActiveAt:          now,
			JoinedAt:              now,
		}
	} else {
		enrollment.ProgressPercent = progressPercent
		enrollment.CompletedLessonsCount = int(completedCount)
		enrollment.LastLessonID = lastLessonID
		enrollment.LastActiveAt = now
	}

	if isCompleted {
		enrollment.Status = EnrollmentStatusCompleted
		if enrollment.CompletedAt == nil {
			enrollment.CompletedAt = nowPtr(now)
		}
	} else {
		enrollment.Status = EnrollmentStatusInProgress
		enrollment.CompletedAt = nil
	}

	return s.repo.SaveEnrollment(enrollment)
}

func (s *Service) touchActivityLog(userID uint64) error {
	today := time.Now().Format("2006-01-02")
	log, err := s.repo.FindActivityLog(userID, today)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	if err != nil && errors.Is(err, gorm.ErrRecordNotFound) {
		log = &UserActivityLog{
			UserID:            userID,
			ActivityDate:      today,
			ContributionCount: 1,
		}
		return s.repo.SaveActivityLog(log)
	}

	log.ContributionCount++
	return s.repo.SaveActivityLog(log)
}
