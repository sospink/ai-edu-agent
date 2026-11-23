package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"strings"

	"edu-platform/internal/config"
	"edu-platform/internal/infra/database"
	"go.uber.org/zap"
)

type options struct {
	Assets, Image, IDEImage string
	CreatorID               uint64
	DryRun, Publish         bool
	RepairLegacyStepOrder   bool
}

func main() {
	var o options
	flag.StringVar(&o.Assets, "assets", "../courses/prompt-workbench", "课程素材目录")
	flag.StringVar(&o.Image, "image", "", "专用实验镜像（必填）")
	flag.StringVar(&o.IDEImage, "ide-image", "", "IDE 镜像（必填，由调用者提供已确认版本）")
	flag.Uint64Var(&o.CreatorID, "creator-id", 0, "已有启用教师或管理员 ID（必填）")
	flag.BoolVar(&o.DryRun, "dry-run", false, "仅校验素材，不连接数据库、不写文件")
	flag.BoolVar(&o.Publish, "publish", false, "通过既有发布检查后发布手册和课程")
	flag.BoolVar(&o.RepairLegacyStepOrder, "repair-legacy-step-order", false, "显式迁移本课程旧 1-based 步骤及关联进度，保留实体 ID")
	flag.Parse()
	if err := run(context.Background(), o); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(ctx context.Context, o options) error {
	if strings.TrimSpace(o.Image) == "" || strings.TrimSpace(o.IDEImage) == "" || o.CreatorID == 0 {
		return fmt.Errorf("必须提供 --image、--ide-image 和 --creator-id")
	}
	a, err := loadAssets(o.Assets)
	if err != nil {
		return err
	}
	if o.DryRun {
		return json.NewEncoder(os.Stdout).Encode(map[string]any{"slug": slug, "dryRun": true, "steps": len(a.Steps["zh-CN"]), "files": len(a.Files), "publishRequested": o.Publish, "repairLegacyStepOrderRequested": o.RepairLegacyStepOrder, "说明": "仅完成离线素材校验，数据库权限、旧步骤迁移资格、已有 ID 和发布检查尚未执行"})
	}
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("加载配置失败")
	}
	cfg.Database.AutoMigrate = false
	db, err := database.New(cfg, zap.NewNop())
	if err != nil {
		return fmt.Errorf("连接数据库失败，请检查本地配置")
	}
	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("获取数据库连接失败")
	}
	defer sqlDB.Close()
	result, err := seed(ctx, db, cfg.Upload.Root, o, a)
	if err != nil {
		return err
	}
	return json.NewEncoder(os.Stdout).Encode(result)
}
