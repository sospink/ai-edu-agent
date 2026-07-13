package lab

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"k8s.io/client-go/rest"

	"edu-platform/internal/middleware"
	"edu-platform/pkg/i18n"
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
	response.SuccessKey(c, []gin.H{}, "lab.imagesConfiguredExternally", nil)
}

func (h *Handler) GetActiveSession(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}

	session, err := h.service.GetActiveSessionForClient(c.Request.Context(), userID, labClientIDForUser(c, userID))
	if err != nil {
		h.writeSessionAccessError(c, err, "LAB_ACTIVE_SESSION_FAILED", "lab.activeSessionFailed")
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
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}

	sessions, err := h.service.GetUserSessions(c.Request.Context(), userID)
	if err != nil {
		response.ErrorKey(c, http.StatusInternalServerError, "LAB_SESSION_LIST_FAILED", "lab.sessionListFailed", nil)
		return
	}
	response.Success(c, sessions, "")
}

func (h *Handler) CreateSession(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}

	var req struct {
		SourceType SourceType `json:"sourceType"`
		SourceID   uint64     `json:"sourceId"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}
	if req.SourceType != SourceTypeCourse && req.SourceType != SourceTypeProject {
		response.ErrorKey(c, http.StatusBadRequest, "LAB_SOURCE_TYPE_INVALID", "lab.invalidSourceType", nil)
		return
	}
	if req.SourceID == 0 {
		response.ErrorKey(c, http.StatusBadRequest, "LAB_SOURCE_REQUIRED", "lab.sourceRequired", nil)
		return
	}

	session, err := h.service.CreateSession(c.Request.Context(), CreateSessionParams{
		UserID:     userID,
		SourceType: req.SourceType,
		SourceID:   req.SourceID,
		ClientID:   labClientIDForUser(c, userID),
	})
	if err != nil {
		if errors.Is(err, ErrSessionInUse) {
			response.ErrorKey(c, http.StatusConflict, "LAB_SESSION_IN_USE", "lab.sessionInUse", nil)
			return
		}
		if errors.Is(err, ErrCapacityReached) {
			response.ErrorKey(c, http.StatusServiceUnavailable, "LAB_CAPACITY_REACHED", "lab.capacityReached", nil)
			return
		}
		// 透传 service 层的具体原因（如并发上限、镜像未配置等），response.Error 会按语言翻译，
		// 英文请求经 i18n.SystemText 回退为通用英文，避免中文泄漏，同时保留中文端的可操作信息。
		response.Error(c, http.StatusBadRequest, err.Error(), "LAB_CREATE_FAILED")
		return
	}

	response.Success(c, gin.H{
		"session": session,
		"urls":    h.urlsFor(c, session),
	}, "")
}

func (h *Handler) RenewLease(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	sessionID, err := parseUintParam(c, "sessionId")
	if err != nil {
		response.ErrorKey(c, http.StatusBadRequest, "LAB_SESSION_ID_INVALID", "lab.invalidSessionId", nil)
		return
	}
	session, err := h.service.RenewSessionLease(c.Request.Context(), userID, sessionID, labClientIDForUser(c, userID))
	if err != nil {
		h.writeSessionAccessError(c, err, "LAB_LEASE_RENEW_FAILED", "lab.sessionExpired")
		return
	}
	response.Success(c, gin.H{"sessionId": session.ID, "leaseExpiresAt": session.LeaseExpiresAt}, "")
}

func (h *Handler) StopSession(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}

	sessionID, err := parseUintParam(c, "sessionId")
	if err != nil {
		response.ErrorKey(c, http.StatusBadRequest, "LAB_SESSION_ID_INVALID", "lab.invalidSessionId", nil)
		return
	}
	if _, err := h.service.RenewSessionLease(c.Request.Context(), userID, sessionID, labClientIDForUser(c, userID)); err != nil {
		h.writeSessionAccessError(c, err, "LAB_STOP_FAILED", "lab.stopFailed")
		return
	}
	if err := h.service.StopSession(c.Request.Context(), userID, sessionID); err != nil {
		response.ErrorKey(c, http.StatusBadRequest, "LAB_STOP_FAILED", "lab.stopFailed", nil)
		return
	}
	message := i18n.Message(c.Request.Context(), "lab.stopped", nil)
	response.SuccessKey(c, gin.H{"message": message}, "lab.stopped", nil)
}

func (h *Handler) GetSessionURLs(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}

	session, err := h.service.GetActiveSessionForClient(c.Request.Context(), userID, labClientIDForUser(c, userID))
	if err != nil {
		h.writeSessionAccessError(c, err, "LAB_URLS_FAILED", "lab.urlsFailed")
		return
	}
	if session == nil {
		response.ErrorKey(c, http.StatusNotFound, "LAB_ACTIVE_SESSION_NOT_FOUND", "lab.noActiveSession", nil)
		return
	}
	response.Success(c, h.urlsFor(c, session), "")
}

func (h *Handler) ExecuteCommand(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}

	var req struct {
		Command   string `json:"command"`
		ManualID  uint64 `json:"manualId"`
		StepOrder int    `json:"stepOrder"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Command) == "" {
		response.ErrorKey(c, http.StatusBadRequest, "LAB_COMMAND_REQUIRED", "lab.commandRequired", nil)
		return
	}

	session, err := h.service.GetActiveSessionForClient(c.Request.Context(), userID, labClientIDForUser(c, userID))
	if err != nil {
		h.writeSessionAccessError(c, err, "LAB_EXECUTE_FAILED", "lab.executeFailed")
		return
	}
	if session == nil {
		response.ErrorKey(c, http.StatusNotFound, "LAB_ACTIVE_SESSION_NOT_FOUND", "lab.noActiveSession", nil)
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
		response.ErrorKey(c, http.StatusBadRequest, "LAB_SESSION_ID_INVALID", "lab.invalidSessionId", nil)
		return
	}

	userID, authToken := h.proxyUserID(c, sessionID, routeBase)
	if userID == 0 {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}

	session, err := h.service.GetOwnedSession(c.Request.Context(), userID, sessionID)
	if err != nil {
		response.ErrorKey(c, http.StatusInternalServerError, "LAB_PROXY_FAILED", "lab.proxyFailed", nil)
		return
	}
	if session == nil || session.Status != SessionStatusRunning {
		response.ErrorKey(c, http.StatusNotFound, "LAB_SESSION_EXPIRED", "lab.sessionExpired", nil)
		return
	}
	if _, err := h.service.RenewSessionLease(c.Request.Context(), userID, sessionID, labClientIDForUser(c, userID)); err != nil {
		h.writeSessionAccessError(c, err, "LAB_PROXY_FAILED", "lab.proxyFailed")
		return
	}
	if target == PortNameGateway && (session.RuntimeMode != RuntimeModeOpenClaw || session.GatewayPort == 0) {
		response.ErrorKey(c, http.StatusBadRequest, "LAB_GATEWAY_DISABLED", "lab.gatewayDisabled", nil)
		return
	}
	resolvedTarget, ok := resolveProxyTarget(session, target)
	if !ok {
		response.ErrorKey(c, http.StatusForbidden, "LAB_PROXY_FORBIDDEN", "lab.proxyForbidden", nil)
		return
	}

	suffix := c.Param("proxyPath")
	upstream, err := h.service.ServiceProxyURL(session.ID, resolvedTarget, suffix, c.Request.URL.RawQuery)
	if err != nil {
		response.ErrorKey(c, http.StatusBadRequest, "LAB_PROXY_TARGET_INVALID", "lab.proxyTargetInvalid", nil)
		return
	}
	if authToken != "" {
		h.setProxyCookie(c, session.ID, routeBase, authToken)
	}

	proxy, err := h.reverseProxy(upstream, session.ID, resolvedTarget, routeBase)
	if err != nil {
		response.ErrorKey(c, http.StatusInternalServerError, "LAB_PROXY_FAILED", "lab.proxyFailed", nil)
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
			req.Header.Del("Accept-Encoding")
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
			rewriteProxyResponseBody(resp, k8sServiceProxyBase(h.service.runtimeNamespace(), sessionID, target), proxyBase)
			return nil
		},
		ErrorHandler: func(w http.ResponseWriter, req *http.Request, _ error) {
			if !headerWritten(w) {
				w.Header().Set("Content-Type", "text/plain; charset=utf-8")
				w.WriteHeader(http.StatusBadGateway)
				_, _ = w.Write([]byte(i18n.Message(req.Context(), "lab.proxyFailed", nil)))
				return
			}
		},
	}, nil
}

func (h *Handler) urlsFor(c *gin.Context, session *UserLabSession) URLs {
	urls := h.service.BuildURLs(session)
	token := bearerOrQueryToken(c)
	clientID := labClientID(c)
	if token == "" {
		return urls
	}
	if urls.VNCURL != "" {
		urls.VNCURL = appendQuery(urls.VNCURL, "authToken", token)
		urls.VNCURL = appendQuery(urls.VNCURL, "labClientId", clientID)
		urls.VNCURL = rewriteVNCWebsockifyAccess(urls.VNCURL, token, clientID)
	}
	if urls.IDEURL != "" {
		urls.IDEURL = appendQuery(urls.IDEURL, "authToken", token)
		urls.IDEURL = appendQuery(urls.IDEURL, "labClientId", clientID)
	}
	for idx := range urls.AppURLs {
		if urls.AppURLs[idx].URL != "" {
			urls.AppURLs[idx].URL = appendQuery(urls.AppURLs[idx].URL, "authToken", token)
			urls.AppURLs[idx].URL = appendQuery(urls.AppURLs[idx].URL, "labClientId", clientID)
		}
	}
	return urls
}

func labClientID(c *gin.Context) string {
	if c == nil || c.Request == nil {
		return ""
	}
	value := strings.TrimSpace(c.GetHeader("X-Lab-Client"))
	if value == "" {
		value = strings.TrimSpace(c.Query("labClientId"))
	}
	return normalizeClientID(value)
}

func labClientIDForUser(c *gin.Context, userID uint64) string {
	if value := labClientID(c); value != "" {
		return value
	}
	return fmt.Sprintf("legacy-user-%d", userID)
}

func (h *Handler) writeSessionAccessError(c *gin.Context, err error, fallbackCode string, fallbackKey i18n.MessageKey) {
	if errors.Is(err, ErrSessionInUse) {
		response.ErrorKey(c, http.StatusConflict, "LAB_SESSION_IN_USE", "lab.sessionInUse", nil)
		return
	}
	if strings.Contains(err.Error(), "客户端标识") {
		response.ErrorKey(c, http.StatusBadRequest, "LAB_CLIENT_ID_REQUIRED", "lab.clientIdRequired", nil)
		return
	}
	response.ErrorKey(c, http.StatusInternalServerError, fallbackCode, fallbackKey, nil)
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
	if rewritten, ok := rewriteK8SServiceProxyLocation(location, proxyBase); ok {
		headers.Set("Location", rewritten)
		return
	}
	if strings.HasPrefix(location, "/") {
		headers.Set("Location", proxyBase+location)
	}
}

func rewriteK8SServiceProxyLocation(location, proxyBase string) (string, bool) {
	parsed, err := url.Parse(location)
	if err != nil {
		return "", false
	}
	path := parsed.Path
	if !strings.HasPrefix(path, "/api/v1/namespaces/") {
		return "", false
	}
	proxyIndex := strings.Index(path, "/proxy")
	if proxyIndex < 0 {
		return "", false
	}
	suffix := path[proxyIndex+len("/proxy"):]
	if suffix == "" {
		suffix = "/"
	}
	parsed.Scheme = ""
	parsed.Host = ""
	parsed.User = nil
	parsed.Path = strings.TrimRight(proxyBase, "/") + suffix
	parsed.RawPath = ""
	return parsed.String(), true
}

func k8sServiceProxyBase(namespace string, sessionID uint64, target string) string {
	return fmt.Sprintf("/api/v1/namespaces/%s/services/%s:%s/proxy", namespace, ServiceName(sessionID), target)
}

func rewriteProxyResponseBody(resp *http.Response, internalBase, proxyBase string) {
	if resp == nil || resp.Body == nil || internalBase == "" || proxyBase == "" {
		return
	}
	contentType := strings.ToLower(resp.Header.Get("Content-Type"))
	if !isRewritableProxyContent(contentType) {
		return
	}

	body, err := io.ReadAll(resp.Body)
	_ = resp.Body.Close()
	if err != nil {
		resp.Body = io.NopCloser(bytes.NewReader(nil))
		resp.ContentLength = 0
		resp.Header.Set("Content-Length", "0")
		return
	}

	externalBase := strings.TrimRight(proxyBase, "/")
	replacements := [][2]string{
		{internalBase, externalBase},
		{url.QueryEscape(internalBase), url.QueryEscape(externalBase)},
		{strings.ReplaceAll(internalBase, "/", `\/`), strings.ReplaceAll(externalBase, "/", `\/`)},
	}
	rewritten := body
	for _, pair := range replacements {
		if pair[0] == "" || pair[0] == pair[1] {
			continue
		}
		rewritten = bytes.ReplaceAll(rewritten, []byte(pair[0]), []byte(pair[1]))
	}

	resp.Body = io.NopCloser(bytes.NewReader(rewritten))
	resp.ContentLength = int64(len(rewritten))
	resp.Header.Set("Content-Length", strconv.Itoa(len(rewritten)))
	resp.Header.Del("Content-Encoding")
	resp.Header.Del("ETag")
}

func isRewritableProxyContent(contentType string) bool {
	if contentType == "" {
		return false
	}
	return strings.Contains(contentType, "text/html") ||
		strings.Contains(contentType, "text/css") ||
		strings.Contains(contentType, "javascript") ||
		strings.Contains(contentType, "application/json") ||
		strings.Contains(contentType, "text/plain")
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
	return rewriteVNCWebsockifyAccess(rawURL, token, "")
}

func rewriteVNCWebsockifyAccess(rawURL, token, clientID string) string {
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
	path += separator + "authToken=" + url.QueryEscape(token)
	if clientID != "" {
		path += "&labClientId=" + url.QueryEscape(clientID)
	}
	query.Set("path", path)
	parsed.RawQuery = query.Encode()
	return parsed.String()
}

func headerWritten(_ http.ResponseWriter) bool {
	return false
}
