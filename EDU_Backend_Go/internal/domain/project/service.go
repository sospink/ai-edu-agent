package project

import (
	"errors"
	"strings"

	"go.uber.org/zap"
	"gorm.io/gorm"

	apperrors "edu-platform/pkg/errors"
)

type Service struct {
	repo   *Repository
	logger *zap.Logger
}

func NewService(db *gorm.DB, logger *zap.Logger) *Service {
	return &Service{
		repo:   NewRepository(db),
		logger: logger,
	}
}

const retiredProjectTagName = "openclaw"

func (s *Service) List(page, pageSize int, keyword string, _ *int, difficulty *int, tagID *uint64) ([]ProjectDetail, int64, error) {
	publishedStatus := int(ProjectStatusPublished)
	return s.listByQuery(ListQuery{
		Page:       page,
		PageSize:   pageSize,
		Keyword:    strings.TrimSpace(keyword),
		Status:     &publishedStatus,
		Difficulty: difficulty,
		TagID:      tagID,
	})
}

func (s *Service) ListForTeacher(actorID uint64, roleType int, page, pageSize int, keyword string, status, difficulty *int, tagID *uint64) ([]ProjectDetail, int64, error) {
	var createdBy *uint64
	if roleType < 10 {
		createdBy = &actorID
	}
	return s.listByQuery(ListQuery{
		Page:       page,
		PageSize:   pageSize,
		Keyword:    strings.TrimSpace(keyword),
		Status:     status,
		Difficulty: difficulty,
		TagID:      tagID,
		CreatedBy:  createdBy,
	})
}

func (s *Service) listByQuery(query ListQuery) ([]ProjectDetail, int64, error) {
	projects, total, err := s.repo.ListProjects(ListQuery{
		Page:       query.Page,
		PageSize:   query.PageSize,
		Keyword:    query.Keyword,
		Status:     query.Status,
		Difficulty: query.Difficulty,
		TagID:      query.TagID,
		CreatedBy:  query.CreatedBy,
	})
	if err != nil {
		return nil, 0, err
	}

	projectIDs := make([]uint64, 0, len(projects))
	for _, project := range projects {
		projectIDs = append(projectIDs, project.ID)
	}

	projectTagRelations, err := s.repo.FindProjectTagsByProjectIDs(projectIDs)
	if err != nil {
		return nil, 0, err
	}
	tagMap, err := s.buildTagMap(projectTagRelations)
	if err != nil {
		return nil, 0, err
	}

	result := make([]ProjectDetail, 0, len(projects))
	for _, project := range projects {
		tags := tagMap[project.ID]
		if tags == nil {
			tags = make([]Tag, 0)
		}
		result = append(result, ProjectDetail{
			Project: project,
			Tags:    tags,
			Units:   make([]ProjectUnit, 0),
		})
	}
	return result, total, nil
}

func (s *Service) FindByIDForTeacher(actorID uint64, roleType int, id uint64) (*ProjectDetail, error) {
	project, err := s.FindProjectEntity(id)
	if err != nil {
		return nil, err
	}
	if err := ensureTeacherProjectReadable(actorID, roleType, project.CreatedBy); err != nil {
		return nil, err
	}
	return s.buildDetail(project)
}

func (s *Service) FindByID(id uint64) (*ProjectDetail, error) {
	project, err := s.repo.FindProjectByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("项目不存在")
		}
		return nil, err
	}
	return s.buildDetail(project)
}

func (s *Service) FindBySlug(slug string) (*ProjectDetail, error) {
	project, err := s.repo.FindProjectBySlug(strings.TrimSpace(slug))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("项目不存在")
		}
		return nil, err
	}
	return s.buildDetail(project)
}

func (s *Service) FindPublishedByID(id uint64) (*ProjectDetail, error) {
	detail, err := s.FindByID(id)
	if err != nil {
		return nil, err
	}
	if detail.Status != ProjectStatusPublished {
		return nil, apperrors.NotFound("项目不存在或尚未发布")
	}
	return detail, nil
}

func (s *Service) FindPublishedBySlug(slug string) (*ProjectDetail, error) {
	detail, err := s.FindBySlug(slug)
	if err != nil {
		return nil, err
	}
	if detail.Status != ProjectStatusPublished {
		return nil, apperrors.NotFound("项目不存在或尚未发布")
	}
	return detail, nil
}

func (s *Service) GetUnits(projectID uint64) ([]ProjectUnit, error) {
	if _, err := s.repo.FindProjectByID(projectID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("项目不存在")
		}
		return nil, err
	}
	return s.repo.FindProjectUnits(projectID)
}

func (s *Service) GetPublishedUnits(projectID uint64) ([]ProjectUnit, error) {
	if _, err := s.FindPublishedByID(projectID); err != nil {
		return nil, err
	}
	return s.repo.FindProjectUnits(projectID)
}

func (s *Service) GetUnitsForTeacher(actorID uint64, roleType int, projectID uint64) ([]ProjectUnit, error) {
	project, err := s.FindProjectEntity(projectID)
	if err != nil {
		return nil, err
	}
	if err := ensureTeacherProjectReadable(actorID, roleType, project.CreatedBy); err != nil {
		return nil, err
	}
	return s.repo.FindProjectUnits(projectID)
}

func (s *Service) GetAllTags() ([]Tag, error) {
	tags, err := s.repo.FindAllTags()
	if err != nil {
		return nil, err
	}
	result := make([]Tag, 0, len(tags))
	for _, tag := range tags {
		if !IsRetiredProjectTag(tag.Name) {
			result = append(result, tag)
		}
	}
	return result, nil
}

func (s *Service) CreateTag(name, styleColor string) (*Tag, error) {
	if strings.TrimSpace(name) == "" {
		return nil, apperrors.BadRequest("标签名称不能为空")
	}
	if IsRetiredProjectTag(name) {
		return nil, apperrors.BadRequest("该历史项目标签已下架")
	}
	if _, err := s.repo.FindTagByName(strings.TrimSpace(name)); err == nil {
		return nil, apperrors.BadRequest("标签已存在")
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if strings.TrimSpace(styleColor) == "" {
		styleColor = "#3B82F6"
	}
	tag := &Tag{Name: strings.TrimSpace(name), StyleColor: strings.TrimSpace(styleColor)}
	if err := s.repo.CreateTag(tag); err != nil {
		return nil, err
	}
	return tag, nil
}

func (s *Service) UpdateTag(id uint64, name, styleColor *string) (*Tag, error) {
	tag, err := s.repo.FindTagByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("标签不存在")
		}
		return nil, err
	}
	if IsRetiredProjectTag(tag.Name) {
		return nil, apperrors.BadRequest("历史项目标签只保留审计，不能修改")
	}
	if name != nil && IsRetiredProjectTag(*name) {
		return nil, apperrors.BadRequest("该历史项目标签已下架")
	}
	if name != nil && strings.TrimSpace(*name) != "" {
		tag.Name = strings.TrimSpace(*name)
	}
	if styleColor != nil && strings.TrimSpace(*styleColor) != "" {
		tag.StyleColor = strings.TrimSpace(*styleColor)
	}
	if err := s.repo.SaveTag(tag); err != nil {
		return nil, err
	}
	return tag, nil
}

func (s *Service) DeleteTag(id uint64) error {
	tag, err := s.repo.FindTagByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apperrors.NotFound("标签不存在")
		}
		return err
	}
	if IsRetiredProjectTag(tag.Name) {
		return apperrors.BadRequest("历史项目标签只保留审计，不能删除")
	}
	if err := s.repo.DeleteProjectTagsByTagID(id); err != nil {
		return err
	}
	return s.repo.DeleteTag(id)
}

type CreateProjectParams struct {
	Title         string
	Slug          string
	Subtitle      string
	CoverURL      string
	Difficulty    int
	Status        ProjectStatus
	Description   string
	LearningGoals []string
	Prerequisites []string
	TagIDs        []uint64
	CreatedBy     uint64
	EnvImage      string
	IDEImage      string
	LabTemplateID uint64
}

type UpdateProjectParams struct {
	Title         *string
	Slug          *string
	Subtitle      *string
	CoverURL      *string
	Difficulty    *int
	Status        *ProjectStatus
	Description   *string
	LearningGoals *[]string
	Prerequisites *[]string
	TagIDs        *[]uint64
	EnvImage      *string
	IDEImage      *string
	LabTemplateID *uint64
}

func (s *Service) CreateProject(params CreateProjectParams) (*Project, error) {
	if strings.TrimSpace(params.Title) == "" || strings.TrimSpace(params.Slug) == "" {
		return nil, apperrors.BadRequest("项目名称和 Slug 不能为空")
	}
	if _, err := s.repo.FindProjectBySlug(strings.TrimSpace(params.Slug)); err == nil {
		return nil, apperrors.BadRequest("Slug 已存在")
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if _, err := s.validateProjectTagIDs(params.TagIDs); err != nil {
		return nil, err
	}
	project := &Project{
		Title:         strings.TrimSpace(params.Title),
		Slug:          strings.TrimSpace(params.Slug),
		Subtitle:      strings.TrimSpace(params.Subtitle),
		CoverURL:      strings.TrimSpace(params.CoverURL),
		Difficulty:    params.Difficulty,
		Status:        params.Status,
		Description:   params.Description,
		LearningGoals: params.LearningGoals,
		Prerequisites: params.Prerequisites,
		CreatedBy:     params.CreatedBy,
		EnvImage:      strings.TrimSpace(params.EnvImage),
		IDEImage:      strings.TrimSpace(params.IDEImage),
		LabTemplateID: params.LabTemplateID,
	}
	if err := s.repo.CreateProject(project); err != nil {
		return nil, err
	}
	if len(params.TagIDs) > 0 {
		if err := s.replaceProjectTags(project.ID, params.TagIDs); err != nil {
			return nil, err
		}
	}
	return project, nil
}

func (s *Service) UpdateProject(id uint64, params UpdateProjectParams) (*Project, error) {
	project, err := s.repo.FindProjectByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("项目不存在")
		}
		return nil, err
	}
	retired, err := s.projectHasRetiredTag(id)
	if err != nil {
		return nil, err
	}
	if retired {
		return nil, apperrors.BadRequest("历史项目已下架，不能修改")
	}
	if params.Slug != nil && strings.TrimSpace(*params.Slug) != "" && strings.TrimSpace(*params.Slug) != project.Slug {
		if _, slugErr := s.repo.FindProjectBySlug(strings.TrimSpace(*params.Slug)); slugErr == nil {
			return nil, apperrors.BadRequest("Slug 已存在")
		} else if !errors.Is(slugErr, gorm.ErrRecordNotFound) {
			return nil, slugErr
		}
	}
	if params.TagIDs != nil {
		if _, err := s.validateProjectTagIDs(*params.TagIDs); err != nil {
			return nil, err
		}
	}
	if params.Title != nil {
		project.Title = strings.TrimSpace(*params.Title)
	}
	if params.Slug != nil && strings.TrimSpace(*params.Slug) != "" {
		project.Slug = strings.TrimSpace(*params.Slug)
	}
	if params.Subtitle != nil {
		project.Subtitle = strings.TrimSpace(*params.Subtitle)
	}
	if params.CoverURL != nil {
		project.CoverURL = strings.TrimSpace(*params.CoverURL)
	}
	if params.Difficulty != nil {
		project.Difficulty = *params.Difficulty
	}
	if params.Status != nil {
		project.Status = *params.Status
	}
	if params.Description != nil {
		project.Description = *params.Description
	}
	if params.LearningGoals != nil {
		project.LearningGoals = *params.LearningGoals
	}
	if params.Prerequisites != nil {
		project.Prerequisites = *params.Prerequisites
	}
	if params.EnvImage != nil {
		project.EnvImage = strings.TrimSpace(*params.EnvImage)
	}
	if params.IDEImage != nil {
		project.IDEImage = strings.TrimSpace(*params.IDEImage)
	}
	if params.LabTemplateID != nil {
		project.LabTemplateID = *params.LabTemplateID
	}
	if err := s.repo.SaveProject(project); err != nil {
		return nil, err
	}
	if params.TagIDs != nil {
		if err := s.replaceProjectTags(project.ID, *params.TagIDs); err != nil {
			return nil, err
		}
	}
	return project, nil
}

func (s *Service) DeleteProject(id uint64) error {
	if _, err := s.repo.FindProjectByID(id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apperrors.NotFound("项目不存在")
		}
		return err
	}
	retired, err := s.projectHasRetiredTag(id)
	if err != nil {
		return err
	}
	if retired {
		return apperrors.BadRequest("历史项目只保留审计，不能删除")
	}
	if err := s.repo.DeleteUnitsByProjectID(id); err != nil {
		return err
	}
	return s.repo.DeleteProject(id)
}

func (s *Service) FindProjectEntity(id uint64) (*Project, error) {
	project, err := s.repo.FindProjectByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("项目不存在")
		}
		return nil, err
	}
	return project, nil
}

func (s *Service) FindProjectEntityByUnitID(unitID uint64) (*Project, error) {
	project, err := s.repo.FindProjectByUnitID(unitID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("项目不存在")
		}
		return nil, err
	}
	return project, nil
}

func (s *Service) UpdateProjectStatus(id uint64, status ProjectStatus) (*Project, error) {
	return s.UpdateProject(id, UpdateProjectParams{Status: &status})
}

type CreateUnitParams struct {
	ProjectID   uint64
	Title       string
	Description string
	Type        int
	ModeGroup   int
	EnvID       string
	TimeLimit   int
	Points      int
	SortOrder   int
	IsHidden    int
}

type UpdateUnitParams struct {
	Title       *string
	Description *string
	Type        *int
	ModeGroup   *int
	EnvID       *string
	TimeLimit   *int
	Points      *int
	SortOrder   *int
	IsHidden    *int
}

func (s *Service) CreateUnit(params CreateUnitParams) (*ProjectUnit, error) {
	if strings.TrimSpace(params.Title) == "" {
		return nil, apperrors.BadRequest("单元标题不能为空")
	}
	if _, err := s.repo.FindProjectByID(params.ProjectID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("项目不存在")
		}
		return nil, err
	}
	unit := &ProjectUnit{
		ProjectID:   params.ProjectID,
		Title:       strings.TrimSpace(params.Title),
		Description: strings.TrimSpace(params.Description),
		Type:        params.Type,
		ModeGroup:   params.ModeGroup,
		EnvID:       strings.TrimSpace(params.EnvID),
		TimeLimit:   params.TimeLimit,
		Points:      params.Points,
		SortOrder:   params.SortOrder,
		IsHidden:    params.IsHidden,
	}
	if err := s.repo.CreateUnit(unit); err != nil {
		return nil, err
	}
	return unit, nil
}

func (s *Service) UpdateUnit(id uint64, params UpdateUnitParams) (*ProjectUnit, error) {
	unit, err := s.repo.FindUnitByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("单元不存在")
		}
		return nil, err
	}
	if params.Title != nil {
		unit.Title = strings.TrimSpace(*params.Title)
	}
	if params.Description != nil {
		unit.Description = strings.TrimSpace(*params.Description)
	}
	if params.Type != nil {
		unit.Type = *params.Type
	}
	if params.ModeGroup != nil {
		unit.ModeGroup = *params.ModeGroup
	}
	if params.EnvID != nil {
		unit.EnvID = strings.TrimSpace(*params.EnvID)
	}
	if params.TimeLimit != nil {
		unit.TimeLimit = *params.TimeLimit
	}
	if params.Points != nil {
		unit.Points = *params.Points
	}
	if params.SortOrder != nil {
		unit.SortOrder = *params.SortOrder
	}
	if params.IsHidden != nil {
		unit.IsHidden = *params.IsHidden
	}
	if err := s.repo.SaveUnit(unit); err != nil {
		return nil, err
	}
	return unit, nil
}

func (s *Service) DeleteUnit(id uint64) error {
	if _, err := s.repo.FindUnitByID(id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apperrors.NotFound("单元不存在")
		}
		return err
	}
	return s.repo.DeleteUnit(id)
}

func (s *Service) ReorderUnits(projectID uint64, orders []struct {
	ID        uint64
	SortOrder int
}) ([]ProjectUnit, error) {
	for _, item := range orders {
		sortOrder := item.SortOrder
		if _, err := s.UpdateUnit(item.ID, UpdateUnitParams{SortOrder: &sortOrder}); err != nil {
			return nil, err
		}
	}
	return s.GetUnits(projectID)
}

func (s *Service) buildDetail(project *Project) (*ProjectDetail, error) {
	units, err := s.repo.FindProjectUnits(project.ID)
	if err != nil {
		return nil, err
	}
	projectTags, err := s.repo.FindProjectTags(project.ID)
	if err != nil {
		return nil, err
	}
	tagMap, err := s.buildTagMap(projectTags)
	if err != nil {
		return nil, err
	}
	tags := nonNilTags(tagMap[project.ID])
	return &ProjectDetail{
		Project: *project,
		Tags:    tags,
		Units:   nonNilUnits(units),
	}, nil
}

func ensureTeacherProjectReadable(actorID uint64, roleType int, creatorID uint64) error {
	if roleType >= 10 || creatorID == actorID {
		return nil
	}
	return apperrors.Forbidden("无权查看该项目")
}

func (s *Service) buildTagMap(relations []ProjectTag) (map[uint64][]Tag, error) {
	result := make(map[uint64][]Tag)
	if len(relations) == 0 {
		return result, nil
	}

	tagIDs := make([]uint64, 0, len(relations))
	seen := make(map[uint64]struct{})
	for _, relation := range relations {
		if _, ok := seen[relation.TagID]; ok {
			continue
		}
		seen[relation.TagID] = struct{}{}
		tagIDs = append(tagIDs, relation.TagID)
	}

	tags, err := s.repo.FindTagsByIDs(tagIDs)
	if err != nil {
		return nil, err
	}
	tagsByID := make(map[uint64]Tag, len(tags))
	for _, tag := range tags {
		tagsByID[tag.ID] = tag
	}

	for _, relation := range relations {
		tag, ok := tagsByID[relation.TagID]
		if !ok {
			continue
		}
		result[relation.ProjectID] = append(result[relation.ProjectID], tag)
	}
	return result, nil
}

func (s *Service) replaceProjectTags(projectID uint64, tagIDs []uint64) error {
	uniqueTagIDs, err := s.validateProjectTagIDs(tagIDs)
	if err != nil {
		return err
	}
	return s.repo.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("project_id = ?", projectID).Delete(&ProjectTag{}).Error; err != nil {
			return err
		}
		if len(uniqueTagIDs) == 0 {
			return nil
		}
		relations := make([]ProjectTag, 0, len(uniqueTagIDs))
		for _, tagID := range uniqueTagIDs {
			relations = append(relations, ProjectTag{ProjectID: projectID, TagID: tagID})
		}
		return tx.Create(&relations).Error
	})
}

func (s *Service) validateProjectTagIDs(tagIDs []uint64) ([]uint64, error) {
	uniqueTagIDs := make([]uint64, 0, len(tagIDs))
	seen := make(map[uint64]struct{}, len(tagIDs))
	for _, tagID := range tagIDs {
		if tagID == 0 {
			return nil, apperrors.BadRequest("项目标签不存在")
		}
		if _, exists := seen[tagID]; exists {
			continue
		}
		seen[tagID] = struct{}{}
		uniqueTagIDs = append(uniqueTagIDs, tagID)
	}
	if len(uniqueTagIDs) > 0 {
		tags, err := s.repo.FindTagsByIDs(uniqueTagIDs)
		if err != nil {
			return nil, err
		}
		if len(tags) != len(uniqueTagIDs) {
			return nil, apperrors.BadRequest("项目标签不存在")
		}
		for _, tag := range tags {
			if IsRetiredProjectTag(tag.Name) {
				return nil, apperrors.BadRequest("该历史项目标签已下架")
			}
		}
	}
	return uniqueTagIDs, nil
}

func (s *Service) projectHasRetiredTag(projectID uint64) (bool, error) {
	relations, err := s.repo.FindProjectTagsByProjectIDs([]uint64{projectID})
	if err != nil {
		return false, err
	}
	tagMap, err := s.buildTagMap(relations)
	if err != nil {
		return false, err
	}
	for _, tag := range tagMap[projectID] {
		if IsRetiredProjectTag(tag.Name) {
			return true, nil
		}
	}
	return false, nil
}

func IsRetiredProjectTag(name string) bool {
	normalized := strings.ToLower(strings.Join(strings.Fields(name), ""))
	normalized = strings.NewReplacer("-", "", "_", "").Replace(normalized)
	return normalized == retiredProjectTagName
}

func nonNilTags(tags []Tag) []Tag {
	if tags == nil {
		return make([]Tag, 0)
	}
	return tags
}

func nonNilUnits(units []ProjectUnit) []ProjectUnit {
	if units == nil {
		return make([]ProjectUnit, 0)
	}
	return units
}
