package assignment

import (
	"edu-platform/internal/domain/classroom"
	"edu-platform/internal/middleware"
	appjwt "edu-platform/pkg/jwt"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"net/http/httptest"
	"testing"
)

func TestAttachmentRejectsAnonymousAndNonMemberBeforeUpload(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	conn, _ := db.DB()
	defer conn.Close()
	if err = db.AutoMigrate(&TeachingAssignment{}, &AssignmentClass{}, &classroom.Class{}, &classroom.ClassMember{}); err != nil {
		t.Fatal(err)
	}
	if err = db.Create(&TeachingAssignment{ID: 1, Status: AssignmentStatusPublished}).Error; err != nil {
		t.Fatal(err)
	}
	h := NewHandler(NewService(db, zap.NewNop()))
	for _, loggedIn := range []bool{false, true} {
		called := false
		r := gin.New()
		r.Use(func(c *gin.Context) {
			if loggedIn {
				c.Set(middleware.UserClaimsKey, &appjwt.Claims{UserID: 99, RoleType: 1})
			}
			c.Next()
		})
		r.POST("/assignments/:id/attachments", h.RequireStudentAttachmentAccess, func(c *gin.Context) { called = true })
		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest("POST", "/assignments/1/attachments", nil))
		if called {
			t.Fatal("未授权请求进入文件写入处理器")
		}
		if !loggedIn && w.Code != 401 {
			t.Fatal(w.Code)
		}
	}
}
