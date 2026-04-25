package lab

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"k8s.io/client-go/rest"

	"edu-platform/internal/middleware"
	appjwt "edu-platform/pkg/jwt"
	"edu-platform/pkg/response"
)

type Handler struct {
	service    *Service
	jwtManager *appjwt.Manager
}

func NewHandler(service *Service, jwtManager *appjwt.Manager) *Handler {
	return &Handler{service: service, jwtManager: jwtManager}
}

func (h *Handler) GetImages(c *gin.Context) {
	response.Success(c, []gin.H{}, "K8S 运行时不再从 Docker daemon 枚举镜像，请在课程/项目中直接填写镜像名")
}

func (h *Handler) GetActiveSession(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		response.Unauthorized(c, "未登录")
		return
	}

	session, err := h.service.GetActiveSession(c.Request.Context(), userID)
	if err != nil {
		response.Internal(c, "获取会话失败: "+err.Error())
		return
	}
	if session == nil {
		response.Success[any](c, nil, "")
		return
	}

	response.Success(c, gin.H{
		"session": session,
		"urls":    h.urlsFor(c, session),
	}, "")
}

func (h *Handler) GetUserSessions(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		response.Unauthorized(c, "未登录")
		return
	}

	sessions, err := h.service.GetUserSessions(c.Request.Context(), userID)
	if err != nil {
		response.Internal(c, "获取会话列表失败: "+err.Error())
		return
	}
	response.Success(c, sessions, "")
}

func (h *Handler) CreateSession(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		response.Unauthorized(c, "未登录")
		return
	}

	var req struct {
		SourceType SourceType `json:"sourceType"`
		SourceID   uint64     `json:"sourceId"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数无效")
		return
	}
	if req.SourceType != SourceTypeCourse && req.SourceType != SourceTypeProject {
		response.BadRequest(c, "无效的来源类型")
		return
	}
	if req.SourceID == 0 {
		response.BadRequest(c, "缺少必要参数")
		return
	}

	session, err := h.service.CreateSession(c.Request.Context(), CreateSessionParams{
		UserID:     userID,
		SourceType: req.SourceType,
		SourceID:   req.SourceID,
	})
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, gin.H{
		"session": session,
		"urls":    h.urlsFor(c, session),
	}, "")
}

func (h *Handler) StopSession(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		response.Unauthorized(c, "未登录")
		return
	}

	sessionID, err := parseUintParam(c, "sessionId")
	if err != nil {
		response.BadRequest(c, "无效的会话ID")
		return
	}
	if err := h.service.StopSession(c.Request.Context(), userID, sessionID); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, gin.H{"message": "实验环境已停止"}, "")
}

func (h *Handler) GetSessionURLs(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		response.Unauthorized(c, "未登录")
		return
	}

	session, err := h.service.GetActiveSession(c.Request.Context(), userID)
	if err != nil {
		response.Internal(c, "获取URL失败: "+err.Error())
		return
	}
	if session == nil {
		response.NotFound(c, "没有活跃的实验环境")
		return
	}
	response.Success(c, h.urlsFor(c, session), "")
}

func (h *Handler) ExecuteCommand(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		response.Unauthorized(c, "未登录")
		return
	}

	var req struct {
		Command   string `json:"command"`
		ManualID  uint64 `json:"manualId"`
		StepOrder int    `json:"stepOrder"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Command) == "" {
		response.BadRequest(c, "缺少命令参数")
		return
	}

	session, err := h.service.GetActiveSession(c.Request.Context(), userID)
	if err != nil {
		response.Internal(c, "执行命令失败: "+err.Error())
		return
	}
	if session == nil {
		response.NotFound(c, "没有活跃的实验环境")
		return
	}

	result := h.service.ExecuteCommand(c.Request.Context(), session, req.Command)
	h.service.RecordTerminalEventAsync(c.Request.Context(), userID, session.ID, req.ManualID, req.StepOrder, req.Command, firstNonEmpty(result.Output, result.Error), result.ExitCode)
	response.Success(c, result, "")
}

func (h *Handler) ProxyGateway(c *gin.Context) {
	h.proxyToTarget(c, PortNameGateway, "/api/lab/gateway")
}

func (h *Handler) ProxyTarget(c *gin.Context) {
	target := c.Param("target")
	h.proxyToTarget(c, target, "/api/lab/proxy")
}

func (h *Handler) proxyToTarget(c *gin.Context, target, routeBase string) {
	sessionID, err := parseUintParam(c, "sessionId")
	if err != nil {
		response.BadRequest(c, "无效的会话ID")
		return
	}

	userID, authToken := h.proxyUserID(c, sessionID, routeBase)
	if userID == 0 {
		response.Unauthorized(c, "未登录")
		return
	}

	session, err := h.service.GetOwnedSession(c.Request.Context(), userID, sessionID)
	if err != nil {
		response.Internal(c, "Gateway 代理失败: "+err.Error())
		return
	}
	if session == nil || session.Status != SessionStatusRunning {
		response.NotFound(c, "实验会话不存在或已过期")
		return
	}
	if target == PortNameGateway && (session.RuntimeMode != RuntimeModeOpenClaw || session.GatewayPort == 0) {
		response.BadRequest(c, "当前会话未启用 Gateway")
		return
	}
	resolvedTarget, ok := resolveProxyTarget(session, target)
	if !ok {
		response.Forbidden(c, "无权访问该代理目标")
		return
	}

	suffix := c.Param("proxyPath")
	upstream, err := h.service.ServiceProxyURL(session.ID, resolvedTarget, suffix, c.Request.URL.RawQuery)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if authToken != "" {
		h.setProxyCookie(c, session.ID, routeBase, authToken)
	}

	proxy, err := h.reverseProxy(upstream, session.ID, resolvedTarget, routeBase)
	if err != nil {
		response.Internal(c, "Gateway 代理失败: "+err.Error())
		return
	}
	proxy.ServeHTTP(c.Writer, c.Request)
}

func (h *Handler) reverseProxy(upstream *url.URL, sessionID uint64, target, routeBase string) (*httputil.ReverseProxy, error) {
	restCfg := h.service.RestConfig()
	if restCfg == nil {
		return nil, errors.New("K8S REST 配置未启用")
	}
	transport, err := rest.TransportFor(rest.CopyConfig(restCfg))
	if err != nil {
		return nil, err
	}

	proxyBase := fmt.Sprintf("%s/%d", routeBase, sessionID)
	if routeBase == "/api/lab/proxy" {
		proxyBase = fmt.Sprintf("%s/%d/%s", routeBase, sessionID, target)
	}

	return &httputil.ReverseProxy{
		Transport: transport,
		Director: func(req *http.Request) {
			isWebSocket := strings.EqualFold(req.Header.Get("Upgrade"), "websocket")

			req.URL.Scheme = upstream.Scheme
			req.URL.Host = upstream.Host
			req.URL.Path = upstream.Path
			req.URL.RawPath = upstream.RawPath
			req.URL.RawQuery = upstream.RawQuery
			req.Host = upstream.Host

			req.Header.Del("Authorization")
			req.Header.Del("Proxy-Connection")
			req.Header.Del("Content-Length")
			if isWebSocket {
				req.Header.Set("Connection", "Upgrade")
				req.Header.Set("Upgrade", "websocket")
			} else {
				req.Header.Del("Connection")
			}
		},
		ModifyResponse: func(resp *http.Response) error {
			stripFrameBlockingHeaders(resp.Header)
			rewriteLocation(resp.Header, proxyBase)
			return nil
		},
		ErrorHandler: func(w http.ResponseWriter, _ *http.Request, err error) {
			if !headerWritten(w) {
				w.WriteHeader(http.StatusBadGateway)
				_, _ = w.Write([]byte("Gateway 代理失败: " + err.Error()))
				return
			}
		},
	}, nil
}

func (h *Handler) urlsFor(c *gin.Context, session *UserLabSession) URLs {
	urls := h.service.BuildURLs(session)
	token := bearerOrQueryToken(c)
	if token == "" {
		return urls
	}
	if urls.VNCURL != "" {
		urls.VNCURL = appendQuery(urls.VNCURL, "authToken", token)
		urls.VNCURL = rewriteVNCWebsockifyAuth(urls.VNCURL, token)
	}
	if urls.IDEURL != "" {
		urls.IDEURL = appendQuery(urls.IDEURL, "authToken", token)
	}
	for idx := range urls.AppURLs {
		if urls.AppURLs[idx].URL != "" {
			urls.AppURLs[idx].URL = appendQuery(urls.AppURLs[idx].URL, "authToken", token)
		}
	}
	return urls
}

func resolveProxyTarget(session *UserLabSession, target string) (string, bool) {
	normalized := normalizeProxyTarget(target)
	switch normalized {
	case PortNameNoVNC:
		return normalized, session != nil && session.VNCPort > 0
	case PortNameIDE:
		return normalized, session != nil && session.IDEPort > 0
	case PortNameGateway:
		return normalized, session != nil && session.RuntimeMode == RuntimeModeOpenClaw && session.GatewayPort > 0
	}
	target = strings.TrimSpace(strings.ToLower(target))
	if session == nil || target == "" {
		return "", false
	}
	for _, port := range session.AppPorts {
		if target == appPortName(port.Name) {
			return target, true
		}
	}
	return "", false
}

func (h *Handler) proxyUserID(c *gin.Context, sessionID uint64, routeBase string) (uint64, string) {
	token := bearerOrQueryToken(c)
	if token == "" {
		token, _ = c.Cookie(proxyCookieName(sessionID))
	}
	if token == "" {
		return 0, ""
	}
	claims, err := h.jwtManager.ParseToken(token)
	if err != nil {
		return 0, ""
	}
	return claims.UserID, token
}

func (h *Handler) setProxyCookie(c *gin.Context, sessionID uint64, routeBase, token string) {
	path := fmt.Sprintf("%s/%d", routeBase, sessionID)
	if routeBase == "/api/lab/proxy" {
		path = fmt.Sprintf("%s/%d", routeBase, sessionID)
	}
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     proxyCookieName(sessionID),
		Value:    url.QueryEscape(token),
		Path:     path,
		MaxAge:   int((2 * time.Hour).Seconds()),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
}

func currentUserID(c *gin.Context) (uint64, bool) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil || claims.UserID == 0 {
		return 0, false
	}
	return claims.UserID, true
}

func parseUintParam(c *gin.Context, key string) (uint64, error) {
	value := strings.TrimSpace(c.Param(key))
	parsed, err := strconv.ParseUint(value, 10, 64)
	if err != nil || parsed == 0 {
		return 0, errors.New("invalid id")
	}
	return parsed, nil
}

func bearerOrQueryToken(c *gin.Context) string {
	token := appjwt.ExtractBearerToken(c.GetHeader("Authorization"))
	if token != "" {
		return token
	}
	return strings.TrimSpace(c.Query("authToken"))
}

func proxyCookieName(sessionID uint64) string {
	return fmt.Sprintf("edu_lab_proxy_%d", sessionID)
}

func stripFrameBlockingHeaders(headers http.Header) {
	blocked := []string{
		"X-Frame-Options",
		"Frame-Options",
		"Content-Security-Policy",
		"Content-Security-Policy-Report-Only",
	}
	for _, key := range blocked {
		headers.Del(key)
	}
}

func rewriteLocation(headers http.Header, proxyBase string) {
	location := headers.Get("Location")
	if location == "" {
		return
	}
	if strings.HasPrefix(location, "/") {
		headers.Set("Location", proxyBase+location)
	}
}

func appendQuery(rawURL, key, value string) string {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}
	query := parsed.Query()
	query.Set(key, value)
	parsed.RawQuery = query.Encode()
	return parsed.String()
}

func rewriteVNCWebsockifyAuth(rawURL, token string) string {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}
	query := parsed.Query()
	path := query.Get("path")
	if path == "" {
		return rawURL
	}
	separator := "?"
	if strings.Contains(path, "?") {
		separator = "&"
	}
	query.Set("path", path+separator+"authToken="+url.QueryEscape(token))
	parsed.RawQuery = query.Encode()
	return parsed.String()
}

func headerWritten(_ http.ResponseWriter) bool {
	return false
}
