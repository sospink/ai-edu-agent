package main

import (
	"fmt"
	"sort"

	"edu-platform/internal/domain/agent"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type orderRow struct {
	ID        uint64
	UserID    uint64
	StepID    uint64
	StepOrder int
}

type orderTable struct {
	name   string
	stepID bool
	chat   bool
	rows   []orderRow
}

// 由 seed 的事务调用；只接受本课程的课时手册，不独立提交或删除任何记录。
func ensureStepOrder(tx *gorm.DB, manualID uint64, count int, repair bool, out *summary) error {
	var steps []agent.AgentStep
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("manual_id = ?", manualID).Order("step_order ASC, id ASC").Find(&steps).Error; err != nil {
		return fmt.Errorf("读取原步骤失败")
	}
	if len(steps) == 0 {
		return nil
	}
	if len(steps) != count {
		return fmt.Errorf("已有步骤数量与素材不同，拒绝删除或重建，请人工迁移")
	}
	zeroBased, oneBased := true, true
	for i, s := range steps {
		zeroBased = zeroBased && s.StepOrder == i
		oneBased = oneBased && s.StepOrder == i+1
	}
	if zeroBased {
		return nil
	}
	if !oneBased {
		return fmt.Errorf("已有步骤既非严格 0-based 也非严格 1-based，拒绝迁移")
	}
	if !repair {
		return fmt.Errorf("检测到旧 1-based 步骤；备份后显式使用 --repair-legacy-step-order")
	}
	var scopeCount int64
	if err := tx.Table("agent_manuals AS m").Joins("JOIN course_lessons AS l ON l.id = m.source_id").Joins("JOIN courses AS c ON c.id = l.course_id").Where("m.id = ? AND m.source_type = ? AND c.slug = ?", manualID, agent.SourceTypeLesson, slug).Count(&scopeCount).Error; err != nil || scopeCount != 1 {
		return fmt.Errorf("步骤修复仅允许 prompt-workbench 的课时手册")
	}
	newOrderByID := make(map[uint64]int, len(steps))
	for i, s := range steps {
		newOrderByID[s.ID] = i
	}
	var progress []agent.UserAgentProgress
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("manual_id = ?", manualID).Find(&progress).Error; err != nil {
		return fmt.Errorf("读取待迁移学习进度失败")
	}
	for i := range progress {
		p := &progress[i]
		if p.CurrentStep > count+1 {
			return fmt.Errorf("学习进度超出旧步骤范围，拒绝自动迁移")
		}
		if p.CurrentStep > 0 {
			p.CurrentStep--
		} else {
			p.CurrentStep = 0
		}
		if p.CompletedSteps != nil {
			completed := make([]int, 0, len(p.CompletedSteps))
			seen := map[int]bool{}
			for _, v := range p.CompletedSteps {
				if v < 0 || v > count {
					return fmt.Errorf("已完成步骤超出旧步骤范围，拒绝自动迁移")
				}
				if v >= 1 {
					v--
				}
				if !seen[v] {
					seen[v] = true
					completed = append(completed, v)
				}
			}
			sort.Ints(completed)
			p.CompletedSteps = completed
		}
	}
	tables := []orderTable{
		{name: (agent.AgentStepAttempt{}).TableName(), stepID: true},
		{name: (agent.AgentLearningEvent{}).TableName()},
		{name: (agent.AgentChatSession{}).TableName(), chat: true},
		{name: (agent.AgentFAQItem{}).TableName(), stepID: true},
		{name: (agent.LabTerminalEvent{}).TableName()},
	}
	// 预检所有关系和聊天唯一键；不跳过缺失表，避免只修复部分历史数据。
	for i := range tables {
		table := &tables[i]
		columns := []string{"id", "step_order"}
		if table.stepID {
			columns = append(columns, "step_id")
		}
		if table.chat {
			columns = append(columns, "user_id")
		}
		if err := tx.Table(table.name).Select(columns).Clauses(clause.Locking{Strength: "UPDATE"}).Where("manual_id = ?", manualID).Order("step_order ASC, id ASC").Find(&table.rows).Error; err != nil {
			return fmt.Errorf("读取 %s 步骤索引失败", table.name)
		}
		chatKeys := map[[2]uint64]bool{}
		for _, row := range table.rows {
			if row.StepOrder < 0 || row.StepOrder > count {
				return fmt.Errorf("%s 存在越界步骤索引，拒绝自动迁移", table.name)
			}
			next := row.StepOrder
			if next > 0 {
				next--
			}
			if table.stepID && row.StepID != 0 {
				expected, ok := newOrderByID[row.StepID]
				if !ok || expected != next {
					return fmt.Errorf("%s 的 step_id 与旧排序不一致，拒绝自动迁移", table.name)
				}
			}
			if table.chat {
				key := [2]uint64{row.UserID, uint64(next)}
				if chatKeys[key] {
					return fmt.Errorf("聊天会话迁移后唯一键冲突，拒绝合并或删除历史消息")
				}
				chatKeys[key] = true
			}
		}
	}
	counts := map[string]int{}
	for _, table := range tables {
		// 升序逐 ID 左移，避免 2->1 先于 1->0 导致唯一键临时冲突。
		for _, row := range table.rows {
			if row.StepOrder == 0 {
				continue
			}
			if err := moveOrder(tx, table.name, manualID, row.ID, row.StepOrder, row.StepOrder-1); err != nil {
				return err
			}
			counts[table.name]++
		}
	}
	for _, p := range progress {
		result := tx.Model(&agent.UserAgentProgress{}).Where("id = ? AND manual_id = ?", p.ID, manualID).Select("CurrentStep", "CompletedSteps").Updates(&p)
		if result.Error != nil {
			return fmt.Errorf("迁移学习进度失败")
		}
		counts[(agent.UserAgentProgress{}).TableName()]++
	}
	for i, s := range steps {
		if err := moveOrder(tx, (agent.AgentStep{}).TableName(), manualID, s.ID, s.StepOrder, i); err != nil {
			return err
		}
		counts[(agent.AgentStep{}).TableName()]++
	}
	out.StepOrderRepaired = true
	out.StepOrderRepairCounts = counts
	return nil
}

func moveOrder(tx *gorm.DB, table string, manualID, rowID uint64, oldOrder, newOrder int) error {
	result := tx.Table(table).Where("id = ? AND manual_id = ? AND step_order = ?", rowID, manualID, oldOrder).UpdateColumn("step_order", newOrder)
	if result.Error != nil || result.RowsAffected != 1 {
		return fmt.Errorf("迁移 %s 步骤索引失败或数据已并发变化", table)
	}
	return nil
}
