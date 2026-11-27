package main

import (
	"compress/gzip"
	"context"
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"

	"edu-platform/internal/config"
	"edu-platform/internal/domain/agent"
	"edu-platform/internal/domain/project"
	"edu-platform/internal/domain/publishing"
	"edu-platform/internal/domain/user"
	"edu-platform/internal/infra/database"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

//go:embed cases.json
var catalog []byte

type content struct {
	Title, Subtitle, Scenario, Question         string
	Modules, Goals, Prerequisites, Deliverables []string
}
type caseSpec struct {
	Slug       string
	Tags       []string
	Difficulty int
	ZH         content
	EN         content
}
type entry struct {
	Slug      string `json:"slug"`
	ProjectID uint64 `json:"projectId"`
	UnitID    uint64 `json:"unitId"`
	ManualID  uint64 `json:"manualId"`
	Existing  bool   `json:"existing"`
}

func specs() ([]caseSpec, error) {
	var items []caseSpec
	if err := json.Unmarshal(catalog, &items); err != nil {
		return nil, err
	}
	if len(items) != 4 {
		return nil, fmt.Errorf("项目数量必须为四个")
	}
	for _, s := range items {
		for _, c := range []content{s.ZH, s.EN} {
			if s.Slug == "" || c.Title == "" || c.Scenario == "" || len(c.Goals) == 0 || len(c.Deliverables) == 0 {
				return nil, fmt.Errorf("项目双语内容不完整")
			}
		}
	}
	return items, nil
}

func description(c content, zh bool) string {
	headings := []string{"Project brief", "Target modules", "Expected deliverables", "Current lab scope"}
	scope := "This edition provides project orientation and solution planning. It reuses the Prompt Workbench environment and sample application. The dedicated application, integrations and automated business acceptance for this case are not yet included. Environment checks confirm readiness only; they do not certify completion of the proposed application."
	if zh {
		headings = []string{"项目背景", "目标功能模块", "预期交付成果", "当前实训范围"}
		scope = "本版提供项目导学与方案设计，暂时复用提示词工作台环境及示例应用。该案例的专属应用、业务集成和业务自动验收尚未接入。环境检查仅确认基础环境可用，不代表目标应用已经实现或验收通过。"
	}
	return "## " + headings[0] + "\n\n" + c.Scenario + "\n\n## " + headings[1] + "\n\n- " + strings.Join(c.Modules, "\n- ") + "\n\n## " + headings[2] + "\n\n- " + strings.Join(c.Deliverables, "\n- ") + "\n\n## " + headings[3] + "\n\n" + scope
}

func stepContent(c content, zh bool) ([]string, [][]agent.ContentBlock) {
	titles := []string{"Understand the brief", "Inspect the shared environment", "Prepare the implementation plan"}
	texts := []string{
		c.Scenario + "\n\nTarget modules:\n" + strings.Join(c.Modules, "\n"),
		"Use WebIDE to inspect /workspace/prompt-workbench, Terminal to inspect files, and Desktop to view the existing example. This is the shared Prompt Workbench application, not the dedicated application for this case. Verification checks only the baseline AGENTS.md file.",
		"Ask the tutor to critique your module boundaries, interface contracts and tests. Review its suggestions manually. Prepare:\n" + strings.Join(c.Deliverables, "\n") + "\nRecord completed work and pending implementation honestly.",
	}
	if zh {
		titles = []string{"理解项目任务", "检查共用实训环境", "形成实施方案"}
		texts = []string{c.Scenario + "\n\n目标模块：\n" + strings.Join(c.Modules, "\n"),
			"使用 WebIDE 查看 /workspace/prompt-workbench，使用 Terminal 检查文件，使用 Desktop 查看现有示例。这里运行的是共用提示词工作台，并非本案例的专属应用。自动验证只检查基础目录中的 AGENTS.md。",
			"请智能助教协助审查模块边界、接口契约和测试计划，再由人工复核。整理以下成果：\n" + strings.Join(c.Deliverables, "\n") + "\n如实记录已完成和待实现内容。"}
	}
	blocks := make([][]agent.ContentBlock, len(texts))
	for i, text := range texts {
		blocks[i] = []agent.ContentBlock{{Type: "text", Text: text}}
	}
	return titles, blocks
}

// 只新增四个固定 slug；重跑不覆盖教师后续编辑，也不复用已有手册或进度ID。
func seed(ctx context.Context, db *gorm.DB, apply bool) ([]entry, error) {
	items, err := specs()
	if err != nil {
		return nil, err
	}
	var out []entry
	err = db.WithContext(ctx).Connection(func(conn *gorm.DB) error {
		if conn.Dialector.Name() == "mysql" {
			var acquired int
			if err := conn.Raw("SELECT GET_LOCK(?,10)", "seed:project-cases-v1").Scan(&acquired).Error; err != nil || acquired != 1 {
				return fmt.Errorf("无法获取项目入库锁")
			}
			defer conn.Exec("SELECT RELEASE_LOCK(?)", "seed:project-cases-v1")
		}
		return conn.Transaction(func(tx *gorm.DB) error {
			var source project.Project
			if err := tx.Where("slug = ? AND status = ? AND deleted_at IS NULL", "prompt-workbench", project.ProjectStatusPublished).First(&source).Error; err != nil {
				return fmt.Errorf("找不到已发布提示词工作台：%w", err)
			}
			if source.EnvImage == "" || source.IDEImage == "" {
				return fmt.Errorf("共用镜像配置不完整")
			}
			var actor user.User
			if err := tx.Where("status = ? AND role_type = ?", user.StatusActive, user.RoleAdmin).Order("id").First(&actor).Error; err != nil {
				return fmt.Errorf("需要有效管理员作为创建者")
			}
			for _, s := range items {
				var existing project.Project
				err := tx.Where("slug = ?", s.Slug).First(&existing).Error
				if err == nil {
					var units []project.ProjectUnit
					if err := tx.Where("project_id = ?", existing.ID).Find(&units).Error; err != nil {
						return err
					}
					if len(units) != 1 || existing.DeletedAt != nil {
						return fmt.Errorf("已有项目结构冲突：%s", s.Slug)
					}
					var manual agent.AgentManual
					if err := tx.Where("source_type = ? AND source_id = ?", 2, units[0].ID).First(&manual).Error; err != nil {
						return fmt.Errorf("已有项目手册不完整：%s", s.Slug)
					}
					out = append(out, entry{s.Slug, existing.ID, units[0].ID, manual.ID, true})
					continue
				}
				if !errors.Is(err, gorm.ErrRecordNotFound) {
					return err
				}
				if !apply {
					out = append(out, entry{Slug: s.Slug})
					continue
				}
				p := project.Project{Slug: s.Slug, Title: s.EN.Title, Subtitle: s.EN.Subtitle, Description: description(s.EN, false), LearningGoals: s.EN.Goals, Prerequisites: s.EN.Prerequisites, Difficulty: s.Difficulty, CoverURL: source.CoverURL, EnvImage: source.EnvImage, IDEImage: source.IDEImage, LabTemplateID: source.LabTemplateID, CreatedBy: actor.ID, LabsCount: 1}
				if err := tx.Create(&p).Error; err != nil {
					return err
				}
				u := project.ProjectUnit{ProjectID: p.ID, Title: "Project orientation and solution design", Description: "Inspect the shared environment and prepare a project implementation plan. Dedicated application pending.", Type: 1, ModeGroup: 1, EnvID: s.Slug, TimeLimit: 60, Points: 0, SortOrder: 1}
				if err := tx.Create(&u).Error; err != nil {
					return err
				}
				m := agent.AgentManual{SourceType: 2, SourceID: u.ID, Title: s.EN.Title + " · Project guide", Description: u.Description, CreatorID: actor.ID}
				if err := tx.Create(&m).Error; err != nil {
					return err
				}
				titles, blocks := stepContent(s.EN, false)
				steps := make([]agent.AgentStep, 3)
				for i := range steps {
					steps[i] = agent.AgentStep{ManualID: m.ID, StepOrder: i, Title: titles[i], Content: blocks[i], QuickQuestions: []string{s.EN.Question}}
					if i == 1 {
						steps[i].Verification = &agent.VerificationRule{Type: "file_exists", Path: "/workspace/prompt-workbench/AGENTS.md"}
					}
					if err := tx.Create(&steps[i]).Error; err != nil {
						return err
					}
				}
				for _, locale := range []string{"en-US", "zh-CN"} {
					c := s.EN
					zh := locale == "zh-CN"
					unitTitle, unitDescription := u.Title, u.Description
					if zh {
						c = s.ZH
						unitTitle = "项目导学与方案设计"
						unitDescription = "检查共用实训环境，形成项目实施方案；专属业务应用尚未接入。"
					}
					sum := sha256.Sum256([]byte(description(c, zh)))
					hash := hex.EncodeToString(sum[:])
					pt := project.ProjectTranslation{EntityID: p.ID, Locale: locale, Title: c.Title, Subtitle: c.Subtitle, Description: description(c, zh), LearningGoals: c.Goals, Prerequisites: c.Prerequisites, Status: 1, Version: 1, SourceHash: hash}
					ut := project.ProjectUnitTranslation{EntityID: u.ID, Locale: locale, Title: unitTitle, Description: unitDescription, Status: 1, Version: 1, SourceHash: hash}
					mt := agent.AgentManualTranslation{EntityID: m.ID, Locale: locale, Title: c.Title + " · " + unitTitle, Description: unitDescription, Status: 1, Version: 1, SourceHash: hash}
					for _, record := range []any{&pt, &ut, &mt} {
						if err := tx.Create(record).Error; err != nil {
							return err
						}
					}
					t, b := stepContent(c, zh)
					for i, step := range steps {
						st := agent.AgentStepTranslation{EntityID: step.ID, Locale: locale, Title: t[i], Content: b[i], QuickQuestions: []string{c.Question}, Status: 1, Version: 1, SourceHash: hash}
						if err := tx.Create(&st).Error; err != nil {
							return err
						}
					}
				}
				for _, name := range s.Tags {
					var tag project.Tag
					if err := tx.Where("name = ?", name).Attrs(project.Tag{Name: name, StyleColor: "#0F766E"}).FirstOrCreate(&tag).Error; err != nil {
						return err
					}
					if err := tx.Create(&project.ProjectTag{ProjectID: p.ID, TagID: tag.ID}).Error; err != nil {
						return err
					}
				}
				pub := publishing.NewService(tx, zap.NewNop())
				published := 1
				if _, err := pub.UpdateManual(ctx, actor.ID, int(actor.RoleType), m.ID, m.Title, m.Description, &published); err != nil {
					return err
				}
				if _, err := pub.PublishProject(ctx, actor.ID, int(actor.RoleType), p.ID); err != nil {
					return err
				}
				out = append(out, entry{s.Slug, p.ID, u.ID, m.ID, false})
			}
			return nil
		})
	})
	return out, err
}

func backup(cfg *config.Config, path string) error {
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		return err
	}
	z := gzip.NewWriter(f)
	cmd := exec.Command("mysqldump", "--single-transaction", "--skip-lock-tables", "--no-tablespaces", "--set-gtid-purged=OFF", "--host="+cfg.Database.Host, "--port="+strconv.Itoa(cfg.Database.Port), "--user="+cfg.Database.User, cfg.Database.Name)
	cmd.Env = append(os.Environ(), "MYSQL_PWD="+cfg.Database.Password)
	cmd.Stdout = z
	runErr := cmd.Run()
	zipErr := z.Close()
	fileErr := f.Close()
	if runErr != nil || zipErr != nil || fileErr != nil {
		_ = os.Remove(path)
		return fmt.Errorf("数据库备份失败，未执行入库")
	}
	return nil
}

func main() {
	apply := flag.Bool("apply", false, "实际入库；默认只读预览")
	backupPath := flag.String("backup", "", "执行前保存完整数据库备份，要求新文件路径")
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
	if _, err = seed(context.Background(), db, false); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if *apply {
		if *backupPath == "" {
			fmt.Fprintln(os.Stderr, "实际入库必须提供 --backup")
			os.Exit(1)
		}
		if err = backup(cfg, *backupPath); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
	}
	result, err := seed(context.Background(), db, *apply)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	_ = json.NewEncoder(os.Stdout).Encode(result)
}
