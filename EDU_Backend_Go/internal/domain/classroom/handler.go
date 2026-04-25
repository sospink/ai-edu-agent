package classroom

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"edu-platform/internal/middleware"
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
	response.Success(c, items, "获取学期列表成功")
}

func (h *Handler) GetAdminTerms(c *gin.Context) {
	items, err := h.service.ListAdminTerms(c.Query("keyword"))
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, items, "获取学期列表成功")
}

func (h *Handler) CreateTerm(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.Unauthorized(c, "请先登录")
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
		response.BadRequest(c, "请求参数错误")
		return
	}
	startAt, err := parseOptionalDateInput(req.StartAt)
	if err != nil {
		response.BadRequest(c, "开始日期格式错误，请使用 YYYY-MM-DD")
		return
	}
	endAt, err := parseOptionalDateInput(req.EndAt)
	if err != nil {
		response.BadRequest(c, "结束日期格式错误，请使用 YYYY-MM-DD")
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
	response.Created(c, item, "学期创建成功")
}

func (h *Handler) UpdateTerm(c *gin.Context) {
	id, ok := parseUintParam(c, "id", "无效的学期ID")
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
		response.BadRequest(c, "请求参数错误")
		return
	}
	startAt, err := parseOptionalDateInput(req.StartAt)
	if err != nil {
		response.BadRequest(c, "开始日期格式错误，请使用 YYYY-MM-DD")
		return
	}
	endAt, err := parseOptionalDateInput(req.EndAt)
	if err != nil {
		response.BadRequest(c, "结束日期格式错误，请使用 YYYY-MM-DD")
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
	response.Success(c, item, "学期更新成功")
}

func (h *Handler) UpdateTermStatus(c *gin.Context) {
	id, ok := parseUintParam(c, "id", "无效的学期ID")
	if !ok {
		return
	}
	var req struct {
		Status TermStatus `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误")
		return
	}
	item, err := h.service.UpdateTermStatus(id, req.Status)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, item, "学期状态更新成功")
}

func (h *Handler) ListTeacherClasses(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.Unauthorized(c, "请先登录")
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
	response.Success(c, gin.H{
		"list":     list,
		"total":    total,
		"page":     params.Page,
		"pageSize": params.PageSize,
	}, "获取班级列表成功")
}

func (h *Handler) CreateClass(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.Unauthorized(c, "请先登录")
		return
	}
	var req struct {
		TermID      uint64 `json:"termId"`
		Name        string `json:"name"`
		Code        string `json:"code"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误")
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
	response.Created(c, item, "班级创建成功")
}

func (h *Handler) GetTeacherClass(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.Unauthorized(c, "请先登录")
		return
	}
	id, ok := parseUintParam(c, "id", "无效的班级ID")
	if !ok {
		return
	}
	item, err := h.service.GetClassDetailForTeacher(claims.UserID, claims.RoleType, id)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, item, "获取班级详情成功")
}

func (h *Handler) UpdateTeacherClass(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.Unauthorized(c, "请先登录")
		return
	}
	id, ok := parseUintParam(c, "id", "无效的班级ID")
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
		response.BadRequest(c, "请求参数错误")
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
	response.Success(c, item, "班级更新成功")
}

func (h *Handler) ListTeacherClassMembers(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.Unauthorized(c, "请先登录")
		return
	}
	classID, ok := parseUintParam(c, "id", "无效的班级ID")
	if !ok {
		return
	}
	items, err := h.service.ListMembersForTeacher(claims.UserID, claims.RoleType, classID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, items, "获取班级成员成功")
}

func (h *Handler) ImportTeacherClassMembers(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.Unauthorized(c, "请先登录")
		return
	}
	classID, ok := parseUintParam(c, "id", "无效的班级ID")
	if !ok {
		return
	}
	file, err := c.FormFile("file")
	if err != nil {
		response.BadRequest(c, "请上传导入文件")
		return
	}
	result, err := h.service.ImportMembersForTeacher(claims.UserID, claims.RoleType, classID, file)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, result, "班级成员导入完成")
}

func (h *Handler) DeleteTeacherClassMember(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.Unauthorized(c, "请先登录")
		return
	}
	classID, ok := parseUintParam(c, "id", "无效的班级ID")
	if !ok {
		return
	}
	userID, ok := parseUintParam(c, "userId", "无效的成员ID")
	if !ok {
		return
	}
	if err := h.service.RemoveMemberForTeacher(claims.UserID, claims.RoleType, classID, userID); err != nil {
		_ = c.Error(err)
		return
	}
	response.Success[any](c, nil, "班级成员已移除")
}

func (h *Handler) ListStudentClasses(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.Unauthorized(c, "请先登录")
		return
	}
	items, err := h.service.ListClassesForStudent(claims.UserID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, items, "获取我的班级成功")
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
	response.Success(c, gin.H{
		"list":     list,
		"total":    total,
		"page":     params.Page,
		"pageSize": params.PageSize,
	}, "获取班级列表成功")
}

func (h *Handler) GetAdminClass(c *gin.Context) {
	id, ok := parseUintParam(c, "id", "无效的班级ID")
	if !ok {
		return
	}
	item, err := h.service.GetClassDetailForAdmin(id)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, item, "获取班级详情成功")
}

func (h *Handler) UpdateAdminClassStatus(c *gin.Context) {
	id, ok := parseUintParam(c, "id", "无效的班级ID")
	if !ok {
		return
	}
	var req struct {
		Status ClassStatus `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误")
		return
	}
	item, err := h.service.UpdateClassStatusForAdmin(id, req.Status)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, item, "班级状态更新成功")
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
			response.BadRequest(c, "无效的学期ID")
			return ListClassesParams{}, false
		}
		params.TermID = &termID
	}
	if raw := c.Query("status"); raw != "" {
		status, err := strconv.Atoi(raw)
		if err != nil {
			response.BadRequest(c, "无效的班级状态")
			return ListClassesParams{}, false
		}
		casted := ClassStatus(status)
		params.Status = &casted
	}
	return params, true
}

func parseUintParam(c *gin.Context, name, message string) (uint64, bool) {
	value, err := strconv.ParseUint(c.Param(name), 10, 64)
	if err != nil {
		response.Error(c, http.StatusBadRequest, message, "BAD_REQUEST")
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
