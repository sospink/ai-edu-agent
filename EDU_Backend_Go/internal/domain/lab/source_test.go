package lab

import (
	"context"
	"strings"
	"testing"

	"go.uber.org/zap"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"edu-platform/internal/config"
	"edu-platform/internal/domain/project"
)

func TestResolveSourceRejectsArchivedProject(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:lab-source-retirement?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("打开测试数据库失败: %v", err)
	}
	if err := db.AutoMigrate(&project.Project{}); err != nil {
		t.Fatalf("初始化项目表失败: %v", err)
	}
	record := project.Project{
		Title:    "已下架历史项目",
		Slug:     "archived-project",
		Status:   project.ProjectStatusArchived,
		EnvImage: "registry.local/lab:latest",
	}
	if err := db.Create(&record).Error; err != nil {
		t.Fatalf("创建历史项目失败: %v", err)
	}

	service := NewService(db, zap.NewNop(), &config.Config{}, nil, nil)
	_, err = service.resolveSource(context.Background(), SourceTypeProject, record.ID)
	if err == nil || !strings.Contains(err.Error(), "已下架") {
		t.Fatalf("归档项目不应启动 Lab，实际错误: %v", err)
	}
}
