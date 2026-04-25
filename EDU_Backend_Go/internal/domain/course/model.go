package course

import "time"

type CourseStatus int

const (
	CourseStatusDraft     CourseStatus = 0
	CourseStatusPublished CourseStatus = 1
	CourseStatusArchived  CourseStatus = 2
)

type LessonRecordStatus int

const (
	LessonRecordStatusNotStarted LessonRecordStatus = 0
	LessonRecordStatusInProgress LessonRecordStatus = 1
	LessonRecordStatusCompleted  LessonRecordStatus = 2
)

type EnrollmentStatus int

const (
	EnrollmentStatusInProgress EnrollmentStatus = 1
	EnrollmentStatusCompleted  EnrollmentStatus = 2
)

type Course struct {
	ID             uint64       `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	Title          string       `gorm:"column:title;size:128;not null;default:''" json:"title"`
	Slug           string       `gorm:"column:slug;size:128;unique;not null;default:''" json:"slug"`
	Description    string       `gorm:"column:description;size:512;not null;default:''" json:"description"`
	IconURL        string       `gorm:"column:icon_url;size:512;not null;default:''" json:"iconUrl"`
	CoverColor     string       `gorm:"column:cover_color;size:32;not null;default:''" json:"coverColor"`
	Difficulty     int          `gorm:"column:difficulty;not null;default:1" json:"difficulty"`
	TotalLessons   int          `gorm:"column:total_lessons;not null;default:0" json:"totalLessons"`
	TotalSkills    int          `gorm:"column:total_skills;not null;default:0" json:"totalSkills"`
	EstimatedHours int          `gorm:"column:estimated_hours;not null;default:0" json:"estimatedHours"`
	Status         CourseStatus `gorm:"column:status;not null;default:0" json:"status"`
	EnvImage       string       `gorm:"column:env_image;size:256;not null;default:''" json:"envImage"`
	IDEImage       string       `gorm:"column:ide_image;size:256;not null;default:''" json:"ideImage"`
	LabTemplateID  uint64       `gorm:"column:lab_template_id;not null;default:0" json:"labTemplateId"`
	CreatorID      uint64       `gorm:"column:creator_id;not null;default:0" json:"creatorId"`
	CreatedAt      time.Time    `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt      time.Time    `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (Course) TableName() string {
	return "courses"
}

type CourseStage struct {
	ID          uint64    `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	CourseID    uint64    `gorm:"column:course_id;not null;default:0" json:"courseId"`
	Title       string    `gorm:"column:title;size:128;not null;default:''" json:"title"`
	Description string    `gorm:"column:description;size:512;not null;default:''" json:"description"`
	SortOrder   int       `gorm:"column:sort_order;not null;default:0" json:"sortOrder"`
	LevelLabel  string    `gorm:"column:level_label;size:32;not null;default:''" json:"levelLabel"`
	CreatedAt   time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
}

func (CourseStage) TableName() string {
	return "course_stages"
}

type CourseLesson struct {
	ID              uint64    `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	CourseID        uint64    `gorm:"column:course_id;not null;default:0" json:"courseId"`
	StageID         uint64    `gorm:"column:stage_id;not null;default:0" json:"stageId"`
	Title           string    `gorm:"column:title;size:128;not null;default:''" json:"title"`
	Type            int       `gorm:"column:type;not null;default:1" json:"type"`
	DurationMinutes int       `gorm:"column:duration_minutes;not null;default:15" json:"durationMinutes"`
	LabIdentifier   string    `gorm:"column:lab_identifier;size:64;not null;default:''" json:"labIdentifier"`
	Points          int       `gorm:"column:points;not null;default:0" json:"points"`
	SortOrder       int       `gorm:"column:sort_order;not null;default:0" json:"sortOrder"`
	CreatedAt       time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
}

func (CourseLesson) TableName() string {
	return "course_lessons"
}

type Skill struct {
	ID        uint64    `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	Name      string    `gorm:"column:name;size:64;not null;default:''" json:"name"`
	Category  string    `gorm:"column:category;size:32;not null;default:'General'" json:"category"`
	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
}

func (Skill) TableName() string {
	return "skills"
}

type LessonSkill struct {
	ID       uint64 `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	LessonID uint64 `gorm:"column:lesson_id;not null;default:0" json:"lessonId"`
	SkillID  uint64 `gorm:"column:skill_id;not null;default:0" json:"skillId"`
}

func (LessonSkill) TableName() string {
	return "lesson_skills"
}

type LessonMaterial struct {
	ID        uint64    `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	LessonID  uint64    `gorm:"column:lesson_id;not null;default:0" json:"lessonId"`
	Title     string    `gorm:"column:title;size:128;not null;default:''" json:"title"`
	Type      int       `gorm:"column:type;not null;default:1" json:"type"`
	FileURL   string    `gorm:"column:file_url;size:512;not null;default:''" json:"fileUrl"`
	FileName  string    `gorm:"column:file_name;size:256;not null;default:''" json:"fileName"`
	FileSize  int64     `gorm:"column:file_size;not null;default:0" json:"fileSize"`
	SortOrder int       `gorm:"column:sort_order;not null;default:0" json:"sortOrder"`
	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (LessonMaterial) TableName() string {
	return "lesson_materials"
}

type UserCourseEnrollment struct {
	ID                    uint64           `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	UserID                uint64           `gorm:"column:user_id;not null;default:0" json:"userId"`
	CourseID              uint64           `gorm:"column:course_id;not null;default:0" json:"courseId"`
	Status                EnrollmentStatus `gorm:"column:status;not null;default:1" json:"status"`
	ProgressPercent       int              `gorm:"column:progress_percent;not null;default:0" json:"progressPercent"`
	CompletedLessonsCount int              `gorm:"column:completed_lessons_count;not null;default:0" json:"completedLessonsCount"`
	LastLessonID          uint64           `gorm:"column:last_lesson_id;not null;default:0" json:"lastLessonId"`
	LastActiveAt          time.Time        `gorm:"column:last_active_at" json:"lastActiveAt"`
	JoinedAt              time.Time        `gorm:"column:joined_at" json:"joinedAt"`
	CompletedAt           *time.Time       `gorm:"column:completed_at" json:"completedAt"`
}

func (UserCourseEnrollment) TableName() string {
	return "user_course_enrollments"
}

type UserLessonRecord struct {
	ID         uint64             `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	UserID     uint64             `gorm:"column:user_id;not null;default:0" json:"userId"`
	CourseID   uint64             `gorm:"column:course_id;not null;default:0" json:"courseId"`
	LessonID   uint64             `gorm:"column:lesson_id;not null;default:0" json:"lessonId"`
	Status     LessonRecordStatus `gorm:"column:status;not null;default:0" json:"status"`
	Score      int                `gorm:"column:score;not null;default:0" json:"score"`
	StartedAt  *time.Time         `gorm:"column:started_at" json:"startedAt"`
	FinishedAt *time.Time         `gorm:"column:finished_at" json:"finishedAt"`
}

func (UserLessonRecord) TableName() string {
	return "user_lesson_records"
}

type UserActivityLog struct {
	ID                uint64 `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	UserID            uint64 `gorm:"column:user_id;not null;default:0" json:"userId"`
	ActivityDate      string `gorm:"column:activity_date;type:date" json:"activityDate"`
	ContributionCount int    `gorm:"column:contribution_count;not null;default:1" json:"contributionCount"`
}

func (UserActivityLog) TableName() string {
	return "user_activity_logs"
}

type CourseLessonDetail struct {
	CourseLesson
	Skills []Skill `json:"skills,omitempty"`
}

type CourseStageDetail struct {
	CourseStage
	Lessons []CourseLessonDetail `json:"lessons,omitempty"`
}

type CourseDetail struct {
	Course
	Stages []CourseStageDetail `json:"stages"`
}

type AssignedCourse struct {
	Course
	UserProgress int `json:"userProgress"`
}

type EnrollmentWithCourse struct {
	UserCourseEnrollment
	Course *Course `json:"course"`
}

type ContinueLearningPayload struct {
	Enrollment *UserCourseEnrollment `json:"enrollment"`
	Course     *Course               `json:"course"`
	NextLesson *CourseLesson         `json:"nextLesson"`
}

type CompleteLessonPayload struct {
	Record   *UserLessonRecord `json:"record"`
	EarnedXP int               `json:"earnedXP"`
}
