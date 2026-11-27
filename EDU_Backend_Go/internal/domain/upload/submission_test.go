package upload

import (
	"bytes"
	"edu-platform/internal/config"
	"github.com/gin-gonic/gin"
	"mime/multipart"
	"net/http/httptest"
	"testing"
)

func TestSubmissionAttachmentAllowsArchiveButNotActiveContent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cfg := &config.Config{}
	cfg.Upload.Root = t.TempDir()
	h := NewHandler(cfg)
	for _, tc := range []struct {
		name       string
		size, code int
	}{{"result.zip", 100, 200}, {"attack.html", 100, 400}, {"script.svg", 100, 400}, {"large.zip", 20*1024*1024 + 1, 400}} {
		t.Run(tc.name, func(t *testing.T) {
			var body bytes.Buffer
			writer := multipart.NewWriter(&body)
			part, err := writer.CreateFormFile("file", tc.name)
			if err != nil {
				t.Fatal(err)
			}
			part.Write(make([]byte, tc.size))
			writer.Close()
			r := gin.New()
			r.POST("/attachment", h.UploadSubmissionFile)
			req := httptest.NewRequest("POST", "/attachment", &body)
			req.Header.Set("Content-Type", writer.FormDataContentType())
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			if w.Code != tc.code {
				t.Fatalf("status=%d expected=%d", w.Code, tc.code)
			}
		})
	}
}
