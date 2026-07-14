package project

import (
	"testing"

	"go.uber.org/zap"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestRetiredProjectTypeCannotReturnToStudentFlow(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:project-retirement?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("打开测试数据库失败: %v", err)
	}
	if err := db.AutoMigrate(&Project{}, &ProjectUnit{}, &Tag{}, &ProjectTag{}); err != nil {
		t.Fatalf("初始化测试表失败: %v", err)
	}

	service := NewService(db, zap.NewNop())
	normalTag := Tag{Name: "Go", StyleColor: "#2563EB"}
	retiredTag := Tag{Name: "Open-Claw", StyleColor: "#10B981"}
	if err := db.Create(&normalTag).Error; err != nil {
		t.Fatalf("创建普通标签失败: %v", err)
	}
	if err := db.Create(&retiredTag).Error; err != nil {
		t.Fatalf("创建历史标签失败: %v", err)
	}

	published := Project{Title: "Go 实战", Slug: "go-practice", Status: ProjectStatusPublished}
	archived := Project{Title: "历史实战", Slug: "retired-practice", Status: ProjectStatusArchived}
	if err := db.Create(&published).Error; err != nil {
		t.Fatalf("创建普通项目失败: %v", err)
	}
	if err := db.Create(&archived).Error; err != nil {
		t.Fatalf("创建历史项目失败: %v", err)
	}
	if err := db.Create(&ProjectTag{ProjectID: archived.ID, TagID: retiredTag.ID}).Error; err != nil {
		t.Fatalf("关联历史项目标签失败: %v", err)
	}

	archivedStatus := int(ProjectStatusArchived)
	projects, total, err := service.List(1, 20, "", &archivedStatus, nil, nil)
	if err != nil {
		t.Fatalf("读取学生项目列表失败: %v", err)
	}
	if total != 1 || len(projects) != 1 || projects[0].ID != published.ID {
		t.Fatalf("学生列表不应暴露归档项目: total=%d projects=%+v", total, projects)
	}
	if _, err := service.FindPublishedByID(archived.ID); err == nil {
		t.Fatal("归档项目不应允许学生直接读取")
	}

	tags, err := service.GetAllTags()
	if err != nil {
		t.Fatalf("读取标签失败: %v", err)
	}
	if len(tags) != 1 || tags[0].ID != normalTag.ID {
		t.Fatalf("学生和教师可选标签不应包含历史类型: %+v", tags)
	}
	if _, err := service.CreateTag("Open Claw", ""); err == nil {
		t.Fatal("不应允许重新创建历史项目标签")
	}
	replacementName := "普通标签"
	if _, err := service.UpdateTag(retiredTag.ID, &replacementName, nil); err == nil {
		t.Fatal("历史项目标签不应允许改名绕过下架保护")
	}
	if err := service.replaceProjectTags(published.ID, []uint64{retiredTag.ID}); err == nil {
		t.Fatal("不应允许把历史项目标签重新绑定到项目")
	}
	if _, err := service.UpdateProjectStatus(archived.ID, ProjectStatusPublished); err == nil {
		t.Fatal("历史项目不应允许恢复发布")
	}
	if err := service.DeleteProject(archived.ID); err == nil {
		t.Fatal("历史项目不应允许物理删除")
	}
	if err := service.DeleteTag(retiredTag.ID); err == nil {
		t.Fatal("历史项目标签应保留审计，不能删除")
	}
}
