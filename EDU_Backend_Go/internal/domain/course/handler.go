package course

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"edu-platform/internal/middleware"
	apperrors "edu-platform/pkg/errors"
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

	list, total, err := h.service.List(q.Page, q.PageSize, c.Query("keyword"), status, difficulty)
	if err != nil {
		_ = c.Error(err)
		return
	}

	response.Success(c, gin.H{
		"list":     list,
		"total":    total,
		"page":     q.Page,
		"pageSize": q.PageSize,
	}, "获取课程列表成功")
}

func (h *Handler) ListAssignedForStudent(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	classID, _ := strconv.ParseUint(c.Query("classId"), 10, 64)
	items, err := h.service.ListAssignedForStudent(c.Request.Context(), claims.UserID, classID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    items,
		"message": "获取班级课程成功",
	})
}

func (h *Handler) GetByID(c *gin.Context) {
	id, ok := parseUintParam(c, "id", "无效的课程ID")
	if !ok {
		return
	}
	detail, err := h.service.FindByID(id)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, detail, "获取课程成功")
}

func (h *Handler) GetBySlug(c *gin.Context) {
	detail, err := h.service.FindBySlug(c.Param("slug"))
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, detail, "获取课程成功")
}

func (h *Handler) GetStages(c *gin.Context) {
	courseID, ok := parseUintParam(c, "id", "无效的课程ID")
	if !ok {
		return
	}
	stages, err := h.service.GetCourseStages(courseID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, stages, "获取阶段列表成功")
}

func (h *Handler) GetLessons(c *gin.Context) {
	courseID, ok := parseUintParam(c, "id", "无效的课程ID")
	if !ok {
		return
	}
	lessons, err := h.service.GetCourseLessons(courseID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, lessons, "获取课时列表成功")
}

func (h *Handler) GetStageLessons(c *gin.Context) {
	stageID, ok := parseUintParam(c, "stageId", "无效的阶段ID")
	if !ok {
		return
	}
	lessons, err := h.service.GetStageLessons(stageID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, lessons, "获取课时列表成功")
}

func (h *Handler) GetLessonByID(c *gin.Context) {
	lessonID, ok := parseUintParam(c, "lessonId", "无效的课时ID")
	if !ok {
		return
	}
	lesson, err := h.service.GetLessonByID(lessonID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, lesson, "获取课时成功")
}

func (h *Handler) GetLessonMaterials(c *gin.Context) {
	lessonID, ok := parseUintParam(c, "lessonId", "无效的课时ID")
	if !ok {
		return
	}
	materials, err := h.service.GetLessonMaterials(lessonID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, materials, "获取学习资料成功")
}

func (h *Handler) EnrollCourse(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.Unauthorized(c, "请先登录")
		return
	}
	courseID, ok := parseUintParam(c, "id", "无效的课程ID")
	if !ok {
		return
	}
	enrollment, err := h.service.EnrollCourse(claims.UserID, courseID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, enrollment, "加入课程成功")
}

func (h *Handler) GetUserLessonRecords(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.Unauthorized(c, "请先登录")
		return
	}
	courseID, ok := parseUintParam(c, "id", "无效的课程ID")
	if !ok {
		return
	}
	records, err := h.service.GetUserLessonRecords(claims.UserID, courseID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, records, "获取课时记录成功")
}

func (h *Handler) StartLesson(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.Unauthorized(c, "请先登录")
		return
	}
	lessonID, ok := parseUintParam(c, "lessonId", "无效的课时ID")
	if !ok {
		return
	}
	record, err := h.service.StartLesson(claims.UserID, lessonID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, record, "开始学习成功")
}

func (h *Handler) CompleteLesson(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.Unauthorized(c, "请先登录")
		return
	}
	lessonID, ok := parseUintParam(c, "lessonId", "无效的课时ID")
	if !ok {
		return
	}

	var req struct {
		Score *int `json:"score"`
	}
	if err := c.ShouldBindJSON(&req); err != nil && c.ContentType() == "application/json" {
		response.BadRequest(c, "请求参数错误")
		return
	}

	result, err := h.service.CompleteLesson(claims.UserID, lessonID, req.Score)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, result, "完成学习成功")
}

func (h *Handler) CreateCourse(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.Unauthorized(c, "请先登录")
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
		response.BadRequest(c, "请求参数错误")
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
	response.Created(c, course, "课程创建成功")
}

func (h *Handler) UpdateCourse(c *gin.Context) {
	id, ok := parseUintParam(c, "id", "无效的课程ID")
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
		response.BadRequest(c, "请求参数错误")
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
	response.Success(c, course, "课程更新成功")
}

func (h *Handler) DeleteCourse(c *gin.Context) {
	id, ok := parseUintParam(c, "id", "无效的课程ID")
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
	response.Success[any](c, nil, "课程删除成功")
}

func (h *Handler) PublishCourse(c *gin.Context) {
	h.updateCourseStatus(c, CourseStatusPublished, "课程已发布")
}

func (h *Handler) ArchiveCourse(c *gin.Context) {
	h.updateCourseStatus(c, CourseStatusArchived, "课程已下架")
}

func (h *Handler) DraftCourse(c *gin.Context) {
	h.updateCourseStatus(c, CourseStatusDraft, "课程已设为草稿")
}

func (h *Handler) CreateStage(c *gin.Context) {
	courseID, ok := parseUintParam(c, "id", "无效的课程ID")
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
		response.BadRequest(c, "请求参数错误")
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
	response.Created(c, stage, "阶段创建成功")
}

func (h *Handler) UpdateStage(c *gin.Context) {
	stageID, ok := parseUintParam(c, "stageId", "无效的阶段ID")
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
		response.BadRequest(c, "请求参数错误")
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
	response.Success(c, stage, "阶段更新成功")
}

func (h *Handler) DeleteStage(c *gin.Context) {
	stageID, ok := parseUintParam(c, "stageId", "无效的阶段ID")
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
	response.Success[any](c, nil, "阶段删除成功")
}

func (h *Handler) ReorderStages(c *gin.Context) {
	courseID, ok := parseUintParam(c, "id", "无效的课程ID")
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
		response.BadRequest(c, "排序数据格式错误")
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
	response.Success(c, stages, "阶段排序更新成功")
}

func (h *Handler) CreateLesson(c *gin.Context) {
	courseID, ok := parseUintParam(c, "id", "无效的课程ID")
	if !ok {
		return
	}
	if !h.ensureCourseAccess(c, courseID) {
		return
	}
	stageID, ok := parseUintParam(c, "stageId", "无效的阶段ID")
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
		response.BadRequest(c, "请求参数错误")
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
	response.Created(c, lesson, "课时创建成功")
}

func (h *Handler) UpdateLesson(c *gin.Context) {
	lessonID, ok := parseUintParam(c, "lessonId", "无效的课时ID")
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
		response.BadRequest(c, "请求参数错误")
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
	response.Success(c, lesson, "课时更新成功")
}

func (h *Handler) DeleteLesson(c *gin.Context) {
	lessonID, ok := parseUintParam(c, "lessonId", "无效的课时ID")
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
	response.Success[any](c, nil, "课时删除成功")
}

func (h *Handler) ReorderLessons(c *gin.Context) {
	stageID, ok := parseUintParam(c, "stageId", "无效的阶段ID")
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
		response.BadRequest(c, "排序数据格式错误")
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
	response.Success(c, lessons, "课时排序更新成功")
}

func (h *Handler) GetAllSkills(c *gin.Context) {
	skills, err := h.service.GetAllSkills()
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, skills, "获取技能列表成功")
}

func (h *Handler) GetSkillsByCategory(c *gin.Context) {
	skills, err := h.service.GetSkillsByCategory(c.Param("category"))
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, skills, "获取技能列表成功")
}

func (h *Handler) CreateSkill(c *gin.Context) {
	var req struct {
		Name     string `json:"name"`
		Category string `json:"category"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误")
		return
	}
	skill, err := h.service.CreateSkill(req.Name, req.Category)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Created(c, skill, "技能创建成功")
}

func (h *Handler) UpdateSkill(c *gin.Context) {
	id, ok := parseUintParam(c, "id", "无效的技能ID")
	if !ok {
		return
	}
	var req struct {
		Name     *string `json:"name"`
		Category *string `json:"category"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误")
		return
	}
	skill, err := h.service.UpdateSkill(id, req.Name, req.Category)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, skill, "技能更新成功")
}

func (h *Handler) DeleteSkill(c *gin.Context) {
	id, ok := parseUintParam(c, "id", "无效的技能ID")
	if !ok {
		return
	}
	if err := h.service.DeleteSkill(id); err != nil {
		_ = c.Error(err)
		return
	}
	response.Success[any](c, nil, "技能删除成功")
}

func (h *Handler) UploadMaterial(c *gin.Context) {
	lessonID, ok := parseUintParam(c, "lessonId", "无效的课时ID")
	if !ok {
		return
	}
	if !h.ensureCourseAccessByLesson(c, lessonID) {
		return
	}
	file, err := c.FormFile("material")
	if err != nil {
		response.BadRequest(c, "请选择要上传的文件")
		return
	}
	title := c.PostForm("title")
	sortOrder, _ := strconv.Atoi(c.DefaultPostForm("sortOrder", "0"))
	materialType := materialTypeFromFilename(file.Filename)
	if err := os.MkdirAll(filepath.Join(h.uploadRoot, "materials"), 0o755); err != nil {
		response.Internal(c, "创建上传目录失败")
		return
	}
	ext := strings.ToLower(filepath.Ext(file.Filename))
	filename := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
	destPath := filepath.Join(h.uploadRoot, "materials", filename)
	if err := c.SaveUploadedFile(file, destPath); err != nil {
		response.Internal(c, "保存文件失败")
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
	response.Created(c, material, "学习资料上传成功")
}

func (h *Handler) UpdateMaterial(c *gin.Context) {
	materialID, ok := parseUintParam(c, "materialId", "无效的资料ID")
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
		response.BadRequest(c, "请求参数错误")
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
	response.Success(c, material, "学习资料更新成功")
}

func (h *Handler) DeleteMaterial(c *gin.Context) {
	materialID, ok := parseUintParam(c, "materialId", "无效的资料ID")
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
	response.Success[any](c, nil, "学习资料删除成功")
}

func (h *Handler) ReorderMaterials(c *gin.Context) {
	lessonID, ok := parseUintParam(c, "lessonId", "无效的课时ID")
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
		response.BadRequest(c, "排序数据格式错误")
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
	response.Success(c, materials, "学习资料排序更新成功")
}

func parseUintParam(c *gin.Context, name, message string) (uint64, bool) {
	id, err := strconv.ParseUint(c.Param(name), 10, 64)
	if err != nil {
		response.BadRequest(c, message)
		return 0, false
	}
	return id, true
}

func (h *Handler) updateCourseStatus(c *gin.Context, status CourseStatus, message string) {
	id, ok := parseUintParam(c, "id", "无效的课程ID")
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
	response.Success(c, course, message)
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
		response.Unauthorized(c, "请先登录")
		return false
	}
	if claims.RoleType >= 10 || creatorID == claims.UserID {
		return true
	}
	_ = c.Error(apperrors.Forbidden("无权管理该课程"))
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
