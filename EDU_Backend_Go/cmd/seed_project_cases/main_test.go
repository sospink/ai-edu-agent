package main

import (
	"context"
	"path/filepath"
	"testing"

	"edu-platform/internal/domain/agent"
	"edu-platform/internal/domain/project"
	"edu-platform/internal/domain/publishing"
	"edu-platform/internal/domain/user"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func fixture(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "cases.db")), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, _ := db.DB()
	t.Cleanup(func() { _ = sqlDB.Close() })
	if err = db.AutoMigrate(&user.User{}, &project.Project{}, &project.ProjectUnit{}, &project.ProjectTranslation{}, &project.ProjectUnitTranslation{}, &project.Tag{}, &project.ProjectTag{}, &agent.AgentManual{}, &agent.AgentStep{}, &agent.AgentManualTranslation{}, &agent.AgentStepTranslation{}, &publishing.LabTemplate{}, &publishing.ContentPublishCheck{}, &publishing.PublishAuditLog{}); err != nil {
		t.Fatal(err)
	}
	for _, v := range []any{
		&user.User{ID: 1, Username: "admin", RoleType: user.RoleAdmin, Status: user.StatusActive},
		&project.Tag{Name: "Python", StyleColor: "#123456"},
		&project.Project{ID: 9, Slug: "prompt-workbench", Title: "Existing workbench", Status: project.ProjectStatusPublished, EnvImage: "test/workbench@sha256:fixed", IDEImage: "test/ide@sha256:fixed", CoverURL: "/existing.png", CreatedBy: 1},
	} {
		if err := db.Create(v).Error; err != nil {
			t.Fatal(err)
		}
	}
	return db
}

func TestPreviewApplyAndRerun(t *testing.T) {
	db := fixture(t)
	ctx := context.Background()
	before, err := seed(ctx, db, false)
	if err != nil || len(before) != 4 {
		t.Fatalf("预览失败：%v", err)
	}
	var count int64
	db.Model(&project.Project{}).Count(&count)
	if count != 1 {
		t.Fatal("预览产生了写入")
	}
	result, err := seed(ctx, db, true)
	if err != nil {
		t.Fatal(err)
	}
	if len(result) != 4 {
		t.Fatal("项目数量错误")
	}
	manualIDs := map[uint64]bool{}
	for _, item := range result {
		if manualIDs[item.ManualID] {
			t.Fatal("项目复用了手册ID")
		}
		manualIDs[item.ManualID] = true
		var p project.Project
		db.First(&p, item.ProjectID)
		if p.Status != project.ProjectStatusPublished || p.EnvImage != "test/workbench@sha256:fixed" || p.StudentsCount != 0 {
			t.Fatal("镜像、发布状态或学习人数错误")
		}
		for _, locale := range []string{"zh-CN", "en-US"} {
			var tr project.ProjectTranslation
			if err := db.Where("entity_id = ? AND locale = ?", p.ID, locale).First(&tr).Error; err != nil {
				t.Fatal(err)
			}
			if len(tr.LearningGoals) < 3 || len(tr.Description) < 200 {
				t.Fatal("翻译内容不完整")
			}
		}
		var steps []agent.AgentStep
		db.Where("manual_id = ?", item.ManualID).Order("step_order").Find(&steps)
		if len(steps) != 3 || steps[1].Verification == nil || steps[1].Verification.Path != "/workspace/prompt-workbench/AGENTS.md" {
			t.Fatal("导学验证不正确")
		}
	}
	if err := db.Model(&project.Project{}).Where("id = ?", result[0].ProjectID).Update("title", "Teacher edit").Error; err != nil {
		t.Fatal(err)
	}
	again, err := seed(ctx, db, true)
	if err != nil {
		t.Fatal(err)
	}
	for i, item := range again {
		if !item.Existing || item.ProjectID != result[i].ProjectID || item.ManualID != result[i].ManualID {
			t.Fatal("重复运行改变实体")
		}
	}
	var edited project.Project
	db.First(&edited, result[0].ProjectID)
	if edited.Title != "Teacher edit" {
		t.Fatal("覆盖了教师编辑")
	}
	var original project.Project
	db.First(&original, 9)
	if original.Title != "Existing workbench" {
		t.Fatal("修改了原项目")
	}
	db.Model(&agent.AgentStepTranslation{}).Count(&count)
	if count != 24 {
		t.Fatalf("步骤翻译数量错误：%d", count)
	}
	db.Model(&project.Tag{}).Where("name = ?", "Python").Count(&count)
	if count != 1 {
		t.Fatal("未复用已有标签")
	}
	var tag project.Tag
	db.Where("name = ?", "Python").First(&tag)
	if tag.StyleColor != "#123456" {
		t.Fatal("修改了已有标签样式")
	}
}

func TestPublishingFailureRollsBack(t *testing.T) {
	db := fixture(t)
	db.Model(&project.Project{}).Where("id = 9").Update("lab_template_id", 999)
	if _, err := seed(context.Background(), db, true); err == nil {
		t.Fatal("不应绕过模板发布检查")
	}
	var count int64
	db.Model(&project.Project{}).Count(&count)
	if count != 1 {
		t.Fatal("失败后残留项目")
	}
	db.Model(&agent.AgentManual{}).Count(&count)
	if count != 0 {
		t.Fatal("失败后残留手册")
	}
}
