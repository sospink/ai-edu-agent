package auth

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"edu-platform/internal/domain/user"
	"edu-platform/internal/infra/authz"
	"edu-platform/internal/middleware"
	apperrors "edu-platform/pkg/errors"
	"edu-platform/pkg/response"
)

type Handler struct {
	authService    *Service
	userService    *user.Service
	tokenBlacklist *authz.TokenBlacklist
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
		response.BadRequestKey(c, "auth.credentialsRequired", nil)
		return
	}
	u, token, err := h.authService.Login(req.Username, req.Password)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, gin.H{
		"user":  u,
		"token": token,
	}, "auth.loginSucceeded", nil)
}

func (h *Handler) Logout(c *gin.Context) {
	token, ok := middleware.CurrentToken(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
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
	response.SuccessKey[any](c, nil, "auth.logoutSucceeded", nil)
}

func (h *Handler) Me(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if ok {
		u, err := h.userService.FindByID(claims.UserID)
		if err != nil {
			_ = c.Error(err)
			return
		}
		response.SuccessKey(c, u, "auth.userLoaded", nil)
		return
	}

	rawUserID := c.Query("userId")
	if rawUserID == "" {
		response.BadRequestKey(c, "user.idRequired", nil)
		return
	}

	userID, err := strconv.ParseUint(rawUserID, 10, 64)
	if err != nil {
		response.BadRequestKey(c, "user.idRequired", nil)
		return
	}

	u, err := h.userService.FindByID(userID)
	if err != nil {
		_ = c.Error(err)
		return
	}

	response.SuccessKey(c, u, "auth.userLoaded", nil)
}

func (h *Handler) Refresh(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
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
	response.SuccessKey(c, gin.H{"token": token}, "auth.tokenRefreshed", nil)
}
