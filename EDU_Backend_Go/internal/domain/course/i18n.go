package course

import (
	"context"
	"strings"

	"edu-platform/pkg/i18n"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const translationStatusPublished = 1

type StageContentTranslationInput struct {
	ID          uint64 `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
}

type LessonContentTranslationInput struct {
	ID    uint64 `json:"id"`
	Title string `json:"title"`
}

type CourseContentTranslationInput struct {
	Title       string                          `json:"title"`
	Description string                          `json:"description"`
	Stages      []StageContentTranslationInput  `json:"stages"`
	Lessons     []LessonContentTranslationInput `json:"lessons"`
}

type MaterialContentTranslationInput struct {
	Title    *string
	FileURL  string
	FileName string
	FileSize int64
}

func (s *Service) ListLocalized(ctx context.Context, page, pageSize int, keyword string, status, difficulty *int) ([]Course, int64, error) {
	items, total, err := s.List(page, pageSize, keyword, status, difficulty)
	if err != nil {
		return nil, 0, err
	}
	return s.localizeCourses(ctx, items), total, nil
}

func (s *Service) SaveCourseContentTranslation(ctx context.Context, courseID uint64, locale string, input CourseContentTranslationInput) (*CourseDetail, error) {
	course, err := s.FindCourseEntity(courseID)
	if err != nil {
		return nil, err
	}
	normalizedLocale := i18n.NormalizeLocale(locale)
	if err := s.repo.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "entity_id"}, {Name: "locale"}},
		DoUpdates: clause.AssignmentColumns([]string{"title", "description", "status", "version", "updated_at"}),
	}).Create(&CourseTranslation{
		EntityID:    course.ID,
		Locale:      normalizedLocale,
		Title:       input.Title,
		Description: input.Description,
		Status:      translationStatusPublished,
		Version:     1,
	}).Error; err != nil {
		return nil, err
	}

	for _, item := range input.Stages {
		stage, err := s.repo.FindStageByID(item.ID)
		if err != nil || stage.CourseID != course.ID {
			continue
		}
		if err := s.repo.db.WithContext(ctx).Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "entity_id"}, {Name: "locale"}},
			DoUpdates: clause.AssignmentColumns([]string{"title", "description", "status", "version", "updated_at"}),
		}).Create(&CourseStageTranslation{
			EntityID:    item.ID,
			Locale:      normalizedLocale,
			Title:       item.Title,
			Description: item.Description,
			Status:      translationStatusPublished,
			Version:     1,
		}).Error; err != nil {
			return nil, err
		}
	}

	for _, item := range input.Lessons {
		lesson, err := s.repo.FindLessonByID(item.ID)
		if err != nil || lesson.CourseID != course.ID {
			continue
		}
		if err := s.repo.db.WithContext(ctx).Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "entity_id"}, {Name: "locale"}},
			DoUpdates: clause.AssignmentColumns([]string{"title", "description", "status", "version", "updated_at"}),
		}).Create(&CourseLessonTranslation{
			EntityID: item.ID,
			Locale:   normalizedLocale,
			Title:    item.Title,
			Status:   translationStatusPublished,
			Version:  1,
		}).Error; err != nil {
			return nil, err
		}
	}

	return s.FindByIDLocalized(i18n.WithLocale(ctx, normalizedLocale), course.ID)
}

func (s *Service) SaveMaterialContentTranslation(ctx context.Context, materialID uint64, locale string, input MaterialContentTranslationInput) (*LessonMaterial, error) {
	material, err := s.repo.FindMaterialByID(materialID)
	if err != nil {
		return nil, err
	}

	normalizedLocale := i18n.NormalizeLocale(locale)
	translation := LessonMaterialTranslation{
		EntityID: material.ID,
		Locale:   normalizedLocale,
		Title:    material.Title,
		FileURL:  material.FileURL,
		FileName: material.FileName,
		FileSize: material.FileSize,
		Status:   translationStatusPublished,
		Version:  1,
	}
	var existing LessonMaterialTranslation
	err = s.repo.db.WithContext(ctx).
		Where("entity_id = ? AND locale = ?", material.ID, normalizedLocale).
		First(&existing).Error
	if err == nil {
		translation = existing
		translation.Status = translationStatusPublished
		translation.Version++
	} else if err != nil && err != gorm.ErrRecordNotFound {
		return nil, err
	}

	if input.Title != nil {
		translation.Title = strings.TrimSpace(*input.Title)
	}
	if input.FileURL != "" {
		translation.FileURL = strings.TrimSpace(input.FileURL)
		translation.FileName = strings.TrimSpace(input.FileName)
		translation.FileSize = input.FileSize
	}
	if strings.TrimSpace(translation.Title) == "" {
		translation.Title = translation.FileName
	}

	if translation.ID > 0 {
		if err := s.repo.db.WithContext(ctx).Save(&translation).Error; err != nil {
			return nil, err
		}
	} else if err := s.repo.db.WithContext(ctx).Create(&translation).Error; err != nil {
		return nil, err
	}

	items := s.localizeMaterials(i18n.WithLocale(ctx, normalizedLocale), []LessonMaterial{*material})
	return &items[0], nil
}

func (s *Service) ListForTeacherLocalized(ctx context.Context, actorID uint64, roleType int, page, pageSize int, keyword string, status, difficulty *int) ([]Course, int64, error) {
	items, total, err := s.ListForTeacher(actorID, roleType, page, pageSize, keyword, status, difficulty)
	if err != nil {
		return nil, 0, err
	}
	return s.localizeCourses(ctx, items), total, nil
}

func (s *Service) ListAssignedForStudentLocalized(ctx context.Context, studentID, classID uint64) ([]AssignedCourse, error) {
	items, err := s.ListAssignedForStudent(ctx, studentID, classID)
	if err != nil {
		return nil, err
	}
	courses := make([]Course, 0, len(items))
	for _, item := range items {
		courses = append(courses, item.Course)
	}
	localized := s.localizeCourses(ctx, courses)
	for idx := range items {
		items[idx].Course = localized[idx]
	}
	return items, nil
}

func (s *Service) FindByIDLocalized(ctx context.Context, id uint64) (*CourseDetail, error) {
	detail, err := s.FindByID(id)
	if err != nil {
		return nil, err
	}
	s.localizeCourseDetail(ctx, detail)
	return detail, nil
}

func (s *Service) FindBySlugLocalized(ctx context.Context, slug string) (*CourseDetail, error) {
	detail, err := s.FindBySlug(slug)
	if err != nil {
		return nil, err
	}
	s.localizeCourseDetail(ctx, detail)
	return detail, nil
}

func (s *Service) FindByIDForTeacherLocalized(ctx context.Context, actorID uint64, roleType int, id uint64) (*CourseDetail, error) {
	detail, err := s.FindByIDForTeacher(actorID, roleType, id)
	if err != nil {
		return nil, err
	}
	s.localizeCourseDetail(ctx, detail)
	return detail, nil
}

func (s *Service) GetCourseStagesLocalized(ctx context.Context, courseID uint64) ([]CourseStage, error) {
	stages, err := s.GetCourseStages(courseID)
	if err != nil {
		return nil, err
	}
	return s.localizeStages(ctx, stages), nil
}

func (s *Service) GetCourseStagesForTeacherLocalized(ctx context.Context, actorID uint64, roleType int, courseID uint64) ([]CourseStage, error) {
	stages, err := s.GetCourseStagesForTeacher(actorID, roleType, courseID)
	if err != nil {
		return nil, err
	}
	return s.localizeStages(ctx, stages), nil
}

func (s *Service) GetCourseLessonsLocalized(ctx context.Context, courseID uint64) ([]CourseLessonDetail, error) {
	lessons, err := s.GetCourseLessons(courseID)
	if err != nil {
		return nil, err
	}
	return s.localizeLessonDetails(ctx, lessons), nil
}

func (s *Service) GetCourseLessonsForTeacherLocalized(ctx context.Context, actorID uint64, roleType int, courseID uint64) ([]CourseLessonDetail, error) {
	lessons, err := s.GetCourseLessonsForTeacher(actorID, roleType, courseID)
	if err != nil {
		return nil, err
	}
	return s.localizeLessonDetails(ctx, lessons), nil
}

func (s *Service) GetStageLessonsLocalized(ctx context.Context, stageID uint64) ([]CourseLessonDetail, error) {
	lessons, err := s.GetStageLessons(stageID)
	if err != nil {
		return nil, err
	}
	return s.localizeLessonDetails(ctx, lessons), nil
}

func (s *Service) GetStageLessonsForTeacherLocalized(ctx context.Context, actorID uint64, roleType int, stageID uint64) ([]CourseLessonDetail, error) {
	lessons, err := s.GetStageLessonsForTeacher(actorID, roleType, stageID)
	if err != nil {
		return nil, err
	}
	return s.localizeLessonDetails(ctx, lessons), nil
}

func (s *Service) GetLessonByIDLocalized(ctx context.Context, lessonID uint64) (*CourseLesson, error) {
	lesson, err := s.GetLessonByID(lessonID)
	if err != nil {
		return nil, err
	}
	localized := s.localizeLessons(ctx, []CourseLesson{*lesson})
	return &localized[0], nil
}

func (s *Service) GetLessonByIDForTeacherLocalized(ctx context.Context, actorID uint64, roleType int, lessonID uint64) (*CourseLesson, error) {
	lesson, err := s.GetLessonByIDForTeacher(actorID, roleType, lessonID)
	if err != nil {
		return nil, err
	}
	localized := s.localizeLessons(ctx, []CourseLesson{*lesson})
	return &localized[0], nil
}

func (s *Service) GetLessonMaterialsLocalized(ctx context.Context, lessonID uint64) ([]LessonMaterial, error) {
	materials, err := s.GetLessonMaterials(lessonID)
	if err != nil {
		return nil, err
	}
	return s.localizeMaterials(ctx, materials), nil
}

func (s *Service) GetLessonMaterialsForTeacherLocalized(ctx context.Context, actorID uint64, roleType int, lessonID uint64) ([]LessonMaterial, error) {
	materials, err := s.GetLessonMaterialsForTeacher(actorID, roleType, lessonID)
	if err != nil {
		return nil, err
	}
	return s.localizeMaterials(ctx, materials), nil
}

func (s *Service) localizeCourseDetail(ctx context.Context, detail *CourseDetail) {
	if detail == nil {
		return
	}
	course := s.localizeCourses(ctx, []Course{detail.Course})
	detail.Course = course[0]
	stages := make([]CourseStage, 0, len(detail.Stages))
	lessons := make([]CourseLessonDetail, 0)
	for _, stage := range detail.Stages {
		stages = append(stages, stage.CourseStage)
		lessons = append(lessons, stage.Lessons...)
	}
	stages = s.localizeStages(ctx, stages)
	lessons = s.localizeLessonDetails(ctx, lessons)
	lessonByID := make(map[uint64]CourseLessonDetail, len(lessons))
	for _, lesson := range lessons {
		lessonByID[lesson.ID] = lesson
	}
	for idx := range detail.Stages {
		detail.Stages[idx].CourseStage = stages[idx]
		for lessonIdx := range detail.Stages[idx].Lessons {
			if localized, ok := lessonByID[detail.Stages[idx].Lessons[lessonIdx].ID]; ok {
				detail.Stages[idx].Lessons[lessonIdx] = localized
			}
		}
	}
}

func (s *Service) localizeCourses(ctx context.Context, courses []Course) []Course {
	locale := i18n.LocaleFromContext(ctx)
	ids := make([]uint64, 0, len(courses))
	for _, item := range courses {
		ids = append(ids, item.ID)
	}
	current, fallback := s.loadCourseTranslations(ctx, ids, locale)
	for idx := range courses {
		if tr, missing, ok := pickCourseTranslation(courses[idx].ID, locale, current, fallback); ok {
			courses[idx].Title = tr.Title
			courses[idx].Description = tr.Description
			courses[idx].TranslationMissing = missing
		} else if locale != i18n.LocaleEnUS {
			courses[idx].TranslationMissing = true
		}
		courses[idx].Locale = locale
	}
	return courses
}

func (s *Service) localizeStages(ctx context.Context, stages []CourseStage) []CourseStage {
	locale := i18n.LocaleFromContext(ctx)
	ids := make([]uint64, 0, len(stages))
	for _, item := range stages {
		ids = append(ids, item.ID)
	}
	current, fallback := s.loadStageTranslations(ctx, ids, locale)
	for idx := range stages {
		if tr, missing, ok := pickStageTranslation(stages[idx].ID, locale, current, fallback); ok {
			stages[idx].Title = tr.Title
			stages[idx].Description = tr.Description
			stages[idx].TranslationMissing = missing
		} else if locale != i18n.LocaleEnUS {
			stages[idx].TranslationMissing = true
		}
		stages[idx].Locale = locale
	}
	return stages
}

func (s *Service) localizeLessonDetails(ctx context.Context, lessons []CourseLessonDetail) []CourseLessonDetail {
	base := make([]CourseLesson, 0, len(lessons))
	for _, item := range lessons {
		base = append(base, item.CourseLesson)
	}
	localized := s.localizeLessons(ctx, base)
	for idx := range lessons {
		lessons[idx].CourseLesson = localized[idx]
	}
	return lessons
}

func (s *Service) localizeLessons(ctx context.Context, lessons []CourseLesson) []CourseLesson {
	locale := i18n.LocaleFromContext(ctx)
	ids := make([]uint64, 0, len(lessons))
	for _, item := range lessons {
		ids = append(ids, item.ID)
	}
	current, fallback := s.loadLessonTranslations(ctx, ids, locale)
	for idx := range lessons {
		if tr, missing, ok := pickLessonTranslation(lessons[idx].ID, locale, current, fallback); ok {
			lessons[idx].Title = tr.Title
			lessons[idx].TranslationMissing = missing
		} else if locale != i18n.LocaleEnUS {
			lessons[idx].TranslationMissing = true
		}
		lessons[idx].Locale = locale
	}
	return lessons
}

func (s *Service) localizeMaterials(ctx context.Context, materials []LessonMaterial) []LessonMaterial {
	locale := i18n.LocaleFromContext(ctx)
	ids := make([]uint64, 0, len(materials))
	for _, item := range materials {
		ids = append(ids, item.ID)
	}
	current, fallback := s.loadMaterialTranslations(ctx, ids, locale)
	for idx := range materials {
		if tr, missing, ok := pickMaterialTranslation(materials[idx].ID, locale, current, fallback); ok {
			materials[idx].Title = tr.Title
			if tr.FileURL != "" {
				materials[idx].FileURL = tr.FileURL
			}
			if tr.FileName != "" {
				materials[idx].FileName = tr.FileName
			}
			if tr.FileSize > 0 {
				materials[idx].FileSize = tr.FileSize
			}
			materials[idx].TranslationMissing = missing
		} else if locale != i18n.LocaleEnUS {
			materials[idx].TranslationMissing = true
		}
		materials[idx].Locale = locale
	}
	return materials
}

func (s *Service) loadCourseTranslations(ctx context.Context, ids []uint64, locale string) (map[uint64]CourseTranslation, map[uint64]CourseTranslation) {
	current := make(map[uint64]CourseTranslation)
	fallback := make(map[uint64]CourseTranslation)
	if len(ids) == 0 {
		return current, fallback
	}
	var rows []CourseTranslation
	_ = s.repo.db.WithContext(ctx).Where("entity_id IN ? AND locale = ? AND status = ?", ids, locale, translationStatusPublished).Find(&rows).Error
	for _, row := range rows {
		current[row.EntityID] = row
	}
	if locale != i18n.LocaleEnUS {
		rows = nil
		_ = s.repo.db.WithContext(ctx).Where("entity_id IN ? AND locale = ? AND status = ?", ids, i18n.LocaleEnUS, translationStatusPublished).Find(&rows).Error
		for _, row := range rows {
			fallback[row.EntityID] = row
		}
	}
	return current, fallback
}

func (s *Service) loadStageTranslations(ctx context.Context, ids []uint64, locale string) (map[uint64]CourseStageTranslation, map[uint64]CourseStageTranslation) {
	current := make(map[uint64]CourseStageTranslation)
	fallback := make(map[uint64]CourseStageTranslation)
	if len(ids) == 0 {
		return current, fallback
	}
	var rows []CourseStageTranslation
	_ = s.repo.db.WithContext(ctx).Where("entity_id IN ? AND locale = ? AND status = ?", ids, locale, translationStatusPublished).Find(&rows).Error
	for _, row := range rows {
		current[row.EntityID] = row
	}
	if locale != i18n.LocaleEnUS {
		rows = nil
		_ = s.repo.db.WithContext(ctx).Where("entity_id IN ? AND locale = ? AND status = ?", ids, i18n.LocaleEnUS, translationStatusPublished).Find(&rows).Error
		for _, row := range rows {
			fallback[row.EntityID] = row
		}
	}
	return current, fallback
}

func (s *Service) loadLessonTranslations(ctx context.Context, ids []uint64, locale string) (map[uint64]CourseLessonTranslation, map[uint64]CourseLessonTranslation) {
	current := make(map[uint64]CourseLessonTranslation)
	fallback := make(map[uint64]CourseLessonTranslation)
	if len(ids) == 0 {
		return current, fallback
	}
	var rows []CourseLessonTranslation
	_ = s.repo.db.WithContext(ctx).Where("entity_id IN ? AND locale = ? AND status = ?", ids, locale, translationStatusPublished).Find(&rows).Error
	for _, row := range rows {
		current[row.EntityID] = row
	}
	if locale != i18n.LocaleEnUS {
		rows = nil
		_ = s.repo.db.WithContext(ctx).Where("entity_id IN ? AND locale = ? AND status = ?", ids, i18n.LocaleEnUS, translationStatusPublished).Find(&rows).Error
		for _, row := range rows {
			fallback[row.EntityID] = row
		}
	}
	return current, fallback
}

func (s *Service) loadMaterialTranslations(ctx context.Context, ids []uint64, locale string) (map[uint64]LessonMaterialTranslation, map[uint64]LessonMaterialTranslation) {
	current := make(map[uint64]LessonMaterialTranslation)
	fallback := make(map[uint64]LessonMaterialTranslation)
	if len(ids) == 0 {
		return current, fallback
	}
	var rows []LessonMaterialTranslation
	_ = s.repo.db.WithContext(ctx).Where("entity_id IN ? AND locale = ? AND status = ?", ids, locale, translationStatusPublished).Find(&rows).Error
	for _, row := range rows {
		current[row.EntityID] = row
	}
	if locale != i18n.LocaleEnUS {
		rows = nil
		_ = s.repo.db.WithContext(ctx).Where("entity_id IN ? AND locale = ? AND status = ?", ids, i18n.LocaleEnUS, translationStatusPublished).Find(&rows).Error
		for _, row := range rows {
			fallback[row.EntityID] = row
		}
	}
	return current, fallback
}

func pickCourseTranslation(id uint64, locale string, current, fallback map[uint64]CourseTranslation) (CourseTranslation, bool, bool) {
	if tr, ok := current[id]; ok {
		return tr, false, true
	}
	if locale != i18n.LocaleEnUS {
		if tr, ok := fallback[id]; ok {
			return tr, true, true
		}
	}
	return CourseTranslation{}, false, false
}

func pickStageTranslation(id uint64, locale string, current, fallback map[uint64]CourseStageTranslation) (CourseStageTranslation, bool, bool) {
	if tr, ok := current[id]; ok {
		return tr, false, true
	}
	if locale != i18n.LocaleEnUS {
		if tr, ok := fallback[id]; ok {
			return tr, true, true
		}
	}
	return CourseStageTranslation{}, false, false
}

func pickLessonTranslation(id uint64, locale string, current, fallback map[uint64]CourseLessonTranslation) (CourseLessonTranslation, bool, bool) {
	if tr, ok := current[id]; ok {
		return tr, false, true
	}
	if locale != i18n.LocaleEnUS {
		if tr, ok := fallback[id]; ok {
			return tr, true, true
		}
	}
	return CourseLessonTranslation{}, false, false
}

func pickMaterialTranslation(id uint64, locale string, current, fallback map[uint64]LessonMaterialTranslation) (LessonMaterialTranslation, bool, bool) {
	if tr, ok := current[id]; ok {
		return tr, false, true
	}
	if locale != i18n.LocaleEnUS {
		if tr, ok := fallback[id]; ok {
			return tr, true, true
		}
	}
	return LessonMaterialTranslation{}, false, false
}
