package project

import (
	"context"

	"edu-platform/pkg/i18n"
)

const translationStatusPublished = 1

func (s *Service) ListLocalized(ctx context.Context, page, pageSize int, keyword string, status, difficulty *int, tagID *uint64) ([]ProjectDetail, int64, error) {
	items, total, err := s.List(page, pageSize, keyword, status, difficulty, tagID)
	if err != nil {
		return nil, 0, err
	}
	s.localizeProjectDetails(ctx, items)
	return items, total, nil
}

func (s *Service) ListForTeacherLocalized(ctx context.Context, actorID uint64, roleType int, page, pageSize int, keyword string, status, difficulty *int, tagID *uint64) ([]ProjectDetail, int64, error) {
	items, total, err := s.ListForTeacher(actorID, roleType, page, pageSize, keyword, status, difficulty, tagID)
	if err != nil {
		return nil, 0, err
	}
	s.localizeProjectDetails(ctx, items)
	return items, total, nil
}

func (s *Service) FindByIDLocalized(ctx context.Context, id uint64) (*ProjectDetail, error) {
	detail, err := s.FindByID(id)
	if err != nil {
		return nil, err
	}
	s.localizeProjectDetail(ctx, detail)
	return detail, nil
}

func (s *Service) FindBySlugLocalized(ctx context.Context, slug string) (*ProjectDetail, error) {
	detail, err := s.FindBySlug(slug)
	if err != nil {
		return nil, err
	}
	s.localizeProjectDetail(ctx, detail)
	return detail, nil
}

func (s *Service) FindByIDForTeacherLocalized(ctx context.Context, actorID uint64, roleType int, id uint64) (*ProjectDetail, error) {
	detail, err := s.FindByIDForTeacher(actorID, roleType, id)
	if err != nil {
		return nil, err
	}
	s.localizeProjectDetail(ctx, detail)
	return detail, nil
}

func (s *Service) GetUnitsLocalized(ctx context.Context, projectID uint64) ([]ProjectUnit, error) {
	units, err := s.GetUnits(projectID)
	if err != nil {
		return nil, err
	}
	return s.localizeUnits(ctx, units), nil
}

func (s *Service) GetUnitsForTeacherLocalized(ctx context.Context, actorID uint64, roleType int, projectID uint64) ([]ProjectUnit, error) {
	units, err := s.GetUnitsForTeacher(actorID, roleType, projectID)
	if err != nil {
		return nil, err
	}
	return s.localizeUnits(ctx, units), nil
}

func (s *Service) localizeProjectDetails(ctx context.Context, details []ProjectDetail) {
	projects := make([]Project, 0, len(details))
	units := make([]ProjectUnit, 0)
	for _, item := range details {
		projects = append(projects, item.Project)
		units = append(units, item.Units...)
	}
	projects = s.localizeProjects(ctx, projects)
	units = s.localizeUnits(ctx, units)
	unitByID := make(map[uint64]ProjectUnit, len(units))
	for _, unit := range units {
		unitByID[unit.ID] = unit
	}
	for idx := range details {
		details[idx].Project = projects[idx]
		for unitIdx := range details[idx].Units {
			if localized, ok := unitByID[details[idx].Units[unitIdx].ID]; ok {
				details[idx].Units[unitIdx] = localized
			}
		}
	}
}

func (s *Service) localizeProjectDetail(ctx context.Context, detail *ProjectDetail) {
	if detail == nil {
		return
	}
	items := []ProjectDetail{*detail}
	s.localizeProjectDetails(ctx, items)
	*detail = items[0]
}

func (s *Service) localizeProjects(ctx context.Context, projects []Project) []Project {
	locale := i18n.LocaleFromContext(ctx)
	ids := make([]uint64, 0, len(projects))
	for _, item := range projects {
		ids = append(ids, item.ID)
	}
	current, fallback := s.loadProjectTranslations(ctx, ids, locale)
	for idx := range projects {
		if tr, missing, ok := pickProjectTranslation(projects[idx].ID, locale, current, fallback); ok {
			projects[idx].Title = tr.Title
			projects[idx].Subtitle = tr.Subtitle
			projects[idx].Description = tr.Description
			projects[idx].LearningGoals = tr.LearningGoals
			projects[idx].Prerequisites = tr.Prerequisites
			projects[idx].TranslationMissing = missing
		} else if locale != i18n.LocaleEnUS {
			projects[idx].TranslationMissing = true
		}
		projects[idx].Locale = locale
	}
	return projects
}

func (s *Service) localizeUnits(ctx context.Context, units []ProjectUnit) []ProjectUnit {
	locale := i18n.LocaleFromContext(ctx)
	ids := make([]uint64, 0, len(units))
	for _, item := range units {
		ids = append(ids, item.ID)
	}
	current, fallback := s.loadUnitTranslations(ctx, ids, locale)
	for idx := range units {
		if tr, missing, ok := pickUnitTranslation(units[idx].ID, locale, current, fallback); ok {
			units[idx].Title = tr.Title
			units[idx].Description = tr.Description
			units[idx].TranslationMissing = missing
		} else if locale != i18n.LocaleEnUS {
			units[idx].TranslationMissing = true
		}
		units[idx].Locale = locale
	}
	return units
}

func (s *Service) loadProjectTranslations(ctx context.Context, ids []uint64, locale string) (map[uint64]ProjectTranslation, map[uint64]ProjectTranslation) {
	current := make(map[uint64]ProjectTranslation)
	fallback := make(map[uint64]ProjectTranslation)
	if len(ids) == 0 {
		return current, fallback
	}
	var rows []ProjectTranslation
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

func (s *Service) loadUnitTranslations(ctx context.Context, ids []uint64, locale string) (map[uint64]ProjectUnitTranslation, map[uint64]ProjectUnitTranslation) {
	current := make(map[uint64]ProjectUnitTranslation)
	fallback := make(map[uint64]ProjectUnitTranslation)
	if len(ids) == 0 {
		return current, fallback
	}
	var rows []ProjectUnitTranslation
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

func pickProjectTranslation(id uint64, locale string, current, fallback map[uint64]ProjectTranslation) (ProjectTranslation, bool, bool) {
	if tr, ok := current[id]; ok {
		return tr, false, true
	}
	if locale != i18n.LocaleEnUS {
		if tr, ok := fallback[id]; ok {
			return tr, true, true
		}
	}
	return ProjectTranslation{}, false, false
}

func pickUnitTranslation(id uint64, locale string, current, fallback map[uint64]ProjectUnitTranslation) (ProjectUnitTranslation, bool, bool) {
	if tr, ok := current[id]; ok {
		return tr, false, true
	}
	if locale != i18n.LocaleEnUS {
		if tr, ok := fallback[id]; ok {
			return tr, true, true
		}
	}
	return ProjectUnitTranslation{}, false, false
}
