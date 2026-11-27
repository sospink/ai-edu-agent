package courseharness

import (
	"net/http"
	"os"
	"os/exec"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestBrandingLocalPreview(t *testing.T) {
	if os.Getenv("EDU_BRAND_PREVIEW") != "1" {
		t.Skip("仅用于独立本地容器的浏览器验收")
	}
	h, _, s := proxyFixture(t)
	logs, err := exec.Command("docker", "logs", "edu-brand-check-20261126").CombinedOutput()
	if err != nil {
		t.Fatal(err)
	}
	match := launchPattern.FindStringSubmatch(string(logs))
	if len(match) < 2 {
		t.Fatal("本地验收容器未启动")
	}
	s.Address, s.LaunchKey, s.Locale = "127.0.0.1:13081", match[1], "zh-CN"
	h.origin = "http://127.0.0.1:13081"
	h.instances[s.ID] = s
	h.tickets["local-preview"] = ticket{Instance: s.ID, AccessKey: s.AccessKey, ExpiresAt: time.Now().Add(time.Minute)}
	router := gin.New()
	router.Use(func(c *gin.Context) {
		if c.GetHeader("Origin") == "http://127.0.0.1:13082" {
			c.Request.Header.Set("Origin", h.origin)
		}
		c.Next()
	})
	router.Any("/api/course-harness/proxy/:id/*path", h.Proxy)
	server := &http.Server{Addr: "127.0.0.1:13082", Handler: router}
	router.POST("/__stop", func(c *gin.Context) {
		c.Status(200)
		go func() { time.Sleep(100 * time.Millisecond); _ = server.Close() }()
	})
	if err := server.ListenAndServe(); err != http.ErrServerClosed {
		t.Fatal(err)
	}
}
