package middleware

import (
	"github.com/gin-gonic/gin"

	apperrors "edu-platform/pkg/errors"
	"edu-platform/pkg/i18n"
	"edu-platform/pkg/response"
)

type payloadError interface {
	error
	StatusCode() int
	Code() string
	Payload() any
}

func ErrorHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
		if len(c.Errors) == 0 {
			return
		}
		lastErr := c.Errors.Last().Err
		if errWithPayload, ok := lastErr.(payloadError); ok {
			c.JSON(errWithPayload.StatusCode(), response.APIResponse[any]{
				Success: false,
				Error:   i18n.T(c.Request.Context(), errWithPayload.Error()),
				Code:    errWithPayload.Code(),
				Data:    errWithPayload.Payload(),
			})
			return
		}
		if appErr, ok := lastErr.(*apperrors.AppError); ok {
			response.Error(c, appErr.StatusCode, appErr.Message, appErr.Code)
			return
		}
		response.Internal(c, lastErr.Error())
	}
}
