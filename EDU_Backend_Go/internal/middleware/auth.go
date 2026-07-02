package middleware

import (
	"fmt"

	"github.com/casbin/casbin/v2"
	"github.com/gin-gonic/gin"

	"edu-platform/internal/infra/authz"
	appjwt "edu-platform/pkg/jwt"
	"edu-platform/pkg/response"
)

const UserClaimsKey = "userClaims"
const UserTokenKey = "userToken"

func AuthMiddleware(manager *appjwt.Manager, blacklist *authz.TokenBlacklist) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := appjwt.ExtractBearerToken(c.GetHeader("Authorization"))
		if token == "" {
			response.UnauthorizedKey(c, "auth.tokenRequired", nil)
			c.Abort()
			return
		}
		claims, err := manager.ParseToken(token)
		if err != nil {
			response.UnauthorizedKey(c, "auth.tokenInvalid", nil)
			c.Abort()
			return
		}
		revoked, err := blacklist.IsRevoked(c.Request.Context(), token)
		if err != nil {
			response.InternalKey(c, "auth.statusFailed", nil)
			c.Abort()
			return
		}
		if revoked {
			response.UnauthorizedKey(c, "auth.tokenRevoked", nil)
			c.Abort()
			return
		}
		c.Set(UserClaimsKey, claims)
		c.Set(UserTokenKey, token)
		c.Next()
	}
}

func OptionalAuthMiddleware(manager *appjwt.Manager, blacklist *authz.TokenBlacklist) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := appjwt.ExtractBearerToken(c.GetHeader("Authorization"))
		if token != "" {
			if claims, err := manager.ParseToken(token); err == nil {
				if revoked, revokeErr := blacklist.IsRevoked(c.Request.Context(), token); revokeErr == nil && !revoked {
					c.Set(UserClaimsKey, claims)
					c.Set(UserTokenKey, token)
				}
			}
		}
		c.Next()
	}
}

func AdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		raw, ok := c.Get(UserClaimsKey)
		if !ok {
			response.UnauthorizedKey(c, "auth.required", nil)
			c.Abort()
			return
		}
		claims, ok := raw.(*appjwt.Claims)
		if !ok || claims.RoleType != 10 {
			response.ForbiddenKey(c, "auth.adminRequired", nil)
			c.Abort()
			return
		}
		c.Next()
	}
}

func TeacherMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		raw, ok := c.Get(UserClaimsKey)
		if !ok {
			response.UnauthorizedKey(c, "auth.required", nil)
			c.Abort()
			return
		}
		claims, ok := raw.(*appjwt.Claims)
		if !ok || claims.RoleType < 2 {
			response.ForbiddenKey(c, "auth.teacherRequired", nil)
			c.Abort()
			return
		}
		c.Next()
	}
}

func CasbinMiddleware(enforcer *casbin.Enforcer) gin.HandlerFunc {
	return func(c *gin.Context) {
		if enforcer == nil {
			response.InternalKey(c, "auth.permissionUnavailable", nil)
			c.Abort()
			return
		}
		claims, ok := CurrentClaims(c)
		if !ok || claims == nil {
			response.UnauthorizedKey(c, "auth.required", nil)
			c.Abort()
			return
		}

		allowed, err := enforcer.Enforce(fmt.Sprintf("role:%d", claims.RoleType), c.Request.URL.Path, c.Request.Method)
		if err != nil {
			response.InternalKey(c, "auth.permissionCheckFailed", nil)
			c.Abort()
			return
		}
		if !allowed {
			response.ForbiddenKey(c, "auth.accessForbidden", nil)
			c.Abort()
			return
		}
		c.Next()
	}
}

func CurrentClaims(c *gin.Context) (*appjwt.Claims, bool) {
	raw, ok := c.Get(UserClaimsKey)
	if !ok {
		return nil, false
	}
	claims, ok := raw.(*appjwt.Claims)
	return claims, ok
}

func CurrentToken(c *gin.Context) (string, bool) {
	raw, ok := c.Get(UserTokenKey)
	if !ok {
		return "", false
	}
	token, ok := raw.(string)
	return token, ok && token != ""
}
