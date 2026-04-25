package user

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"edu-platform/internal/middleware"
	apperrors "edu-platform/pkg/errors"
	"edu-platform/pkg/pagination"
	"edu-platform/pkg/response"
)

type Handler struct {
	service *Service
}

type createUserRequest struct {
	Username   string   `json:"username"`
	Email      string   `json:"email"`
	Password   string   `json:"password"`
	Phone      string   `json:"phone"`
	StudentID  string   `json:"studentId"`
	FullName   string   `json:"fullName"`
	AvatarURL  string   `json:"avatarUrl"`
	Bio        string   `json:"bio"`
	GithubLink string   `json:"githubLink"`
	RoleType   RoleType `json:"roleType"`
}

type updateUserRequest struct {
	Phone      *string     `json:"phone"`
	StudentID  *string     `json:"studentId"`
	FullName   *string     `json:"fullName"`
	AvatarURL  *string     `json:"avatarUrl"`
	Bio        *string     `json:"bio"`
	GithubLink *string     `json:"githubLink"`
	RoleType   *RoleType   `json:"roleType"`
	Status     *UserStatus `json:"status"`
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) currentClaims(c *gin.Context) (uint64, int, bool) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		return 0, 0, false
	}
	return claims.UserID, claims.RoleType, true
}

func (h *Handler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	q := pagination.Normalize(page, pageSize)

	var roleType *int
	if raw := c.Query("roleType"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil {
			roleType = &parsed
		}
	}
	var status *int
	if raw := c.Query("status"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil {
			status = &parsed
		}
	}

	users, total, err := h.service.List(ListParams{
		Page:     q.Page,
		PageSize: q.PageSize,
		Keyword:  c.Query("keyword"),
		RoleType: roleType,
		Status:   status,
	})
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, gin.H{
		"list":     users,
		"total":    total,
		"page":     q.Page,
		"pageSize": q.PageSize,
	}, "获取用户列表成功")
}

func (h *Handler) StudentLeaderboard(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "4"))
	if limit <= 0 {
		limit = 4
	}
	if limit > 20 {
		limit = 20
	}

	var currentUserID uint64
	if claims, ok := middleware.CurrentClaims(c); ok {
		currentUserID = claims.UserID
	}

	items, err := h.service.StudentLeaderboard(limit, currentUserID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, items, "获取学习者排行成功")
}

func (h *Handler) Get(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的用户ID")
		return
	}

	currentUserID, roleType, ok := h.currentClaims(c)
	if !ok {
		response.Unauthorized(c, "请先登录")
		return
	}
	if currentUserID != id && roleType != int(RoleAdmin) {
		_ = c.Error(apperrors.Forbidden("无权查看该用户信息"))
		return
	}

	user, err := h.service.FindByID(id)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, user, "获取用户成功")
}

func (h *Handler) Create(c *gin.Context) {
	var req createUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误")
		return
	}
	user, err := h.service.Create(CreateParams{
		Username:   req.Username,
		Email:      req.Email,
		Password:   req.Password,
		Phone:      req.Phone,
		StudentID:  req.StudentID,
		FullName:   req.FullName,
		AvatarURL:  req.AvatarURL,
		Bio:        req.Bio,
		GithubLink: req.GithubLink,
		RoleType:   req.RoleType,
	})
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Created(c, user, "用户创建成功")
}

func (h *Handler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的用户ID")
		return
	}

	currentUserID, roleType, ok := h.currentClaims(c)
	if !ok {
		response.Unauthorized(c, "请先登录")
		return
	}
	isAdmin := roleType == int(RoleAdmin)
	if currentUserID != id && !isAdmin {
		_ = c.Error(apperrors.Forbidden("无权更新该用户信息"))
		return
	}

	var req updateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误")
		return
	}

	params := UpdateParams{
		Phone:      req.Phone,
		FullName:   req.FullName,
		AvatarURL:  req.AvatarURL,
		Bio:        req.Bio,
		GithubLink: req.GithubLink,
	}
	if isAdmin {
		params.StudentID = req.StudentID
		params.RoleType = req.RoleType
		params.Status = req.Status
	}

	if err := h.service.Update(id, params); err != nil {
		_ = c.Error(err)
		return
	}
	user, err := h.service.FindByID(id)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, user, "用户更新成功")
}

func (h *Handler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的用户ID")
		return
	}
	if err := h.service.Delete(id); err != nil {
		_ = c.Error(err)
		return
	}
	response.Success[any](c, nil, "用户删除成功")
}

func (h *Handler) UpdatePassword(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的用户ID")
		return
	}
	var req struct {
		OldPassword string `json:"oldPassword"`
		NewPassword string `json:"newPassword"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误")
		return
	}

	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.Unauthorized(c, "请先登录")
		return
	}
	if claims.UserID != id && claims.RoleType != int(RoleAdmin) {
		_ = c.Error(apperrors.Forbidden("无权修改该用户密码"))
		return
	}
	if claims.UserID == id && (req.OldPassword == "" || req.NewPassword == "") {
		response.BadRequest(c, "旧密码和新密码为必填项")
		return
	}
	if claims.UserID != id && req.NewPassword == "" {
		response.BadRequest(c, "新密码不能为空")
		return
	}

	user, err := h.service.FindByID(id)
	if err != nil {
		_ = c.Error(err)
		return
	}
	if claims.UserID == id && !h.service.ValidatePassword(user, req.OldPassword) {
		_ = c.Error(apperrors.BadRequest("旧密码错误"))
		return
	}
	if err := h.service.UpdatePassword(id, req.NewPassword); err != nil {
		_ = c.Error(err)
		return
	}
	response.Success[any](c, nil, "密码修改成功")
}

func (h *Handler) Freeze(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的用户ID")
		return
	}
	if err := h.service.Freeze(id); err != nil {
		_ = c.Error(err)
		return
	}
	response.Success[any](c, nil, "用户已冻结")
}

func (h *Handler) Activate(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的用户ID")
		return
	}
	if err := h.service.Activate(id); err != nil {
		_ = c.Error(err)
		return
	}
	response.Success[any](c, nil, "用户已激活")
}
