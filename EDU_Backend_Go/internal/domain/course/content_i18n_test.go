package course

import (
	"context"
	"testing"

	"go.uber.org/zap"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"edu-platform/pkg/i18n"
)

func TestCourseContentLocaleFallbackKeepsStableIDs(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&Course{}, &CourseStage{}, &CourseLesson{}, &LessonSkill{}, &LessonMaterial{}, &CourseTranslation{}, &CourseStageTranslation{}, &CourseLessonTranslation{}, &LessonMaterialTranslation{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	service := NewService(db, zap.NewNop(), "")

	course := Course{Title: "中文课程", Slug: "course-one", Description: "中文介绍", Status: CourseStatusPublished}
	if err := db.Create(&course).Error; err != nil {
		t.Fatalf("create course: %v", err)
	}
	stage := CourseStage{CourseID: course.ID, Title: "中文阶段", Description: "阶段说明"}
	if err := db.Create(&stage).Error; err != nil {
		t.Fatalf("create stage: %v", err)
	}
	lesson := CourseLesson{CourseID: course.ID, StageID: stage.ID, Title: "中文课时", Type: 1, DurationMinutes: 15}
	if err := db.Create(&lesson).Error; err != nil {
		t.Fatalf("create lesson: %v", err)
	}
	material := LessonMaterial{LessonID: lesson.ID, Title: "中文资料", Type: 1, FileURL: "/uploads/zh.md", FileName: "zh.md"}
	if err := db.Create(&material).Error; err != nil {
		t.Fatalf("create material: %v", err)
	}
	if err := db.Create(&CourseTranslation{EntityID: course.ID, Locale: i18n.LocaleEnUS, Title: "English Course", Description: "English description", Status: translationStatusPublished}).Error; err != nil {
		t.Fatalf("create course translation: %v", err)
	}
	if err := db.Create(&CourseStageTranslation{EntityID: stage.ID, Locale: i18n.LocaleEnUS, Title: "English Stage", Description: "Stage intro", Status: translationStatusPublished}).Error; err != nil {
		t.Fatalf("create stage translation: %v", err)
	}
	if err := db.Create(&CourseLessonTranslation{EntityID: lesson.ID, Locale: i18n.LocaleEnUS, Title: "English Lesson", Status: translationStatusPublished}).Error; err != nil {
		t.Fatalf("create lesson translation: %v", err)
	}
	if err := db.Create(&LessonMaterialTranslation{EntityID: material.ID, Locale: i18n.LocaleEnUS, Title: "English Material", FileURL: "/uploads/en.md", FileName: "en.md", FileSize: 42, Status: translationStatusPublished}).Error; err != nil {
		t.Fatalf("create translations: %v", err)
	}

	ctx := i18n.WithLocale(context.Background(), i18n.LocaleZhCN)
	detail, err := service.FindByIDLocalized(ctx, course.ID)
	if err != nil {
		t.Fatalf("find localized detail: %v", err)
	}
	if detail.ID != course.ID || detail.Stages[0].ID != stage.ID || detail.Stages[0].Lessons[0].ID != lesson.ID {
		t.Fatalf("localized content changed stable IDs: %#v", detail)
	}
	if detail.Title != "English Course" || !detail.TranslationMissing {
		t.Fatalf("expected zh-CN fallback to en-US course, got title=%q missing=%v", detail.Title, detail.TranslationMissing)
	}
	if got := detail.Stages[0].Lessons[0].Title; got != "English Lesson" {
		t.Fatalf("expected localized lesson title, got %q", got)
	}

	materials, err := service.GetLessonMaterialsLocalized(ctx, lesson.ID)
	if err != nil {
		t.Fatalf("get localized materials: %v", err)
	}
	if materials[0].ID != material.ID || materials[0].FileURL != "/uploads/en.md" || !materials[0].TranslationMissing {
		t.Fatalf("expected material fallback with stable ID and en file, got %#v", materials[0])
	}
}

func TestSaveMaterialContentTranslation(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&Course{}, &CourseStage{}, &CourseLesson{}, &LessonSkill{}, &LessonMaterial{}, &LessonMaterialTranslation{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	service := NewService(db, zap.NewNop(), "")

	lesson := CourseLesson{Title: "Lesson", Type: 4}
	if err := db.Create(&lesson).Error; err != nil {
		t.Fatalf("create lesson: %v", err)
	}
	material := LessonMaterial{LessonID: lesson.ID, Title: "English Material", Type: 1, FileURL: "/uploads/materials/en.md", FileName: "en.md", FileSize: 12}
	if err := db.Create(&material).Error; err != nil {
		t.Fatalf("create material: %v", err)
	}

	title := "中文资料"
	saved, err := service.SaveMaterialContentTranslation(context.Background(), material.ID, i18n.LocaleZhCN, MaterialContentTranslationInput{
		Title:    &title,
		FileURL:  "/uploads/materials/zh.md",
		FileName: "zh.md",
		FileSize: 34,
	})
	if err != nil {
		t.Fatalf("save material translation: %v", err)
	}
	if saved.ID != material.ID || saved.Title != title || saved.FileURL != "/uploads/materials/zh.md" || saved.TranslationMissing {
		t.Fatalf("unexpected saved material translation: %#v", saved)
	}

	materials, err := service.GetLessonMaterialsLocalized(i18n.WithLocale(context.Background(), i18n.LocaleZhCN), lesson.ID)
	if err != nil {
		t.Fatalf("get zh materials: %v", err)
	}
	if len(materials) != 1 || materials[0].FileName != "zh.md" || materials[0].FileSize != 34 {
		t.Fatalf("expected zh material file, got %#v", materials)
	}
}
