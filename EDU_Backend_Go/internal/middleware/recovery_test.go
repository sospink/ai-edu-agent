package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"go.uber.org/zap/zaptest/observer"
)

func TestRecoveryIgnoresReverseProxyAbort(t *testing.T) {
	gin.SetMode(gin.TestMode)
	core, logs := observer.New(zap.ErrorLevel)
	engine := gin.New()
	engine.Use(Recovery(zap.New(core)))
	engine.GET("/proxy-abort", func(*gin.Context) {
		panic(http.ErrAbortHandler)
	})

	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/proxy-abort", nil))

	if logs.Len() != 0 {
		t.Fatalf("反向代理正常中止不应记录 panic 错误: %#v", logs.All())
	}
	if strings.Contains(recorder.Body.String(), "INTERNAL_ERROR") {
		t.Fatalf("反向代理正常中止不应写入 500 响应: %s", recorder.Body.String())
	}
}

func TestRecoveryHandlesUnexpectedPanic(t *testing.T) {
	gin.SetMode(gin.TestMode)
	core, logs := observer.New(zap.ErrorLevel)
	engine := gin.New()
	engine.Use(Recovery(zap.New(core)))
	engine.GET("/panic", func(*gin.Context) {
		panic("unexpected")
	})

	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/panic", nil))

	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf("真实 panic 应返回 500，实际为 %d: %s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), `"code":"INTERNAL_ERROR"`) {
		t.Fatalf("真实 panic 应返回稳定错误码: %s", recorder.Body.String())
	}
	if logs.Len() != 1 {
		t.Fatalf("真实 panic 应记录一次错误，实际为 %d", logs.Len())
	}
}
