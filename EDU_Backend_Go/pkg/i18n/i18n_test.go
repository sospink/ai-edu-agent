package i18n

import (
	"context"
	"reflect"
	"regexp"
	"testing"
)

var placeholderPattern = regexp.MustCompile(`\{\{[A-Za-z0-9_]+\}\}`)

func TestSystemTextDoesNotLeakChineseToEnglishResponse(t *testing.T) {
	ctx := WithLocale(context.Background(), LocaleEnUS)
	got := SystemText(ctx, "尚未迁移的系统错误", "Request failed")
	if got != "Request failed" {
		t.Fatalf("expected safe English fallback, got %q", got)
	}
}

func TestSystemTextKeepsUserFacingChineseForChineseLocale(t *testing.T) {
	ctx := WithLocale(context.Background(), LocaleZhCN)
	got := SystemText(ctx, "请求失败", "Request failed")
	if got != "请求失败" {
		t.Fatalf("expected original Chinese message, got %q", got)
	}
}

func TestMessageUsesStableKey(t *testing.T) {
	ctx := WithLocale(context.Background(), LocaleEnUS)
	if got := Message(ctx, "common.invalidParams", nil); got != "Invalid request parameters" {
		t.Fatalf("unexpected keyed message: %q", got)
	}
}

func TestDefaultLocaleIsEnglish(t *testing.T) {
	if got := NormalizeLocale(""); got != LocaleEnUS {
		t.Fatalf("expected empty locale to default to en-US, got %q", got)
	}
	if got := LocaleFromContext(context.Background()); got != LocaleEnUS {
		t.Fatalf("expected missing context locale to default to en-US, got %q", got)
	}
}

func TestMessagePanicsForUnknownKeyInTests(t *testing.T) {
	defer func() {
		if recover() == nil {
			t.Fatal("测试环境中的未知消息 key 应直接触发 panic")
		}
	}()
	_ = Message(WithLocale(context.Background(), LocaleEnUS), "missing.key", nil)
}

func TestKeyedMessageCatalogsStayInSync(t *testing.T) {
	zh := keyedMessages[LocaleZhCN]
	en := keyedMessages[LocaleEnUS]
	if len(zh) != len(en) {
		t.Fatalf("中英文消息 key 数量不一致: zh-CN=%d en-US=%d", len(zh), len(en))
	}
	for key, zhValue := range zh {
		if zhValue == "" {
			t.Fatalf("中文消息为空: %s", key)
		}
		if enValue, ok := en[key]; !ok || enValue == "" {
			t.Fatalf("英文消息缺失或为空: %s", key)
		} else if !reflect.DeepEqual(placeholderPattern.FindAllString(zhValue, -1), placeholderPattern.FindAllString(enValue, -1)) {
			t.Fatalf("中英文插值参数不一致: %s, zh-CN=%q en-US=%q", key, zhValue, enValue)
		}
	}
}
