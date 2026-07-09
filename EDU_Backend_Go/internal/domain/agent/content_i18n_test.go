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

func TestImportMarkdownForLocalePreservesOtherLocaleTranslations(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&AgentManual{}, &AgentStep{}, &AgentManualTranslation{}, &AgentStepTranslation{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	service := NewService(db, zap.NewNop(), nil)

	enMarkdown := `# English Manual
> English description

## 1. Prepare
Run the setup command.

## 2. Verify
Check the output.
`
	manual, err := service.ImportMarkdownForLocale(context.Background(), SourceTypeLesson, 200, enMarkdown, 1, i18n.LocaleEnUS)
	if err != nil {
		t.Fatalf("import english markdown: %v", err)
	}
	if len(manual.Steps) != 2 {
		t.Fatalf("expected two english steps, got %d", len(manual.Steps))
	}
	firstStepID := manual.Steps[0].ID

	zhMarkdown := `# 中文手册
> 中文说明

## 步骤 1：准备环境
执行初始化命令。

## 步骤 2：验证结果
检查输出内容。
`
	if _, err := service.ImportMarkdownForLocale(context.Background(), SourceTypeLesson, 200, zhMarkdown, 1, i18n.LocaleZhCN); err != nil {
		t.Fatalf("import chinese markdown: %v", err)
	}

	updatedEnMarkdown := `# English Manual Updated
> English description updated

## 1. Prepare Updated
Run the updated setup command.

## 2. Verify Updated
Check the updated output.
`
	updated, err := service.ImportMarkdownForLocale(i18n.WithLocale(context.Background(), i18n.LocaleZhCN), SourceTypeLesson, 200, updatedEnMarkdown, 1, i18n.LocaleEnUS)
	if err != nil {
		t.Fatalf("reimport english markdown: %v", err)
	}
	if len(updated.Steps) != 2 || updated.Steps[0].ID != firstStepID {
		t.Fatalf("expected english reimport to preserve step IDs, got %#v", updated.Steps)
	}
	if updated.Title != "English Manual Updated" || updated.Steps[0].Title != "Prepare Updated" {
		t.Fatalf("expected english import to ignore request context locale, got %#v", updated)
	}

	zhManual, err := service.GetManualByID(i18n.WithLocale(context.Background(), i18n.LocaleZhCN), manual.ID)
	if err != nil {
		t.Fatalf("get zh manual: %v", err)
	}
	if zhManual.Title != "中文手册" || zhManual.TranslationMissing {
		t.Fatalf("expected chinese manual translation, got %#v", zhManual)
	}
	if len(zhManual.Steps) != 2 || zhManual.Steps[0].ID != firstStepID || zhManual.Steps[0].Title != "准备环境" || zhManual.Steps[0].TranslationMissing {
		t.Fatalf("expected chinese step translation to remain attached, got %#v", zhManual.Steps)
	}
}

func TestDeleteManualContentTranslationOnlyRemovesRequestedLocale(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&AgentManual{}, &AgentStep{}, &AgentManualTranslation{}, &AgentStepTranslation{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	service := NewService(db, zap.NewNop(), nil)

	manual := AgentManual{SourceType: 1, SourceID: 300, Title: "English Source", Description: "English source description", IsPublished: 1}
	if err := db.Create(&manual).Error; err != nil {
		t.Fatalf("create manual: %v", err)
	}
	step := AgentStep{
		ManualID:       manual.ID,
		StepOrder:      0,
		Title:          "English Source Step",
		Content:        []ContentBlock{{Type: "text", Text: "English source content"}},
		QuickQuestions: []string{"English source question"},
	}
	if err := db.Create(&step).Error; err != nil {
		t.Fatalf("create step: %v", err)
	}
	if _, err := service.SaveManualContentTranslation(context.Background(), manual.ID, i18n.LocaleEnUS, AgentManualContentTranslationInput{
		Title:       "English Manual",
		Description: "English description",
		Steps: []AgentStepContentTranslationInput{{
			ID:             step.ID,
			Title:          "English Step",
			Content:        []ContentBlock{{Type: "text", Text: "English content"}},
			QuickQuestions: []string{"English question"},
		}},
	}); err != nil {
		t.Fatalf("save english translation: %v", err)
	}
	if _, err := service.SaveManualContentTranslation(context.Background(), manual.ID, i18n.LocaleZhCN, AgentManualContentTranslationInput{
		Title:       "中文手册",
		Description: "中文说明",
		Steps: []AgentStepContentTranslationInput{{
			ID:             step.ID,
			Title:          "中文步骤",
			Content:        []ContentBlock{{Type: "text", Text: "中文内容"}},
			QuickQuestions: []string{"中文问题"},
		}},
	}); err != nil {
		t.Fatalf("save chinese translation: %v", err)
	}

	afterDelete, err := service.DeleteManualContentTranslation(context.Background(), manual.ID, i18n.LocaleZhCN)
	if err != nil {
		t.Fatalf("delete chinese translation: %v", err)
	}
	if afterDelete.ID != manual.ID || len(afterDelete.Steps) != 1 || afterDelete.Steps[0].ID != step.ID {
		t.Fatalf("delete translation changed stable IDs: %#v", afterDelete)
	}
	if afterDelete.Title != "English Manual" || !afterDelete.TranslationMissing {
		t.Fatalf("expected zh read to fall back to english after deletion, got %#v", afterDelete)
	}

	enManual, err := service.GetManualByID(i18n.WithLocale(context.Background(), i18n.LocaleEnUS), manual.ID)
	if err != nil {
		t.Fatalf("get english manual: %v", err)
	}
	if enManual.Title != "English Manual" || len(enManual.Steps) != 1 || enManual.Steps[0].Title != "English Step" || enManual.TranslationMissing {
		t.Fatalf("expected english translation to remain intact, got %#v", enManual)
	}

	var manualCount int64
	if err := db.Model(&AgentManual{}).Where("id = ?", manual.ID).Count(&manualCount).Error; err != nil {
		t.Fatalf("count manual: %v", err)
	}
	if manualCount != 1 {
		t.Fatalf("expected source manual to remain, got count %d", manualCount)
	}
}
