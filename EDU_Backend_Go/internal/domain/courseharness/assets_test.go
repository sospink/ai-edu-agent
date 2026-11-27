package courseharness

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestStaticAssetsRevalidateAfterAuthorization(t *testing.T) {
	h, router, s := proxyFixture(t)
	script := "console.log('original official client')"
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Accept-Encoding") != "identity" {
			t.Error("静态资源压缩未交给入口代理")
		}
		w.Header().Set("Content-Type", "text/javascript; charset=utf-8")
		_, _ = w.Write([]byte(script))
	}))
	defer up.Close()
	u, _ := url.Parse(up.URL)
	s.Address = u.Host
	h.instances[s.ID] = s
	path := "/api/course-harness/proxy/" + s.ID + "/plugins/??official/index.js"
	get := func(cookie, tag string) *httptest.ResponseRecorder {
		req := httptest.NewRequest("GET", path, nil)
		ctx, cancel := context.WithCancel(req.Context())
		defer cancel()
		req = req.WithContext(ctx)
		req.AddCookie(&http.Cookie{Name: "edu_harness", Value: cookie})
		req.Header.Set("If-None-Match", tag)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		return w
	}
	first := get(s.AccessKey, "")
	tag := first.Header().Get("ETag")
	if first.Code != 200 || first.Body.String() != script || tag == "" ||
		first.Header().Get("Cache-Control") != "private, no-cache" {
		t.Fatal("静态脚本首次响应或缓存策略错误")
	}
	second := get(s.AccessKey, tag)
	if second.Code != 304 || second.Body.Len() != 0 {
		t.Fatal("未复用已校验脚本")
	}
	if get("another-user", tag).Code != 401 {
		t.Fatal("条件请求绕过了用户鉴权")
	}
	script = "console.log('new official client')"
	changed := get(s.AccessKey, tag)
	if changed.Code != 200 || changed.Header().Get("ETag") == tag {
		t.Fatal("脚本变更未使缓存失效")
	}
	h.db.Exec("UPDATE sys_users SET status=0")
	if get(s.AccessKey, changed.Header().Get("ETag")).Code != 403 {
		t.Fatal("条件请求绕过了账号撤销检查")
	}
}

func TestOnlyStaticScriptsAndStylesCanBeCached(t *testing.T) {
	for _, tc := range []struct {
		path, contentType string
		status            int
		cookie, cache     bool
	}{
		{"/assets/index-abc.js", "text/javascript", 200, false, true},
		{"/assets/index-abc.css", "text/css", 200, false, true},
		{"/assets/index-abc.js", "text/html", 200, false, false},
		{"/assets/index-abc.js", "text/javascript", 401, false, false},
		{"/assets/index-abc.js", "text/javascript", 200, true, false},
		{"/", "text/html", 200, false, false},
		{"/api/history", "application/json", 200, false, false},
		{"/files/private.js", "text/javascript", 200, false, false},
	} {
		t.Run(tc.path+tc.contentType+http.StatusText(tc.status), func(t *testing.T) {
			w := httptest.NewRecorder()
			w.Header().Set("Content-Type", tc.contentType)
			if tc.cookie {
				http.SetCookie(w, &http.Cookie{Name: "login", Value: "private"})
			}
			w.WriteHeader(tc.status)
			_, _ = w.WriteString("test")
			resp := w.Result()
			defer resp.Body.Close()
			err := revalidateAsset(resp, httptest.NewRequest("GET", tc.path, nil), tc.path)
			if err != nil || strings.Contains(resp.Header.Get("Cache-Control"), "private") != tc.cache {
				t.Fatalf("缓存范围错误: %v %v", resp.Header, err)
			}
		})
	}
}
