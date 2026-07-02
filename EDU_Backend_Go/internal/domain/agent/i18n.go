package agent

import (
	"context"

	"edu-platform/pkg/i18n"
)

const translationStatusPublished = 1

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
