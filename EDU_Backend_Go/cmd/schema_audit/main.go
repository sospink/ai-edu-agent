package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"time"

	"go.uber.org/zap"

	"edu-platform/internal/config"
	"edu-platform/internal/infra/database"
	"edu-platform/internal/infra/schemaaudit"
)

func main() {
	jsonOutput := flag.Bool("json", false, "以 JSON 格式输出审计结果")
	warningsAsErrors := flag.Bool("warnings-as-errors", false, "将警告视为失败")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		fail("加载配置失败", err)
	}
	db, err := database.New(cfg, zap.NewNop())
	if err != nil {
		fail("连接数据库失败", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	report, err := schemaaudit.Check(ctx, db)
	if err != nil {
		fail("数据库结构审计失败", err)
	}

	if *jsonOutput {
		encoder := json.NewEncoder(os.Stdout)
		encoder.SetIndent("", "  ")
		_ = encoder.Encode(report)
	} else {
		printText(report)
	}

	if !report.OK() || (*warningsAsErrors && len(report.Warnings) > 0) {
		os.Exit(1)
	}
}

func fail(message string, err error) {
	fmt.Fprintf(os.Stderr, "%s：%v\n", message, err)
	os.Exit(1)
}

func printText(report schemaaudit.Report) {
	fmt.Printf("数据库结构审计：%s\n", report.Database)
	if len(report.Errors) == 0 && len(report.Warnings) == 0 {
		fmt.Println("结果：通过")
		return
	}
	for _, issue := range report.Errors {
		fmt.Printf("[错误] %s.%s：%s\n", issue.Table, issue.Target, issue.Message)
	}
	for _, issue := range report.Warnings {
		fmt.Printf("[警告] %s.%s：%s\n", issue.Table, issue.Target, issue.Message)
	}
	if len(report.Errors) == 0 {
		fmt.Println("结果：通过，但存在警告")
	} else {
		fmt.Println("结果：失败")
	}
}
