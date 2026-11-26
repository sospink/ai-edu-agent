// Package courseharness 将官方Harness Web作为隔离工作区嵌入课程页。
package courseharness

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"go.uber.org/zap"
	"gorm.io/gorm"

	"edu-platform/internal/domain/course"
	"edu-platform/internal/domain/llm"
)

const networkName = "edu-course-harness"

var errCapacity = errors.New("工作区容量已满")
var idPattern = regexp.MustCompile(`^[a-f0-9]{32}$`)
var launchPattern = regexp.MustCompile(`(?m)^dsh web: https?://[^\s]+[?&]token=([A-Za-z0-9_-]+)`)

type Instance struct {
	ID                                                         string
	UserID, LessonID                                           uint64
	Locale, Container, Address, AccessKey, ModelKey, LaunchKey string
	ExpiresAt                                                  time.Time
	PlatformToken                                              string
	LastSeen                                                   time.Time
}
type ticket struct {
	Instance  string
	ExpiresAt time.Time
	AccessKey string
}
type budget struct {
	Window       time.Time
	Count, Total int
	Active       bool
}
type Handler struct {
	db                                           *gorm.DB
	courses                                      *course.Service
	models                                       *llm.Store
	logger                                       *zap.Logger
	root, uploadRoot, image, origin, backendPort string
	mu                                           sync.Mutex
	lifecycle                                    sync.Mutex
	instances                                    map[string]Instance
	tickets                                      map[string]ticket
	budgets                                      map[string]*budget
	client                                       *http.Client
	tokenValid                                   func(context.Context, string) bool
	connections                                  map[string]int
}

func NewHandler(db *gorm.DB, courses *course.Service, models *llm.Store, uploads string, port int, logger *zap.Logger, tokenValid func(context.Context, string) bool) *Handler {
	root, _ := filepath.Abs(filepath.Join(filepath.Dir(uploads), ".settings", "course-harness"))
	h := &Handler{db: db, courses: courses, models: models, logger: logger, root: root, uploadRoot: uploads, image: os.Getenv("COURSE_HARNESS_IMAGE"), origin: strings.TrimRight(os.Getenv("COURSE_HARNESS_PUBLIC_ORIGIN"), "/"), backendPort: strconv.Itoa(port), instances: map[string]Instance{}, tickets: map[string]ticket{}, budgets: map[string]*budget{}, client: llm.NewHTTPClient()}
	h.tokenValid = tokenValid
	h.connections = map[string]int{}
	if h.image != "" {
		if data, err := os.ReadFile(filepath.Join(root, "instances.json")); err == nil {
			_ = json.Unmarshal(data, &h.instances)
		}
		if h.instances == nil {
			h.instances = map[string]Instance{}
		}
		// 重启后给浏览器重连留出空闲窗口，不延长绝对有效期。
		for id, instance := range h.instances {
			instance.LastSeen = time.Now()
			h.instances[id] = instance
		}
		go func() {
			for range time.NewTicker(time.Minute).C {
				h.reap()
			}
		}()
	}
	return h
}
func randomKey() string {
	var b [32]byte
	if _, err := rand.Read(b[:]); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b[:])
}
func same(a, b string) bool {
	return a != "" && b != "" && subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}
func docker(ctx context.Context, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, "docker", args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("容器操作失败: %s", args[0])
	}
	return strings.TrimSpace(string(output)), nil
}
func (h *Handler) saveLocked() error {
	if err := os.MkdirAll(h.root, 0700); err != nil {
		return err
	}
	data, err := json.Marshal(h.instances)
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp(h.root, ".instances-")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	if _, err = tmp.Write(data); err != nil {
		tmp.Close()
		return err
	}
	if err = tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), filepath.Join(h.root, "instances.json"))
}
func (h *Handler) get(id string) (Instance, bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	s, ok := h.instances[id]
	return s, ok && idPattern.MatchString(id) && time.Now().Before(s.ExpiresAt)
}
func (h *Handler) remove(s Instance) error {
	if !idPattern.MatchString(s.ID) || s.Container != "edu-harness-"+s.ID {
		return errors.New("工作区登记无效")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	// 只回收本模块登记的随机名称，不扫描/清理其他服务容器。
	exists, err := docker(ctx, "ps", "-aq", "--filter", "name=^"+s.Container+"$")
	if err != nil {
		return err
	}
	if exists != "" {
		if _, err := docker(ctx, "rm", "-f", s.Container); err != nil {
			return err
		}
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.instances, s.ID)
	delete(h.budgets, s.ID)
	delete(h.connections, s.ID)
	return h.saveLocked()
}
func (h *Handler) reap() {
	h.lifecycle.Lock()
	defer h.lifecycle.Unlock()
	h.mu.Lock()
	expired := []Instance{}
	for _, s := range h.instances {
		if time.Now().After(s.ExpiresAt) || (!s.LastSeen.IsZero() && time.Since(s.LastSeen) > 10*time.Minute && h.connections[s.ID] == 0) {
			expired = append(expired, s)
		}
	}
	for key, t := range h.tickets {
		if time.Now().After(t.ExpiresAt) {
			delete(h.tickets, key)
		}
	}
	h.mu.Unlock()
	for _, s := range expired {
		if err := h.remove(s); err != nil {
			h.logger.Warn("Harness过期工作区回收失败", zap.String("instance", s.ID))
		}
	}
	h.mu.Lock()
	live := []Instance{}
	for _, s := range h.instances {
		live = append(live, s)
	}
	h.mu.Unlock()
	for _, s := range live {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		valid := h.allowed(ctx, s)
		cancel()
		if !valid {
			_ = h.remove(s)
		}
	}
}
func (h *Handler) ensureNetwork(ctx context.Context) (string, error) {
	gateway, err := docker(ctx, "network", "inspect", networkName, "--format", "{{(index .IPAM.Config 0).Gateway}}")
	if err != nil {
		if _, err = docker(ctx, "network", "create", "--internal", "--opt", "com.docker.network.bridge.enable_icc=false", networkName); err != nil {
			return "", err
		}
		gateway, err = docker(ctx, "network", "inspect", networkName, "--format", "{{(index .IPAM.Config 0).Gateway}}")
	}
	return gateway, err
}
func (h *Handler) start(ctx context.Context, user uint64, lesson *course.CourseLesson, locale, platformToken string) (Instance, error) {
	h.lifecycle.Lock()
	defer h.lifecycle.Unlock()
	h.mu.Lock()
	list := []Instance{}
	for _, s := range h.instances {
		list = append(list, s)
	}
	h.mu.Unlock()
	for _, s := range list {
		if s.UserID == user && s.LessonID == lesson.ID && s.Locale == locale && time.Until(s.ExpiresAt) > 2*time.Minute {
			running, _ := docker(ctx, "inspect", s.Container, "--format", "{{.State.Running}}")
			if running == "true" {
				if !same(s.PlatformToken, platformToken) {
					s.AccessKey = randomKey()
				}
				s.PlatformToken = platformToken
				s.LastSeen = time.Now()
				h.mu.Lock()
				h.instances[s.ID] = s
				err := h.saveLocked()
				h.mu.Unlock()
				if err != nil {
					return Instance{}, err
				}
				return s, nil
			}
		}
	}
	for _, s := range list {
		if (s.UserID == user && s.LessonID == lesson.ID && s.Locale == locale) || time.Now().After(s.ExpiresAt) {
			if err := h.remove(s); err != nil {
				return Instance{}, err
			}
		}
	}
	h.mu.Lock()
	count := len(h.instances)
	h.mu.Unlock()
	if count >= 2 {
		return Instance{}, errCapacity
	}
	gateway, err := h.ensureNetwork(ctx)
	if err != nil {
		return Instance{}, err
	}
	id := randomKey()[:32]
	s := Instance{ID: id, UserID: user, LessonID: lesson.ID, Locale: locale, Container: "edu-harness-" + id, AccessKey: randomKey(), ModelKey: randomKey(), ExpiresAt: time.Now().Add(2 * time.Hour)}
	s.PlatformToken = platformToken
	s.LastSeen = time.Now()
	base := filepath.Join(h.root, "users", fmt.Sprint(user), fmt.Sprint(lesson.ID), locale)
	home := filepath.Join(base, "home")
	workspace := filepath.Join(base, "workspace")
	for _, p := range []string{home, workspace} {
		if err = os.MkdirAll(p, 0700); err != nil {
			return Instance{}, err
		}
		if err = os.Chown(p, 1000, 1000); err != nil {
			return Instance{}, err
		}
	}
	if err = h.prepareMaterials(ctx, lesson, locale, workspace); err != nil {
		return Instance{}, err
	}
	public := h.origin + "/api/course-harness/proxy/" + id + "/"
	parsed, err := url.Parse(h.origin)
	if err != nil || parsed.Host == "" {
		return Instance{}, errors.New("公开地址未配置")
	}
	args := []string{"run", "-d", "--name", s.Container, "--label", "edu.course-harness=true", "--network", networkName, "--user", "1000:1000", "--read-only", "--cap-drop=ALL", "--security-opt", "no-new-privileges", "--memory", "768m", "--memory-swap", "768m", "--cpus", "0.75", "--pids-limit", "160", "--tmpfs", "/tmp:rw,exec,nosuid,nodev,size=128m,mode=1777", "--mount", "type=bind,source=" + home + ",target=/home/harness", "--mount", "type=bind,source=" + workspace + ",target=/workspace,readonly", "--log-opt", "max-size=2m", "--log-opt", "max-file=1",
		"-e", "EDU_PUBLIC_URL=" + public, "-e", "EDU_TRUSTED_HOST=" + parsed.Host, "-e", "EDU_MODEL_BASE_URL=http://" + gateway + ":" + h.backendPort + "/api/course-harness/model/" + id + "/v1", "-e", "EDU_MODEL_TOKEN=" + s.ModelKey, "-e", "EDU_LOCALE=" + locale, "-e", "EDU_COURSE_TITLE=" + lesson.Title, h.image}
	if _, err = docker(ctx, args...); err != nil {
		return Instance{}, err
	}
	ok := false
	defer func() {
		if !ok {
			cleanup, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			defer cancel()
			_, _ = docker(cleanup, "rm", "-f", s.Container)
		}
	}()
	ip, err := docker(ctx, "inspect", s.Container, "--format", `{{(index .NetworkSettings.Networks "edu-course-harness").IPAddress}}`)
	if err != nil {
		return Instance{}, err
	}
	if net.ParseIP(ip) == nil {
		return Instance{}, errors.New("工作区私网地址无效")
	}
	s.Address = net.JoinHostPort(ip, "3080")
	for attempt := 0; attempt < 120; attempt++ {
		log, _ := docker(ctx, "logs", "--tail", "40", s.Container)
		if match := launchPattern.FindStringSubmatch(log); len(match) > 1 {
			s.LaunchKey = match[1]
			break
		}
		if running, _ := docker(ctx, "inspect", s.Container, "--format", "{{.State.Running}}"); running == "false" {
			if len(log) > 16384 {
				log = log[len(log)-16384:]
			}
			log = strings.ReplaceAll(log, s.ModelKey, "[redacted]")
			_ = os.WriteFile(filepath.Join(h.root, "startup-"+id+".log"), []byte(log), 0600)
			return Instance{}, errors.New("Harness启动进程已退出")
		}
		select {
		case <-ctx.Done():
			return Instance{}, ctx.Err()
		case <-time.After(500 * time.Millisecond):
		}
	}
	if s.LaunchKey == "" {
		return Instance{}, errors.New("Harness Web启动未就绪")
	}
	h.mu.Lock()
	h.instances[id] = s
	err = h.saveLocked()
	if err != nil {
		delete(h.instances, id)
	}
	h.mu.Unlock()
	if err != nil {
		return Instance{}, err
	}
	ok = true
	return s, nil
}
