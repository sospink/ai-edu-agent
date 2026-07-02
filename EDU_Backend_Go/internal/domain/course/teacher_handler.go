package course

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"edu-platform/internal/middleware"
	"edu-platform/pkg/pagination"
	"edu-platform/pkg/response"
)

type TeacherHandler struct {
	service *Service
}

func NewTeacherHandler(service *Service) *TeacherHandler {
	return &TeacherHandler{service: service}
}

func (h *TeacherHandler) List(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	q := pagination.Normalize(page, pageSize)

	var status *int
	if raw := c.Query("status"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil {
			status = &parsed
		}
	}

	var difficulty *int
	if raw := c.Query("difficulty"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil {
			difficulty = &parsed
		}
	}

	list, total, err := h.service.ListForTeacher(claims.UserID, claims.RoleType, q.Page, q.PageSize, c.Query("keyword"), status, difficulty)
	if err != nil {
		_ = c.Error(err)
		return
	}

	response.SuccessKey(c, gin.H{
		"list":     list,
		"total":    total,
		"page":     q.Page,
		"pageSize": q.PageSize,
	}, "course.listLoaded", nil)
}

func (h *TeacherHandler) GetByID(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}

	id, ok := parseUintParam(c, "id", "course.invalidId")
	if !ok {
		return
	}

	detail, err := h.service.FindByIDForTeacher(claims.UserID, claims.RoleType, id)
	if err != nil {
		_ = c.Error(err)
		return
	}

	response.SuccessKey(c, detail, "course.detailLoaded", nil)
}

func (h *TeacherHandler) GetStages(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}

	courseID, ok := parseUintParam(c, "id", "course.invalidId")
	if !ok {
		return
	}

	stages, err := h.service.GetCourseStagesForTeacher(claims.UserID, claims.RoleType, courseID)
	if err != nil {
		_ = c.Error(err)
		return
	}

	response.SuccessKey(c, stages, "course.stagesLoaded", nil)
}

func (h *TeacherHandler) GetLessons(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}

	courseID, ok := parseUintParam(c, "id", "course.invalidId")
	if !ok {
		return
	}

	lessons, err := h.service.GetCourseLessonsForTeacher(claims.UserID, claims.RoleType, courseID)
	if err != nil {
		_ = c.Error(err)
		return
	}

	response.SuccessKey(c, lessons, "course.lessonsLoaded", nil)
}

func (h *TeacherHandler) GetStageLessons(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}

	stageID, ok := parseUintParam(c, "stageId", "course.invalidStageId")
	if !ok {
		return
	}

	lessons, err := h.service.GetStageLessonsForTeacher(claims.UserID, claims.RoleType, stageID)
	if err != nil {
		_ = c.Error(err)
		return
	}

	response.SuccessKey(c, lessons, "course.lessonsLoaded", nil)
}

func (h *TeacherHandler) GetLessonByID(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}

	lessonID, ok := parseUintParam(c, "lessonId", "course.invalidLessonId")
	if !ok {
		return
	}

	lesson, err := h.service.GetLessonByIDForTeacher(claims.UserID, claims.RoleType, lessonID)
	if err != nil {
		_ = c.Error(err)
		return
	}

	response.SuccessKey(c, lesson, "course.lessonLoaded", nil)
}

func (h *TeacherHandler) GetLessonMaterials(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}

	lessonID, ok := parseUintParam(c, "lessonId", "course.invalidLessonId")
	if !ok {
		return
	}

	materials, err := h.service.GetLessonMaterialsForTeacher(claims.UserID, claims.RoleType, lessonID)
	if err != nil {
		_ = c.Error(err)
		return
	}

	response.SuccessKey(c, materials, "course.materialsLoaded", nil)
}
