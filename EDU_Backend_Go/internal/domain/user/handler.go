package user

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"edu-platform/internal/middleware"
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
	response.SuccessKey(c, gin.H{
		"list":     users,
		"total":    total,
		"page":     q.Page,
		"pageSize": q.PageSize,
	}, "user.listLoaded", nil)
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
	response.SuccessKey(c, items, "user.leaderboardLoaded", nil)
}

func (h *Handler) Get(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequestKey(c, "user.invalidId", nil)
		return
	}

	currentUserID, roleType, ok := h.currentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	if currentUserID != id && roleType != int(RoleAdmin) {
		response.ForbiddenKey(c, "user.viewForbidden", nil)
		return
	}

	user, err := h.service.FindByID(id)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, user, "user.detailLoaded", nil)
}

func (h *Handler) Create(c *gin.Context) {
	var req createUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
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
	response.CreatedKey(c, user, "user.created", nil)
}

func (h *Handler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequestKey(c, "user.invalidId", nil)
		return
	}

	currentUserID, roleType, ok := h.currentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	isAdmin := roleType == int(RoleAdmin)
	if currentUserID != id && !isAdmin {
		response.ForbiddenKey(c, "user.updateForbidden", nil)
		return
	}

	var req updateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
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
	response.SuccessKey(c, user, "user.updated", nil)
}

func (h *Handler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequestKey(c, "user.invalidId", nil)
		return
	}
	if err := h.service.Delete(id); err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey[any](c, nil, "user.deleted", nil)
}

func (h *Handler) UpdatePassword(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequestKey(c, "user.invalidId", nil)
		return
	}
	var req struct {
		OldPassword string `json:"oldPassword"`
		NewPassword string `json:"newPassword"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}

	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	if claims.UserID != id && claims.RoleType != int(RoleAdmin) {
		response.ForbiddenKey(c, "user.passwordForbidden", nil)
		return
	}
	if claims.UserID == id && (req.OldPassword == "" || req.NewPassword == "") {
		response.BadRequestKey(c, "user.passwordsRequired", nil)
		return
	}
	if claims.UserID != id && req.NewPassword == "" {
		response.BadRequestKey(c, "user.newPasswordRequired", nil)
		return
	}

	user, err := h.service.FindByID(id)
	if err != nil {
		_ = c.Error(err)
		return
	}
	if claims.UserID == id && !h.service.ValidatePassword(user, req.OldPassword) {
		response.BadRequestKey(c, "user.oldPasswordInvalid", nil)
		return
	}
	if err := h.service.UpdatePassword(id, req.NewPassword); err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey[any](c, nil, "user.passwordUpdated", nil)
}

func (h *Handler) Freeze(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequestKey(c, "user.invalidId", nil)
		return
	}
	if err := h.service.Freeze(id); err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey[any](c, nil, "user.frozen", nil)
}

func (h *Handler) Activate(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequestKey(c, "user.invalidId", nil)
		return
	}
	if err := h.service.Activate(id); err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey[any](c, nil, "user.activated", nil)
}
