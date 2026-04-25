package user

import (
	"strings"
	"time"

	"gorm.io/gorm"

	"edu-platform/internal/domain/course"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Count() (int64, error) {
	var count int64
	err := r.db.Model(&User{}).Count(&count).Error
	return count, err
}

func (r *Repository) FindByID(id uint64) (*User, error) {
	var u User
	if err := r.db.First(&u, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *Repository) FindByUsername(username string) (*User, error) {
	var u User
	if err := r.db.Where("username = ?", username).First(&u).Error; err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *Repository) FindByEmail(email string) (*User, error) {
	var u User
	if err := r.db.Where("email = ?", email).First(&u).Error; err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *Repository) FindByStudentID(studentID string) (*User, error) {
	var u User
	if err := r.db.Where("student_id = ?", studentID).First(&u).Error; err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *Repository) FindForLogin(keyword string) (*User, error) {
	var u User
	err := r.db.Where("username = ? OR email = ? OR student_id = ?", keyword, keyword, keyword).First(&u).Error
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *Repository) Create(u *User) error {
	return r.db.Create(u).Error
}

func (r *Repository) Update(id uint64, attrs map[string]any) (bool, error) {
	tx := r.db.Model(&User{}).Where("id = ?", id).Updates(attrs)
	if tx.Error != nil {
		return false, tx.Error
	}
	return tx.RowsAffected > 0, nil
}

func (r *Repository) List(page, pageSize int, keyword string, roleType, status *int) ([]User, int64, error) {
	query := r.db.Model(&User{})
	if trimmed := strings.TrimSpace(keyword); trimmed != "" {
		like := "%" + trimmed + "%"
		query = query.Where(
			"username LIKE ? OR email LIKE ? OR full_name LIKE ? OR student_id LIKE ?",
			like, like, like, like,
		)
	}
	if roleType != nil {
		query = query.Where("role_type = ?", *roleType)
	}
	if status != nil {
		query = query.Where("status = ?", *status)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var users []User
	err := query.Order("created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&users).Error
	return users, total, err
}

func (r *Repository) StudentLeaderboard(limit int) ([]StudentLeaderboardItem, error) {
	if limit <= 0 {
		limit = 4
	}
	if limit > 20 {
		limit = 20
	}

	type leaderboardRow struct {
		ID               uint64
		Username         string
		FullName         string
		AvatarURL        string
		SkillsCount      int
		CompletedLessons int
		EnrolledCourses  int
		LastActiveAt     *time.Time
	}

	var rows []leaderboardRow
	err := r.db.Table("sys_users AS u").
		Select(`
			u.id,
			u.username,
			u.full_name,
			u.avatar_url,
			GREATEST(
				COUNT(DISTINCT CASE WHEN ulr.status = ? THEN ls.skill_id END),
				COUNT(DISTINCT CASE WHEN ulr.status = ? THEN ulr.lesson_id END)
			) AS skills_count,
			COUNT(DISTINCT CASE WHEN ulr.status = ? THEN ulr.lesson_id END) AS completed_lessons,
			COUNT(DISTINCT uce.course_id) AS enrolled_courses,
			MAX(COALESCE(ulr.finished_at, uce.last_active_at, u.created_at)) AS last_active_at
		`, course.LessonRecordStatusCompleted, course.LessonRecordStatusCompleted, course.LessonRecordStatusCompleted).
		Joins("LEFT JOIN user_lesson_records AS ulr ON ulr.user_id = u.id").
		Joins("LEFT JOIN lesson_skills AS ls ON ls.lesson_id = ulr.lesson_id").
		Joins("LEFT JOIN user_course_enrollments AS uce ON uce.user_id = u.id").
		Where("u.role_type = ? AND u.status = ?", RoleStudent, StatusActive).
		Group("u.id, u.username, u.full_name, u.avatar_url, u.created_at").
		Order("skills_count DESC, completed_lessons DESC, enrolled_courses DESC, last_active_at DESC, u.created_at DESC").
		Limit(limit).
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	items := make([]StudentLeaderboardItem, 0, len(rows))
	for i, row := range rows {
		displayName := strings.TrimSpace(row.FullName)
		if displayName == "" {
			displayName = strings.TrimSpace(row.Username)
		}
		items = append(items, StudentLeaderboardItem{
			ID:               row.ID,
			Rank:             i + 1,
			Username:         row.Username,
			DisplayName:      displayName,
			AvatarURL:        row.AvatarURL,
			SkillsCount:      row.SkillsCount,
			CompletedLessons: row.CompletedLessons,
			EnrolledCourses:  row.EnrolledCourses,
			LastActiveAt:     row.LastActiveAt,
		})
	}
	return items, nil
}
