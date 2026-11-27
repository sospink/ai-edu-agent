package main

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"edu-platform/internal/domain/agent"
	"edu-platform/internal/domain/course"
	"edu-platform/internal/domain/project"
	"edu-platform/internal/domain/publishing"
	"edu-platform/internal/domain/user"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func migrationFixture(t *testing.T) (*gorm.DB, string) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "test.db")), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, _ := db.DB()
	t.Cleanup(func() { sqlDB.Close() })
	if err = db.AutoMigrate(&user.User{}, &course.Course{}, &course.CourseLesson{}, &course.CourseTranslation{}, &course.CourseLessonTranslation{}, &course.LessonMaterial{}, &course.LessonMaterialTranslation{}, &agent.AgentManual{}, &agent.AgentStep{}, &agent.AgentManualTranslation{}, &agent.AgentStepTranslation{}, &agent.UserAgentProgress{}, &project.Project{}, &project.ProjectUnit{}, &project.ProjectTranslation{}, &project.ProjectUnitTranslation{}, &project.Tag{}, &project.ProjectTag{}, &publishing.LabTemplate{}, &publishing.ContentPublishCheck{}, &publishing.PublishAuditLog{}); err != nil {
		t.Fatal(err)
	}
	create := func(v any) {
		if err := db.Create(v).Error; err != nil {
			t.Fatal(err)
		}
	}
	create(&user.User{ID: 1, Username: "teacher", RoleType: user.RoleTeacher, Status: user.StatusActive})
	create(&course.Course{ID: 47, Slug: slug, Title: "案例", CreatorID: 1, Status: course.CourseStatusPublished, EnvImage: "test/workbench:1"})
	create(&course.CourseLesson{ID: 378, CourseID: 47, Type: 4, SortOrder: 1})
	create(&course.CourseLesson{ID: 379, CourseID: 47, Title: "实训", Type: 1, SortOrder: 2})
	create(&course.LessonMaterial{ID: 53, LessonID: 378})
	create(&agent.AgentManual{ID: 77, SourceType: 1, SourceID: 379, Title: "手册", IsPublished: 1, CreatorID: 1})
	create(&agent.AgentStep{ID: 2698, ManualID: 77, Title: "步骤", Verification: &agent.VerificationRule{Type: "command", Command: "true"}})
	create(&agent.UserAgentProgress{UserID: 9, ManualID: 77, CurrentStep: 0, CompletedSteps: []int{0}})
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "prompt-workbench", "revision"), 0755); err != nil {
		t.Fatal(err)
	}
	for _, locale := range []string{"zh-CN", "en-US"} {
		create(&course.CourseTranslation{EntityID: 47, Locale: locale, Title: locale, Status: 1})
		create(&course.CourseLessonTranslation{EntityID: 379, Locale: locale, Title: locale, Status: 1})
		create(&course.LessonMaterialTranslation{EntityID: 53, Locale: locale, FileURL: "/uploads/prompt-workbench/revision/" + locale + ".md", Status: 1})
		create(&agent.AgentManualTranslation{EntityID: 77, Locale: locale, Title: locale, Status: 1})
		create(&agent.AgentStepTranslation{EntityID: 2698, Locale: locale, Title: locale, Status: 1})
		if err := os.WriteFile(filepath.Join(root, "prompt-workbench", "revision", locale+".md"), []byte("# "+locale), 0644); err != nil {
			t.Fatal(err)
		}
	}
	return db, root
}

func TestMigrationPreservesManualProgressAndIsIdempotent(t *testing.T) {
	db, root := migrationFixture(t)
	dry, err := migrate(context.Background(), db, root, false)
	if err != nil || dry.Applied {
		t.Fatalf("dry run: %v", err)
	}
	first, err := migrate(context.Background(), db, root, true)
	if err != nil {
		t.Fatal(err)
	}
	second, err := migrate(context.Background(), db, root, true)
	if err != nil || first.ProjectID != second.ProjectID || first.UnitID != second.UnitID {
		t.Fatalf("幂等失败: %v", err)
	}
	var m agent.AgentManual
	db.First(&m, 77)
	if m.SourceType != agent.SourceTypeProjectUnit || m.SourceID != first.UnitID {
		t.Fatal("手册来源未迁移")
	}
	var progress agent.UserAgentProgress
	if err := db.Where("manual_id = ?", 77).First(&progress).Error; err != nil || len(progress.CompletedSteps) != 1 {
		t.Fatal("手册进度改变")
	}
	var tr project.ProjectTranslation
	db.Where("entity_id = ? AND locale = ?", first.ProjectID, "en-US").First(&tr)
	if tr.Description != "# en-US" {
		t.Fatal("理论正文未迁移")
	}
	var c course.Course
	db.First(&c, 47)
	if c.Status != course.CourseStatusArchived {
		t.Fatal("课程未下架")
	}
}

func TestMigrationRollsBackOnPublishFailure(t *testing.T) {
	db, root := migrationFixture(t)
	db.Model(&agent.AgentStep{}).Where("id = 2698").Update("verification", nil)
	if _, err := migrate(context.Background(), db, root, true); err == nil {
		t.Fatal("缺少验证规则仍发布")
	}
	var count int64
	db.Model(&project.Project{}).Count(&count)
	if count != 0 {
		t.Fatal("失败留下项目")
	}
	var m agent.AgentManual
	db.First(&m, 77)
	if m.SourceType != 1 || m.SourceID != 379 {
		t.Fatal("失败仍改变手册归属")
	}
	var c course.Course
	db.First(&c, 47)
	if c.Status != course.CourseStatusPublished {
		t.Fatal("失败仍下架课程")
	}
}
