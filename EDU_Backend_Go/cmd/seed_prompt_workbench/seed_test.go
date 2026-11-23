package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"edu-platform/internal/domain/agent"
	"edu-platform/internal/domain/course"
	"edu-platform/internal/domain/project"
	"edu-platform/internal/domain/publishing"
	"edu-platform/internal/domain/user"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func fixture(t *testing.T) *assets {
	t.Helper()
	root := t.TempDir()
	for _, locale := range locales {
		steps := make([]stepInput, 8)
		for i := range steps {
			steps[i] = stepInput{StepOrder: i + 1, Title: fmt.Sprintf("步骤 %d", i+1), Content: []agent.ContentBlock{{Type: "text", Text: "完成实验并检查结果"}}, QuickQuestions: []string{"如何验证？"}, Verification: &agent.VerificationRule{Type: "command", Command: "true"}}
		}
		data, _ := json.Marshal(steps)
		for name, content := range map[string][]byte{"materials/theory." + locale + ".md": []byte("# 理论\n学习提示词"), "manuals/steps." + locale + ".json": data} {
			path := filepath.Join(root, name)
			if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(path, content, 0644); err != nil {
				t.Fatal(err)
			}
		}
	}
	a, err := loadAssets(root)
	if err != nil {
		t.Fatal(err)
	}
	return a
}

func testDB(t *testing.T) (*gorm.DB, options) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, _ := db.DB()
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() { sqlDB.Close() })
	// 迁移仅用于独立测试数据库，生产 CLI 从不执行迁移。
	err = db.AutoMigrate(&user.User{}, &course.Course{}, &course.CourseStage{}, &course.CourseLesson{}, &course.LessonMaterial{}, &course.CourseTranslation{}, &course.CourseStageTranslation{}, &course.CourseLessonTranslation{}, &course.LessonMaterialTranslation{}, &course.Skill{}, &course.LessonSkill{}, &agent.AgentManual{}, &agent.AgentStep{}, &agent.AgentManualTranslation{}, &agent.AgentStepTranslation{}, &agent.UserAgentProgress{}, &course.UserLessonRecord{}, &publishing.LabTemplate{}, &publishing.ContentPublishCheck{}, &publishing.PublishAuditLog{}, &project.Project{})
	if err != nil {
		t.Fatal(err)
	}
	u := user.User{Username: "teacher", RoleType: user.RoleTeacher, Status: user.StatusActive}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	return db, options{Image: "test/workbench:1", IDEImage: "test/ide:1", CreatorID: u.ID}
}

func TestSeedIdempotentAndPreservesProgress(t *testing.T) {
	db, o := testDB(t)
	a := fixture(t)
	root := t.TempDir()
	first, err := seed(context.Background(), db, root, o, a)
	if err != nil {
		t.Fatal(err)
	}
	progress := agent.UserAgentProgress{UserID: 123, ManualID: first.ManualID, CurrentStep: 3, CompletedSteps: []int{1, 2}}
	if err := db.Create(&progress).Error; err != nil {
		t.Fatal(err)
	}
	record := course.UserLessonRecord{UserID: 123, CourseID: first.CourseID, LessonID: first.LessonIDs[1], Status: course.LessonRecordStatusCompleted}
	if err := db.Create(&record).Error; err != nil {
		t.Fatal(err)
	}
	unrelated := course.Course{Slug: "other", Title: "其他课程", Status: course.CourseStatusPublished}
	if err := db.Create(&unrelated).Error; err != nil {
		t.Fatal(err)
	}
	second, err := seed(context.Background(), db, root, o, a)
	if err != nil {
		t.Fatal(err)
	}
	if first.CourseID != second.CourseID || first.StageID != second.StageID || first.ManualID != second.ManualID || first.TemplateID != second.TemplateID || first.MaterialID != second.MaterialID || !reflect.DeepEqual(first.StepIDs, second.StepIDs) || !reflect.DeepEqual(first.LessonIDs, second.LessonIDs) || second.Created != 0 {
		t.Fatalf("重跑改变 ID 或新增实体: %+v %+v", first, second)
	}
	var got agent.UserAgentProgress
	db.First(&got, progress.ID)
	if got.CurrentStep != 3 || !reflect.DeepEqual(got.CompletedSteps, progress.CompletedSteps) {
		t.Fatal("学习进度被修改")
	}
	var lr course.UserLessonRecord
	db.First(&lr, record.ID)
	if lr.Status != course.LessonRecordStatusCompleted {
		t.Fatal("课时记录被修改")
	}
	var other course.Course
	db.First(&other, unrelated.ID)
	if other.Title != unrelated.Title || other.Status != unrelated.Status {
		t.Fatal("其他课程被修改")
	}
	var lessons []course.CourseLesson
	db.Where("course_id = ?", first.CourseID).Order("sort_order").Find(&lessons)
	if len(lessons) != 2 || lessons[0].Type != 4 || lessons[0].DurationMinutes != 45 || lessons[1].Type != 1 || lessons[1].DurationMinutes != 105 {
		t.Fatal("课程结构不正确")
	}
	var seededCourse course.Course
	if err := db.First(&seededCourse, first.CourseID).Error; err != nil {
		t.Fatal(err)
	}
	if seededCourse.EstimatedHours != 3 {
		t.Fatal("课程整数预计时长应保持 3 小时")
	}
	var translations []course.LessonMaterialTranslation
	db.Where("entity_id = ?", first.MaterialID).Find(&translations)
	if len(translations) != 2 || translations[0].FileURL == translations[1].FileURL {
		t.Fatal("双语素材未独立关联")
	}
	for _, tr := range translations {
		if _, err := os.Stat(filepath.Join(root, slug, first.AssetRevision, "materials", tr.FileName)); err != nil {
			t.Fatal(err)
		}
	}
}

func TestRejectStepCountChangeRollsBack(t *testing.T) {
	db, o := testDB(t)
	a := fixture(t)
	root := t.TempDir()
	first, err := seed(context.Background(), db, root, o, a)
	if err != nil {
		t.Fatal(err)
	}
	for _, locale := range locales {
		a.Steps[locale] = append(a.Steps[locale], stepInput{StepOrder: 9, Title: "新步骤", Content: []agent.ContentBlock{{Type: "text", Text: "内容"}}})
	}
	o.Image = "changed/image:2"
	if _, err := seed(context.Background(), db, root, o, a); err == nil {
		t.Fatal("应拒绝步骤数量变化")
	}
	var c course.Course
	db.First(&c, first.CourseID)
	if c.EnvImage == o.Image {
		t.Fatal("失败后课程未回滚")
	}
	var n int64
	db.Model(&agent.AgentStep{}).Where("manual_id = ?", first.ManualID).Count(&n)
	if n != 8 {
		t.Fatal("原步骤被破坏")
	}
}

func TestPublishUsesExistingChecks(t *testing.T) {
	db, o := testDB(t)
	a := fixture(t)
	root := t.TempDir()
	o.Publish = true
	result, err := seed(context.Background(), db, root, o, a)
	if err != nil {
		t.Fatal(err)
	}
	var c course.Course
	db.First(&c, result.CourseID)
	if c.Status != course.CourseStatusPublished {
		t.Fatal("课程未发布")
	}
	var n int64
	db.Model(&publishing.ContentPublishCheck{}).Count(&n)
	if n < 2 {
		t.Fatal("未通过现有发布检查")
	}
	for _, locale := range locales {
		for i := range a.Steps[locale] {
			a.Steps[locale][i].Verification = nil
		}
	}
	if _, err := seed(context.Background(), db, root, o, a); err == nil {
		t.Fatal("无验证规则的手册不应发布")
	}
	var step agent.AgentStep
	db.First(&step, result.StepIDs[0])
	if step.Verification == nil {
		t.Fatal("发布失败未回滚")
	}
	o.Publish = false
	if _, err := seed(context.Background(), db, root, o, a); err == nil {
		t.Fatal("不得隐式降级已发布课程")
	}
}

func TestRejectOtherOwnerAndSharedTemplate(t *testing.T) {
	db, o := testDB(t)
	a := fixture(t)
	root := t.TempDir()
	result, err := seed(context.Background(), db, root, o, a)
	if err != nil {
		t.Fatal(err)
	}
	u := user.User{Username: "another", RoleType: user.RoleTeacher, Status: user.StatusActive}
	db.Create(&u)
	other := o
	other.CreatorID = u.ID
	if _, err := seed(context.Background(), db, root, other, a); err == nil {
		t.Fatal("越权写入未被拒绝")
	}
	db.Create(&course.Course{Slug: "shared", LabTemplateID: result.TemplateID})
	if _, err := seed(context.Background(), db, root, o, a); err == nil {
		t.Fatal("共享模板写入未被拒绝")
	}
}

func TestAssetsValidation(t *testing.T) {
	a := fixture(t)
	if _, err := parseSteps([]byte(`[]`)); err == nil {
		t.Fatal("空步骤应拒绝")
	}
	if _, err := parseSteps(append(a.Files["manuals/steps.zh-CN.json"], []byte(` {}`)...)); err == nil {
		t.Fatal("多余 JSON 应拒绝")
	}
	steps := a.Steps["zh-CN"]
	steps[2].StepOrder = 1
	data, _ := json.Marshal(steps)
	if _, err := parseSteps(data); err == nil {
		t.Fatal("重复排序应拒绝")
	}
	if _, err := loadAssets(t.TempDir()); err == nil {
		t.Fatal("缺失素材应拒绝")
	}
}

func TestImplicitOrderAndCustomCommand(t *testing.T) {
	a := fixture(t)
	steps := a.Steps["zh-CN"]
	for i := range steps {
		steps[i].StepOrder = 0
		steps[i].Verification = &agent.VerificationRule{Type: "custom", Command: "test -f /workspace/review.md"}
	}
	data, _ := json.Marshal(steps)
	got, err := parseSteps(data)
	if err != nil {
		t.Fatal(err)
	}
	for i, s := range got {
		if s.StepOrder != i+1 || s.Verification.Script != s.Verification.Command {
			t.Fatal("数组顺序或验证字段未归一化")
		}
	}
	steps[0].StepOrder = 1
	data, _ = json.Marshal(steps)
	if _, err := parseSteps(data); err == nil {
		t.Fatal("部分缺失排序应拒绝")
	}
}

func TestBilingualMismatchAndDryRun(t *testing.T) {
	a := fixture(t)
	root := t.TempDir()
	write := func() {
		t.Helper()
		for name, data := range a.Files {
			path := filepath.Join(root, name)
			if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(path, data, 0644); err != nil {
				t.Fatal(err)
			}
		}
	}
	write()
	if err := run(context.Background(), options{Assets: root, Image: "offline", IDEImage: "offline", CreatorID: 1, DryRun: true}); err != nil {
		t.Fatal(err)
	}
	steps := a.Steps["en-US"]
	steps[0].Verification.Command = "false"
	a.Files["manuals/steps.en-US.json"], _ = json.Marshal(steps)
	write()
	if _, err := loadAssets(root); err == nil {
		t.Fatal("双语验证差异应拒绝")
	}
}

func TestRealTeachingAssetsOffline(t *testing.T) {
	root := "../../../courses/prompt-workbench"
	if _, err := os.Stat(filepath.Join(root, "manuals/steps.zh-CN.json")); os.IsNotExist(err) {
		t.Skip("真实教学素材尚未就绪")
	}
	a, err := loadAssets(root)
	if err != nil {
		t.Fatal(err)
	}
	db, o := testDB(t)
	o.Publish = true
	if _, err := seed(context.Background(), db, t.TempDir(), o, a); err != nil {
		t.Fatal(err)
	}
}
