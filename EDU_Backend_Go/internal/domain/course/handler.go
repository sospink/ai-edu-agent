package course

import (
	"fmt"
	"os"
	"path/filepath"
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
	service    *Service
	uploadRoot string
}

type stageOrder struct {
	ID        uint64 `json:"id"`
	SortOrder int    `json:"sortOrder"`
}

type lessonOrder struct {
	ID        uint64 `json:"id"`
	SortOrder int    `json:"sortOrder"`
}

type materialOrder struct {
	ID        uint64 `json:"id"`
	SortOrder int    `json:"sortOrder"`
}

func NewHandler(service *Service, uploadRoot string) *Handler {
	return &Handler{
		service:    service,
		uploadRoot: uploadRoot,
	}
}

func (h *Handler) List(c *gin.Context) {
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

	list, total, err := h.service.ListLocalized(c.Request.Context(), q.Page, q.PageSize, c.Query("keyword"), status, difficulty)
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

func (h *Handler) ListAssignedForStudent(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	classID, _ := strconv.ParseUint(c.Query("classId"), 10, 64)
	items, err := h.service.ListAssignedForStudentLocalized(c.Request.Context(), claims.UserID, classID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, items, "course.assignedLoaded", nil)
}

func (h *Handler) GetByID(c *gin.Context) {
	id, ok := parseUintParam(c, "id", "course.invalidId")
	if !ok {
		return
	}
	detail, err := h.service.FindByIDLocalized(c.Request.Context(), id)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, detail, "course.detailLoaded", nil)
}

func (h *Handler) GetContentTranslation(c *gin.Context) {
	id, ok := parseUintParam(c, "id", "course.invalidId")
	if !ok {
		return
	}
	if !h.ensureCourseAccess(c, id) {
		return
	}
	locale := i18n.NormalizeLocale(c.Param("locale"))
	detail, err := h.service.FindByIDLocalized(i18n.WithLocale(c.Request.Context(), locale), id)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, detail, "course.detailLoaded", nil)
}

func (h *Handler) SaveContentTranslation(c *gin.Context) {
	id, ok := parseUintParam(c, "id", "course.invalidId")
	if !ok {
		return
	}
	if !h.ensureCourseAccess(c, id) {
		return
	}
	var req CourseContentTranslationInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}
	locale := i18n.NormalizeLocale(c.Param("locale"))
	detail, err := h.service.SaveCourseContentTranslation(c.Request.Context(), id, locale, req)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, detail, "course.updated", nil)
}

func (h *Handler) GetBySlug(c *gin.Context) {
	detail, err := h.service.FindBySlugLocalized(c.Request.Context(), c.Param("slug"))
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, detail, "course.detailLoaded", nil)
}

func (h *Handler) GetStages(c *gin.Context) {
	courseID, ok := parseUintParam(c, "id", "course.invalidId")
	if !ok {
		return
	}
	stages, err := h.service.GetCourseStagesLocalized(c.Request.Context(), courseID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, stages, "course.stagesLoaded", nil)
}

func (h *Handler) GetLessons(c *gin.Context) {
	courseID, ok := parseUintParam(c, "id", "course.invalidId")
	if !ok {
		return
	}
	lessons, err := h.service.GetCourseLessonsLocalized(c.Request.Context(), courseID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, lessons, "course.lessonsLoaded", nil)
}

func (h *Handler) GetStageLessons(c *gin.Context) {
	stageID, ok := parseUintParam(c, "stageId", "course.invalidStageId")
	if !ok {
		return
	}
	lessons, err := h.service.GetStageLessonsLocalized(c.Request.Context(), stageID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, lessons, "course.lessonsLoaded", nil)
}

func (h *Handler) GetLessonByID(c *gin.Context) {
	lessonID, ok := parseUintParam(c, "lessonId", "course.invalidLessonId")
	if !ok {
		return
	}
	lesson, err := h.service.GetLessonByIDLocalized(c.Request.Context(), lessonID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, lesson, "course.lessonLoaded", nil)
}

func (h *Handler) GetLessonMaterials(c *gin.Context) {
	lessonID, ok := parseUintParam(c, "lessonId", "course.invalidLessonId")
	if !ok {
		return
	}
	materials, err := h.service.GetLessonMaterialsLocalized(c.Request.Context(), lessonID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, materials, "course.materialsLoaded", nil)
}

func (h *Handler) EnrollCourse(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	courseID, ok := parseUintParam(c, "id", "course.invalidId")
	if !ok {
		return
	}
	enrollment, err := h.service.EnrollCourse(claims.UserID, courseID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, enrollment, "course.enrolled", nil)
}

func (h *Handler) GetUserLessonRecords(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	courseID, ok := parseUintParam(c, "id", "course.invalidId")
	if !ok {
		return
	}
	records, err := h.service.GetUserLessonRecords(claims.UserID, courseID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, records, "course.recordsLoaded", nil)
}

func (h *Handler) StartLesson(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	lessonID, ok := parseUintParam(c, "lessonId", "course.invalidLessonId")
	if !ok {
		return
	}
	record, err := h.service.StartLesson(claims.UserID, lessonID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, record, "course.lessonStarted", nil)
}

func (h *Handler) CompleteLesson(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	lessonID, ok := parseUintParam(c, "lessonId", "course.invalidLessonId")
	if !ok {
		return
	}

	var req struct {
		Score *int `json:"score"`
	}
	if err := c.ShouldBindJSON(&req); err != nil && c.ContentType() == "application/json" {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}

	result, err := h.service.CompleteLesson(claims.UserID, lessonID, req.Score)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "course.lessonCompleted", nil)
}

func (h *Handler) CreateCourse(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	var req struct {
		Title          string `json:"title"`
		Slug           string `json:"slug"`
		Description    string `json:"description"`
		IconURL        string `json:"iconUrl"`
		CoverColor     string `json:"coverColor"`
		Difficulty     int    `json:"difficulty"`
		Status         *int   `json:"status"`
		EstimatedHours int    `json:"estimatedHours"`
		EnvImage       string `json:"envImage"`
		IDEImage       string `json:"ideImage"`
		LabTemplateID  uint64 `json:"labTemplateId"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}
	status := CourseStatusDraft
	if req.Status != nil {
		if CourseStatus(*req.Status) != CourseStatusPublished {
			status = CourseStatus(*req.Status)
		}
	}
	course, err := h.service.CreateCourse(CreateCourseParams{
		Title:          req.Title,
		Slug:           req.Slug,
		Description:    req.Description,
		IconURL:        req.IconURL,
		CoverColor:     req.CoverColor,
		Difficulty:     req.Difficulty,
		Status:         status,
		EstimatedHours: req.EstimatedHours,
		EnvImage:       req.EnvImage,
		IDEImage:       req.IDEImage,
		LabTemplateID:  req.LabTemplateID,
		CreatorID:      claims.UserID,
	})
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.CreatedKey(c, course, "course.created", nil)
}

func (h *Handler) UpdateCourse(c *gin.Context) {
	id, ok := parseUintParam(c, "id", "course.invalidId")
	if !ok {
		return
	}
	if !h.ensureCourseAccess(c, id) {
		return
	}
	var req struct {
		Title          *string `json:"title"`
		Slug           *string `json:"slug"`
		Description    *string `json:"description"`
		IconURL        *string `json:"iconUrl"`
		CoverColor     *string `json:"coverColor"`
		Difficulty     *int    `json:"difficulty"`
		Status         *int    `json:"status"`
		EstimatedHours *int    `json:"estimatedHours"`
		EnvImage       *string `json:"envImage"`
		IDEImage       *string `json:"ideImage"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}
	var status *CourseStatus
	if req.Status != nil {
		casted := CourseStatus(*req.Status)
		status = &casted
	}
	course, err := h.service.UpdateCourse(id, UpdateCourseParams{
		Title:          req.Title,
		Slug:           req.Slug,
		Description:    req.Description,
		IconURL:        req.IconURL,
		CoverColor:     req.CoverColor,
		Difficulty:     req.Difficulty,
		Status:         status,
		EstimatedHours: req.EstimatedHours,
		EnvImage:       req.EnvImage,
		IDEImage:       req.IDEImage,
	})
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, course, "course.updated", nil)
}

func (h *Handler) DeleteCourse(c *gin.Context) {
	id, ok := parseUintParam(c, "id", "course.invalidId")
	if !ok {
		return
	}
	if !h.ensureCourseAccess(c, id) {
		return
	}
	if err := h.service.DeleteCourse(id); err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey[any](c, nil, "course.deleted", nil)
}

func (h *Handler) PublishCourse(c *gin.Context) {
	h.updateCourseStatus(c, CourseStatusPublished, "publishing.coursePublished")
}

func (h *Handler) ArchiveCourse(c *gin.Context) {
	h.updateCourseStatus(c, CourseStatusArchived, "publishing.courseArchived")
}

func (h *Handler) DraftCourse(c *gin.Context) {
	h.updateCourseStatus(c, CourseStatusDraft, "publishing.courseDrafted")
}

func (h *Handler) CreateStage(c *gin.Context) {
	courseID, ok := parseUintParam(c, "id", "course.invalidId")
	if !ok {
		return
	}
	if !h.ensureCourseAccess(c, courseID) {
		return
	}
	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		SortOrder   int    `json:"sortOrder"`
		LevelLabel  string `json:"levelLabel"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}
	stage, err := h.service.CreateStage(CreateStageParams{
		CourseID:    courseID,
		Title:       req.Title,
		Description: req.Description,
		SortOrder:   req.SortOrder,
		LevelLabel:  req.LevelLabel,
	})
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.CreatedKey(c, stage, "course.stageCreated", nil)
}

func (h *Handler) UpdateStage(c *gin.Context) {
	stageID, ok := parseUintParam(c, "stageId", "course.invalidStageId")
	if !ok {
		return
	}
	if !h.ensureCourseAccessByStage(c, stageID) {
		return
	}
	var req struct {
		Title       *string `json:"title"`
		Description *string `json:"description"`
		SortOrder   *int    `json:"sortOrder"`
		LevelLabel  *string `json:"levelLabel"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}
	stage, err := h.service.UpdateStage(stageID, UpdateStageParams{
		Title:       req.Title,
		Description: req.Description,
		SortOrder:   req.SortOrder,
		LevelLabel:  req.LevelLabel,
	})
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, stage, "course.stageUpdated", nil)
}

func (h *Handler) DeleteStage(c *gin.Context) {
	stageID, ok := parseUintParam(c, "stageId", "course.invalidStageId")
	if !ok {
		return
	}
	if !h.ensureCourseAccessByStage(c, stageID) {
		return
	}
	if err := h.service.DeleteStage(stageID); err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey[any](c, nil, "course.stageDeleted", nil)
}

func (h *Handler) ReorderStages(c *gin.Context) {
	courseID, ok := parseUintParam(c, "id", "course.invalidId")
	if !ok {
		return
	}
	if !h.ensureCourseAccess(c, courseID) {
		return
	}
	var req struct {
		Orders []stageOrder `json:"orders"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || len(req.Orders) == 0 {
		response.BadRequestKey(c, "common.invalidOrder", nil)
		return
	}
	orders := make([]struct {
		ID        uint64
		SortOrder int
	}, 0, len(req.Orders))
	for _, item := range req.Orders {
		orders = append(orders, struct {
			ID        uint64
			SortOrder int
		}{ID: item.ID, SortOrder: item.SortOrder})
	}
	stages, err := h.service.ReorderStages(courseID, orders)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, stages, "course.stagesReordered", nil)
}

func (h *Handler) CreateLesson(c *gin.Context) {
	courseID, ok := parseUintParam(c, "id", "course.invalidId")
	if !ok {
		return
	}
	if !h.ensureCourseAccess(c, courseID) {
		return
	}
	stageID, ok := parseUintParam(c, "stageId", "course.invalidStageId")
	if !ok {
		return
	}
	var req struct {
		Title           string   `json:"title"`
		Type            int      `json:"type"`
		DurationMinutes int      `json:"durationMinutes"`
		LabIdentifier   string   `json:"labIdentifier"`
		Points          int      `json:"points"`
		SortOrder       int      `json:"sortOrder"`
		SkillIDs        []uint64 `json:"skillIds"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}
	lesson, err := h.service.CreateLesson(CreateLessonParams{
		CourseID:        courseID,
		StageID:         stageID,
		Title:           req.Title,
		Type:            req.Type,
		DurationMinutes: req.DurationMinutes,
		LabIdentifier:   req.LabIdentifier,
		Points:          req.Points,
		SortOrder:       req.SortOrder,
		SkillIDs:        req.SkillIDs,
	})
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.CreatedKey(c, lesson, "course.lessonCreated", nil)
}

func (h *Handler) UpdateLesson(c *gin.Context) {
	lessonID, ok := parseUintParam(c, "lessonId", "course.invalidLessonId")
	if !ok {
		return
	}
	if !h.ensureCourseAccessByLesson(c, lessonID) {
		return
	}
	var req struct {
		Title           *string   `json:"title"`
		Type            *int      `json:"type"`
		DurationMinutes *int      `json:"durationMinutes"`
		LabIdentifier   *string   `json:"labIdentifier"`
		Points          *int      `json:"points"`
		SortOrder       *int      `json:"sortOrder"`
		SkillIDs        *[]uint64 `json:"skillIds"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}
	lesson, err := h.service.UpdateLesson(lessonID, UpdateLessonParams{
		Title:           req.Title,
		Type:            req.Type,
		DurationMinutes: req.DurationMinutes,
		LabIdentifier:   req.LabIdentifier,
		Points:          req.Points,
		SortOrder:       req.SortOrder,
		SkillIDs:        req.SkillIDs,
	})
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, lesson, "course.lessonUpdated", nil)
}

func (h *Handler) DeleteLesson(c *gin.Context) {
	lessonID, ok := parseUintParam(c, "lessonId", "course.invalidLessonId")
	if !ok {
		return
	}
	if !h.ensureCourseAccessByLesson(c, lessonID) {
		return
	}
	if err := h.service.DeleteLesson(lessonID); err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey[any](c, nil, "course.lessonDeleted", nil)
}

func (h *Handler) ReorderLessons(c *gin.Context) {
	stageID, ok := parseUintParam(c, "stageId", "course.invalidStageId")
	if !ok {
		return
	}
	if !h.ensureCourseAccessByStage(c, stageID) {
		return
	}
	var req struct {
		Orders []lessonOrder `json:"orders"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || len(req.Orders) == 0 {
		response.BadRequestKey(c, "common.invalidOrder", nil)
		return
	}
	orders := make([]struct {
		ID        uint64
		SortOrder int
	}, 0, len(req.Orders))
	for _, item := range req.Orders {
		orders = append(orders, struct {
			ID        uint64
			SortOrder int
		}{ID: item.ID, SortOrder: item.SortOrder})
	}
	lessons, err := h.service.ReorderLessons(stageID, orders)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, lessons, "course.lessonsReordered", nil)
}

func (h *Handler) GetAllSkills(c *gin.Context) {
	skills, err := h.service.GetAllSkills()
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, skills, "course.skillsLoaded", nil)
}

func (h *Handler) GetSkillsByCategory(c *gin.Context) {
	skills, err := h.service.GetSkillsByCategory(c.Param("category"))
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, skills, "course.skillsLoaded", nil)
}

func (h *Handler) CreateSkill(c *gin.Context) {
	var req struct {
		Name     string `json:"name"`
		Category string `json:"category"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}
	skill, err := h.service.CreateSkill(req.Name, req.Category)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.CreatedKey(c, skill, "course.skillCreated", nil)
}

func (h *Handler) UpdateSkill(c *gin.Context) {
	id, ok := parseUintParam(c, "id", "course.invalidSkillId")
	if !ok {
		return
	}
	var req struct {
		Name     *string `json:"name"`
		Category *string `json:"category"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}
	skill, err := h.service.UpdateSkill(id, req.Name, req.Category)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, skill, "course.skillUpdated", nil)
}

func (h *Handler) DeleteSkill(c *gin.Context) {
	id, ok := parseUintParam(c, "id", "course.invalidSkillId")
	if !ok {
		return
	}
	if err := h.service.DeleteSkill(id); err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey[any](c, nil, "course.skillDeleted", nil)
}

func (h *Handler) UploadMaterial(c *gin.Context) {
	lessonID, ok := parseUintParam(c, "lessonId", "course.invalidLessonId")
	if !ok {
		return
	}
	if !h.ensureCourseAccessByLesson(c, lessonID) {
		return
	}
	file, err := c.FormFile("material")
	if err != nil {
		response.BadRequestKey(c, "course.uploadRequired", nil)
		return
	}
	title := c.PostForm("title")
	sortOrder, _ := strconv.Atoi(c.DefaultPostForm("sortOrder", "0"))
	materialType := materialTypeFromFilename(file.Filename)
	if err := os.MkdirAll(filepath.Join(h.uploadRoot, "materials"), 0o755); err != nil {
		response.InternalKey(c, "course.uploadDirectoryFailed", nil)
		return
	}
	ext := strings.ToLower(filepath.Ext(file.Filename))
	filename := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
	destPath := filepath.Join(h.uploadRoot, "materials", filename)
	if err := c.SaveUploadedFile(file, destPath); err != nil {
		response.InternalKey(c, "course.uploadSaveFailed", nil)
		return
	}
	fileURL := "/uploads/materials/" + filename
	storedName := filepath.Base(fileURL)
	material, serviceErr := h.service.CreateMaterial(CreateMaterialParams{
		LessonID:  lessonID,
		Title:     title,
		Type:      materialType,
		FileURL:   fileURL,
		FileName:  file.Filename,
		FileSize:  file.Size,
		SortOrder: sortOrder,
	})
	if serviceErr != nil {
		_ = c.Error(serviceErr)
		return
	}
	if material.FileName == "" {
		material.FileName = file.Filename
	}
	if material.FileURL == "" {
		material.FileURL = "/uploads/materials/" + storedName
	}
	response.CreatedKey(c, material, "course.materialUploaded", nil)
}

func (h *Handler) UpdateMaterial(c *gin.Context) {
	materialID, ok := parseUintParam(c, "materialId", "course.invalidMaterialId")
	if !ok {
		return
	}
	if !h.ensureCourseAccessByMaterial(c, materialID) {
		return
	}
	var req struct {
		Title     *string `json:"title"`
		SortOrder *int    `json:"sortOrder"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}
	material, err := h.service.UpdateMaterial(materialID, UpdateMaterialParams{
		Title:     req.Title,
		SortOrder: req.SortOrder,
	})
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, material, "course.materialUpdated", nil)
}

func (h *Handler) DeleteMaterial(c *gin.Context) {
	materialID, ok := parseUintParam(c, "materialId", "course.invalidMaterialId")
	if !ok {
		return
	}
	if !h.ensureCourseAccessByMaterial(c, materialID) {
		return
	}
	if err := h.service.DeleteMaterial(materialID); err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey[any](c, nil, "course.materialDeleted", nil)
}

func (h *Handler) ReorderMaterials(c *gin.Context) {
	lessonID, ok := parseUintParam(c, "lessonId", "course.invalidLessonId")
	if !ok {
		return
	}
	if !h.ensureCourseAccessByLesson(c, lessonID) {
		return
	}
	var req struct {
		Orders []materialOrder `json:"orders"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || len(req.Orders) == 0 {
		response.BadRequestKey(c, "common.invalidOrder", nil)
		return
	}
	orders := make([]struct {
		ID        uint64
		SortOrder int
	}, 0, len(req.Orders))
	for _, item := range req.Orders {
		orders = append(orders, struct {
			ID        uint64
			SortOrder int
		}{ID: item.ID, SortOrder: item.SortOrder})
	}
	materials, err := h.service.ReorderMaterials(lessonID, orders)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, materials, "course.materialsReordered", nil)
}

func parseUintParam(c *gin.Context, name string, key i18n.MessageKey) (uint64, bool) {
	id, err := strconv.ParseUint(c.Param(name), 10, 64)
	if err != nil {
		response.BadRequestKey(c, key, nil)
		return 0, false
	}
	return id, true
}

func (h *Handler) updateCourseStatus(c *gin.Context, status CourseStatus, key i18n.MessageKey) {
	id, ok := parseUintParam(c, "id", "course.invalidId")
	if !ok {
		return
	}
	if !h.ensureCourseAccess(c, id) {
		return
	}
	course, err := h.service.UpdateCourseStatus(id, status)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, course, key, nil)
}

func (h *Handler) ensureCourseAccess(c *gin.Context, courseID uint64) bool {
	course, err := h.service.FindCourseEntity(courseID)
	if err != nil {
		_ = c.Error(err)
		return false
	}
	return h.ensureCourseOwnership(c, course.CreatorID)
}

func (h *Handler) ensureCourseAccessByStage(c *gin.Context, stageID uint64) bool {
	course, err := h.service.FindCourseEntityByStageID(stageID)
	if err != nil {
		_ = c.Error(err)
		return false
	}
	return h.ensureCourseOwnership(c, course.CreatorID)
}

func (h *Handler) ensureCourseAccessByLesson(c *gin.Context, lessonID uint64) bool {
	course, err := h.service.FindCourseEntityByLessonID(lessonID)
	if err != nil {
		_ = c.Error(err)
		return false
	}
	return h.ensureCourseOwnership(c, course.CreatorID)
}

func (h *Handler) ensureCourseAccessByMaterial(c *gin.Context, materialID uint64) bool {
	course, err := h.service.FindCourseEntityByMaterialID(materialID)
	if err != nil {
		_ = c.Error(err)
		return false
	}
	return h.ensureCourseOwnership(c, course.CreatorID)
}

func (h *Handler) ensureCourseOwnership(c *gin.Context, creatorID uint64) bool {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return false
	}
	if claims.RoleType >= 10 || creatorID == claims.UserID {
		return true
	}
	response.ForbiddenKey(c, "publishing.courseForbidden", nil)
	return false
}

func materialTypeFromFilename(filename string) int {
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".pdf":
		return 2
	case ".xmind", ".mm", ".xmm":
		return 3
	case ".doc", ".docx":
		return 4
	default:
		return 1
	}
}
