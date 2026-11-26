package courseharness

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"edu-platform/internal/domain/course"
)

func materialPath(root, raw string) (string, error) {
	u, err := url.Parse(raw)
	if err != nil {
		return "", err
	}
	path := strings.TrimPrefix(u.Path, "/api")
	if !strings.HasPrefix(path, "/uploads/") {
		return "", os.ErrNotExist
	}
	root, err = filepath.EvalSymlinks(root)
	if err != nil {
		return "", err
	}
	root, err = filepath.Abs(root)
	if err != nil {
		return "", err
	}
	actual, err := filepath.EvalSymlinks(filepath.Join(root, strings.TrimPrefix(path, "/uploads/")))
	if err != nil {
		return "", err
	}
	rel, err := filepath.Rel(root, actual)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", os.ErrPermission
	}
	return actual, nil
}
func writeSnapshot(path string, data []byte) error {
	if err := os.WriteFile(path, data, 0600); err != nil {
		return err
	}
	return os.Chown(path, 1000, 1000)
}
func (h *Handler) prepareMaterials(ctx context.Context, lesson *course.CourseLesson, locale, workspace string) error {
	// 每次重新启动刷新课程快照；历史与凭证位于独立home目录，不删除。
	old, err := os.ReadDir(workspace)
	if err != nil {
		return err
	}
	for _, f := range old {
		if !f.IsDir() {
			if err = os.Remove(filepath.Join(workspace, f.Name())); err != nil {
				return err
			}
		}
	}
	detail, err := h.courses.FindByIDLocalized(ctx, lesson.CourseID)
	if err != nil {
		return err
	}
	materials, err := h.courses.GetLessonMaterialsLocalized(ctx, lesson.ID)
	if err != nil {
		return err
	}
	var b strings.Builder
	fmt.Fprintf(&b, "# %s\n\nCourse: %s\nLocale: %s\n\n%s\n\n## Materials / 学习资料\n\n", lesson.Title, detail.Title, locale, detail.Description)
	for i, m := range materials {
		if i >= 12 {
			break
		}
		path, err := materialPath(h.uploadRoot, m.FileURL)
		if err != nil {
			continue
		}
		ext := strings.ToLower(filepath.Ext(path))
		if ext != ".md" && ext != ".txt" && ext != ".json" && ext != ".pdf" && ext != ".docx" {
			continue
		}
		stat, err := os.Stat(path)
		if err != nil || stat.Size() > 8*1024*1024 {
			continue
		}
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		name := fmt.Sprintf("material-%d%s", m.ID, ext)
		if err = writeSnapshot(filepath.Join(workspace, name), data); err != nil {
			return err
		}
		fmt.Fprintf(&b, "- [%s](%s)\n", m.Title, name)
	}
	// 旧知识库保存在私有目录，只复制到已授权的学生工作区，不新增公开下载地址。
	referenceRoot := filepath.Join(h.root, "reference")
	refs, _ := filepath.Glob(filepath.Join(referenceRoot, "*.md"))
	for i, path := range refs {
		if i >= 20 {
			break
		}
		actual, err := materialPath(referenceRoot, "/uploads/"+filepath.Base(path))
		if err != nil {
			continue
		}
		data, err := os.ReadFile(actual)
		if err != nil || len(data) > 200000 {
			continue
		}
		name := "reference-" + filepath.Base(path)
		if err = writeSnapshot(filepath.Join(workspace, name), data); err != nil {
			return err
		}
		fmt.Fprintf(&b, "- [%s](%s)\n", strings.TrimLeft(strings.SplitN(string(data), "\n", 2)[0], "# "), name)
	}
	if locale == "en-US" {
		b.WriteString("\nAsk the course assistant about these materials. Prefer Markdown/text sources. PDF/DOCX originals may require document extraction before text-only tools can read them. reference-* files were migrated from the previous teaching knowledge base and may be older; prioritize current material-* files and state any conflicts. Distinguish cited sources from general knowledge.\n")
	} else {
		b.WriteString("\n可以请课程助教阅读以上资料并解释，优先使用Markdown或文本资料。PDF/Word原件可能需要提取文本才能由纯文本工具读取。reference-*为原教学知识库迁移资料，可能较旧，应优先使用当前material-*课时资料并说明冲突。请区分资料依据与通用知识。\n")
	}
	return writeSnapshot(filepath.Join(workspace, "README.md"), []byte(b.String()))
}
