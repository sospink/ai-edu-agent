package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"unicode/utf8"

	"edu-platform/internal/domain/agent"
)

var locales = []string{"zh-CN", "en-US"}

type stepInput struct {
	StepOrder      int                     `json:"stepOrder"`
	Title          string                  `json:"title"`
	Content        []agent.ContentBlock    `json:"content"`
	QuickQuestions []string                `json:"quickQuestions"`
	Verification   *agent.VerificationRule `json:"verification"`
	SkillTags      []string                `json:"skillTags,omitempty"`
}

type assets struct {
	Files map[string][]byte
	Steps map[string][]stepInput
}

func loadAssets(root string) (*assets, error) {
	a := &assets{Files: map[string][]byte{}, Steps: map[string][]stepInput{}}
	for _, locale := range locales {
		for _, name := range []string{"materials/theory." + locale + ".md", "manuals/steps." + locale + ".json"} {
			data, err := os.ReadFile(filepath.Join(root, name))
			if err != nil {
				return nil, fmt.Errorf("读取素材 %s 失败，请先准备教学文件", name)
			}
			if !utf8.Valid(data) || len(bytes.TrimSpace(data)) == 0 {
				return nil, fmt.Errorf("素材 %s 必须为非空 UTF-8", name)
			}
			a.Files[name] = data
		}
		steps, err := parseSteps(a.Files["manuals/steps."+locale+".json"])
		if err != nil {
			return nil, fmt.Errorf("%s 手册：%w", locale, err)
		}
		a.Steps[locale] = steps
	}
	zh, en := a.Steps[locales[0]], a.Steps[locales[1]]
	if len(zh) != len(en) {
		return nil, fmt.Errorf("双语步骤数量不一致")
	}
	for i := range zh {
		if !reflect.DeepEqual(zh[i].Verification, en[i].Verification) || len(zh[i].Content) != len(en[i].Content) || len(zh[i].QuickQuestions) != len(en[i].QuickQuestions) {
			return nil, fmt.Errorf("第 %d 步双语结构或验证规则不一致", i+1)
		}
		for j := range zh[i].Content {
			zb, eb := zh[i].Content[j], en[i].Content[j]
			if zb.Type != eb.Type || zb.Language != eb.Language || zb.Executable != eb.Executable || len(zb.Items) != len(eb.Items) {
				return nil, fmt.Errorf("第 %d 步双语内容块类型不一致", i+1)
			}
		}
	}
	return a, nil
}

func parseSteps(data []byte) ([]stepInput, error) {
	var steps []stepInput
	d := json.NewDecoder(bytes.NewReader(data))
	d.DisallowUnknownFields()
	if err := d.Decode(&steps); err != nil {
		return nil, fmt.Errorf("步骤 JSON 格式不合法")
	}
	if err := d.Decode(new(any)); err != io.EOF {
		return nil, fmt.Errorf("步骤 JSON 包含多余数据")
	}
	if len(steps) < 8 || len(steps) > 10 {
		return nil, fmt.Errorf("手册必须包含 8 至 10 步")
	}
	implicitOrder := true
	for _, s := range steps {
		if s.StepOrder != 0 {
			implicitOrder = false
		}
	}
	for i := range steps {
		if implicitOrder {
			steps[i].StepOrder = i + 1
		}
		// 运行时兼容 custom.command，但发布检查读取 custom.script。
		v := steps[i].Verification
		if v != nil && v.Type == "custom" && strings.TrimSpace(v.Script) == "" {
			v.Script = v.Command
		}
	}
	for i, s := range steps {
		if s.StepOrder != i+1 || strings.TrimSpace(s.Title) == "" || len(s.Content) == 0 {
			return nil, fmt.Errorf("第 %d 步缺少标题、内容或顺序不是从 1 连续递增", i+1)
		}
		for _, b := range s.Content {
			if strings.TrimSpace(b.Type) == "" || (strings.TrimSpace(b.Text+b.Code+b.Src) == "" && len(b.Items) == 0) {
				return nil, fmt.Errorf("第 %d 步存在空内容块", i+1)
			}
		}
	}
	return steps, nil
}

// 使用内容寻址目录，数据库回滚时旧素材仍有效；根目录仍限定于本课程。
func copyAssets(root, revision string, a *assets) error {
	for name, data := range a.Files {
		dest := filepath.Join(root, slug, revision, name)
		if err := os.MkdirAll(filepath.Dir(dest), 0755); err != nil {
			return fmt.Errorf("创建课程素材目录失败")
		}
		f, err := os.CreateTemp(filepath.Dir(dest), ".seed-*")
		if err != nil {
			return fmt.Errorf("复制课程素材失败")
		}
		tmp := f.Name()
		_, writeErr := f.Write(data)
		modeErr := f.Chmod(0644)
		closeErr := f.Close()
		if writeErr != nil || modeErr != nil || closeErr != nil {
			os.Remove(tmp)
			return fmt.Errorf("写入课程素材失败")
		}
		if err := os.Rename(tmp, dest); err != nil {
			os.Remove(tmp)
			return fmt.Errorf("原子替换课程素材失败")
		}
	}
	return nil
}
