package project

import "gorm.io/gorm"

type ListQuery struct {
	Page       int
	PageSize   int
	Keyword    string
	Status     *int
	Difficulty *int
	TagID      *uint64
	CreatedBy  *uint64
}

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) ListProjects(query ListQuery) ([]Project, int64, error) {
	db := r.db.Model(&Project{}).Where("deleted_at IS NULL")
	if query.Keyword != "" {
		like := "%" + query.Keyword + "%"
		db = db.Where("(title LIKE ? OR slug LIKE ? OR subtitle LIKE ?)", like, like, like)
	}
	if query.Status != nil {
		db = db.Where("status = ?", *query.Status)
	}
	if query.Difficulty != nil {
		db = db.Where("difficulty = ?", *query.Difficulty)
	}
	if query.CreatedBy != nil {
		db = db.Where("created_by = ?", *query.CreatedBy)
	}
	if query.TagID != nil {
		db = db.Joins("JOIN project_tags pt ON pt.project_id = projects.id").Where("pt.tag_id = ?", *query.TagID)
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var projects []Project
	err := db.Order("updated_at DESC").
		Offset((query.Page - 1) * query.PageSize).
		Limit(query.PageSize).
		Find(&projects).Error
	return projects, total, err
}

func (r *Repository) FindProjectByID(id uint64) (*Project, error) {
	var project Project
	if err := r.db.Where("id = ? AND deleted_at IS NULL", id).First(&project).Error; err != nil {
		return nil, err
	}
	return &project, nil
}

func (r *Repository) FindProjectBySlug(slug string) (*Project, error) {
	var project Project
	if err := r.db.Where("slug = ? AND deleted_at IS NULL", slug).First(&project).Error; err != nil {
		return nil, err
	}
	return &project, nil
}

func (r *Repository) FindProjectByUnitID(unitID uint64) (*Project, error) {
	unit, err := r.FindUnitByID(unitID)
	if err != nil {
		return nil, err
	}
	return r.FindProjectByID(unit.ProjectID)
}

func (r *Repository) CreateProject(project *Project) error {
	return r.db.Create(project).Error
}

func (r *Repository) SaveProject(project *Project) error {
	return r.db.Save(project).Error
}

func (r *Repository) DeleteProject(id uint64) error {
	return r.db.Model(&Project{}).Where("id = ?", id).Update("deleted_at", gorm.Expr("CURRENT_TIMESTAMP")).Error
}

func (r *Repository) FindProjectUnits(projectID uint64) ([]ProjectUnit, error) {
	var units []ProjectUnit
	err := r.db.Where("project_id = ?", projectID).Order("mode_group ASC, sort_order ASC").Find(&units).Error
	return units, err
}

func (r *Repository) FindUnitByID(unitID uint64) (*ProjectUnit, error) {
	var unit ProjectUnit
	if err := r.db.First(&unit, "id = ?", unitID).Error; err != nil {
		return nil, err
	}
	return &unit, nil
}

func (r *Repository) CreateUnit(unit *ProjectUnit) error {
	return r.db.Create(unit).Error
}

func (r *Repository) SaveUnit(unit *ProjectUnit) error {
	return r.db.Save(unit).Error
}

func (r *Repository) DeleteUnit(id uint64) error {
	return r.db.Delete(&ProjectUnit{}, "id = ?", id).Error
}

func (r *Repository) DeleteUnitsByProjectID(projectID uint64) error {
	return r.db.Where("project_id = ?", projectID).Delete(&ProjectUnit{}).Error
}

func (r *Repository) FindProjectTags(projectID uint64) ([]ProjectTag, error) {
	var tags []ProjectTag
	err := r.db.Where("project_id = ?", projectID).Find(&tags).Error
	return tags, err
}

func (r *Repository) FindProjectTagsByProjectIDs(projectIDs []uint64) ([]ProjectTag, error) {
	var tags []ProjectTag
	if len(projectIDs) == 0 {
		return tags, nil
	}
	err := r.db.Where("project_id IN ?", projectIDs).Find(&tags).Error
	return tags, err
}

func (r *Repository) FindTagsByIDs(tagIDs []uint64) ([]Tag, error) {
	var tags []Tag
	if len(tagIDs) == 0 {
		return tags, nil
	}
	err := r.db.Where("id IN ?", tagIDs).Order("name ASC").Find(&tags).Error
	return tags, err
}

func (r *Repository) FindAllTags() ([]Tag, error) {
	var tags []Tag
	err := r.db.Order("name ASC").Find(&tags).Error
	return tags, err
}

func (r *Repository) CreateTag(tag *Tag) error {
	return r.db.Create(tag).Error
}

func (r *Repository) FindTagByID(id uint64) (*Tag, error) {
	var tag Tag
	if err := r.db.First(&tag, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &tag, nil
}

func (r *Repository) FindTagByName(name string) (*Tag, error) {
	var tag Tag
	if err := r.db.First(&tag, "name = ?", name).Error; err != nil {
		return nil, err
	}
	return &tag, nil
}

func (r *Repository) SaveTag(tag *Tag) error {
	return r.db.Save(tag).Error
}

func (r *Repository) DeleteProjectTagsByTagID(tagID uint64) error {
	return r.db.Where("tag_id = ?", tagID).Delete(&ProjectTag{}).Error
}

func (r *Repository) DeleteTag(id uint64) error {
	return r.db.Delete(&Tag{}, "id = ?", id).Error
}
