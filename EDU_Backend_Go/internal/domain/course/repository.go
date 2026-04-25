package course

import (
	"time"

	"gorm.io/gorm"
)

type ListQuery struct {
	Page       int
	PageSize   int
	Keyword    string
	Status     *int
	Difficulty *int
	CreatorID  *uint64
}

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) ListCourses(query ListQuery) ([]Course, int64, error) {
	db := r.db.Model(&Course{})
	if query.Keyword != "" {
		like := "%" + query.Keyword + "%"
		db = db.Where("(title LIKE ? OR slug LIKE ? OR description LIKE ?)", like, like, like)
	}
	if query.Status != nil {
		db = db.Where("status = ?", *query.Status)
	}
	if query.Difficulty != nil {
		db = db.Where("difficulty = ?", *query.Difficulty)
	}
	if query.CreatorID != nil {
		db = db.Where("creator_id = ?", *query.CreatorID)
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var courses []Course
	err := db.Order("updated_at DESC").
		Offset((query.Page - 1) * query.PageSize).
		Limit(query.PageSize).
		Find(&courses).Error
	return courses, total, err
}

func (r *Repository) FindCourseByID(id uint64) (*Course, error) {
	var course Course
	if err := r.db.First(&course, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &course, nil
}

func (r *Repository) FindCourseBySlug(slug string) (*Course, error) {
	var course Course
	if err := r.db.First(&course, "slug = ?", slug).Error; err != nil {
		return nil, err
	}
	return &course, nil
}

func (r *Repository) FindCourseByStageID(stageID uint64) (*Course, error) {
	var stage CourseStage
	if err := r.db.First(&stage, "id = ?", stageID).Error; err != nil {
		return nil, err
	}
	return r.FindCourseByID(stage.CourseID)
}

func (r *Repository) FindCourseByLessonID(lessonID uint64) (*Course, error) {
	lesson, err := r.FindLessonByID(lessonID)
	if err != nil {
		return nil, err
	}
	return r.FindCourseByID(lesson.CourseID)
}

func (r *Repository) FindCourseByMaterialID(materialID uint64) (*Course, error) {
	material, err := r.FindMaterialByID(materialID)
	if err != nil {
		return nil, err
	}
	return r.FindCourseByLessonID(material.LessonID)
}

func (r *Repository) CreateCourse(course *Course) error {
	return r.db.Create(course).Error
}

func (r *Repository) SaveCourse(course *Course) error {
	return r.db.Save(course).Error
}

func (r *Repository) DeleteCourse(id uint64) error {
	return r.db.Delete(&Course{}, "id = ?", id).Error
}

func (r *Repository) FindCourseStages(courseID uint64) ([]CourseStage, error) {
	var stages []CourseStage
	err := r.db.Where("course_id = ?", courseID).Order("sort_order ASC").Find(&stages).Error
	return stages, err
}

func (r *Repository) FindStageByID(stageID uint64) (*CourseStage, error) {
	var stage CourseStage
	if err := r.db.First(&stage, "id = ?", stageID).Error; err != nil {
		return nil, err
	}
	return &stage, nil
}

func (r *Repository) CreateStage(stage *CourseStage) error {
	return r.db.Create(stage).Error
}

func (r *Repository) SaveStage(stage *CourseStage) error {
	return r.db.Save(stage).Error
}

func (r *Repository) DeleteStage(id uint64) error {
	return r.db.Delete(&CourseStage{}, "id = ?", id).Error
}

func (r *Repository) FindCourseLessons(courseID uint64) ([]CourseLesson, error) {
	var lessons []CourseLesson
	err := r.db.Where("course_id = ?", courseID).Order("sort_order ASC").Find(&lessons).Error
	return lessons, err
}

func (r *Repository) FindStageLessons(stageID uint64) ([]CourseLesson, error) {
	var lessons []CourseLesson
	err := r.db.Where("stage_id = ?", stageID).Order("sort_order ASC").Find(&lessons).Error
	return lessons, err
}

func (r *Repository) FindLessonByID(lessonID uint64) (*CourseLesson, error) {
	var lesson CourseLesson
	if err := r.db.First(&lesson, "id = ?", lessonID).Error; err != nil {
		return nil, err
	}
	return &lesson, nil
}

func (r *Repository) CreateLesson(lesson *CourseLesson) error {
	return r.db.Create(lesson).Error
}

func (r *Repository) SaveLesson(lesson *CourseLesson) error {
	return r.db.Save(lesson).Error
}

func (r *Repository) DeleteLesson(id uint64) error {
	return r.db.Delete(&CourseLesson{}, "id = ?", id).Error
}

func (r *Repository) FindLessonMaterials(lessonID uint64) ([]LessonMaterial, error) {
	var materials []LessonMaterial
	err := r.db.Where("lesson_id = ?", lessonID).Order("sort_order ASC").Find(&materials).Error
	return materials, err
}

func (r *Repository) FindMaterialByID(materialID uint64) (*LessonMaterial, error) {
	var material LessonMaterial
	if err := r.db.First(&material, "id = ?", materialID).Error; err != nil {
		return nil, err
	}
	return &material, nil
}

func (r *Repository) CreateMaterial(material *LessonMaterial) error {
	return r.db.Create(material).Error
}

func (r *Repository) SaveMaterial(material *LessonMaterial) error {
	return r.db.Save(material).Error
}

func (r *Repository) DeleteMaterial(id uint64) error {
	return r.db.Delete(&LessonMaterial{}, "id = ?", id).Error
}

func (r *Repository) FindSkillsByLessonIDs(lessonIDs []uint64) (map[uint64][]Skill, error) {
	result := make(map[uint64][]Skill)
	if len(lessonIDs) == 0 {
		return result, nil
	}

	var relations []LessonSkill
	if err := r.db.Where("lesson_id IN ?", lessonIDs).Find(&relations).Error; err != nil {
		return nil, err
	}
	if len(relations) == 0 {
		return result, nil
	}

	skillIDs := make([]uint64, 0, len(relations))
	seen := make(map[uint64]struct{})
	for _, relation := range relations {
		if _, ok := seen[relation.SkillID]; ok {
			continue
		}
		seen[relation.SkillID] = struct{}{}
		skillIDs = append(skillIDs, relation.SkillID)
	}

	var skills []Skill
	if err := r.db.Where("id IN ?", skillIDs).Find(&skills).Error; err != nil {
		return nil, err
	}
	skillMap := make(map[uint64]Skill, len(skills))
	for _, skill := range skills {
		skillMap[skill.ID] = skill
	}

	for _, relation := range relations {
		skill, ok := skillMap[relation.SkillID]
		if !ok {
			continue
		}
		result[relation.LessonID] = append(result[relation.LessonID], skill)
	}

	return result, nil
}

func (r *Repository) FindAllSkills() ([]Skill, error) {
	var skills []Skill
	err := r.db.Order("category ASC, name ASC").Find(&skills).Error
	return skills, err
}

func (r *Repository) FindSkillsByCategory(category string) ([]Skill, error) {
	var skills []Skill
	err := r.db.Where("category = ?", category).Order("name ASC").Find(&skills).Error
	return skills, err
}

func (r *Repository) FindSkillByID(skillID uint64) (*Skill, error) {
	var skill Skill
	if err := r.db.First(&skill, "id = ?", skillID).Error; err != nil {
		return nil, err
	}
	return &skill, nil
}

func (r *Repository) FindSkillByName(name string) (*Skill, error) {
	var skill Skill
	if err := r.db.First(&skill, "name = ?", name).Error; err != nil {
		return nil, err
	}
	return &skill, nil
}

func (r *Repository) CreateSkill(skill *Skill) error {
	return r.db.Create(skill).Error
}

func (r *Repository) SaveSkill(skill *Skill) error {
	return r.db.Save(skill).Error
}

func (r *Repository) DeleteSkill(id uint64) error {
	return r.db.Delete(&Skill{}, "id = ?", id).Error
}

func (r *Repository) FindLessonSkillRelations(lessonID uint64) ([]LessonSkill, error) {
	var relations []LessonSkill
	err := r.db.Where("lesson_id = ?", lessonID).Find(&relations).Error
	return relations, err
}

func (r *Repository) ReplaceLessonSkills(lessonID uint64, skillIDs []uint64) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("lesson_id = ?", lessonID).Delete(&LessonSkill{}).Error; err != nil {
			return err
		}
		if len(skillIDs) == 0 {
			return nil
		}
		relations := make([]LessonSkill, 0, len(skillIDs))
		for _, skillID := range skillIDs {
			relations = append(relations, LessonSkill{LessonID: lessonID, SkillID: skillID})
		}
		return tx.Create(&relations).Error
	})
}

func (r *Repository) DeleteLessonSkillsByLessonID(lessonID uint64) error {
	return r.db.Where("lesson_id = ?", lessonID).Delete(&LessonSkill{}).Error
}

func (r *Repository) DeleteLessonSkillsBySkillID(skillID uint64) error {
	return r.db.Where("skill_id = ?", skillID).Delete(&LessonSkill{}).Error
}

func (r *Repository) DeleteLessonsByCourseID(courseID uint64) error {
	return r.db.Where("course_id = ?", courseID).Delete(&CourseLesson{}).Error
}

func (r *Repository) DeleteStagesByCourseID(courseID uint64) error {
	return r.db.Where("course_id = ?", courseID).Delete(&CourseStage{}).Error
}

func (r *Repository) DeleteLessonsByStageID(stageID uint64) error {
	return r.db.Where("stage_id = ?", stageID).Delete(&CourseLesson{}).Error
}

func (r *Repository) DeleteMaterialsByLessonID(lessonID uint64) error {
	return r.db.Where("lesson_id = ?", lessonID).Delete(&LessonMaterial{}).Error
}

func (r *Repository) FindEnrollment(userID, courseID uint64) (*UserCourseEnrollment, error) {
	var enrollment UserCourseEnrollment
	if err := r.db.First(&enrollment, "user_id = ? AND course_id = ?", userID, courseID).Error; err != nil {
		return nil, err
	}
	return &enrollment, nil
}

func (r *Repository) SaveEnrollment(enrollment *UserCourseEnrollment) error {
	return r.db.Save(enrollment).Error
}

func (r *Repository) FindUserEnrollments(userID uint64) ([]UserCourseEnrollment, error) {
	var enrollments []UserCourseEnrollment
	err := r.db.Where("user_id = ?", userID).Order("last_active_at DESC").Find(&enrollments).Error
	return enrollments, err
}

func (r *Repository) FindLatestInProgressEnrollment(userID uint64) (*UserCourseEnrollment, error) {
	var enrollment UserCourseEnrollment
	err := r.db.Where("user_id = ? AND status = ?", userID, EnrollmentStatusInProgress).
		Order("last_active_at DESC").
		First(&enrollment).Error
	if err != nil {
		return nil, err
	}
	return &enrollment, nil
}

func (r *Repository) FindLessonRecord(userID, lessonID uint64) (*UserLessonRecord, error) {
	var record UserLessonRecord
	if err := r.db.First(&record, "user_id = ? AND lesson_id = ?", userID, lessonID).Error; err != nil {
		return nil, err
	}
	return &record, nil
}

func (r *Repository) SaveLessonRecord(record *UserLessonRecord) error {
	return r.db.Save(record).Error
}

func (r *Repository) FindUserLessonRecords(userID, courseID uint64) ([]UserLessonRecord, error) {
	var records []UserLessonRecord
	err := r.db.Where("user_id = ? AND course_id = ?", userID, courseID).Find(&records).Error
	return records, err
}

func (r *Repository) CountCompletedLessonRecords(userID, courseID uint64) (int64, error) {
	var count int64
	err := r.db.Model(&UserLessonRecord{}).
		Where("user_id = ? AND course_id = ? AND status = ?", userID, courseID, LessonRecordStatusCompleted).
		Count(&count).Error
	return count, err
}

func (r *Repository) FindCoursesByIDs(ids []uint64) ([]Course, error) {
	var courses []Course
	if len(ids) == 0 {
		return courses, nil
	}
	err := r.db.Where("id IN ?", ids).Find(&courses).Error
	return courses, err
}

func (r *Repository) FindNextLessonByCourseAndSortOrder(courseID uint64, sortOrder int) (*CourseLesson, error) {
	var lesson CourseLesson
	err := r.db.Where("course_id = ? AND sort_order > ?", courseID, sortOrder).
		Order("sort_order ASC").
		First(&lesson).Error
	if err != nil {
		return nil, err
	}
	return &lesson, nil
}

func (r *Repository) FindFirstLessonByCourse(courseID uint64) (*CourseLesson, error) {
	var lesson CourseLesson
	err := r.db.Where("course_id = ?", courseID).
		Order("sort_order ASC").
		First(&lesson).Error
	if err != nil {
		return nil, err
	}
	return &lesson, nil
}

func (r *Repository) FindActivityLogs(userID uint64, startDate string) ([]UserActivityLog, error) {
	var logs []UserActivityLog
	err := r.db.Where("user_id = ? AND activity_date >= ?", userID, startDate).
		Order("activity_date ASC").
		Find(&logs).Error
	return logs, err
}

func (r *Repository) FindActivityLog(userID uint64, date string) (*UserActivityLog, error) {
	var log UserActivityLog
	if err := r.db.First(&log, "user_id = ? AND activity_date = ?", userID, date).Error; err != nil {
		return nil, err
	}
	return &log, nil
}

func (r *Repository) SaveActivityLog(log *UserActivityLog) error {
	return r.db.Save(log).Error
}

func nowPtr(t time.Time) *time.Time {
	return &t
}
