package classroom

import (
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"edu-platform/internal/middleware"
	"edu-platform/pkg/i18n"
	"edu-platform/pkg/pagination"
	"edu-platform/pkg/response"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) GetTeacherTerms(c *gin.Context) {
	items, err := h.service.ListTeacherTerms()
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, items, "classroom.termsLoaded", nil)
}

func (h *Handler) GetAdminTerms(c *gin.Context) {
	items, err := h.service.ListAdminTerms(c.Query("keyword"))
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, items, "classroom.termsLoaded", nil)
}

func (h *Handler) CreateTerm(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	var req struct {
		Name    string      `json:"name"`
		Code    string      `json:"code"`
		StartAt *string     `json:"startAt"`
		EndAt   *string     `json:"endAt"`
		Status  *TermStatus `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}
	startAt, err := parseOptionalDateInput(req.StartAt)
	if err != nil {
		response.BadRequestKey(c, "classroom.invalidStartDate", nil)
		return
	}
	endAt, err := parseOptionalDateInput(req.EndAt)
	if err != nil {
		response.BadRequestKey(c, "classroom.invalidEndDate", nil)
		return
	}
	item, err := h.service.CreateTerm(CreateTermParams{
		Name:      req.Name,
		Code:      req.Code,
		StartAt:   startAt,
		EndAt:     endAt,
		Status:    req.Status,
		CreatedBy: claims.UserID,
	})
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.CreatedKey(c, item, "classroom.termCreated", nil)
}

func (h *Handler) UpdateTerm(c *gin.Context) {
	id, ok := parseUintParam(c, "id", "classroom.invalidTermId")
	if !ok {
		return
	}
	var req struct {
		Name    *string `json:"name"`
		Code    *string `json:"code"`
		StartAt *string `json:"startAt"`
		EndAt   *string `json:"endAt"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}
	startAt, err := parseOptionalDateInput(req.StartAt)
	if err != nil {
		response.BadRequestKey(c, "classroom.invalidStartDate", nil)
		return
	}
	endAt, err := parseOptionalDateInput(req.EndAt)
	if err != nil {
		response.BadRequestKey(c, "classroom.invalidEndDate", nil)
		return
	}
	item, err := h.service.UpdateTerm(id, UpdateTermParams{
		Name:    req.Name,
		Code:    req.Code,
		StartAt: startAt,
		EndAt:   endAt,
	})
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, item, "classroom.termUpdated", nil)
}

func (h *Handler) UpdateTermStatus(c *gin.Context) {
	id, ok := parseUintParam(c, "id", "classroom.invalidTermId")
	if !ok {
		return
	}
	var req struct {
		Status TermStatus `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}
	item, err := h.service.UpdateTermStatus(id, req.Status)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, item, "classroom.termStatusUpdated", nil)
}

func (h *Handler) ListTeacherClasses(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	params, ok := parseListParams(c)
	if !ok {
		return
	}
	list, total, err := h.service.ListClassesForTeacher(claims.UserID, claims.RoleType, params)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, gin.H{
		"list":     list,
		"total":    total,
		"page":     params.Page,
		"pageSize": params.PageSize,
	}, "classroom.listLoaded", nil)
}

func (h *Handler) CreateClass(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	var req struct {
		TermID      uint64 `json:"termId"`
		Name        string `json:"name"`
		Code        string `json:"code"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}
	item, err := h.service.CreateClass(claims.UserID, CreateClassParams{
		TermID:         req.TermID,
		Name:           req.Name,
		Code:           req.Code,
		Description:    req.Description,
		OwnerTeacherID: claims.UserID,
		CreatedBy:      claims.UserID,
	})
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.CreatedKey(c, item, "classroom.classCreated", nil)
}

func (h *Handler) GetTeacherClass(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	id, ok := parseUintParam(c, "id", "classroom.invalidClassId")
	if !ok {
		return
	}
	item, err := h.service.GetClassDetailForTeacher(claims.UserID, claims.RoleType, id)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, item, "classroom.classLoaded", nil)
}

func (h *Handler) UpdateTeacherClass(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	id, ok := parseUintParam(c, "id", "classroom.invalidClassId")
	if !ok {
		return
	}
	var req struct {
		TermID      *uint64 `json:"termId"`
		Name        *string `json:"name"`
		Code        *string `json:"code"`
		Description *string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}
	item, err := h.service.UpdateClassForTeacher(claims.UserID, claims.RoleType, id, UpdateClassParams{
		TermID:      req.TermID,
		Name:        req.Name,
		Code:        req.Code,
		Description: req.Description,
	})
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, item, "classroom.classUpdated", nil)
}

func (h *Handler) ListTeacherClassMembers(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	classID, ok := parseUintParam(c, "id", "classroom.invalidClassId")
	if !ok {
		return
	}
	items, err := h.service.ListMembersForTeacher(claims.UserID, claims.RoleType, classID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, items, "classroom.membersLoaded", nil)
}

func (h *Handler) ImportTeacherClassMembers(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	classID, ok := parseUintParam(c, "id", "classroom.invalidClassId")
	if !ok {
		return
	}
	file, err := c.FormFile("file")
	if err != nil {
		response.BadRequestKey(c, "classroom.uploadRequired", nil)
		return
	}
	result, err := h.service.ImportMembersForTeacher(claims.UserID, claims.RoleType, classID, file)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "classroom.membersImported", nil)
}

func (h *Handler) DeleteTeacherClassMember(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	classID, ok := parseUintParam(c, "id", "classroom.invalidClassId")
	if !ok {
		return
	}
	userID, ok := parseUintParam(c, "userId", "classroom.invalidMemberId")
	if !ok {
		return
	}
	if err := h.service.RemoveMemberForTeacher(claims.UserID, claims.RoleType, classID, userID); err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey[any](c, nil, "classroom.memberRemoved", nil)
}

func (h *Handler) ListStudentClasses(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	items, err := h.service.ListClassesForStudent(claims.UserID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, items, "classroom.studentClassesLoaded", nil)
}

func (h *Handler) ListAdminClasses(c *gin.Context) {
	params, ok := parseListParams(c)
	if !ok {
		return
	}
	list, total, err := h.service.ListAdminClasses(params)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, gin.H{
		"list":     list,
		"total":    total,
		"page":     params.Page,
		"pageSize": params.PageSize,
	}, "classroom.listLoaded", nil)
}

func (h *Handler) GetAdminClass(c *gin.Context) {
	id, ok := parseUintParam(c, "id", "classroom.invalidClassId")
	if !ok {
		return
	}
	item, err := h.service.GetClassDetailForAdmin(id)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, item, "classroom.classLoaded", nil)
}

func (h *Handler) UpdateAdminClassStatus(c *gin.Context) {
	id, ok := parseUintParam(c, "id", "classroom.invalidClassId")
	if !ok {
		return
	}
	var req struct {
		Status ClassStatus `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}
	item, err := h.service.UpdateClassStatusForAdmin(id, req.Status)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, item, "classroom.classStatusUpdated", nil)
}

func parseListParams(c *gin.Context) (ListClassesParams, bool) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	q := pagination.Normalize(page, pageSize)
	params := ListClassesParams{
		Page:     q.Page,
		PageSize: q.PageSize,
		Keyword:  c.Query("keyword"),
	}
	if raw := c.Query("termId"); raw != "" {
		termID, err := strconv.ParseUint(raw, 10, 64)
		if err != nil {
			response.BadRequestKey(c, "classroom.invalidTermId", nil)
			return ListClassesParams{}, false
		}
		params.TermID = &termID
	}
	if raw := c.Query("status"); raw != "" {
		status, err := strconv.Atoi(raw)
		if err != nil {
			response.BadRequestKey(c, "classroom.invalidClassStatus", nil)
			return ListClassesParams{}, false
		}
		casted := ClassStatus(status)
		params.Status = &casted
	}
	return params, true
}

func parseUintParam(c *gin.Context, name string, key i18n.MessageKey) (uint64, bool) {
	value, err := strconv.ParseUint(c.Param(name), 10, 64)
	if err != nil {
		response.BadRequestKey(c, key, nil)
		return 0, false
	}
	return value, true
}

func parseOptionalDateInput(raw *string) (*time.Time, error) {
	if raw == nil {
		return nil, nil
	}

	trimmed := strings.TrimSpace(*raw)
	if trimmed == "" {
		return nil, nil
	}

	layouts := []string{
		"2006-01-02",
		time.RFC3339,
		"2006-01-02 15:04:05",
	}
	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, trimmed); err == nil {
			return &parsed, nil
		}
	}

	return nil, strconv.ErrSyntax
}
