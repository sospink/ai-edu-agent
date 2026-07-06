package agent

import (
	"context"
	"errors"
	"strings"

	"edu-platform/pkg/i18n"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const translationStatusPublished = 1

type AgentStepContentTranslationInput struct {
	ID             uint64         `json:"id"`
	Title          string         `json:"title"`
	Content        []ContentBlock `json:"content"`
	QuickQuestions []string       `json:"quickQuestions"`
}

type AgentManualContentTranslationInput struct {
	Title       string                             `json:"title"`
	Description string                             `json:"description"`
	Steps       []AgentStepContentTranslationInput `json:"steps"`
}

func (s *Service) SaveManualContentTranslation(ctx context.Context, manualID uint64, locale string, input AgentManualContentTranslationInput) (*AgentManual, error) {
	manual, err := s.FindManualByID(ctx, manualID)
	if err != nil {
		return nil, err
	}
	normalizedLocale := i18n.NormalizeLocale(locale)
	if err := s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "entity_id"}, {Name: "locale"}},
		DoUpdates: clause.AssignmentColumns([]string{"title", "description", "status", "version", "updated_at"}),
	}).Create(&AgentManualTranslation{
		EntityID:    manual.ID,
		Locale:      normalizedLocale,
		Title:       input.Title,
		Description: input.Description,
		Status:      translationStatusPublished,
		Version:     1,
	}).Error; err != nil {
		return nil, err
	}

	for _, item := range input.Steps {
		var step AgentStep
		if err := s.db.WithContext(ctx).Where("id = ? AND manual_id = ?", item.ID, manual.ID).First(&step).Error; err != nil {
			continue
		}
		if err := s.db.WithContext(ctx).Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "entity_id"}, {Name: "locale"}},
			DoUpdates: clause.AssignmentColumns([]string{"title", "content_json", "quick_questions_json", "status", "version", "updated_at"}),
		}).Create(&AgentStepTranslation{
			EntityID:       item.ID,
			Locale:         normalizedLocale,
			Title:          item.Title,
			Content:        sanitizeContentBlocks(item.Content),
			QuickQuestions: sanitizeQuickQuestions(item.QuickQuestions),
			Status:         translationStatusPublished,
			Version:        1,
		}).Error; err != nil {
			return nil, err
		}
	}

	return s.GetManualByID(i18n.WithLocale(ctx, normalizedLocale), manual.ID)
}

func (s *Service) ImportMarkdownForLocale(ctx context.Context, sourceType int, sourceID uint64, markdown string, creatorID uint64, locale string) (*AgentManual, error) {
	normalizedLocale := i18n.NormalizeLocale(locale)
	if normalizedLocale == i18n.LocaleEnUS {
		sourceCtx := i18n.WithLocale(ctx, i18n.LocaleEnUS)
		manual, err := s.ImportFromMarkdown(sourceCtx, sourceType, sourceID, markdown, creatorID)
		if err != nil {
			return nil, err
		}
		sourceManual, err := s.FindManualByID(ctx, manual.ID)
		if err != nil {
			return nil, err
		}
		if err := s.loadManualSteps(ctx, sourceManual); err != nil {
			return nil, err
		}
		localizedManual, err := s.SaveManualContentTranslation(ctx, manual.ID, normalizedLocale, manualTranslationInputFromManual(sourceManual))
		if err != nil {
			if isMissingAgentTranslationTableError(err) {
				return manual, nil
			}
			return nil, err
		}
		return localizedManual, nil
	}

	parsed, err := ParseMarkdown(markdown)
	if err != nil {
		return nil, err
	}
	manual, err := s.GetManualForAdmin(ctx, sourceType, sourceID)
	if err != nil {
		return nil, err
	}
	var steps []AgentStep
	if err := s.db.WithContext(ctx).
		Where("manual_id = ?", manual.ID).
		Order("step_order ASC").
		Find(&steps).Error; err != nil {
		return nil, err
	}
	if len(steps) == 0 {
		return nil, gorm.ErrRecordNotFound
	}

	input := AgentManualContentTranslationInput{
		Title:       defaultString(parsed.Title, manual.Title),
		Description: parsed.Description,
		Steps:       make([]AgentStepContentTranslationInput, 0, len(parsed.Steps)),
	}
	for idx, parsedStep := range parsed.Steps {
		if idx >= len(steps) {
			break
		}
		input.Steps = append(input.Steps, AgentStepContentTranslationInput{
			ID:             steps[idx].ID,
			Title:          parsedStep.Title,
			Content:        parsedStep.Content,
			QuickQuestions: parsedStep.QuickQuestions,
		})
	}
	if len(input.Steps) == 0 {
		return nil, errors.New("no matching manual steps")
	}
	return s.SaveManualContentTranslation(ctx, manual.ID, normalizedLocale, input)
}

func isMissingAgentTranslationTableError(err error) bool {
	if err == nil {
		return false
	}
	message := err.Error()
	return strings.Contains(message, "agent_manual_translations") || strings.Contains(message, "agent_step_translations")
}

func manualTranslationInputFromManual(manual *AgentManual) AgentManualContentTranslationInput {
	input := AgentManualContentTranslationInput{
		Title:       manual.Title,
		Description: manual.Description,
		Steps:       make([]AgentStepContentTranslationInput, 0, len(manual.Steps)),
	}
	for _, step := range manual.Steps {
		input.Steps = append(input.Steps, AgentStepContentTranslationInput{
			ID:             step.ID,
			Title:          step.Title,
			Content:        step.Content,
			QuickQuestions: step.QuickQuestions,
		})
	}
	return input
}

func (s *Service) localizeManual(ctx context.Context, manual *AgentManual) {
	if manual == nil {
		return
	}
	locale := i18n.LocaleFromContext(ctx)
	current, fallback := s.loadManualTranslations(ctx, []uint64{manual.ID}, locale)
	if tr, missing, ok := pickManualTranslation(manual.ID, locale, current, fallback); ok {
		manual.Title = tr.Title
		manual.Description = tr.Description
		manual.TranslationMissing = missing
	} else if locale != i18n.LocaleEnUS {
		manual.TranslationMissing = true
	}
	manual.Locale = locale
	manual.Steps = s.localizeSteps(ctx, manual.Steps)
}

func (s *Service) localizeSteps(ctx context.Context, steps []AgentStep) []AgentStep {
	locale := i18n.LocaleFromContext(ctx)
	ids := make([]uint64, 0, len(steps))
	for _, item := range steps {
		ids = append(ids, item.ID)
	}
	current, fallback := s.loadStepTranslations(ctx, ids, locale)
	for idx := range steps {
		if tr, missing, ok := pickStepTranslation(steps[idx].ID, locale, current, fallback); ok {
			steps[idx].Title = tr.Title
			steps[idx].Content = tr.Content
			steps[idx].QuickQuestions = tr.QuickQuestions
			steps[idx].TranslationMissing = missing
		} else if locale != i18n.LocaleEnUS {
			steps[idx].TranslationMissing = true
		}
		steps[idx].Locale = locale
	}
	return steps
}

func (s *Service) loadManualTranslations(ctx context.Context, ids []uint64, locale string) (map[uint64]AgentManualTranslation, map[uint64]AgentManualTranslation) {
	current := make(map[uint64]AgentManualTranslation)
	fallback := make(map[uint64]AgentManualTranslation)
	if len(ids) == 0 {
		return current, fallback
	}
	var rows []AgentManualTranslation
	_ = s.db.WithContext(ctx).Where("entity_id IN ? AND locale = ? AND status = ?", ids, locale, translationStatusPublished).Find(&rows).Error
	for _, row := range rows {
		current[row.EntityID] = row
	}
	if locale != i18n.LocaleEnUS {
		rows = nil
		_ = s.db.WithContext(ctx).Where("entity_id IN ? AND locale = ? AND status = ?", ids, i18n.LocaleEnUS, translationStatusPublished).Find(&rows).Error
		for _, row := range rows {
			fallback[row.EntityID] = row
		}
	}
	return current, fallback
}

func (s *Service) loadStepTranslations(ctx context.Context, ids []uint64, locale string) (map[uint64]AgentStepTranslation, map[uint64]AgentStepTranslation) {
	current := make(map[uint64]AgentStepTranslation)
	fallback := make(map[uint64]AgentStepTranslation)
	if len(ids) == 0 {
		return current, fallback
	}
	var rows []AgentStepTranslation
	_ = s.db.WithContext(ctx).Where("entity_id IN ? AND locale = ? AND status = ?", ids, locale, translationStatusPublished).Find(&rows).Error
	for _, row := range rows {
		current[row.EntityID] = row
	}
	if locale != i18n.LocaleEnUS {
		rows = nil
		_ = s.db.WithContext(ctx).Where("entity_id IN ? AND locale = ? AND status = ?", ids, i18n.LocaleEnUS, translationStatusPublished).Find(&rows).Error
		for _, row := range rows {
			fallback[row.EntityID] = row
		}
	}
	return current, fallback
}

func pickManualTranslation(id uint64, locale string, current, fallback map[uint64]AgentManualTranslation) (AgentManualTranslation, bool, bool) {
	if tr, ok := current[id]; ok {
		return tr, false, true
	}
	if locale != i18n.LocaleEnUS {
		if tr, ok := fallback[id]; ok {
			return tr, true, true
		}
	}
	return AgentManualTranslation{}, false, false
}

func pickStepTranslation(id uint64, locale string, current, fallback map[uint64]AgentStepTranslation) (AgentStepTranslation, bool, bool) {
	if tr, ok := current[id]; ok {
		return tr, false, true
	}
	if locale != i18n.LocaleEnUS {
		if tr, ok := fallback[id]; ok {
			return tr, true, true
		}
	}
	return AgentStepTranslation{}, false, false
}
