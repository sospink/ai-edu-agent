package courseharness

import (
	"context"
	"errors"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"edu-platform/internal/domain/course"
	"edu-platform/internal/domain/user"
	"edu-platform/internal/middleware"
	"edu-platform/pkg/i18n"
)

func failure(c *gin.Context, status int, code, zh, en string) {
	message := zh
	if i18n.LocaleFromContext(c.Request.Context()) == "en-US" {
		message = en
	}
	c.JSON(status, gin.H{"success": false, "data": nil, "code": code, "error": message})
}
func (h *Handler) allowed(ctx context.Context, s Instance) bool {
	if s.ID != "" && h.tokenValid != nil && !h.tokenValid(ctx, s.PlatformToken) {
		return false
	}
	var users, courses int64
	if h.db.WithContext(ctx).Model(&user.User{}).Where("id = ? AND status = 1", s.UserID).Count(&users).Error != nil || users != 1 {
		return false
	}
	if s.Square {
		return s.LessonID == 0
	}
	return h.db.WithContext(ctx).Table("course_lessons AS l").Joins("JOIN courses c ON c.id = l.course_id").Where("l.id = ? AND c.status = ?", s.LessonID, course.CourseStatusPublished).Count(&courses).Error == nil && courses == 1
}
func (h *Handler) Session(c *gin.Context) {
	lessonID, err := strconv.ParseUint(c.Param("lessonId"), 10, 64)
	if err != nil || lessonID == 0 {
		failure(c, 404, "NOT_FOUND", "课时不存在", "Lesson not found")
		return
	}
	h.openSession(c, Instance{LessonID: lessonID})
}

func (h *Handler) SquareSession(c *gin.Context) {
	h.openSession(c, Instance{Square: true})
}

func (h *Handler) openSession(c *gin.Context, workspace Instance) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		failure(c, 401, "UNAUTHORIZED", "请先登录", "Please sign in")
		return
	}
	ctx := c.Request.Context()
	workspace.UserID = claims.UserID
	workspace.Locale = i18n.LocaleFromContext(ctx)
	workspace.PlatformToken = c.GetString(middleware.UserTokenKey)
	if !h.allowed(ctx, workspace) {
		failure(c, 403, "FORBIDDEN", "工作区不可用", "Workspace access denied")
		return
	}
	image := h.image
	if workspace.Square {
		image = h.squareImage
	}
	if image == "" || h.origin == "" {
		if workspace.Square {
			failure(c, 503, "SQUARE_UNCONFIGURED", "AI 广场工作区尚未部署", "AI Square workspace is not configured")
		} else {
			failure(c, 503, "HARNESS_UNAVAILABLE", "智能助教尚未部署", "Agent EDU Tutor is not deployed")
		}
		return
	}
	var lesson *course.CourseLesson
	if !workspace.Square {
		var err error
		lesson, err = h.courses.GetLessonByIDLocalized(ctx, workspace.LessonID)
		if err != nil {
			failure(c, 404, "NOT_FOUND", "课时不存在", "Lesson not found")
			return
		}
	}
	_ = http.NewResponseController(c.Writer).SetWriteDeadline(time.Now().Add(110 * time.Second))
	ctx, cancel := context.WithTimeout(ctx, 90*time.Second)
	defer cancel()
	s, err := h.start(ctx, workspace, lesson, image)
	if errors.Is(err, errCapacity) {
		failure(c, 429, "HARNESS_CAPACITY", "课程助教工作区已满，请稍后再试", "Course assistant workspaces are full. Try again later")
		return
	}
	if err != nil {
		h.logger.Warn("Harness工作区启动失败", zap.Error(err))
		failure(c, 503, "HARNESS_UNAVAILABLE", "工作区启动失败，请稍后重试", "Could not start the workspace. Please retry")
		return
	}
	t := randomKey()
	h.mu.Lock()
	for k, v := range h.tickets {
		if time.Now().After(v.ExpiresAt) {
			delete(h.tickets, k)
		}
	}
	h.tickets[t] = ticket{Instance: s.ID, ExpiresAt: time.Now().Add(time.Minute), AccessKey: s.AccessKey}
	h.mu.Unlock()
	c.Header("Cache-Control", "no-store")
	c.JSON(200, gin.H{"success": true, "data": gin.H{"url": "/api/course-harness/proxy/" + s.ID + "/?ticket=" + t, "expiresAt": s.ExpiresAt}})
}

// 供平台运维和工作区所有者主动回收；历史文件保留以便下次恢复。
func (h *Handler) Stop(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		c.AbortWithStatus(401)
		return
	}
	h.mu.Lock()
	s, exists := h.instances[c.Param("id")]
	h.mu.Unlock()
	if !exists {
		c.JSON(200, gin.H{"success": true, "data": gin.H{"released": true}})
		return
	}
	if s.UserID != claims.UserID && claims.RoleType != 10 {
		c.AbortWithStatus(403)
		return
	}
	h.lifecycle.Lock()
	err := h.remove(s)
	h.lifecycle.Unlock()
	if err != nil {
		failure(c, 503, "HARNESS_CLEANUP", "工作区释放失败，请重试", "Could not release workspace. Please retry")
		return
	}
	c.JSON(200, gin.H{"success": true, "data": gin.H{"released": true}})
}
func (h *Handler) Proxy(c *gin.Context) {
	s, ok := h.get(c.Param("id"))
	if !ok {
		failure(c, 410, "HARNESS_EXPIRED", "工作区已结束，请返回课程重新打开", "Workspace ended. Reopen it from the course")
		return
	}
	origin, err := url.Parse(h.origin)
	if err != nil || origin.Host == "" {
		c.AbortWithStatus(503)
		return
	}
	// 原版Web含写操作和WebSocket，额外拒绝跨站请求。
	if requestOrigin := c.GetHeader("Origin"); requestOrigin != "" && requestOrigin != h.origin {
		c.AbortWithStatus(403)
		return
	}
	if !h.allowed(c.Request.Context(), s) {
		c.AbortWithStatus(403)
		return
	}
	prefix := "/api/course-harness/proxy/" + s.ID + "/"
	cookie, _ := c.Cookie("edu_harness")
	authorized := same(cookie, s.AccessKey)
	bootstrap := false
	if c.Request.Method == http.MethodGet && c.Param("path") == "/" {
		h.mu.Lock()
		ticketKey := c.Query("ticket")
		t, exists := h.tickets[ticketKey]
		if exists && t.Instance == s.ID && same(t.AccessKey, s.AccessKey) && time.Now().Before(t.ExpiresAt) {
			delete(h.tickets, ticketKey)
			bootstrap = true
			authorized = true
		}
		h.mu.Unlock()
	}
	if !authorized {
		c.AbortWithStatus(401)
		return
	}
	h.mu.Lock()
	current, stillExists := h.instances[s.ID]
	if !stillExists || !same(current.AccessKey, s.AccessKey) {
		h.mu.Unlock()
		c.AbortWithStatus(410)
		return
	}
	current.LastSeen = time.Now()
	h.instances[s.ID] = current
	isSocket := strings.EqualFold(c.GetHeader("Upgrade"), "websocket")
	if h.connections == nil {
		h.connections = map[string]int{}
	}
	if isSocket {
		h.connections[s.ID]++
	}
	h.mu.Unlock()
	if isSocket {
		defer func() {
			h.mu.Lock()
			h.connections[s.ID]--
			if h.connections[s.ID] <= 0 {
				delete(h.connections, s.ID)
			}
			h.mu.Unlock()
		}()
	}
	path := c.Param("path")
	if strings.Contains(path, "\\") {
		c.AbortWithStatus(400)
		return
	}
	for _, part := range strings.Split(path, "/") {
		if part == ".." || part == "." {
			c.AbortWithStatus(400)
			return
		}
	}
	if bootstrap {
		http.SetCookie(c.Writer, &http.Cookie{Name: "edu_harness", Value: s.AccessKey, Path: prefix, HttpOnly: true, Secure: origin.Scheme == "https", SameSite: http.SameSiteStrictMode, Expires: s.ExpiresAt})
	}
	target := &url.URL{Scheme: "http", Host: s.Address}
	proxy := httputil.NewSingleHostReverseProxy(target)
	director := proxy.Director
	proxy.Director = func(r *http.Request) {
		director(r)
		r.URL.Path = path
		r.URL.RawPath = ""
		r.Host = origin.Host
		// 原版插件批量加载使用 /plugins/??...，不能重新编码其原始查询串。
		if path == "/" {
			q := r.URL.Query()
			q.Del("ticket")
			q.Del("token")
			if bootstrap {
				q.Set("token", s.LaunchKey)
			}
			r.URL.RawQuery = q.Encode()
		}
		r.Header.Del("Authorization")
		if isFrontendAsset(r, path) || path == "/" {
			// 静态资源统一由Nginx压缩，避免上游低压缩等级使入口配置失效。
			r.Header.Set("Accept-Encoding", "identity")
			// 品牌展示按语言转换后再校验，不能复用上游未转换版本的304。
			r.Header.Del("If-None-Match")
			r.Header.Del("If-Modified-Since")
		}
		// 代理不向容器转发平台其他Cookie。
		cookies := r.Cookies()
		r.Header.Del("Cookie")
		for _, ck := range cookies {
			if strings.HasPrefix(ck.Name, "dsh-auth-") {
				r.AddCookie(ck)
			}
		}
	}
	proxy.ModifyResponse = func(resp *http.Response) error {
		cookies := resp.Cookies()
		resp.Header.Del("Set-Cookie")
		for _, ck := range cookies {
			ck.Path = prefix
			ck.Domain = ""
			ck.Secure = origin.Scheme == "https"
			resp.Header.Add("Set-Cookie", ck.String())
		}
		if location := resp.Header.Get("Location"); strings.HasPrefix(location, "/") && !strings.HasPrefix(location, prefix) {
			resp.Header.Set("Location", prefix+strings.TrimPrefix(location, "/"))
		}
		resp.Header.Set("X-Frame-Options", "SAMEORIGIN")
		policies := []string{}
		for _, part := range strings.Split(resp.Header.Get("Content-Security-Policy"), ";") {
			if p := strings.TrimSpace(part); p != "" && !strings.HasPrefix(p, "frame-ancestors") {
				policies = append(policies, p)
			}
		}
		policies = append(policies, "frame-ancestors 'self'")
		resp.Header.Set("Content-Security-Policy", strings.Join(policies, "; "))
		if err := brandResponse(resp, c.Request, path, s.Locale); err != nil {
			return err
		}
		return revalidateAsset(resp, c.Request, path)
	}
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		http.Error(w, "Agent EDU Tutor workspace unavailable; reopen from course", 502)
	}
	proxy.FlushInterval = -1
	_ = http.NewResponseController(c.Writer).SetWriteDeadline(time.Time{})
	request := c.Request
	if isSocket {
		ctx, cancel := context.WithCancel(request.Context())
		defer cancel()
		go h.watchAuthorization(ctx, cancel, s.ID, s.AccessKey, 15*time.Second)
		request = request.WithContext(ctx)
	}
	proxy.ServeHTTP(c.Writer, request)
}

func (h *Handler) watchAuthorization(ctx context.Context, cancel context.CancelFunc, id, accessKey string, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s, exists := h.get(id)
			check, stop := context.WithTimeout(ctx, 5*time.Second)
			valid := exists && same(accessKey, s.AccessKey) && h.allowed(check, s)
			stop()
			if !valid {
				cancel()
				return
			}
		}
	}
}
