package upload

import (
	"fmt"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"edu-platform/internal/config"
	"edu-platform/pkg/response"
)

type Handler struct {
	cfg *config.Config
}

func NewHandler(cfg *config.Config) *Handler {
	return &Handler{cfg: cfg}
}

func (h *Handler) UploadImage(c *gin.Context) {
	h.save(c, "image", map[string]bool{
		".png": true, ".jpg": true, ".jpeg": true, ".gif": true, ".webp": true,
	})
}

func (h *Handler) UploadImages(c *gin.Context) {
	form, err := c.MultipartForm()
	if err != nil || form == nil || len(form.File["images"]) == 0 {
		response.BadRequestKey(c, "upload.imageRequired", nil)
		return
	}
	files := form.File["images"]
	result := make([]gin.H, 0, len(files))
	for _, file := range files {
		ext := strings.ToLower(filepath.Ext(file.Filename))
		if ext != ".png" && ext != ".jpg" && ext != ".jpeg" && ext != ".gif" && ext != ".webp" {
			response.ErrorKey(c, http.StatusBadRequest, "UNSUPPORTED_FILE_TYPE", "upload.unsupportedType", nil)
			return
		}
		saved, saveErr := h.saveOne(c, file, "images")
		if saveErr != nil {
			response.InternalKey(c, "upload.saveFailed", nil)
			return
		}
		result = append(result, saved)
	}
	response.SuccessKey(c, result, "upload.imageUploaded", nil)
}

func (h *Handler) UploadFile(c *gin.Context) {
	h.save(c, "file", nil)
}

func (h *Handler) UploadMaterial(c *gin.Context) {
	h.save(c, "material", map[string]bool{
		".png": true, ".jpg": true, ".jpeg": true, ".gif": true, ".webp": true,
		".pdf": true, ".doc": true, ".docx": true, ".md": true,
	})
}

func (h *Handler) DeleteFile(c *gin.Context) {
	filePath := strings.TrimSpace(c.Query("filePath"))
	if filePath == "" {
		var req struct {
			FilePath string `json:"filePath"`
		}
		if err := c.ShouldBindJSON(&req); err == nil {
			filePath = strings.TrimSpace(req.FilePath)
		}
	}
	if filePath == "" {
		response.BadRequestKey(c, "upload.pathRequired", nil)
		return
	}
	if !strings.HasPrefix(filePath, "/uploads/") {
		response.BadRequestKey(c, "upload.invalidPath", nil)
		return
	}
	relative := strings.TrimPrefix(filePath, "/uploads/")
	relative = filepath.Clean(relative)
	if relative == "." || strings.HasPrefix(relative, "..") {
		response.BadRequestKey(c, "upload.invalidPath", nil)
		return
	}
	absolutePath := filepath.Join(h.cfg.Upload.Root, relative)
	if _, err := os.Stat(absolutePath); err != nil {
		if os.IsNotExist(err) {
			response.BadRequestKey(c, "upload.fileNotFound", nil)
			return
		}
		response.InternalKey(c, "upload.deleteFailed", nil)
		return
	}
	if err := os.Remove(absolutePath); err != nil {
		response.InternalKey(c, "upload.deleteFailed", nil)
		return
	}
	response.SuccessKey[any](c, nil, "upload.deleted", nil)
}

func (h *Handler) save(c *gin.Context, field string, allow map[string]bool) {
	file, err := c.FormFile(field)
	if err != nil {
		response.BadRequestKey(c, "upload.fileRequired", nil)
		return
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if len(allow) > 0 && !allow[ext] {
		response.ErrorKey(c, http.StatusBadRequest, "UNSUPPORTED_FILE_TYPE", "upload.unsupportedType", nil)
		return
	}

	subDir := field + "s"
	saved, err := h.saveOne(c, file, subDir)
	if err != nil {
		response.InternalKey(c, "upload.saveFailed", nil)
		return
	}
	c.Set("uploadedFileURL", saved["url"])
	response.SuccessKey(c, saved, "upload.completed", nil)
}

func (h *Handler) saveOne(c *gin.Context, file *multipart.FileHeader, subDir string) (gin.H, error) {
	destDir := filepath.Join(h.cfg.Upload.Root, subDir)
	if err := os.MkdirAll(destDir, 0o755); err != nil {
		return nil, fmt.Errorf("创建上传目录失败")
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	filename := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
	dest := filepath.Join(destDir, filename)
	if err := c.SaveUploadedFile(file, dest); err != nil {
		return nil, fmt.Errorf("保存文件失败")
	}

	urlPath := fmt.Sprintf("/uploads/%s/%s", subDir, filename)
	return gin.H{
		"url":          urlPath,
		"filename":     filename,
		"originalname": file.Filename,
		"size":         file.Size,
		"mimetype":     file.Header.Get("Content-Type"),
	}, nil
}
