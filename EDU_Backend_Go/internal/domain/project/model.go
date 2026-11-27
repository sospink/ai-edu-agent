package project

import "time"

type ProjectStatus int

const (
	ProjectStatusDraft     ProjectStatus = 0
	ProjectStatusPublished ProjectStatus = 1
	ProjectStatusArchived  ProjectStatus = 2
)

type Project struct {
	ID                 uint64        `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	Title              string        `gorm:"column:title;size:128;not null;default:''" json:"title"`
	Slug               string        `gorm:"column:slug;size:128;unique;not null;default:''" json:"slug"`
	Subtitle           string        `gorm:"column:subtitle;size:255;not null;default:''" json:"subtitle"`
	CoverURL           string        `gorm:"column:cover_url;size:512;not null;default:''" json:"coverUrl"`
	Difficulty         int           `gorm:"column:difficulty;not null;default:1" json:"difficulty"`
	Status             ProjectStatus `gorm:"column:status;not null;default:0" json:"status"`
	Description        string        `gorm:"column:description;type:mediumtext" json:"description"`
	LearningGoals      []string      `gorm:"column:learning_goals;serializer:json" json:"learningGoals"`
	Prerequisites      []string      `gorm:"column:prerequisites;serializer:json" json:"prerequisites"`
	LabsCount          int           `gorm:"column:labs_count;not null;default:0" json:"labsCount"`
	ChallengesCount    int           `gorm:"column:challenges_count;not null;default:0" json:"challengesCount"`
	StudentsCount      int           `gorm:"column:students_count;not null;default:0" json:"studentsCount"`
	EnvImage           string        `gorm:"column:env_image;size:256;not null;default:''" json:"envImage"`
	IDEImage           string        `gorm:"column:ide_image;size:256;not null;default:''" json:"ideImage"`
	LabTemplateID      uint64        `gorm:"column:lab_template_id;not null;default:0" json:"labTemplateId"`
	CreatedBy          uint64        `gorm:"column:created_by;not null;default:0" json:"createdBy"`
	CreatedAt          time.Time     `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt          time.Time     `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	DeletedAt          *time.Time    `gorm:"column:deleted_at" json:"deletedAt,omitempty"`
	Locale             string        `gorm:"-" json:"locale,omitempty"`
	TranslationMissing bool          `gorm:"-" json:"translationMissing,omitempty"`
}

func (Project) TableName() string {
	return "projects"
}

type ProjectUnit struct {
	ID                 uint64    `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	ProjectID          uint64    `gorm:"column:project_id;not null;default:0" json:"projectId"`
	Title              string    `gorm:"column:title;size:128;not null;default:''" json:"title"`
	Description        string    `gorm:"column:description;size:512;not null;default:''" json:"description"`
	Type               int       `gorm:"column:type;not null;default:1" json:"type"`
	ModeGroup          int       `gorm:"column:mode_group;not null;default:1" json:"modeGroup"`
	EnvID              string    `gorm:"column:env_id;size:64;not null;default:''" json:"envId"`
	TimeLimit          int       `gorm:"column:time_limit;not null;default:45" json:"timeLimit"`
	Points             int       `gorm:"column:points;not null;default:0" json:"points"`
	SortOrder          int       `gorm:"column:sort_order;not null;default:0" json:"sortOrder"`
	IsHidden           int       `gorm:"column:is_hidden;not null;default:0" json:"isHidden"`
	CreatedAt          time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt          time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	Locale             string    `gorm:"-" json:"locale,omitempty"`
	TranslationMissing bool      `gorm:"-" json:"translationMissing,omitempty"`
}

func (ProjectUnit) TableName() string {
	return "project_units"
}

type Tag struct {
	ID         uint64    `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	Name       string    `gorm:"column:name;size:32;not null;default:''" json:"name"`
	StyleColor string    `gorm:"column:style_color;size:16;not null;default:'#3B82F6'" json:"styleColor"`
	CreatedAt  time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
}

func (Tag) TableName() string {
	return "tags"
}

type ProjectTag struct {
	ID        uint64 `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	ProjectID uint64 `gorm:"column:project_id;not null;default:0" json:"projectId"`
	TagID     uint64 `gorm:"column:tag_id;not null;default:0" json:"tagId"`
}

func (ProjectTag) TableName() string {
	return "project_tags"
}

type ProjectDetail struct {
	Project
	DurationMinutes int           `json:"durationMinutes"`
	Tags            []Tag         `json:"tags"`
	Units           []ProjectUnit `json:"units"`
}

type ProjectTranslation struct {
	ID            uint64    `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	EntityID      uint64    `gorm:"column:entity_id;not null;uniqueIndex:uniq_project_translation_locale" json:"entityId"`
	Locale        string    `gorm:"column:locale;size:16;not null;uniqueIndex:uniq_project_translation_locale" json:"locale"`
	Title         string    `gorm:"column:title;size:128;not null;default:''" json:"title"`
	Subtitle      string    `gorm:"column:subtitle;size:255;not null;default:''" json:"subtitle"`
	Description   string    `gorm:"column:description;type:mediumtext" json:"description"`
	LearningGoals []string  `gorm:"column:learning_goals;serializer:json" json:"learningGoals"`
	Prerequisites []string  `gorm:"column:prerequisites;serializer:json" json:"prerequisites"`
	Status        int       `gorm:"column:status;not null;default:1" json:"status"`
	Version       int       `gorm:"column:version;not null;default:1" json:"version"`
	SourceHash    string    `gorm:"column:source_hash;size:64;not null;default:''" json:"sourceHash"`
	CreatedAt     time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt     time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (ProjectTranslation) TableName() string { return "project_translations" }

type ProjectUnitTranslation struct {
	ID          uint64    `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	EntityID    uint64    `gorm:"column:entity_id;not null;uniqueIndex:uniq_project_unit_translation_locale" json:"entityId"`
	Locale      string    `gorm:"column:locale;size:16;not null;uniqueIndex:uniq_project_unit_translation_locale" json:"locale"`
	Title       string    `gorm:"column:title;size:128;not null;default:''" json:"title"`
	Description string    `gorm:"column:description;size:512;not null;default:''" json:"description"`
	Status      int       `gorm:"column:status;not null;default:1" json:"status"`
	Version     int       `gorm:"column:version;not null;default:1" json:"version"`
	SourceHash  string    `gorm:"column:source_hash;size:64;not null;default:''" json:"sourceHash"`
	CreatedAt   time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (ProjectUnitTranslation) TableName() string { return "project_unit_translations" }

type ProgressStatus int

const (
	ProgressStatusNotStarted ProgressStatus = 0
	ProgressStatusInProgress ProgressStatus = 1
	ProgressStatusCompleted  ProgressStatus = 2
)

type UserProjectProgress struct {
	ID                 uint64         `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	UserID             uint64         `gorm:"column:user_id;not null;default:0" json:"userId"`
	ProjectID          uint64         `gorm:"column:project_id;not null;default:0" json:"projectId"`
	Status             ProgressStatus `gorm:"column:status;not null;default:0" json:"status"`
	CurrentUnitID      uint64         `gorm:"column:current_unit_id;not null;default:0" json:"currentUnitId"`
	FinishedUnitsCount int            `gorm:"column:finished_units_count;not null;default:0" json:"finishedUnitsCount"`
	ProgressPercent    int            `gorm:"column:progress_percent;not null;default:0" json:"progressPercent"`
	LastActiveAt       *time.Time     `gorm:"column:last_active_at" json:"lastActiveAt"`
	StartedAt          *time.Time     `gorm:"column:started_at" json:"startedAt"`
	CompletedAt        *time.Time     `gorm:"column:completed_at" json:"completedAt"`
}

func (UserProjectProgress) TableName() string {
	return "user_project_progress"
}
