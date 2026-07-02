package assignment

import (
	"context"
	"strings"
	"testing"

	"edu-platform/pkg/i18n"
)

func TestTeacherAISystemPromptUsesLocale(t *testing.T) {
	enPrompt := teacherAISystemPrompt(i18n.WithLocale(context.Background(), i18n.LocaleEnUS))
	if strings.Contains(enPrompt, "所有输出必须是中文") || !strings.Contains(enPrompt, "Please respond in English") {
		t.Fatalf("expected English prompt instruction, got %q", enPrompt)
	}

	zhPrompt := teacherAISystemPrompt(i18n.WithLocale(context.Background(), i18n.LocaleZhCN))
	if !strings.Contains(zhPrompt, "请使用中文回答") {
		t.Fatalf("expected Chinese prompt instruction, got %q", zhPrompt)
	}
}
