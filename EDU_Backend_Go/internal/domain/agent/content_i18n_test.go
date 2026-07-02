package agent

import (
	"context"
	"testing"

	"go.uber.org/zap"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"edu-platform/pkg/i18n"
)

func TestAgentManualContentLocaleFallbackKeepsStableIDs(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&AgentManual{}, &AgentStep{}, &AgentManualTranslation{}, &AgentStepTranslation{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	service := NewService(db, zap.NewNop(), nil)

	manual := AgentManual{SourceType: 1, SourceID: 100, Title: "中文手册", Description: "中文说明", IsPublished: 1}
	if err := db.Create(&manual).Error; err != nil {
		t.Fatalf("create manual: %v", err)
	}
	step := AgentStep{
		ManualID:       manual.ID,
		StepOrder:      0,
		Title:          "中文步骤",
		Content:        []ContentBlock{{Type: "text", Text: "中文内容"}},
		QuickQuestions: []string{"中文问题"},
	}
	if err := db.Create(&step).Error; err != nil {
		t.Fatalf("create step: %v", err)
	}
	if err := db.Create(&AgentManualTranslation{EntityID: manual.ID, Locale: i18n.LocaleEnUS, Title: "English Manual", Description: "English description", Status: translationStatusPublished}).Error; err != nil {
		t.Fatalf("create manual translation: %v", err)
	}
	if err := db.Create(&AgentStepTranslation{
		EntityID:       step.ID,
		Locale:         i18n.LocaleEnUS,
		Title:          "English Step",
		Content:        []ContentBlock{{Type: "text", Text: "English content"}},
		QuickQuestions: []string{"English question"},
		Status:         translationStatusPublished,
	}).Error; err != nil {
		t.Fatalf("create step translation: %v", err)
	}

	got, err := service.GetManual(i18n.WithLocale(context.Background(), i18n.LocaleZhCN), manual.SourceType, manual.SourceID)
	if err != nil {
		t.Fatalf("get manual: %v", err)
	}
	if got.ID != manual.ID || len(got.Steps) != 1 || got.Steps[0].ID != step.ID {
		t.Fatalf("localized manual changed stable IDs: %#v", got)
	}
	if got.Title != "English Manual" || !got.TranslationMissing {
		t.Fatalf("expected manual fallback overlay, got %#v", got)
	}
	if got.Steps[0].Title != "English Step" || got.Steps[0].Content[0].Text != "English content" || !got.Steps[0].TranslationMissing {
		t.Fatalf("expected step fallback overlay, got %#v", got.Steps[0])
	}
}
