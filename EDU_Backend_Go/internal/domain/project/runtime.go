package project

import "strings"

const (
	LabRuntimeModeClassic  = "classic"
	LabRuntimeModeOpenClaw = "openclaw"
)

func ResolveLabRuntimeMode(project Project, configured string) string {
	return ResolveLabRuntimeModeWithTags(project, nil, configured)
}

func ResolveLabRuntimeModeWithTags(project Project, tags []Tag, configured string) string {
	mode := strings.ToLower(strings.TrimSpace(configured))
	switch mode {
	case "classic":
		return LabRuntimeModeClassic
	default:
		if HasOpenClawTag(tags) {
			return LabRuntimeModeOpenClaw
		}
		return LabRuntimeModeClassic
	}
}

func IsOpenClawProject(project Project) bool {
	slug := strings.ToLower(strings.TrimSpace(project.Slug))
	title := strings.ToLower(strings.TrimSpace(project.Title))
	subtitle := strings.ToLower(strings.TrimSpace(project.Subtitle))
	return strings.Contains(slug, "openclaw") ||
		strings.Contains(title, "openclaw") ||
		strings.Contains(subtitle, "openclaw")
}

func HasOpenClawTag(tags []Tag) bool {
	for _, tag := range tags {
		normalized := strings.ToLower(strings.TrimSpace(tag.Name))
		normalized = strings.ReplaceAll(normalized, " ", "")
		normalized = strings.ReplaceAll(normalized, "-", "")
		normalized = strings.ReplaceAll(normalized, "_", "")
		if normalized == "openclaw" {
			return true
		}
	}
	return false
}
