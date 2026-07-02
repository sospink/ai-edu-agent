package project

import (
	"context"
	"testing"

	"go.uber.org/zap"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"edu-platform/internal/config"
	"edu-platform/pkg/i18n"
)

func TestProjectContentLocaleOverlay(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&Project{}, &ProjectUnit{}, &ProjectTag{}, &Tag{}, &ProjectTranslation{}, &ProjectUnitTranslation{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	service := NewService(db, zap.NewNop(), &config.Config{})

	project := Project{Title: "中文项目", Slug: "project-one", Subtitle: "中文副标题", Description: "中文说明", Status: ProjectStatusPublished}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}
	unit := ProjectUnit{ProjectID: project.ID, Title: "中文单元", Description: "中文单元说明", Type: 1}
	if err := db.Create(&unit).Error; err != nil {
		t.Fatalf("create unit: %v", err)
	}
	if err := db.Create(&ProjectTranslation{
		EntityID:      project.ID,
		Locale:        i18n.LocaleEnUS,
		Title:         "English Project",
		Subtitle:      "English subtitle",
		Description:   "English description",
		LearningGoals: []string{"Build agents"},
		Prerequisites: []string{"Linux basics"},
		Status:        translationStatusPublished,
	}).Error; err != nil {
		t.Fatalf("create project translation: %v", err)
	}
	if err := db.Create(&ProjectUnitTranslation{EntityID: unit.ID, Locale: i18n.LocaleEnUS, Title: "English Unit", Description: "Unit description", Status: translationStatusPublished}).Error; err != nil {
		t.Fatalf("create unit translation: %v", err)
	}

	detail, err := service.FindByIDLocalized(i18n.WithLocale(context.Background(), i18n.LocaleZhCN), project.ID)
	if err != nil {
		t.Fatalf("find localized project: %v", err)
	}
	if detail.ID != project.ID || detail.Units[0].ID != unit.ID {
		t.Fatalf("localized project changed stable IDs: %#v", detail)
	}
	if detail.Title != "English Project" || len(detail.LearningGoals) != 1 || !detail.TranslationMissing {
		t.Fatalf("expected project fallback overlay, got %#v", detail.Project)
	}
	if detail.Units[0].Title != "English Unit" || !detail.Units[0].TranslationMissing {
		t.Fatalf("expected unit fallback overlay, got %#v", detail.Units[0])
	}
}
