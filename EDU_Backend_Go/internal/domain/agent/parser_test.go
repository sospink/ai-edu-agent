package agent

import "testing"

func TestParseMarkdownAcceptsCommonSecondLevelHeadings(t *testing.T) {
	manual, err := ParseMarkdown("# 提示词工程\n\n## 1. 角色模块\n\n说明内容\n\n## 受众模块\n\n- 学生\n")
	if err != nil {
		t.Fatalf("parse markdown: %v", err)
	}
	if manual.Title != "提示词工程" || len(manual.Steps) != 2 {
		t.Fatalf("unexpected parsed manual: %+v", manual)
	}
	if manual.Steps[0].Title != "角色模块" || manual.Steps[1].Title != "受众模块" {
		t.Fatalf("unexpected step titles: %+v", manual.Steps)
	}
}

func TestParseMarkdownReturnsReadableErrorForNoSteps(t *testing.T) {
	_, err := ParseMarkdown("# 空手册\n\n只有一级标题和正文")
	if err == nil {
		t.Fatal("expected no steps error")
	}
}
