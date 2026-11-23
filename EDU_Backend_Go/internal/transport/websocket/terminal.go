package websocket

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"k8s.io/client-go/tools/remotecommand"

	"edu-platform/internal/config"
	"edu-platform/internal/domain/lab"
	"edu-platform/internal/infra/authz"
	"edu-platform/internal/middleware"
	"edu-platform/pkg/i18n"
	"edu-platform/pkg/jwt"
)

type TerminalHandler struct {
	jwtManager     *jwt.Manager
	labService     *lab.Service
	cfg            *config.Config
	tokenBlacklist *authz.TokenBlacklist
}

func NewTerminalHandler(jwtManager *jwt.Manager, labService *lab.Service, cfg *config.Config, tokenBlacklist *authz.TokenBlacklist) *TerminalHandler {
	return &TerminalHandler{jwtManager: jwtManager, labService: labService, cfg: cfg, tokenBlacklist: tokenBlacklist}
}

type terminalMessage struct {
	Type string `json:"type"`
	Data string `json:"data,omitempty"`
	Rows int    `json:"rows,omitempty"`
	Cols int    `json:"cols,omitempty"`
}

type terminalTransport string

const (
	transportJSON terminalTransport = "json"
	transportRaw  terminalTransport = "raw"
)

func (h *TerminalHandler) Handle(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": i18n.Message(c.Request.Context(), "terminal.tokenRequired", nil), "code": "TERMINAL_TOKEN_REQUIRED"})
		return
	}
	claims, err := h.jwtManager.ParseToken(token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": i18n.Message(c.Request.Context(), "terminal.tokenInvalid", nil), "code": "TERMINAL_TOKEN_INVALID"})
		return
	}
	revoked, err := h.tokenBlacklist.IsRevoked(c.Request.Context(), token)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"success": false, "error": i18n.Message(c.Request.Context(), "terminal.authCheckFailed", nil), "code": "TERMINAL_AUTH_CHECK_FAILED"})
		return
	}
	if revoked {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": i18n.Message(c.Request.Context(), "terminal.tokenRevoked", nil), "code": "TERMINAL_TOKEN_REVOKED"})
		return
	}
	if h.labService == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"success": false, "error": i18n.Message(c.Request.Context(), "terminal.labUnavailable", nil), "code": "TERMINAL_LAB_UNAVAILABLE"})
		return
	}

	sessionID, err := strconv.ParseUint(c.Query("sessionId"), 10, 64)
	if err != nil || sessionID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": i18n.Message(c.Request.Context(), "terminal.sessionIdInvalid", nil), "code": "TERMINAL_SESSION_ID_INVALID"})
		return
	}

	clientID := strings.TrimSpace(c.Query("labClientId"))
	if clientID == "" {
		clientID = fmt.Sprintf("legacy-user-%d", claims.UserID)
	}
	session, err := h.labService.RenewSessionLease(c.Request.Context(), claims.UserID, sessionID, clientID)
	if err != nil {
		if errors.Is(err, lab.ErrSessionInUse) {
			c.JSON(http.StatusConflict, gin.H{"success": false, "error": i18n.Message(c.Request.Context(), "lab.sessionInUse", nil), "code": "LAB_SESSION_IN_USE"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": i18n.Message(c.Request.Context(), "terminal.sessionQueryFailed", nil), "code": "TERMINAL_SESSION_QUERY_FAILED"})
		return
	}
	if session == nil || session.ID != sessionID {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": i18n.Message(c.Request.Context(), "terminal.sessionExpired", nil), "code": "TERMINAL_SESSION_EXPIRED"})
		return
	}

	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return middleware.IsOriginAllowed(h.cfg, r.Header.Get("Origin"))
		},
	}
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	if rawConn := conn.UnderlyingConn(); rawConn != nil {
		_ = rawConn.SetDeadline(time.Time{})
	}

	transportMode := normalizeTransport(c.DefaultQuery("transport", "json"))
	terminalID := c.DefaultQuery("terminalId", "default")
	mode := c.DefaultQuery("mode", "ssh")
	command := c.DefaultQuery("command", "/bin/bash")
	sessionPolicy := c.DefaultQuery("sessionPolicy", "reuse")
	initialCommand := strings.TrimSpace(c.Query("initialCommand"))

	if err := h.handleK8SExec(c.Request.Context(), conn, session, terminalID, mode, command, sessionPolicy, initialCommand, transportMode); err != nil {
		_ = conn.WriteJSON(gin.H{"type": "error", "message": i18n.Message(c.Request.Context(), "terminal.execFailed", nil), "code": "TERMINAL_EXEC_FAILED"})
	}
}

func (h *TerminalHandler) handleK8SExec(
	parent context.Context,
	conn *websocket.Conn,
	session *lab.UserLabSession,
	terminalID string,
	mode string,
	command string,
	sessionPolicy string,
	initialCommand string,
	transportMode terminalTransport,
) error {
	ctx, cancel := context.WithCancel(parent)
	defer cancel()

	reader, writer := io.Pipe()
	defer reader.Close()
	defer writer.Close()

	sizeQueue := newTerminalSizeQueue()
	writeMu := &sync.Mutex{}
	outputWriter := websocketOutputWriter{conn: conn, transport: transportMode, writeMu: writeMu}
	execCommand := buildExecCommand(mode, command, sessionPolicy, terminalID)
	// 课程编辑、运行与 OpenCode 使用同一 UID，避免生成 root 文件后 IDE 无法编辑。
	execCommand = h.labService.WorkspaceExecCommand(session, execCommand)

	streamDone := make(chan error, 1)
	go func() {
		streamDone <- h.labService.StreamExec(ctx, session, execCommand, true, reader, outputWriter, nil, sizeQueue)
	}()

	writeMu.Lock()
	err := conn.WriteJSON(gin.H{"type": "connected"})
	writeMu.Unlock()
	if err != nil {
		cancel()
		return err
	}

	if initial := effectiveInitialCommand(initialCommand, terminalID, mode); initial != "" {
		go func() {
			timer := time.NewTimer(1200 * time.Millisecond)
			defer timer.Stop()
			select {
			case <-ctx.Done():
			case <-timer.C:
				_, _ = writer.Write([]byte(initial + "\n"))
			}
		}()
	}

	pingDone := startPingLoop(ctx, conn, writeMu, cancel)
	defer func() {
		cancel()
		<-pingDone
	}()

	readDone := make(chan error, 1)
	go func() {
		readDone <- pumpWebSocketInput(ctx, conn, writer, sizeQueue, transportMode)
	}()

	select {
	case err := <-streamDone:
		cancel()
		if err != nil && !strings.Contains(err.Error(), "context canceled") {
			return fmt.Errorf("K8S exec 失败: %w", err)
		}
		return nil
	case err := <-readDone:
		cancel()
		if err != nil && !websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
			return err
		}
		return nil
	case <-ctx.Done():
		return nil
	}
}

func pumpWebSocketInput(
	ctx context.Context,
	conn *websocket.Conn,
	writer *io.PipeWriter,
	sizeQueue *terminalSizeQueue,
	transportMode terminalTransport,
) error {
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		messageType, payload, err := conn.ReadMessage()
		if err != nil {
			_ = writer.CloseWithError(err)
			return err
		}

		if transportMode == transportRaw {
			if messageType == websocket.BinaryMessage {
				if len(payload) > 0 {
					_, _ = writer.Write(payload)
				}
				continue
			}
			if handleResizePayload(payload, sizeQueue) {
				continue
			}
			if len(payload) > 0 {
				_, _ = writer.Write(payload)
			}
			continue
		}

		var msg terminalMessage
		if err := json.Unmarshal(payload, &msg); err != nil {
			if len(payload) > 0 {
				_, _ = writer.Write(payload)
			}
			continue
		}

		switch msg.Type {
		case "input":
			if msg.Data != "" {
				_, _ = writer.Write([]byte(msg.Data))
			}
		case "input_binary_base64":
			decoded, err := base64.StdEncoding.DecodeString(strings.TrimSpace(msg.Data))
			if err == nil && len(decoded) > 0 {
				_, _ = writer.Write(decoded)
			}
		case "resize":
			sizeQueue.Push(msg.Rows, msg.Cols)
		}
	}
}

type websocketOutputWriter struct {
	conn      *websocket.Conn
	transport terminalTransport
	writeMu   *sync.Mutex
}

func (w websocketOutputWriter) Write(p []byte) (int, error) {
	if len(p) == 0 {
		return 0, nil
	}
	w.writeMu.Lock()
	defer w.writeMu.Unlock()
	if w.transport == transportRaw {
		if err := w.conn.WriteMessage(websocket.BinaryMessage, p); err != nil {
			return 0, err
		}
		return len(p), nil
	}
	if err := w.conn.WriteJSON(gin.H{"type": "output", "data": string(p)}); err != nil {
		return 0, err
	}
	return len(p), nil
}

type terminalSizeQueue struct {
	ch chan remotecommand.TerminalSize
}

func newTerminalSizeQueue() *terminalSizeQueue {
	return &terminalSizeQueue{ch: make(chan remotecommand.TerminalSize, 8)}
}

func (q *terminalSizeQueue) Next() *remotecommand.TerminalSize {
	size, ok := <-q.ch
	if !ok {
		return nil
	}
	return &size
}

func (q *terminalSizeQueue) Push(rows, cols int) {
	if rows < 2 || cols < 2 {
		return
	}
	size := remotecommand.TerminalSize{Width: uint16(cols), Height: uint16(rows)}
	select {
	case q.ch <- size:
	default:
		select {
		case <-q.ch:
		default:
		}
		q.ch <- size
	}
}

func normalizeTransport(raw string) terminalTransport {
	if raw == string(transportRaw) {
		return transportRaw
	}
	return transportJSON
}

func buildExecCommand(mode, command, sessionPolicy, terminalID string) []string {
	projectDirectory := `if [ -n "${EDU_PROJECT_DIR:-}" ] && [ -d "$EDU_PROJECT_DIR" ]; then cd -- "$EDU_PROJECT_DIR"; fi;`
	if mode != "exec" {
		// 默认终端也设 TERM 并走 tmux：学生常按手册在此手动启动 opencode 等全屏 TUI，
		// 裸 bash exec 下 TUI 高频全屏重绘会冲垮 K8S SPDY exec 流，导致
		// “终端执行失败 / 连接已断开”。tmux 提供稳定 PTY 并支持断线重连，
		// 与 CLI(exec) 终端行为一致；若镜像无 tmux 则回退到普通登录 shell。
		sessionName := "edu_" + sanitizeTerminalSessionName(terminalID)
		restart := ""
		if sessionPolicy == "restart" {
			restart = fmt.Sprintf("tmux kill-session -t %s 2>/dev/null || true;", sessionName)
		}
		run := strings.Join([]string{
			projectDirectory,
			"export TERM=xterm-256color COLORTERM=truecolor;",
			"if command -v tmux >/dev/null 2>&1; then",
			restart,
			fmt.Sprintf("tmux has-session -t %s 2>/dev/null && tmux attach-session -t %s || tmux new-session -s %s;",
				sessionName, sessionName, sessionName),
			"else",
			"exec bash -l;",
			"fi",
		}, " ")
		return []string{"/bin/bash", "-lc", run}
	}

	sessionName := "edu_" + sanitizeTerminalSessionName(command)
	escapedCommand := strings.ReplaceAll(command, "'", `'\''`)
	restart := ""
	if sessionPolicy == "restart" {
		restart = fmt.Sprintf("tmux kill-session -t %s 2>/dev/null || true;", sessionName)
	}
	termValue := "xterm"
	if terminalID == "opencode" || regexp.MustCompile(`(?i)opencode`).MatchString(command) {
		termValue = "xterm-256color"
	}
	run := strings.Join([]string{
		projectDirectory,
		fmt.Sprintf("export TERM=%s COLORTERM=truecolor;", termValue),
		"if command -v tmux >/dev/null 2>&1; then",
		restart,
		fmt.Sprintf("tmux has-session -t %s 2>/dev/null && tmux attach-session -t %s || tmux new-session -s %s -d '%s; exec bash' \\; attach-session -t %s;",
			sessionName, sessionName, sessionName, escapedCommand, sessionName),
		"else",
		fmt.Sprintf("bash -lc '%s; exec bash';", escapedCommand),
		"fi",
	}, " ")
	return []string{"/bin/bash", "-lc", run}
}

func effectiveInitialCommand(initialCommand, terminalID, mode string) string {
	if mode == "exec" {
		return ""
	}
	if initialCommand != "" {
		return initialCommand
	}
	return ""
}

func sanitizeTerminalSessionName(value string) string {
	re := regexp.MustCompile(`[^a-zA-Z0-9]+`)
	cleaned := strings.Trim(re.ReplaceAllString(value, "_"), "_")
	if cleaned == "" {
		return "shell"
	}
	if len(cleaned) > 40 {
		return cleaned[:40]
	}
	return cleaned
}

func handleResizePayload(payload []byte, sizeQueue *terminalSizeQueue) bool {
	var msg terminalMessage
	if err := json.Unmarshal(payload, &msg); err != nil || msg.Type != "resize" {
		return false
	}
	sizeQueue.Push(msg.Rows, msg.Cols)
	return true
}

func startPingLoop(ctx context.Context, conn *websocket.Conn, writeMu *sync.Mutex, cancel context.CancelFunc) <-chan struct{} {
	done := make(chan struct{})
	go func() {
		defer close(done)
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				writeMu.Lock()
				err := conn.WriteControl(websocket.PingMessage, nil, time.Now().Add(5*time.Second))
				writeMu.Unlock()
				if err != nil {
					cancel()
					return
				}
			}
		}
	}()
	conn.SetPongHandler(func(string) error { return nil })
	return done
}
