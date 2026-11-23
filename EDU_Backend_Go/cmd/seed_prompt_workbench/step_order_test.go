package main

import (
	"context"
	"reflect"
	"strings"
	"testing"

	"edu-platform/internal/domain/agent"
	"edu-platform/internal/domain/course"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

func legacyFixture(t *testing.T) (*gorm.DB, options, *assets, string, *summary) {
	t.Helper()
	db, o := testDB(t)
	if err := db.AutoMigrate(&agent.AgentStepAttempt{}, &agent.AgentLearningEvent{}, &agent.AgentChatSession{}, &agent.AgentChatMessage{}, &agent.AgentFAQItem{}, &agent.LabTerminalEvent{}); err != nil {
		t.Fatal(err)
	}
	a := fixture(t)
	for _, locale := range locales {
		for len(a.Steps[locale]) < 10 {
			a.Steps[locale] = append(a.Steps[locale], stepInput{StepOrder: len(a.Steps[locale]) + 1, Title: "后续步骤", Content: []agent.ContentBlock{{Type: "text", Text: "验证内容"}}})
		}
	}
	root := t.TempDir()
	first, err := seed(context.Background(), db, root, o, a)
	if err != nil {
		t.Fatal(err)
	}
	must := func(result *gorm.DB) {
		t.Helper()
		if result.Error != nil {
			t.Fatal(result.Error)
		}
	}
	// 在独立内存库复现已上线 ID；所有后续迁移仍必须原位保留这些 ID。
	must(db.Model(&agent.AgentManual{}).Where("id = ?", first.ManualID).UpdateColumn("id", 77))
	must(db.Model(&agent.AgentManualTranslation{}).Where("entity_id = ?", first.ManualID).UpdateColumn("entity_id", 77))
	must(db.Model(&agent.AgentStep{}).Where("manual_id = ?", first.ManualID).UpdateColumn("manual_id", 77))
	first.ManualID = 77
	for i, oldID := range first.StepIDs {
		newID := uint64(2698 + i)
		must(db.Model(&agent.AgentStep{}).Where("id = ?", oldID).UpdateColumns(map[string]any{"id": newID, "step_order": i + 1}))
		must(db.Model(&agent.AgentStepTranslation{}).Where("entity_id = ?", oldID).UpdateColumn("entity_id", newID))
		first.StepIDs[i] = newID
	}
	return db, o, a, root, first
}

func TestLegacyStepOrderRepairPreservesIdentitiesAndHistory(t *testing.T) {
	db, o, a, root, first := legacyFixture(t)
	create := func(v any) {
		t.Helper()
		if err := db.Create(v).Error; err != nil {
			t.Fatal(err)
		}
	}
	progress := agent.UserAgentProgress{UserID: 27, ManualID: 77, CurrentStep: 4, CompletedSteps: []int{0, 1, 2, 2, 10}, ChatHistory: []agent.ChatMessage{{Role: "user", Content: "原始 stepOrder=1 消息"}}}
	create(&progress)
	finished := agent.UserAgentProgress{UserID: 28, ManualID: 77, CurrentStep: 11, CompletedSteps: []int{10}}
	create(&finished)
	zero := agent.UserAgentProgress{UserID: 29, ManualID: 77, CurrentStep: 0, CompletedSteps: []int{}}
	create(&zero)
	other := agent.UserAgentProgress{UserID: 27, ManualID: 88, CurrentStep: 4, CompletedSteps: []int{1, 2}}
	create(&other)
	attempt := agent.AgentStepAttempt{UserID: 27, ManualID: 77, StepID: 2698, StepOrder: 1, Evidence: agent.JSONMap{"text": "原始步骤 1"}}
	create(&attempt)
	event := agent.AgentLearningEvent{UserID: 27, ManualID: 77, StepOrder: 10, Meta: agent.JSONMap{"text": "原始步骤 10"}}
	create(&event)
	zeroEvent := agent.AgentLearningEvent{UserID: 27, ManualID: 77, StepOrder: 0}
	create(&zeroEvent)
	faq := agent.AgentFAQItem{ManualID: 77, StepID: 2707, StepOrder: 10, Question: "原始第 10 步", Answer: "保留答案"}
	create(&faq)
	terminal := agent.LabTerminalEvent{ManualID: 77, StepOrder: 2, Command: "echo step1", OutputSummary: "原始输出"}
	create(&terminal)
	// 反向插入，验证按旧排序而非主键排序迁移，避免唯一键中途冲突。
	chat2 := agent.AgentChatSession{ManualID: 77, UserID: 27, StepOrder: 2}
	create(&chat2)
	chat1 := agent.AgentChatSession{ManualID: 77, UserID: 27, StepOrder: 1}
	create(&chat1)
	msg := agent.AgentChatMessage{SessionID: chat1.ID, Role: "user", Content: "第 1 步原始消息"}
	create(&msg)
	otherEvent := agent.AgentLearningEvent{UserID: 27, ManualID: 88, StepOrder: 10}
	create(&otherEvent)
	var translations []agent.AgentStepTranslation
	if err := db.Order("id").Find(&translations).Error; err != nil {
		t.Fatal(err)
	}
	if _, err := seed(context.Background(), db, root, o, a); err == nil || !strings.Contains(err.Error(), "--repair-legacy-step-order") {
		t.Fatalf("未显式授权必须拒绝旧排序: %v", err)
	}
	var unrepaired agent.AgentStep
	db.First(&unrepaired, 2698)
	if unrepaired.StepOrder != 1 {
		t.Fatal("无 flag 改写了步骤")
	}
	o.RepairLegacyStepOrder = true
	result, err := seed(context.Background(), db, root, o, a)
	if err != nil {
		t.Fatal(err)
	}
	if !result.StepOrderRepaired || !reflect.DeepEqual(result.StepIDs, first.StepIDs) || result.ManualID != 77 || result.Created != 0 {
		t.Fatalf("身份或修复摘要错误: %+v", result)
	}
	var steps []agent.AgentStep
	db.Where("manual_id = ?", 77).Order("step_order").Find(&steps)
	for i, s := range steps {
		if s.ID != uint64(2698+i) || s.StepOrder != i {
			t.Fatal("步骤未原位迁移")
		}
	}
	var after []agent.AgentStepTranslation
	db.Order("id").Find(&after)
	if len(after) != len(translations) {
		t.Fatal("翻译数量变化")
	}
	for i, tr := range after {
		if tr.ID != translations[i].ID || tr.EntityID != translations[i].EntityID || tr.Locale != translations[i].Locale {
			t.Fatal("翻译身份变化")
		}
	}
	var got agent.UserAgentProgress
	db.First(&got, progress.ID)
	if got.CurrentStep != 3 || !reflect.DeepEqual(got.CompletedSteps, []int{0, 1, 9}) || !reflect.DeepEqual(got.ChatHistory, progress.ChatHistory) {
		t.Fatalf("学习进度迁移错误: %+v", got)
	}
	var gotFinished agent.UserAgentProgress
	db.First(&gotFinished, finished.ID)
	if gotFinished.CurrentStep != 10 || !reflect.DeepEqual(gotFinished.CompletedSteps, []int{9}) {
		t.Fatal("完成进度迁移错误")
	}
	var gotZero agent.UserAgentProgress
	db.First(&gotZero, zero.ID)
	if gotZero.CurrentStep != 0 || len(gotZero.CompletedSteps) != 0 {
		t.Fatal("空进度迁移错误")
	}
	var gotOther agent.UserAgentProgress
	db.First(&gotOther, other.ID)
	if !reflect.DeepEqual(gotOther, other) {
		t.Fatal("修改了其他手册进度")
	}
	checks := []struct {
		table string
		id    uint64
		want  int
	}{
		{attempt.TableName(), attempt.ID, 0}, {event.TableName(), event.ID, 9}, {zeroEvent.TableName(), zeroEvent.ID, 0},
		{faq.TableName(), faq.ID, 9}, {terminal.TableName(), terminal.ID, 1}, {chat1.TableName(), chat1.ID, 0}, {chat2.TableName(), chat2.ID, 1}, {otherEvent.TableName(), otherEvent.ID, 10},
	}
	for _, check := range checks {
		var row orderRow
		if err := db.Table(check.table).Where("id = ?", check.id).First(&row).Error; err != nil || row.StepOrder != check.want {
			t.Fatalf("%s 索引错误: %+v %v", check.table, row, err)
		}
	}
	var gotMsg agent.AgentChatMessage
	db.First(&gotMsg, msg.ID)
	if gotMsg.ID != msg.ID || gotMsg.SessionID != msg.SessionID || gotMsg.Role != msg.Role || gotMsg.Content != msg.Content || !gotMsg.CreatedAt.Equal(msg.CreatedAt) {
		t.Fatal("聊天消息被修改")
	}
	var gotAttempt agent.AgentStepAttempt
	db.First(&gotAttempt, attempt.ID)
	if gotAttempt.StepID != 2698 || !reflect.DeepEqual(gotAttempt.Evidence, attempt.Evidence) {
		t.Fatal("验证证据或 stepID 被改写")
	}
	var gotEvent agent.AgentLearningEvent
	db.First(&gotEvent, event.ID)
	if !reflect.DeepEqual(gotEvent.Meta, event.Meta) {
		t.Fatal("事件证据被改写")
	}
	var gotFAQ agent.AgentFAQItem
	db.First(&gotFAQ, faq.ID)
	if gotFAQ.Question != faq.Question || gotFAQ.Answer != faq.Answer {
		t.Fatal("FAQ 文本被改写")
	}
	var gotTerminal agent.LabTerminalEvent
	db.First(&gotTerminal, terminal.ID)
	if gotTerminal.Command != terminal.Command || gotTerminal.OutputSummary != terminal.OutputSummary {
		t.Fatal("终端文本被改写")
	}
	// flag 重跑和普通重跑都不再减一。
	for _, repair := range []bool{true, false} {
		o.RepairLegacyStepOrder = repair
		r, err := seed(context.Background(), db, root, o, a)
		if err != nil || r.StepOrderRepaired {
			t.Fatalf("重跑不幂等: %v", err)
		}
		var reread agent.UserAgentProgress
		db.First(&reread, progress.ID)
		if !reflect.DeepEqual(reread, got) {
			t.Fatal("重跑重复迁移进度")
		}
	}
	// 使用现有公开服务确认第 0 步已命中；无需真实 runtime 或外部服务。
	svc := agent.NewService(db, zap.NewNop(), nil)
	verified, err := svc.VerifyStep(context.Background(), 27, 77, 0, "")
	if err != nil || verified.Message != "运行时验证未启用" {
		t.Fatalf("现有 Agent 服务未命中第 0 步: %+v %v", verified, err)
	}
}

func TestLegacyRepairRejectsUnsafeDataAndRollsBack(t *testing.T) {
	for _, scenario := range []string{"chat-conflict", "noncontiguous", "step-id-mismatch", "out-of-range", "other-slug", "later-failure"} {
		t.Run(scenario, func(t *testing.T) {
			db, o, a, root, first := legacyFixture(t)
			p := agent.UserAgentProgress{UserID: 27, ManualID: 77, CurrentStep: 3, CompletedSteps: []int{1, 2}}
			if err := db.Create(&p).Error; err != nil {
				t.Fatal(err)
			}
			switch scenario {
			case "chat-conflict":
				for _, n := range []int{0, 1} {
					if err := db.Create(&agent.AgentChatSession{ManualID: 77, UserID: 27, StepOrder: n}).Error; err != nil {
						t.Fatal(err)
					}
				}
			case "noncontiguous":
				db.Model(&agent.AgentStep{}).Where("id = ?", 2707).UpdateColumn("step_order", 12)
			case "step-id-mismatch":
				db.Create(&agent.AgentStepAttempt{ManualID: 77, StepID: 2707, StepOrder: 1})
			case "out-of-range":
				db.Create(&agent.AgentLearningEvent{ManualID: 77, StepOrder: 11})
			case "other-slug":
				db.Model(&course.Course{}).Where("id = ?", first.CourseID).UpdateColumn("slug", "other-course")
			case "later-failure":
				// 数据迁移成功后制造外层事务失败，证明迁移没有自行提交。
				if err := db.Exec("CREATE TRIGGER reject_translation BEFORE UPDATE ON agent_step_translations BEGIN SELECT RAISE(ABORT, 'test rollback'); END").Error; err != nil {
					t.Fatal(err)
				}
			}
			o.RepairLegacyStepOrder = true
			var err error
			if scenario == "other-slug" {
				err = db.Transaction(func(tx *gorm.DB) error { return ensureStepOrder(tx, 77, 10, true, &summary{}) })
			} else {
				_, err = seed(context.Background(), db, root, o, a)
			}
			if err == nil {
				t.Fatal("危险或失败场景未被拒绝")
			}
			var step agent.AgentStep
			db.First(&step, 2698)
			if step.StepOrder != 1 {
				t.Fatal("失败未回滚步骤")
			}
			var progress agent.UserAgentProgress
			db.First(&progress, p.ID)
			if progress.CurrentStep != 3 || !reflect.DeepEqual(progress.CompletedSteps, p.CompletedSteps) {
				t.Fatal("失败未回滚学习进度")
			}
			var count int64
			db.Model(&agent.AgentStep{}).Where("manual_id = ?", 77).Count(&count)
			if count != 10 {
				t.Fatal("删除或重建了步骤")
			}
		})
	}
}

func TestNewStepsAreZeroBased(t *testing.T) {
	db, o := testDB(t)
	a := fixture(t)
	r, err := seed(context.Background(), db, t.TempDir(), o, a)
	if err != nil {
		t.Fatal(err)
	}
	var steps []agent.AgentStep
	db.Where("manual_id = ?", r.ManualID).Order("step_order").Find(&steps)
	for i, s := range steps {
		if s.StepOrder != i {
			t.Fatal("新步骤必须使用 0-based 数据库索引")
		}
	}
}
