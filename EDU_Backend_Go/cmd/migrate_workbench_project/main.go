package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"edu-platform/internal/config"
	"edu-platform/internal/domain/agent"
	"edu-platform/internal/domain/course"
	"edu-platform/internal/domain/project"
	"edu-platform/internal/domain/publishing"
	"edu-platform/internal/domain/user"
	"edu-platform/internal/infra/database"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

const slug = "prompt-workbench"

type report struct {
	CourseID  uint64 `json:"courseId"`
	ProjectID uint64 `json:"projectId"`
	UnitID    uint64 `json:"unitId"`
	ManualID  uint64 `json:"manualId"`
	Steps     int    `json:"steps"`
	Applied   bool   `json:"applied"`
}

func main() {
	apply := flag.Bool("apply", false, "事务迁移并下架原课程；默认只读检查")
	flag.Parse()
	cfg, err := config.Load()
	if err != nil {
		panic("配置加载失败")
	}
	cfg.Database.AutoMigrate = false
	db, err := database.New(cfg, zap.NewNop())
	if err != nil {
		panic("数据库连接失败")
	}
	result, err := migrate(context.Background(), db, cfg.Upload.Root, *apply)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	_ = json.NewEncoder(os.Stdout).Encode(result)
}

// 手册仅重新绑定来源，不复制或删除步骤，保留双语版本及已有手册进度ID。
func migrate(ctx context.Context, db *gorm.DB, uploads string, apply bool) (*report, error) {
	out := &report{}
	err := db.WithContext(ctx).Connection(func(conn *gorm.DB) error {
		if conn.Dialector.Name() == "mysql" {
			var locked int
			if err := conn.Raw("SELECT GET_LOCK(?, 10)", "migrate:workbench-project").Scan(&locked).Error; err != nil || locked != 1 {
				return fmt.Errorf("无法获取迁移锁")
			}
			defer conn.Exec("SELECT RELEASE_LOCK(?)", "migrate:workbench-project")
		}
		return conn.Transaction(func(tx *gorm.DB) error {
			var c course.Course
			if err := tx.Where("slug = ?", slug).First(&c).Error; err != nil {
				return err
			}
			out.CourseID = c.ID
			var lessons []course.CourseLesson
			if err := tx.Where("course_id = ?", c.ID).Order("sort_order").Find(&lessons).Error; err != nil {
				return err
			}
			if len(lessons) != 2 || lessons[0].Type != 4 || lessons[1].Type != 1 {
				return fmt.Errorf("课程结构不匹配，停止迁移")
			}
			var actor user.User
			if err := tx.First(&actor, c.CreatorID).Error; err != nil {
				return err
			}
			if actor.Status != user.StatusActive || (actor.RoleType != user.RoleTeacher && actor.RoleType != user.RoleAdmin) {
				return fmt.Errorf("课程创建者不可用")
			}
			var existing []project.Project
			if err := tx.Where("slug = ?", slug).Find(&existing).Error; err != nil {
				return err
			}
			if len(existing) > 0 {
				var units []project.ProjectUnit
				if err := tx.Where("project_id = ?", existing[0].ID).Find(&units).Error; err != nil {
					return err
				}
				if len(units) != 1 {
					return fmt.Errorf("目标项目已存在且结构不同")
				}
				var manual agent.AgentManual
				if err := tx.Where("source_type = ? AND source_id = ?", agent.SourceTypeProjectUnit, units[0].ID).First(&manual).Error; err != nil {
					return fmt.Errorf("目标项目已存在，拒绝覆盖")
				}
				if c.Status != course.CourseStatusArchived || existing[0].Status != project.ProjectStatusPublished {
					return fmt.Errorf("已有项目状态不符合迁移完成条件")
				}
				out.ProjectID, out.UnitID, out.ManualID = existing[0].ID, units[0].ID, manual.ID
				var stepCount int64
				if err := tx.Model(&agent.AgentStep{}).Where("manual_id = ?", manual.ID).Count(&stepCount).Error; err != nil {
					return err
				}
				out.Steps = int(stepCount)
				out.Applied = true
				return nil
			}
			var manuals []agent.AgentManual
			if err := tx.Where("source_type = ? AND source_id = ?", agent.SourceTypeLesson, lessons[1].ID).Find(&manuals).Error; err != nil {
				return err
			}
			if len(manuals) != 1 || manuals[0].IsPublished != 1 {
				return fmt.Errorf("需要唯一且已发布的实训手册")
			}
			manual := manuals[0]
			out.ManualID = manual.ID
			var steps []agent.AgentStep
			if err := tx.Where("manual_id = ?", manual.ID).Order("step_order").Find(&steps).Error; err != nil {
				return err
			}
			if len(steps) == 0 {
				return fmt.Errorf("实训手册为空")
			}
			out.Steps = len(steps)
			var translations []course.CourseTranslation
			if err := tx.Where("entity_id = ? AND locale IN ? AND status = 1", c.ID, []string{"zh-CN", "en-US"}).Find(&translations).Error; err != nil {
				return err
			}
			if len(translations) != 2 {
				return fmt.Errorf("课程缺少已发布双语内容")
			}
			var material course.LessonMaterial
			if err := tx.Where("lesson_id = ?", lessons[0].ID).First(&material).Error; err != nil {
				return err
			}
			descriptions := map[string]string{}
			for _, locale := range []string{"zh-CN", "en-US"} {
				var mt course.LessonMaterialTranslation
				if err := tx.Where("entity_id = ? AND locale = ? AND status = 1", material.ID, locale).First(&mt).Error; err != nil {
					return err
				}
				// 只读取本课程由入库工具生成的Markdown，禁止任意路径或外部URL。
				prefix := "/uploads/prompt-workbench/"
				if len(mt.FileURL) <= len(prefix) || mt.FileURL[:len(prefix)] != prefix || filepath.Ext(mt.FileURL) != ".md" {
					return fmt.Errorf("理论资料路径不符合迁移约束")
				}
				root, err := filepath.EvalSymlinks(filepath.Join(uploads, "prompt-workbench"))
				if err != nil {
					return err
				}
				path, err := filepath.EvalSymlinks(filepath.Join(uploads, mt.FileURL[len("/uploads/"):]))
				if err != nil {
					return err
				}
				rel, err := filepath.Rel(root, path)
				if err != nil || rel == ".." || len(rel) > 3 && rel[:3] == "../" {
					return fmt.Errorf("理论资料路径越界")
				}
				body, err := os.ReadFile(path)
				if err != nil {
					return err
				}
				descriptions[locale] = string(body)
				var count int64
				if err := tx.Model(&agent.AgentManualTranslation{}).Where("entity_id = ? AND locale = ? AND status = 1", manual.ID, locale).Count(&count).Error; err != nil || count != 1 {
					return fmt.Errorf("手册缺少双语版本")
				}
				for _, step := range steps {
					if err := tx.Model(&agent.AgentStepTranslation{}).Where("entity_id = ? AND locale = ? AND status = 1", step.ID, locale).Count(&count).Error; err != nil || count != 1 {
						return fmt.Errorf("手册步骤缺少双语版本")
					}
				}
			}
			if !apply {
				return nil
			}
			p := project.Project{Title: c.Title, Slug: slug, Subtitle: c.Description, Description: descriptions["zh-CN"], Difficulty: c.Difficulty, LabsCount: 1, EnvImage: c.EnvImage, IDEImage: c.IDEImage, LabTemplateID: c.LabTemplateID, CreatedBy: c.CreatorID}
			p.CoverURL = "/project-covers/prompt-workbench-7b5290f9.png"
			if err := tx.Create(&p).Error; err != nil {
				return err
			}
			u := project.ProjectUnit{ProjectID: p.ID, Title: lessons[1].Title, Description: c.Description, Type: 1, ModeGroup: 1, EnvID: slug, TimeLimit: lessons[1].DurationMinutes, Points: lessons[1].Points, SortOrder: 1}
			if err := tx.Create(&u).Error; err != nil {
				return err
			}
			for _, tr := range translations {
				pt := project.ProjectTranslation{EntityID: p.ID, Locale: tr.Locale, Title: tr.Title, Subtitle: tr.Description, Description: descriptions[tr.Locale], Status: 1, Version: 1, SourceHash: tr.SourceHash}
				if err := tx.Create(&pt).Error; err != nil {
					return err
				}
				var lt course.CourseLessonTranslation
				if err := tx.Where("entity_id = ? AND locale = ? AND status = 1", lessons[1].ID, tr.Locale).First(&lt).Error; err != nil {
					return err
				}
				ut := project.ProjectUnitTranslation{EntityID: u.ID, Locale: tr.Locale, Title: lt.Title, Description: tr.Description, Status: 1, Version: 1, SourceHash: tr.SourceHash}
				if err := tx.Create(&ut).Error; err != nil {
					return err
				}
			}
			for _, name := range []string{"Python", "React", "JSON"} {
				var tag project.Tag
				if err := tx.Where("name = ?", name).FirstOrCreate(&tag, project.Tag{Name: name}).Error; err != nil {
					return err
				}
				if err := tx.Create(&project.ProjectTag{ProjectID: p.ID, TagID: tag.ID}).Error; err != nil {
					return err
				}
			}
			if err := tx.Model(&manual).Updates(map[string]any{"source_type": agent.SourceTypeProjectUnit, "source_id": u.ID}).Error; err != nil {
				return err
			}
			pub := publishing.NewService(tx, zap.NewNop())
			if _, err := pub.PublishProject(ctx, actor.ID, int(actor.RoleType), p.ID); err != nil {
				return err
			}
			if err := tx.Model(&c).Update("status", course.CourseStatusArchived).Error; err != nil {
				return err
			}
			out.ProjectID, out.UnitID, out.Applied = p.ID, u.ID, true
			return nil
		})
	})
	return out, err
}
