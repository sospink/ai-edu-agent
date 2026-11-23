package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"reflect"
	"sort"

	"edu-platform/internal/domain/agent"
	"edu-platform/internal/domain/course"
	"edu-platform/internal/domain/project"
	"edu-platform/internal/domain/publishing"
	"edu-platform/internal/domain/user"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

const slug = "prompt-workbench"
const templateCode = "prompt-workbench-v1"
const titleZH = "大语言模型基础与应用实训：提示词工作台"
const titleEN = "LLM Foundations: Prompt Workbench"

type summary struct {
	CourseID              uint64   `json:"courseId"`
	StageID               uint64   `json:"stageId"`
	LessonIDs             []uint64 `json:"lessonIds"`
	ManualID              uint64   `json:"manualId"`
	StepIDs               []uint64 `json:"stepIds"`
	TemplateID            uint64   `json:"templateId"`
	MaterialID            uint64   `json:"materialId"`
	Created, Updated      int
	Published             bool           `json:"published"`
	AssetRevision         string         `json:"assetRevision"`
	StepOrderRepaired     bool           `json:"stepOrderRepaired"`
	StepOrderRepairCounts map[string]int `json:"stepOrderRepairCounts,omitempty"`
}

func assetRevision(a *assets) string {
	h := sha256.New()
	names := make([]string, 0, len(a.Files))
	for name := range a.Files {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		fmt.Fprintf(h, "%d:%s:%d:", len(name), name, len(a.Files[name]))
		h.Write(a.Files[name])
	}
	return hex.EncodeToString(h.Sum(nil))
}

// 仅按受控自然键查找，冲突/重复数据直接终止，不删除旧记录或学习进度。
func put[T any](db *gorm.DB, key map[string]any, value *T, fields []string, out *summary) error {
	var rows []T
	if err := db.Where(key).Limit(2).Find(&rows).Error; err != nil {
		return fmt.Errorf("读取入库实体失败")
	}
	if len(rows) > 1 {
		return fmt.Errorf("入库自然键存在重复记录，请人工处理")
	}
	if len(rows) == 0 {
		if err := db.Create(value).Error; err != nil {
			return fmt.Errorf("创建入库实体失败")
		}
		out.Created++
		return nil
	}
	id := reflect.ValueOf(rows[0]).FieldByName("ID").Uint()
	reflect.ValueOf(value).Elem().FieldByName("ID").SetUint(id)
	if err := db.Model(value).Select(fields).Updates(value).Error; err != nil {
		return fmt.Errorf("更新入库实体失败")
	}
	out.Updated++
	return nil
}

func seed(ctx context.Context, db *gorm.DB, uploadRoot string, o options, a *assets) (*summary, error) {
	out := &summary{AssetRevision: assetRevision(a)}
	err := db.WithContext(ctx).Connection(func(conn *gorm.DB) error {
		// MySQL 命名锁覆盖首次创建及文件复制，避免并发重跑产生重复子实体。
		if conn.Dialector.Name() == "mysql" {
			var acquired int
			if err := conn.Raw("SELECT GET_LOCK(?, 10)", "seed:"+slug).Scan(&acquired).Error; err != nil || acquired != 1 {
				return fmt.Errorf("无法获取课程入库锁")
			}
			defer conn.Exec("SELECT RELEASE_LOCK(?)", "seed:"+slug)
		}
		return conn.Transaction(func(tx *gorm.DB) error {
			var actor user.User
			if err := tx.First(&actor, o.CreatorID).Error; err != nil || actor.Status != user.StatusActive || (actor.RoleType != user.RoleTeacher && actor.RoleType != user.RoleAdmin) {
				return fmt.Errorf("creator-id 必须为已有启用教师或管理员")
			}
			var existing course.Course
			err := tx.Where("slug = ?", slug).First(&existing).Error
			if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
				return fmt.Errorf("读取课程失败")
			}
			if existing.ID != 0 {
				if existing.CreatorID != actor.ID && actor.RoleType != user.RoleAdmin {
					return fmt.Errorf("无权修改已有课程")
				}
				if existing.Status != course.CourseStatusDraft && !o.Publish {
					return fmt.Errorf("已有课程非草稿；请通过平台改为草稿后重跑，或显式 --publish 重新检查发布")
				}
			}
			creator := existing.CreatorID
			if existing.ID == 0 {
				creator = actor.ID
			}
			var template publishing.LabTemplate
			if err := tx.Where("code = ?", templateCode).First(&template).Error; err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
				return fmt.Errorf("读取模板失败")
			}
			if template.ID != 0 {
				var count int64
				if err := tx.Model(&course.Course{}).Where("lab_template_id = ? AND slug <> ?", template.ID, slug).Count(&count).Error; err != nil || count != 0 {
					return fmt.Errorf("专用模板被其他课程引用，拒绝更新")
				}
				if err := tx.Model(&project.Project{}).Where("lab_template_id = ?", template.ID).Count(&count).Error; err != nil || count != 0 {
					return fmt.Errorf("专用模板被项目引用，拒绝更新")
				}
			}
			template.Name, template.Code, template.Description = titleZH, templateCode, "提示词工作台专用 K8S 实验环境"
			template.EnvImage, template.IDEImage = o.Image, o.IDEImage
			template.LegacyRuntimeMode, template.Status = "classic", publishing.LabTemplateStatusActive
			template.DesktopEnabled = true
			template.AppPorts = []publishing.LabTemplateAppPort{{Name: "workbench", Label: "提示词工作台", ContainerPort: 8000, Path: "/"}}
			template.DefaultAppPortName = "workbench"
			template.ExposedPorts = []publishing.LabTemplateExposedPort{
				{Type: "novnc", Name: "novnc", Label: "Desktop", ContainerPort: 6080},
				{Type: "web", Name: "workbench", Label: "提示词工作台", ContainerPort: 8000, Path: "/", IsDefault: true},
			}
			if template.ID == 0 {
				template.CreatedBy = actor.ID
			}
			if err := put(tx, map[string]any{"code": templateCode}, &template, []string{"Name", "Description", "EnvImage", "IDEImage", "Status", "DesktopEnabled", "AppPorts", "DefaultAppPortName", "ExposedPorts"}, out); err != nil {
				return err
			}
			out.TemplateID = template.ID
			c := course.Course{Title: titleZH, Slug: slug, Description: "从提示词构造到结构化输出与人工复核，完成校园云服务报障工作台实训。", Difficulty: 1, TotalLessons: 2, TotalSkills: 3, EstimatedHours: 3, Status: course.CourseStatusDraft, EnvImage: o.Image, IDEImage: o.IDEImage, LabTemplateID: template.ID, CreatorID: creator}
			if err := put(tx, map[string]any{"slug": slug}, &c, []string{"Title", "Description", "Difficulty", "TotalLessons", "TotalSkills", "EstimatedHours", "Status", "EnvImage", "IDEImage", "LabTemplateID"}, out); err != nil {
				return err
			}
			out.CourseID = c.ID
			var stages []course.CourseStage
			if err := tx.Where("course_id = ?", c.ID).Find(&stages).Error; err != nil {
				return fmt.Errorf("读取课程阶段失败")
			}
			if len(stages) > 1 || (len(stages) == 1 && stages[0].SortOrder != 1) {
				return fmt.Errorf("已有阶段结构不兼容，拒绝重建")
			}
			stage := course.CourseStage{CourseID: c.ID, Title: "大语言模型基础与应用", Description: "理论阅读与完整工作台实训", SortOrder: 1, LevelLabel: "L1"}
			if err := put(tx, map[string]any{"course_id": c.ID, "sort_order": 1}, &stage, []string{"Title", "Description", "LevelLabel"}, out); err != nil {
				return err
			}
			out.StageID = stage.ID
			var oldLessons []course.CourseLesson
			if err := tx.Where("course_id = ?", c.ID).Find(&oldLessons).Error; err != nil {
				return fmt.Errorf("读取课时失败")
			}
			for _, l := range oldLessons {
				if l.StageID != stage.ID || l.SortOrder < 1 || l.SortOrder > 2 {
					return fmt.Errorf("已有课时结构不兼容，拒绝重建")
				}
			}
			lessons := []course.CourseLesson{
				{CourseID: c.ID, StageID: stage.ID, Title: "理论资料阅读", Type: 4, DurationMinutes: 45, Points: 10, SortOrder: 1},
				{CourseID: c.ID, StageID: stage.ID, Title: "完整提示词工作台实训", Type: 1, DurationMinutes: 105, Points: 30, SortOrder: 2, LabIdentifier: slug},
			}
			for i := range lessons {
				if err := put(tx, map[string]any{"course_id": c.ID, "sort_order": i + 1}, &lessons[i], []string{"Title", "Type", "DurationMinutes", "Points", "LabIdentifier", "StageID"}, out); err != nil {
					return err
				}
				out.LessonIDs = append(out.LessonIDs, lessons[i].ID)
			}
			manual := agent.AgentManual{SourceType: agent.SourceTypeLesson, SourceID: lessons[1].ID, Title: "提示词工作台实训手册", Description: "校园云服务报障结构化、证据校验与人工复核", CreatorID: creator}
			if err := put(tx, map[string]any{"source_type": agent.SourceTypeLesson, "source_id": lessons[1].ID}, &manual, []string{"Title", "Description", "IsPublished"}, out); err != nil {
				return err
			}
			out.ManualID = manual.ID
			if err := ensureStepOrder(tx, manual.ID, len(a.Steps["zh-CN"]), o.RepairLegacyStepOrder, out); err != nil {
				return err
			}
			for i, s := range a.Steps["zh-CN"] {
				step := agent.AgentStep{ManualID: manual.ID, StepOrder: i, Title: s.Title, Content: s.Content, QuickQuestions: s.QuickQuestions, Verification: s.Verification}
				if err := put(tx, map[string]any{"manual_id": manual.ID, "step_order": i}, &step, []string{"Title", "Content", "QuickQuestions", "Verification"}, out); err != nil {
					return err
				}
				out.StepIDs = append(out.StepIDs, step.ID)
				for _, locale := range locales {
					v := a.Steps[locale][i]
					tr := agent.AgentStepTranslation{EntityID: step.ID, Locale: locale, Title: v.Title, Content: v.Content, QuickQuestions: v.QuickQuestions, Status: 1, Version: 1, SourceHash: out.AssetRevision}
					if err := put(tx, translationKey(step.ID, locale), &tr, []string{"Title", "Content", "QuickQuestions", "Status", "SourceHash"}, out); err != nil {
						return err
					}
				}
			}
			urlFor := func(locale string) string {
				return "/uploads/" + slug + "/" + out.AssetRevision + "/materials/theory." + locale + ".md"
			}
			mat := course.LessonMaterial{LessonID: lessons[0].ID, Title: "理论资料", Type: 1, FileURL: urlFor("zh-CN"), FileName: "theory.zh-CN.md", FileSize: int64(len(a.Files["materials/theory.zh-CN.md"])), SortOrder: 1}
			if err := put(tx, map[string]any{"lesson_id": lessons[0].ID, "sort_order": 1}, &mat, []string{"Title", "Type", "FileURL", "FileName", "FileSize"}, out); err != nil {
				return err
			}
			out.MaterialID = mat.ID
			for _, locale := range locales {
				title, description, stageTitle, manualTitle := titleZH, c.Description, stage.Title, manual.Title
				lessonTitles := []string{lessons[0].Title, lessons[1].Title}
				if locale == "en-US" {
					title = titleEN
					description = "Build prompts, validate structured cloud incident reports, and perform human review."
					stageTitle = "LLM Foundations and Applications"
					manualTitle = "Prompt Workbench Lab Manual"
					lessonTitles = []string{"Theory Reading", "Complete Prompt Workbench Lab"}
				}
				ct := course.CourseTranslation{EntityID: c.ID, Locale: locale, Title: title, Description: description, Status: 1, Version: 1, SourceHash: out.AssetRevision}
				if err := put(tx, translationKey(c.ID, locale), &ct, []string{"Title", "Description", "Status", "SourceHash"}, out); err != nil {
					return err
				}
				st := course.CourseStageTranslation{EntityID: stage.ID, Locale: locale, Title: stageTitle, Description: description, Status: 1, Version: 1, SourceHash: out.AssetRevision}
				if err := put(tx, translationKey(stage.ID, locale), &st, []string{"Title", "Description", "Status", "SourceHash"}, out); err != nil {
					return err
				}
				mt := agent.AgentManualTranslation{EntityID: manual.ID, Locale: locale, Title: manualTitle, Description: description, Status: 1, Version: 1, SourceHash: out.AssetRevision}
				if err := put(tx, translationKey(manual.ID, locale), &mt, []string{"Title", "Description", "Status", "SourceHash"}, out); err != nil {
					return err
				}
				for i, l := range lessons {
					lt := course.CourseLessonTranslation{EntityID: l.ID, Locale: locale, Title: lessonTitles[i], Status: 1, Version: 1, SourceHash: out.AssetRevision}
					if err := put(tx, translationKey(l.ID, locale), &lt, []string{"Title", "Status", "SourceHash"}, out); err != nil {
						return err
					}
				}
				mtr := course.LessonMaterialTranslation{EntityID: mat.ID, Locale: locale, Title: lessonTitles[0], FileURL: urlFor(locale), FileName: "theory." + locale + ".md", FileSize: int64(len(a.Files["materials/theory."+locale+".md"])), Status: 1, Version: 1, SourceHash: out.AssetRevision}
				if err := put(tx, translationKey(mat.ID, locale), &mtr, []string{"Title", "FileURL", "FileName", "FileSize", "Status", "SourceHash"}, out); err != nil {
					return err
				}
			}
			for _, name := range []string{"提示词工程", "结构化输出", "AI辅助审查"} {
				var skills []course.Skill
				if err := tx.Where("name = ?", name).Order("id").Find(&skills).Error; err != nil {
					return fmt.Errorf("读取技能失败")
				}
				skill := course.Skill{Name: name, Category: "AI"}
				if len(skills) > 0 {
					skill = skills[0]
				} else if err := tx.Create(&skill).Error; err != nil {
					return fmt.Errorf("创建技能失败")
				} else {
					out.Created++
				}
				link := course.LessonSkill{LessonID: lessons[1].ID, SkillID: skill.ID}
				if err := put(tx, map[string]any{"lesson_id": link.LessonID, "skill_id": link.SkillID}, &link, []string{"SkillID"}, out); err != nil {
					return err
				}
			}
			if err := copyAssets(uploadRoot, out.AssetRevision, a); err != nil {
				return err
			}
			if o.Publish {
				svc := publishing.NewService(tx, zap.NewNop())
				published := 1
				if _, err := svc.UpdateManual(ctx, actor.ID, int(actor.RoleType), manual.ID, manual.Title, manual.Description, &published); err != nil {
					return fmt.Errorf("手册发布检查失败，事务已回滚")
				}
				if _, err := svc.PublishCourse(ctx, actor.ID, int(actor.RoleType), c.ID); err != nil {
					return fmt.Errorf("课程发布检查失败，事务已回滚")
				}
				out.Published = true
			}
			return nil
		})
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}

func translationKey(id uint64, locale string) map[string]any {
	return map[string]any{"entity_id": id, "locale": locale}
}
