package agent

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"edu-platform/internal/domain/user"
	"edu-platform/internal/middleware"
	apperrors "edu-platform/pkg/errors"
	"edu-platform/pkg/i18n"
	"edu-platform/pkg/response"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) GetManual(c *gin.Context) {
	sourceType, sourceID, ok := parseSourceParams(c)
	if !ok {
		response.BadRequestKey(c, "agent.invalidParams", nil)
		return
	}

	manual, err := h.service.GetManual(c.Request.Context(), sourceType, sourceID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		response.NotFoundKey(c, "agent.manualNotPublished", nil)
		return
	}
	if err != nil {
		response.InternalKey(c, "agent.internalError", nil)
		return
	}

	c.JSON(http.StatusOK, buildManualPublicResponse(manual))
}

func (h *Handler) VerifyStep(c *gin.Context) {
	var req struct {
		ManualID    uint64 `json:"manualId"`
		StepOrder   int    `json:"stepOrder"`
		ContainerID string `json:"containerId"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "agent.requiredParams", nil)
		return
	}
	if req.ManualID == 0 || req.ContainerID == "" {
		response.BadRequestKey(c, "agent.requiredParams", nil)
		return
	}

	claims, _ := middleware.CurrentClaims(c)
	result, err := h.service.VerifyStep(c.Request.Context(), claims.UserID, req.ManualID, req.StepOrder, req.ContainerID)
	if err != nil {
		response.ErrorKey(c, http.StatusInternalServerError, "AGENT_VERIFICATION_FAILED", "agent.verificationFailed", nil)
		return
	}

	if result.Success {
		if claims, ok := middleware.CurrentClaims(c); ok {
			_, _ = h.service.CompleteStep(c.Request.Context(), claims.UserID, req.ManualID, req.StepOrder)
			_ = h.service.RecordLearningEvent(c.Request.Context(), claims.UserID, req.ManualID, req.StepOrder, AgentEventTypeStepDone, nil)
		}
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) RecordEvent(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	var req struct {
		ManualID  uint64  `json:"manualId"`
		StepOrder int     `json:"stepOrder"`
		EventType string  `json:"eventType"`
		Meta      JSONMap `json:"meta"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.ManualID == 0 || strings.TrimSpace(req.EventType) == "" {
		response.BadRequestKey(c, "agent.invalidParams", nil)
		return
	}
	if err := h.service.RecordLearningEvent(c.Request.Context(), claims.UserID, req.ManualID, req.StepOrder, req.EventType, req.Meta); err != nil {
		response.BadRequestKey(c, "agent.requestFailed", nil)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *Handler) Chat(c *gin.Context) {
	var req ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Question) == "" {
		response.BadRequestKey(c, "agent.questionRequired", nil)
		return
	}

	answer, err := h.service.Chat(c.Request.Context(), req)
	if err != nil {
		response.InternalKey(c, "agent.internalError", nil)
		return
	}
	c.JSON(http.StatusOK, gin.H{"answer": answer})
}

func (h *Handler) ChatStream(c *gin.Context) {
	var req ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Question) == "" {
		response.BadRequestKey(c, "agent.questionRequired", nil)
		return
	}

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Status(http.StatusOK)
	c.Writer.Flush()

	err := h.service.ChatStream(c.Request.Context(), req, func(chunk string) error {
		payload := fmt.Sprintf("data: {\"content\":%q}\n\n", chunk)
		if _, writeErr := c.Writer.WriteString(payload); writeErr != nil {
			return writeErr
		}
		c.Writer.Flush()
		return nil
	})
	if err != nil {
		message := i18n.Message(c.Request.Context(), "agent.streamFailed", nil)
		_, _ = c.Writer.WriteString(fmt.Sprintf("data: {\"error\":%q}\n\n", message))
		c.Writer.Flush()
		return
	}
	_, _ = c.Writer.WriteString("data: [DONE]\n\n")
	c.Writer.Flush()
}

func (h *Handler) CoachStream(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	var req CoachRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Question) == "" || req.ManualID == 0 {
		response.BadRequestKey(c, "agent.questionRequired", nil)
		return
	}

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Status(http.StatusOK)
	c.Writer.Flush()

	err := h.service.CoachStream(
		c.Request.Context(),
		claims.UserID,
		req,
		func(meta CoachMeta) error {
			raw, _ := json.Marshal(meta)
			if _, writeErr := c.Writer.WriteString("data: [META]" + string(raw) + "\n\n"); writeErr != nil {
				return writeErr
			}
			c.Writer.Flush()
			return nil
		},
		func(chunk string) error {
			payload := fmt.Sprintf("data: {\"content\":%q}\n\n", chunk)
			if _, writeErr := c.Writer.WriteString(payload); writeErr != nil {
				return writeErr
			}
			c.Writer.Flush()
			return nil
		},
	)
	if err != nil {
		message := i18n.Message(c.Request.Context(), "agent.streamFailed", nil)
		_, _ = c.Writer.WriteString(fmt.Sprintf("data: {\"error\":%q}\n\n", message))
		c.Writer.Flush()
		return
	}
	_, _ = c.Writer.WriteString("data: [DONE]\n\n")
	c.Writer.Flush()
}

func (h *Handler) CoachHistory(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	manualID, _ := strconv.ParseUint(c.Query("manualId"), 10, 64)
	stepOrder, _ := strconv.Atoi(c.Query("stepOrder"))
	if manualID == 0 {
		response.BadRequestKey(c, "agent.manualIdRequired", nil)
		return
	}
	items, err := h.service.GetCoachHistory(c.Request.Context(), claims.UserID, manualID, stepOrder)
	if err != nil {
		response.InternalKey(c, "agent.historyFailed", nil)
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (h *Handler) Reflect(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	var req struct {
		ManualID uint64 `json:"manualId"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.ManualID == 0 {
		response.BadRequestKey(c, "agent.manualIdRequired", nil)
		return
	}
	card, err := h.service.GenerateReflectionCard(c.Request.Context(), claims.UserID, req.ManualID)
	if err != nil {
		response.BadRequestKey(c, "agent.requestFailed", nil)
		return
	}
	c.JSON(http.StatusOK, card)
}

func (h *Handler) MarkReflectionViewed(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		response.BadRequestKey(c, "agent.invalidReflectionId", nil)
		return
	}
	card, err := h.service.MarkReflectionViewed(c.Request.Context(), claims.UserID, id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		response.NotFoundKey(c, "agent.reflectionNotFound", nil)
		return
	}
	if err != nil {
		response.InternalKey(c, "agent.reflectionUpdateFailed", nil)
		return
	}
	c.JSON(http.StatusOK, card)
}

func (h *Handler) ListFAQ(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	manualID, _ := strconv.ParseUint(c.Query("manualId"), 10, 64)
	classID, _ := strconv.ParseUint(c.Query("classId"), 10, 64)
	stepOrder, _ := strconv.Atoi(c.Query("stepOrder"))
	if manualID == 0 || classID == 0 {
		response.BadRequestKey(c, "agent.invalidParams", nil)
		return
	}
	items, err := h.service.ListFAQ(c.Request.Context(), claims.UserID, manualID, stepOrder, classID)
	if err != nil {
		response.ForbiddenKey(c, "agent.forbidden", nil)
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (h *Handler) PendingInterventions(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	manualID, _ := strconv.ParseUint(c.Query("manualId"), 10, 64)
	if manualID == 0 {
		response.BadRequestKey(c, "agent.manualIdRequired", nil)
		return
	}
	items, err := h.service.PendingInterventions(c.Request.Context(), claims.UserID, manualID)
	if err != nil {
		response.InternalKey(c, "agent.interventionsLoadFailed", nil)
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (h *Handler) MarkInterventionRead(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		response.BadRequestKey(c, "agent.invalidInterventionId", nil)
		return
	}
	item, err := h.service.MarkInterventionRead(c.Request.Context(), claims.UserID, id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		response.NotFoundKey(c, "agent.interventionNotFound", nil)
		return
	}
	if err != nil {
		response.InternalKey(c, "agent.interventionUpdateFailed", nil)
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *Handler) TeacherReflectionCard(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	studentID, err := strconv.ParseUint(c.Param("studentId"), 10, 64)
	if err != nil || studentID == 0 {
		response.BadRequestKey(c, "agent.invalidStudentId", nil)
		return
	}
	manualID, _ := strconv.ParseUint(c.Query("manualId"), 10, 64)
	if manualID == 0 {
		response.BadRequestKey(c, "agent.manualIdRequired", nil)
		return
	}
	card, err := h.service.TeacherReflectionCard(c.Request.Context(), claims.UserID, claims.RoleType, studentID, manualID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		response.NotFoundKey(c, "agent.reflectionNotFound", nil)
		return
	}
	if err != nil {
		response.ForbiddenKey(c, "agent.forbidden", nil)
		return
	}
	c.JSON(http.StatusOK, card)
}

func (h *Handler) ExplainCode(c *gin.Context) {
	var req struct {
		Code     string `json:"code"`
		Language string `json:"language"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Code) == "" {
		response.BadRequestKey(c, "agent.codeRequired", nil)
		return
	}

	explanation, err := h.service.ExplainCode(c.Request.Context(), req.Code, req.Language)
	if err != nil {
		response.InternalKey(c, "agent.internalError", nil)
		return
	}
	c.JSON(http.StatusOK, gin.H{"explanation": explanation})
}

func (h *Handler) GetProgress(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	sourceType, sourceID, ok := parseSourceParams(c)
	if !ok {
		response.BadRequestKey(c, "agent.invalidParams", nil)
		return
	}

	manual, err := h.service.GetManual(c.Request.Context(), sourceType, sourceID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		response.NotFoundKey(c, "agent.manualNotFound", nil)
		return
	}
	if err != nil {
		response.InternalKey(c, "agent.internalError", nil)
		return
	}

	progress, err := h.service.GetProgress(c.Request.Context(), claims.UserID, manual.ID)
	if err != nil {
		response.InternalKey(c, "agent.internalError", nil)
		return
	}
	if progress == nil {
		c.JSON(http.StatusOK, gin.H{
			"currentStep":    0,
			"completedSteps": []int{},
			"chatHistory":    []ChatMessage{},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"currentStep":    progress.CurrentStep,
		"completedSteps": progress.CompletedSteps,
		"chatHistory":    progress.ChatHistory,
	})
}

func (h *Handler) UpdateProgress(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}

	var req struct {
		SourceType     int           `json:"sourceType"`
		SourceID       uint64        `json:"sourceId"`
		CurrentStep    int           `json:"currentStep"`
		CompletedSteps []int         `json:"completedSteps"`
		ChatHistory    []ChatMessage `json:"chatHistory"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "agent.invalidParams", nil)
		return
	}

	manual, err := h.service.GetManual(c.Request.Context(), req.SourceType, req.SourceID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		response.NotFoundKey(c, "agent.manualNotFound", nil)
		return
	}
	if err != nil {
		response.InternalKey(c, "agent.internalError", nil)
		return
	}

	progress, err := h.service.UpdateProgress(c.Request.Context(), claims.UserID, manual.ID, UserAgentProgress{
		CurrentStep:    req.CurrentStep,
		CompletedSteps: req.CompletedSteps,
		ChatHistory:    req.ChatHistory,
	})
	if err != nil {
		response.InternalKey(c, "agent.internalError", nil)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"currentStep":    progress.CurrentStep,
		"completedSteps": progress.CompletedSteps,
		"chatHistory":    progress.ChatHistory,
	})
}

func (h *Handler) GetVerificationSuggestion(c *gin.Context) {
	var req VerificationHelpRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.ErrorMessage) == "" {
		response.BadRequestKey(c, "agent.errorDetailsRequired", nil)
		return
	}

	suggestion, err := h.service.GetVerificationSuggestion(c.Request.Context(), req)
	if err != nil {
		response.InternalKey(c, "agent.aiUnavailable", nil)
		return
	}
	c.JSON(http.StatusOK, gin.H{"suggestion": suggestion})
}

func (h *Handler) PromptEnhance(c *gin.Context) {
	var req PromptEnhanceRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.RawPrompt) == "" {
		response.BadRequestKey(c, "agent.promptRequired", nil)
		return
	}

	result, err := h.service.PromptEnhance(c.Request.Context(), req)
	if err != nil {
		response.InternalKey(c, "agent.internalError", nil)
		return
	}
	response.SuccessKey(c, result, "agent.promptEnhanced", nil)
}

func (h *Handler) GetManualForAdmin(c *gin.Context) {
	sourceType, sourceID, ok := parseSourceParams(c)
	if !ok {
		response.BadRequestKey(c, "agent.invalidParams", nil)
		return
	}

	manual, err := h.service.GetManualForAdmin(c.Request.Context(), sourceType, sourceID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusOK, gin.H{"exists": false})
		return
	}
	if err != nil {
		response.InternalKey(c, "agent.internalError", nil)
		return
	}
	if !h.ensureManualOwnership(c, manual.CreatorID, "agent.manualViewForbidden") {
		return
	}
	c.JSON(http.StatusOK, buildManualAdminResponse(manual))
}

func (h *Handler) CreateManual(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	var req struct {
		SourceType  int    `json:"sourceType"`
		SourceID    uint64 `json:"sourceId"`
		Title       string `json:"title"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.SourceType == 0 || req.SourceID == 0 || strings.TrimSpace(req.Title) == "" {
		response.BadRequestKey(c, "agent.requiredParams", nil)
		return
	}

	manual, err := h.service.CreateManual(c.Request.Context(), AgentManual{
		SourceType:  req.SourceType,
		SourceID:    req.SourceID,
		Title:       strings.TrimSpace(req.Title),
		Description: req.Description,
		CreatorID:   claims.UserID,
	})
	if err != nil {
		if errors.Is(err, ErrManualExists) {
			response.ErrorKey(c, http.StatusConflict, "MANUAL_EXISTS", "agent.manualExists", nil)
			return
		}
		response.InternalKey(c, "agent.internalError", nil)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":          manual.ID,
		"title":       manual.Title,
		"description": manual.Description,
		"isPublished": manual.IsPublished,
	})
}

func (h *Handler) UpdateManual(c *gin.Context) {
	manualID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || manualID == 0 {
		response.BadRequestKey(c, "agent.invalidParams", nil)
		return
	}
	if !h.ensureManualOwnershipByID(c, manualID) {
		return
	}

	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		IsPublished *int   `json:"isPublished"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "agent.invalidParams", nil)
		return
	}

	updates := map[string]any{
		"title":       req.Title,
		"description": req.Description,
	}
	if req.IsPublished != nil {
		updates["isPublished"] = *req.IsPublished
	}

	manual, err := h.service.UpdateManual(c.Request.Context(), manualID, updates)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		response.NotFoundKey(c, "agent.manualNotFound", nil)
		return
	}
	if err != nil {
		response.InternalKey(c, "agent.internalError", nil)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":          manual.ID,
		"title":       manual.Title,
		"description": manual.Description,
		"isPublished": manual.IsPublished,
	})
}

func (h *Handler) GetManualContentTranslation(c *gin.Context) {
	manualID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || manualID == 0 {
		response.BadRequestKey(c, "agent.invalidParams", nil)
		return
	}
	if !h.ensureManualAccessByID(c, manualID) {
		return
	}
	locale := i18n.NormalizeLocale(c.Param("locale"))
	manual, err := h.service.GetManualByID(i18n.WithLocale(c.Request.Context(), locale), manualID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		response.NotFoundKey(c, "agent.manualNotFound", nil)
		return
	}
	if err != nil {
		response.InternalKey(c, "agent.internalError", nil)
		return
	}
	c.JSON(http.StatusOK, buildManualAdminResponse(manual))
}

func (h *Handler) SaveManualContentTranslation(c *gin.Context) {
	manualID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || manualID == 0 {
		response.BadRequestKey(c, "agent.invalidParams", nil)
		return
	}
	if !h.ensureManualAccessByID(c, manualID) {
		return
	}
	var req AgentManualContentTranslationInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "agent.invalidParams", nil)
		return
	}
	locale := i18n.NormalizeLocale(c.Param("locale"))
	manual, err := h.service.SaveManualContentTranslation(c.Request.Context(), manualID, locale, req)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		response.NotFoundKey(c, "agent.manualNotFound", nil)
		return
	}
	if err != nil {
		response.InternalKey(c, "agent.internalError", nil)
		return
	}
	c.JSON(http.StatusOK, buildManualAdminResponse(manual))
}

func (h *Handler) DeleteManualContentTranslation(c *gin.Context) {
	manualID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || manualID == 0 {
		response.BadRequestKey(c, "agent.invalidParams", nil)
		return
	}
	if !h.ensureManualAccessByID(c, manualID) {
		return
	}
	locale := i18n.NormalizeLocale(c.Param("locale"))
	manual, err := h.service.DeleteManualContentTranslation(c.Request.Context(), manualID, locale)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		response.NotFoundKey(c, "agent.manualNotFound", nil)
		return
	}
	if err != nil {
		response.InternalKey(c, "agent.internalError", nil)
		return
	}
	c.JSON(http.StatusOK, buildManualAdminResponse(manual))
}

func (h *Handler) DeleteManual(c *gin.Context) {
	manualID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || manualID == 0 {
		response.BadRequestKey(c, "agent.invalidParams", nil)
		return
	}
	if !h.ensureManualOwnershipByID(c, manualID) {
		return
	}

	if err := h.service.DeleteManual(c.Request.Context(), manualID); errors.Is(err, gorm.ErrRecordNotFound) {
		response.NotFoundKey(c, "agent.manualNotFound", nil)
		return
	} else if err != nil {
		response.InternalKey(c, "agent.internalError", nil)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *Handler) UpdateSteps(c *gin.Context) {
	manualID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || manualID == 0 {
		response.BadRequestKey(c, "agent.invalidParams", nil)
		return
	}
	if !h.ensureManualAccessByID(c, manualID) {
		return
	}

	var req struct {
		Steps []AgentStep `json:"steps"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.Steps == nil {
		response.BadRequestKey(c, "agent.invalidSteps", nil)
		return
	}

	steps, err := h.service.UpdateSteps(c.Request.Context(), manualID, req.Steps)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		response.NotFoundKey(c, "agent.manualNotFound", nil)
		return
	}
	if err != nil {
		response.InternalKey(c, "agent.internalError", nil)
		return
	}

	items := make([]gin.H, 0, len(steps))
	for _, step := range steps {
		items = append(items, gin.H{
			"id":             step.ID,
			"stepOrder":      step.StepOrder,
			"title":          step.Title,
			"content":        step.Content,
			"quickQuestions": step.QuickQuestions,
			"verification":   step.Verification,
			"skillTags":      defaultStrings(step.SkillTags),
		})
	}
	// 统一走标准响应封装 {success,data}，与前端 updateSteps 读取 response.data.steps 对齐；
	// 旧实现返回裸 {steps} 导致前端解析为空，保存后步骤被清空（DB 实际已写入）。
	response.Success(c, gin.H{"steps": items}, "")
}

func (h *Handler) ImportMarkdown(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	var req struct {
		SourceType int    `json:"sourceType"`
		SourceID   uint64 `json:"sourceId"`
		Markdown   string `json:"markdown"`
		Locale     string `json:"locale"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.SourceType == 0 || req.SourceID == 0 || strings.TrimSpace(req.Markdown) == "" {
		response.BadRequestKey(c, "agent.requiredParams", nil)
		return
	}

	manual, findErr := h.service.GetManualForAdmin(c.Request.Context(), req.SourceType, req.SourceID)
	if findErr == nil {
		if !h.ensureManualMaintainAccess(c, manual.ID, manual.CreatorID, "agent.manualImportForbidden") {
			return
		}
	} else if !errors.Is(findErr, gorm.ErrRecordNotFound) {
		response.InternalKey(c, "agent.internalError", nil)
		return
	}

	locale := i18n.NormalizeLocale(req.Locale)
	manual, err := h.service.ImportMarkdownForLocale(c.Request.Context(), req.SourceType, req.SourceID, req.Markdown, claims.UserID, locale)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		response.NotFoundKey(c, "agent.manualNotFound", nil)
		return
	}
	if err != nil {
		response.InternalKey(c, "agent.internalError", nil)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":     true,
		"id":          manual.ID,
		"title":       manual.Title,
		"description": manual.Description,
		"isPublished": manual.IsPublished,
		"stepsCount":  len(manual.Steps),
	})
}

func (h *Handler) ParseMarkdownPreview(c *gin.Context) {
	var req struct {
		Markdown string `json:"markdown"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Markdown) == "" {
		response.BadRequestKey(c, "agent.markdownRequired", nil)
		return
	}

	parsed, err := ParseMarkdown(req.Markdown)
	if err != nil {
		response.BadRequestKey(c, "agent.requestFailed", nil)
		return
	}

	steps := make([]gin.H, 0, len(parsed.Steps))
	for idx, step := range parsed.Steps {
		steps = append(steps, gin.H{
			"stepOrder":      idx,
			"title":          step.Title,
			"content":        step.Content,
			"quickQuestions": step.QuickQuestions,
			"verification":   step.Verification,
		})
	}
	c.JSON(http.StatusOK, gin.H{
		"title":       parsed.Title,
		"description": parsed.Description,
		"steps":       steps,
	})
}

func (h *Handler) ensureManualAccessByID(c *gin.Context, manualID uint64) bool {
	return h.ensureManualMaintainAccessByID(c, manualID)
}

func (h *Handler) ensureManualOwnershipByID(c *gin.Context, manualID uint64) bool {
	manual, err := h.service.FindManualByID(c.Request.Context(), manualID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			_ = c.Error(apperrors.NotFound(i18n.Message(c.Request.Context(), "agent.manualNotFound", nil)))
			return false
		}
		_ = c.Error(err)
		return false
	}
	return h.ensureManualOwnership(c, manual.CreatorID, "agent.manualManageForbidden")
}

func (h *Handler) ensureManualMaintainAccessByID(c *gin.Context, manualID uint64) bool {
	manual, err := h.service.FindManualByID(c.Request.Context(), manualID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			_ = c.Error(apperrors.NotFound(i18n.Message(c.Request.Context(), "agent.manualNotFound", nil)))
			return false
		}
		_ = c.Error(err)
		return false
	}
	return h.ensureManualMaintainAccess(c, manual.ID, manual.CreatorID, "agent.manualManageForbidden")
}

func (h *Handler) ensureManualOwnership(c *gin.Context, creatorID uint64, key i18n.MessageKey) bool {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return false
	}
	if claims.RoleType >= 10 || creatorID == claims.UserID {
		return true
	}
	response.ForbiddenKey(c, key, nil)
	return false
}

func (h *Handler) ensureManualMaintainAccess(c *gin.Context, manualID, creatorID uint64, key i18n.MessageKey) bool {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return false
	}
	if claims.RoleType >= int(user.RoleAdmin) || creatorID == claims.UserID {
		return true
	}
	if err := h.service.EnsureAssignedTeacherCanMaintainManual(c.Request.Context(), claims.UserID, manualID); err != nil {
		var appErr *apperrors.AppError
		if key != "" && errors.As(err, &appErr) && appErr.Code == "FORBIDDEN" {
			response.ForbiddenKey(c, key, nil)
			return false
		}
		_ = c.Error(err)
		return false
	}
	return true
}

func parseSourceParams(c *gin.Context) (int, uint64, bool) {
	sourceType, err := strconv.Atoi(c.Param("sourceType"))
	if err != nil || sourceType <= 0 {
		return 0, 0, false
	}
	sourceID, err := strconv.ParseUint(c.Param("sourceId"), 10, 64)
	if err != nil || sourceID == 0 {
		return 0, 0, false
	}
	return sourceType, sourceID, true
}

func buildManualPublicResponse(manual *AgentManual) gin.H {
	steps := make([]gin.H, 0, len(manual.Steps))
	for _, step := range manual.Steps {
		steps = append(steps, gin.H{
			"id":             step.StepOrder,
			"title":          step.Title,
			"content":        step.Content,
			"quickQuestions": defaultQuestions(step.QuickQuestions),
			"verification":   step.Verification,
		})
	}
	return gin.H{
		"id":          manual.ID,
		"title":       manual.Title,
		"description": manual.Description,
		"steps":       steps,
	}
}

func buildManualAdminResponse(manual *AgentManual) gin.H {
	steps := make([]gin.H, 0, len(manual.Steps))
	for _, step := range manual.Steps {
		steps = append(steps, gin.H{
			"id":                 step.ID,
			"stepOrder":          step.StepOrder,
			"title":              step.Title,
			"content":            step.Content,
			"quickQuestions":     defaultQuestions(step.QuickQuestions),
			"verification":       step.Verification,
			"skillTags":          defaultStrings(step.SkillTags),
			"locale":             step.Locale,
			"translationMissing": step.TranslationMissing,
		})
	}
	return gin.H{
		"exists":             true,
		"id":                 manual.ID,
		"title":              manual.Title,
		"description":        manual.Description,
		"isPublished":        manual.IsPublished,
		"steps":              steps,
		"locale":             manual.Locale,
		"translationMissing": manual.TranslationMissing,
	}
}

func defaultQuestions(questions []string) []string {
	if questions == nil {
		return []string{}
	}
	return questions
}

func defaultStrings(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}
