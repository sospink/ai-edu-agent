package auth

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"edu-platform/internal/infra/authz"
	"edu-platform/internal/domain/user"
	"edu-platform/internal/middleware"
	apperrors "edu-platform/pkg/errors"
	"edu-platform/pkg/response"
)

type Handler struct {
	authService     *Service
	userService     *user.Service
	tokenBlacklist  *authz.TokenBlacklist
}

func NewHandler(authService *Service, userService *user.Service, tokenBlacklist *authz.TokenBlacklist) *Handler {
	return &Handler{
		authService:    authService,
		userService:    userService,
		tokenBlacklist: tokenBlacklist,
	}
}

func (h *Handler) Login(c *gin.Context) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.Username == "" || req.Password == "" {
		response.BadRequest(c, "用户名和密码为必填项")
		return
	}
	u, token, err := h.authService.Login(req.Username, req.Password)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, gin.H{
		"user":  u,
		"token": token,
	}, "登录成功")
}

func (h *Handler) Logout(c *gin.Context) {
	token, ok := middleware.CurrentToken(c)
	if !ok {
		response.Unauthorized(c, "请先登录")
		return
	}
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	if h.tokenBlacklist != nil && h.tokenBlacklist.Enabled() && claims.ExpiresAt != nil {
		ttl := time.Until(claims.ExpiresAt.Time)
		if ttl > 0 {
			if err := h.tokenBlacklist.Revoke(c.Request.Context(), token, ttl); err != nil {
				_ = c.Error(apperrors.Internal("退出登录失败"))
				return
			}
		}
	}
	response.Success[any](c, nil, "退出登录成功")
}

func (h *Handler) Me(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if ok {
		u, err := h.userService.FindByID(claims.UserID)
		if err != nil {
			_ = c.Error(err)
			return
		}
		response.Success(c, u, "获取用户信息成功")
		return
	}

	rawUserID := c.Query("userId")
	if rawUserID == "" {
		response.BadRequest(c, "缺少用户ID")
		return
	}

	userID, err := strconv.ParseUint(rawUserID, 10, 64)
	if err != nil {
		response.BadRequest(c, "缺少用户ID")
		return
	}

	u, err := h.userService.FindByID(userID)
	if err != nil {
		_ = c.Error(err)
		return
	}

	response.Success(c, u, "获取用户信息成功")
}

func (h *Handler) Refresh(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.Unauthorized(c, "请先登录")
		return
	}
	u, err := h.userService.FindByID(claims.UserID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	if u.Status != user.StatusActive {
		_ = c.Error(apperrors.Forbidden("账号状态异常"))
		return
	}
	token, err := h.authService.Refresh(u)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, gin.H{"token": token}, "Token 刷新成功")
}
