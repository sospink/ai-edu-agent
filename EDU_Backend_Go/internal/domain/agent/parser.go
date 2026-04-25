package agent

import (
	"fmt"
	"regexp"
	"strings"
)

var markdownOrderedStepPrefix = regexp.MustCompile(`^\s*([0-9]+|[一二三四五六七八九十]+)[\.、\)]\s*`)

type ParsedManual struct {
	Title       string
	Description string
	Steps       []ParsedStep
}

type ParsedStep struct {
	Title          string
	Content        []ContentBlock
	QuickQuestions []string
	Verification   *VerificationRule
}

func ParseMarkdown(markdown string) (*ParsedManual, error) {
	normalized := strings.ReplaceAll(strings.ReplaceAll(markdown, "\r\n", "\n"), "\r", "\n")
	lines := strings.Split(normalized, "\n")

	result := &ParsedManual{}
	var currentStep *ParsedStep
	var currentText []string
	var codeBuffer []string
	inCodeBlock := false
	codeLanguage := ""

	flushText := func() {
		if currentStep == nil || len(currentText) == 0 {
			currentText = nil
			return
		}
		text := strings.TrimSpace(strings.Join(currentText, "\n"))
		if text != "" {
			currentStep.Content = append(currentStep.Content, ContentBlock{
				Type: "text",
				Text: text,
			})
		}
		currentText = nil
	}

	flushCode := func() {
		if currentStep == nil || len(codeBuffer) == 0 {
			codeBuffer = nil
			codeLanguage = ""
			return
		}
		language := strings.TrimSpace(codeLanguage)
		if language == "" {
			language = "text"
		}
		currentStep.Content = append(currentStep.Content, ContentBlock{
			Type:       "code",
			Language:   language,
			Code:       strings.Join(codeBuffer, "\n"),
			Executable: language == "bash" || language == "shell" || language == "sh",
		})
		codeBuffer = nil
		codeLanguage = ""
	}

	pushCurrentStep := func() {
		if currentStep == nil {
			return
		}
		flushText()
		result.Steps = append(result.Steps, *currentStep)
		currentStep = nil
	}

	for _, rawLine := range lines {
		line := rawLine

		if strings.HasPrefix(line, "```") {
			if inCodeBlock {
				flushCode()
				inCodeBlock = false
			} else {
				flushText()
				inCodeBlock = true
				codeLanguage = strings.TrimSpace(strings.TrimPrefix(line, "```"))
			}
			continue
		}
		if inCodeBlock {
			codeBuffer = append(codeBuffer, line)
			continue
		}

		if strings.HasPrefix(line, "# ") && result.Title == "" {
			result.Title = strings.TrimSpace(strings.TrimPrefix(line, "# "))
			continue
		}
		if strings.HasPrefix(line, "> ") && result.Description == "" && currentStep == nil {
			result.Description = strings.TrimSpace(strings.TrimPrefix(line, "> "))
			continue
		}

		if matched, title := parseStepTitle(line); matched {
			pushCurrentStep()
			currentStep = &ParsedStep{
				Title:          title,
				Content:        []ContentBlock{},
				QuickQuestions: []string{},
			}
			continue
		}

		if currentStep == nil {
			continue
		}

		if strings.HasPrefix(line, "### ") {
			flushText()
			currentStep.Content = append(currentStep.Content, ContentBlock{
				Type: "heading",
				Text: strings.TrimSpace(strings.TrimPrefix(line, "### ")),
			})
			continue
		}

		if verification := parseVerificationComment(line); verification != nil {
			currentStep.Verification = verification
			continue
		}

		if questions := parseQuestionsComment(line); questions != nil {
			currentStep.QuickQuestions = questions
			continue
		}

		if item, ok := parseListItem(line); ok {
			flushText()
			if len(currentStep.Content) > 0 && currentStep.Content[len(currentStep.Content)-1].Type == "list" {
				currentStep.Content[len(currentStep.Content)-1].Items = append(currentStep.Content[len(currentStep.Content)-1].Items, item)
			} else {
				currentStep.Content = append(currentStep.Content, ContentBlock{
					Type:  "list",
					Items: []string{item},
				})
			}
			continue
		}

		currentText = append(currentText, line)
	}

	if inCodeBlock {
		return nil, fmt.Errorf("Markdown 代码块未闭合")
	}

	pushCurrentStep()
	if strings.TrimSpace(result.Title) == "" {
		result.Title = "导入手册"
	}
	if len(result.Steps) == 0 {
		return nil, fmt.Errorf("未识别到步骤内容，请至少使用一个二级标题，例如：## 步骤 1: 环境检查")
	}
	return result, nil
}

func parseStepTitle(line string) (bool, string) {
	if !strings.HasPrefix(line, "## ") {
		return false, ""
	}
	trimmed := strings.TrimSpace(strings.TrimPrefix(line, "## "))
	if trimmed == "" {
		return false, ""
	}

	if strings.HasPrefix(trimmed, "步骤") || strings.HasPrefix(trimmed, "第") {
		if title := titleAfterStepSeparator(trimmed); title != "" {
			return true, title
		}
		return true, trimmed
	}

	if title := strings.TrimSpace(markdownOrderedStepPrefix.ReplaceAllString(trimmed, "")); title != "" && title != trimmed {
		return true, title
	}

	return true, trimmed
}

func titleAfterStepSeparator(value string) string {
	for _, sep := range []string{":", "：", " ", "　", "-", "—"} {
		parts := strings.SplitN(value, sep, 2)
		if len(parts) == 2 {
			return strings.TrimSpace(parts[1])
		}
	}
	return ""
}

func parseVerificationComment(line string) *VerificationRule {
	start := strings.Index(line, "<!--")
	end := strings.Index(line, "-->")
	if start < 0 || end <= start {
		return nil
	}
	content := strings.TrimSpace(line[start+4 : end])
	if !strings.HasPrefix(content, "verify:") {
		return nil
	}

	payload := strings.TrimSpace(strings.TrimPrefix(content, "verify:"))
	switch {
	case strings.HasPrefix(payload, "file_exists:"):
		return &VerificationRule{
			Type: "file_exists",
			Path: strings.TrimSpace(strings.TrimPrefix(payload, "file_exists:")),
		}
	case strings.HasPrefix(payload, "command:"):
		parts := strings.Split(strings.TrimSpace(strings.TrimPrefix(payload, "command:")), "|")
		rule := &VerificationRule{
			Type:    "command_output",
			Command: strings.TrimSpace(firstPart(parts, 0)),
			Expect:  strings.TrimSpace(firstPart(parts, 1)),
			Value:   strings.TrimSpace(firstPart(parts, 2)),
		}
		if rule.Expect == "" {
			rule.Expect = "not_empty"
		}
		return rule
	case strings.HasPrefix(payload, "service:"):
		return &VerificationRule{
			Type: "service_running",
			Port: atoi(strings.TrimSpace(strings.TrimPrefix(payload, "service:"))),
		}
	default:
		return nil
	}
}

func parseQuestionsComment(line string) []string {
	start := strings.Index(line, "<!--")
	end := strings.Index(line, "-->")
	if start < 0 || end <= start {
		return nil
	}
	content := strings.TrimSpace(line[start+4 : end])
	if !strings.HasPrefix(content, "questions:") {
		return nil
	}
	raw := strings.TrimSpace(strings.TrimPrefix(content, "questions:"))
	parts := strings.Split(raw, "|")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		result = append(result, part)
	}
	return result
}

func parseListItem(line string) (string, bool) {
	line = strings.TrimSpace(line)
	if strings.HasPrefix(line, "- ") || strings.HasPrefix(line, "* ") {
		return strings.TrimSpace(line[2:]), true
	}
	return "", false
}

func firstPart(parts []string, idx int) string {
	if idx < 0 || idx >= len(parts) {
		return ""
	}
	return parts[idx]
}

func atoi(value string) int {
	total := 0
	for _, ch := range value {
		if ch < '0' || ch > '9' {
			return total
		}
		total = total*10 + int(ch-'0')
	}
	return total
}
