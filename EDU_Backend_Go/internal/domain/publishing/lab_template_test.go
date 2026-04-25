package publishing

import "testing"

func TestNormalizeLabTemplateInputAppPorts(t *testing.T) {
	desktopEnabled := false
	template, err := normalizeLabTemplateInput(LabTemplateInput{
		Name:               "应用模板",
		Code:               "app-template",
		EnvImage:           "registry.local/app:latest",
		DesktopEnabled:     &desktopEnabled,
		AppPorts:           []LabTemplateAppPort{{Name: "web", Label: "Web 服务", ContainerPort: 3000, Path: "/"}},
		DefaultAppPortName: "web",
	})
	if err != nil {
		t.Fatalf("normalize template: %v", err)
	}
	if template.DesktopEnabled {
		t.Fatal("expected desktop disabled")
	}
	if len(template.AppPorts) != 1 || template.AppPorts[0].Name != "web" {
		t.Fatalf("expected normalized app port, got %+v", template.AppPorts)
	}
	if template.DefaultAppPortName != "web" {
		t.Fatalf("expected default app port web, got %q", template.DefaultAppPortName)
	}
}

func TestNormalizeLabTemplateInputExposedPorts(t *testing.T) {
	template, err := normalizeLabTemplateInput(LabTemplateInput{
		Name:     "桌面模板",
		Code:     "desktop-template",
		EnvImage: "registry.local/desktop:latest",
		ExposedPorts: []LabTemplateExposedPort{
			{Type: "novnc", Label: "Desktop", ContainerPort: 8888, IsDefault: true},
			{Type: "web", Name: "jupyter", Label: "Jupyter", ContainerPort: 8889, Path: "/lab"},
		},
	})
	if err != nil {
		t.Fatalf("normalize template: %v", err)
	}
	if !template.DesktopEnabled || len(template.ExposedPorts) != 2 {
		t.Fatalf("expected exposed ports with desktop enabled, got %+v", template)
	}
	if len(template.AppPorts) != 1 || template.AppPorts[0].Name != "jupyter" {
		t.Fatalf("expected web app port snapshot, got %+v", template.AppPorts)
	}
	if template.DefaultAppPortName != "" {
		t.Fatalf("expected novnc default to keep default app empty, got %q", template.DefaultAppPortName)
	}
}

func TestNormalizeLabTemplateInputRejectsInvalidAppPorts(t *testing.T) {
	desktopEnabled := false
	cases := []struct {
		name  string
		input LabTemplateInput
	}{
		{
			name: "duplicate name",
			input: LabTemplateInput{
				Name:           "模板",
				Code:           "duplicate-name",
				EnvImage:       "registry.local/app:latest",
				DesktopEnabled: &desktopEnabled,
				AppPorts: []LabTemplateAppPort{
					{Name: "web", ContainerPort: 8080, Path: "/"},
					{Name: "web", ContainerPort: 8081, Path: "/"},
				},
			},
		},
		{
			name: "duplicate port",
			input: LabTemplateInput{
				Name:           "模板",
				Code:           "duplicate-port",
				EnvImage:       "registry.local/app:latest",
				DesktopEnabled: &desktopEnabled,
				AppPorts: []LabTemplateAppPort{
					{Name: "web", ContainerPort: 8080, Path: "/"},
					{Name: "api", ContainerPort: 8080, Path: "/"},
				},
			},
		},
		{
			name: "reserved name",
			input: LabTemplateInput{
				Name:           "模板",
				Code:           "reserved-name",
				EnvImage:       "registry.local/app:latest",
				DesktopEnabled: &desktopEnabled,
				AppPorts:       []LabTemplateAppPort{{Name: "ide", ContainerPort: 8080, Path: "/"}},
			},
		},
		{
			name: "invalid path",
			input: LabTemplateInput{
				Name:           "模板",
				Code:           "invalid-path",
				EnvImage:       "registry.local/app:latest",
				DesktopEnabled: &desktopEnabled,
				AppPorts:       []LabTemplateAppPort{{Name: "web", ContainerPort: 8080, Path: "home"}},
			},
		},
		{
			name: "port overflow",
			input: LabTemplateInput{
				Name:           "模板",
				Code:           "port-overflow",
				EnvImage:       "registry.local/app:latest",
				DesktopEnabled: &desktopEnabled,
				AppPorts:       []LabTemplateAppPort{{Name: "web", ContainerPort: 45536, Path: "/"}},
			},
		},
		{
			name: "ide 3000 conflict",
			input: LabTemplateInput{
				Name:           "模板",
				Code:           "ide-conflict",
				EnvImage:       "registry.local/app:latest",
				IDEImage:       "registry.local/ide:latest",
				DesktopEnabled: &desktopEnabled,
				AppPorts:       []LabTemplateAppPort{{Name: "web", ContainerPort: 3000, Path: "/"}},
			},
		},
		{
			name: "missing entry",
			input: LabTemplateInput{
				Name:           "模板",
				Code:           "missing-entry",
				EnvImage:       "registry.local/app:latest",
				DesktopEnabled: &desktopEnabled,
			},
		},
		{
			name: "invalid default",
			input: LabTemplateInput{
				Name:               "模板",
				Code:               "invalid-default",
				EnvImage:           "registry.local/app:latest",
				DesktopEnabled:     &desktopEnabled,
				AppPorts:           []LabTemplateAppPort{{Name: "web", ContainerPort: 8080, Path: "/"}},
				DefaultAppPortName: "api",
			},
		},
		{
			name: "duplicate exposed port",
			input: LabTemplateInput{
				Name:     "模板",
				Code:     "duplicate-exposed-port",
				EnvImage: "registry.local/app:latest",
				ExposedPorts: []LabTemplateExposedPort{
					{Type: "novnc", ContainerPort: 8888},
					{Type: "web", Name: "web", ContainerPort: 8888, Path: "/"},
				},
			},
		},
		{
			name: "multiple novnc",
			input: LabTemplateInput{
				Name:     "模板",
				Code:     "multiple-novnc",
				EnvImage: "registry.local/app:latest",
				ExposedPorts: []LabTemplateExposedPort{
					{Type: "novnc", ContainerPort: 6080},
					{Type: "novnc", ContainerPort: 8888},
				},
			},
		},
		{
			name: "multiple defaults",
			input: LabTemplateInput{
				Name:     "模板",
				Code:     "multiple-defaults",
				EnvImage: "registry.local/app:latest",
				ExposedPorts: []LabTemplateExposedPort{
					{Type: "novnc", ContainerPort: 6080, IsDefault: true},
					{Type: "web", Name: "web", ContainerPort: 8080, Path: "/", IsDefault: true},
				},
			},
		},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := normalizeLabTemplateInput(tt.input); err == nil {
				t.Fatal("expected validation error")
			}
		})
	}
}
