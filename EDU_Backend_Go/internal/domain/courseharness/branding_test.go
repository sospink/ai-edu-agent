package courseharness

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestBrandingOnlyTransformsApplicationResources(t *testing.T) {
	for _, tc := range []struct {
		path, contentType, locale, want string
	}{
		{"/", "text/html", "zh-CN", "Agent EDU 智能助教"},
		{"/assets/app.js", "text/javascript", "en-US", "Agent EDU Tutor"},
		{"/api/history", "application/json", "zh-CN", "DeepSeek Harness"},
		{"/files/lesson.md", "text/plain", "en-US", "DeepSeek Harness"},
	} {
		t.Run(tc.path, func(t *testing.T) {
			w := httptest.NewRecorder()
			w.Header().Set("Content-Type", tc.contentType)
			w.Header().Set("ETag", `"original"`)
			_, _ = w.WriteString(`"DeepSeek Harness"; "@deepseek-ai/package"; "deepseek-chat"`)
			resp := w.Result()
			req := httptest.NewRequest(http.MethodGet, tc.path, nil)
			if err := brandResponse(resp, req, tc.path, tc.locale); err != nil {
				t.Fatal(err)
			}
			defer resp.Body.Close()
			data, _ := io.ReadAll(resp.Body)
			text := string(data)
			if !strings.Contains(text, tc.want) || !strings.Contains(text, "@deepseek-ai/package") || !strings.Contains(text, "deepseek-chat") {
				t.Fatalf("品牌或非展示标识错误: %s", text)
			}
			if tc.want != "DeepSeek Harness" && resp.Header.Get("ETag") != "" {
				t.Fatal("修改后的品牌资源仍使用上游ETag")
			}
		})
	}
}
