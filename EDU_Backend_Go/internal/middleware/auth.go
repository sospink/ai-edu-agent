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
			response.Unauthorized(c, "未提供认证令牌")
			c.Abort()
			return
		}
		claims, err := manager.ParseToken(token)
		if err != nil {
			response.Unauthorized(c, "认证令牌无效或已过期")
			c.Abort()
			return
		}
		revoked, err := blacklist.IsRevoked(c.Request.Context(), token)
		if err != nil {
			response.Internal(c, "认证状态校验失败")
			c.Abort()
			return
		}
		if revoked {
			response.Unauthorized(c, "认证令牌已失效")
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
			response.Unauthorized(c, "请先登录")
			c.Abort()
			return
		}
		claims, ok := raw.(*appjwt.Claims)
		if !ok || claims.RoleType != 10 {
			response.Forbidden(c, "需要管理员权限")
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
			response.Unauthorized(c, "请先登录")
			c.Abort()
			return
		}
		claims, ok := raw.(*appjwt.Claims)
		if !ok || claims.RoleType < 2 {
			response.Forbidden(c, "需要教务端权限")
			c.Abort()
			return
		}
		c.Next()
	}
}

func CasbinMiddleware(enforcer *casbin.Enforcer) gin.HandlerFunc {
	return func(c *gin.Context) {
		if enforcer == nil {
			response.Internal(c, "权限服务未初始化")
			c.Abort()
			return
		}
		claims, ok := CurrentClaims(c)
		if !ok || claims == nil {
			response.Unauthorized(c, "请先登录")
			c.Abort()
			return
		}

		allowed, err := enforcer.Enforce(fmt.Sprintf("role:%d", claims.RoleType), c.Request.URL.Path, c.Request.Method)
		if err != nil {
			response.Internal(c, "权限校验失败")
			c.Abort()
			return
		}
		if !allowed {
			response.Forbidden(c, "无权访问该资源")
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
