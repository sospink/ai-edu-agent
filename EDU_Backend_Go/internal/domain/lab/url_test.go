package lab

import (
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"

	"edu-platform/internal/config"
	"edu-platform/internal/domain/publishing"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestBuildURLsUsesAbsoluteNoVNCPath(t *testing.T) {
	service := &Service{}
	session := &UserLabSession{
		ID:          143,
		VNCPort:     uint(NoVNCPort),
		RuntimeMode: RuntimeModeClassic,
	}

	urls := service.BuildURLs(session)
	if urls.RuntimeMode != "classic" {
		t.Fatalf("expected classic runtime mode, got %q", urls.RuntimeMode)
	}
	if urls.VNCURL == "" {
		t.Fatal("expected vnc url to be set")
	}

	parsed, err := url.Parse(urls.VNCURL)
	if err != nil {
		t.Fatalf("parse vnc url: %v", err)
	}

	gotPath := parsed.Query().Get("path")
	wantPath := "/api/lab/proxy/143/novnc/websockify"
	if gotPath != wantPath {
		t.Fatalf("expected path %q, got %q", wantPath, gotPath)
	}
}

func TestRewriteVNCWebsockifyAuthPreservesAbsoluteProxyPath(t *testing.T) {
	raw := "/api/lab/proxy/143/novnc/vnc.html?resize=remote&autoconnect=true&path=%2Fapi%2Flab%2Fproxy%2F143%2Fnovnc%2Fwebsockify"

	rewritten := rewriteVNCWebsockifyAuth(raw, "token-123")
	parsed, err := url.Parse(rewritten)
	if err != nil {
		t.Fatalf("parse rewritten url: %v", err)
	}

	gotPath := parsed.Query().Get("path")
	wantPath := "/api/lab/proxy/143/novnc/websockify?authToken=token-123"
	if gotPath != wantPath {
		t.Fatalf("expected rewritten path %q, got %q", wantPath, gotPath)
	}
}

func TestRewriteVNCWebsockifyAccessIncludesClientID(t *testing.T) {
	raw := "/api/lab/proxy/143/novnc/vnc.html?path=%2Fapi%2Flab%2Fproxy%2F143%2Fnovnc%2Fwebsockify"
	rewritten := rewriteVNCWebsockifyAccess(raw, "token-123", "browser-abc")
	parsed, err := url.Parse(rewritten)
	if err != nil {
		t.Fatalf("parse rewritten url: %v", err)
	}
	path := parsed.Query().Get("path")
	if !strings.Contains(path, "authToken=token-123") || !strings.Contains(path, "labClientId=browser-abc") {
		t.Fatalf("expected token and client id in websockify path, got %q", path)
	}
}

func TestRewriteLocationMapsK8SServiceProxyRedirects(t *testing.T) {
	headers := mapHeader("Location", "/api/v1/namespaces/edu-runtime-overseas/services/lab-service-230:ide/proxy/")

	rewriteLocation(headers, "/api/lab/proxy/230/ide")

	if got := headers.Get("Location"); got != "/api/lab/proxy/230/ide/" {
		t.Fatalf("expected IDE redirect to stay under proxy base, got %q", got)
	}
}

func TestRewriteLocationPreservesK8SServiceProxyQuery(t *testing.T) {
	headers := mapHeader("Location", "/api/v1/namespaces/edu-runtime-overseas/services/lab-service-230:ide/proxy/?folder=%2Fworkspace")

	rewriteLocation(headers, "/api/lab/proxy/230/ide")

	if got := headers.Get("Location"); got != "/api/lab/proxy/230/ide/?folder=%2Fworkspace" {
		t.Fatalf("expected IDE redirect query to be preserved, got %q", got)
	}
}

func TestRewriteProxyResponseBodyMapsK8SServiceProxyAssets(t *testing.T) {
	body := `<link href="/api/v1/namespaces/edu-runtime-overseas/services/lab-service-231:ide/proxy/stable/static/out/vs/code/browser/workbench/workbench.css">`
	resp := &http.Response{
		Header: http.Header{"Content-Type": []string{"text/html; charset=utf-8"}},
		Body:   io.NopCloser(strings.NewReader(body)),
	}

	rewriteProxyResponseBody(resp, "/api/v1/namespaces/edu-runtime-overseas/services/lab-service-231:ide/proxy", "/api/lab/proxy/231/ide")

	rewritten, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read rewritten body: %v", err)
	}
	got := string(rewritten)
	if strings.Contains(got, "/api/v1/namespaces/") {
		t.Fatalf("expected internal K8S path to be removed, got %q", got)
	}
	if !strings.Contains(got, `/api/lab/proxy/231/ide/stable/static/out/vs/code/browser/workbench/workbench.css`) {
		t.Fatalf("expected asset path to use lab proxy, got %q", got)
	}
}

func TestBuildURLsIncludesAppURLsAndHandlesNilSnapshot(t *testing.T) {
	service := &Service{}
	empty := service.BuildURLs(&UserLabSession{ID: 144, RuntimeMode: RuntimeModeClassic})
	if empty.AppURLs == nil || len(empty.AppURLs) != 0 {
		t.Fatalf("expected empty app urls, got %+v", empty.AppURLs)
	}

	session := &UserLabSession{
		ID:                 145,
		RuntimeMode:        RuntimeModeClassic,
		AppPorts:           []publishing.LabTemplateAppPort{{Name: "web", Label: "Web", ContainerPort: 3000, Path: "/app"}},
		DefaultAppPortName: "web",
	}
	urls := service.BuildURLs(session)
	if len(urls.AppURLs) != 1 {
		t.Fatalf("expected one app url, got %+v", urls.AppURLs)
	}
	appURL := urls.AppURLs[0]
	if appURL.ServicePort != 23000 {
		t.Fatalf("expected service port 23000, got %d", appURL.ServicePort)
	}
	if appURL.URL != "/api/lab/proxy/145/app-web/app" {
		t.Fatalf("unexpected app url %q", appURL.URL)
	}
	if !appURL.IsDefault {
		t.Fatal("expected app url to be default")
	}
}

func mapHeader(key, value string) http.Header {
	headers := http.Header{}
	headers.Set(key, value)
	return headers
}

func TestRuntimePortsIncludeAppNamedPorts(t *testing.T) {
	session := &UserLabSession{
		ID:       146,
		VNCPort:  8888,
		AppPorts: []publishing.LabTemplateAppPort{{Name: "web", ContainerPort: 3000, Path: "/"}},
	}

	containerPorts := mainContainerPorts(session)
	foundContainerPort := false
	foundNoVNCPort := false
	for _, port := range containerPorts {
		if port.Name == PortNameNoVNC && port.ContainerPort == 8888 {
			foundNoVNCPort = true
		}
		if port.Name == "app-web" && port.ContainerPort == 3000 {
			foundContainerPort = true
		}
	}
	if !foundNoVNCPort {
		t.Fatalf("expected novnc container port 8888, got %+v", containerPorts)
	}
	if !foundContainerPort {
		t.Fatalf("expected app-web container port, got %+v", containerPorts)
	}

	servicePortList := servicePorts(session)
	foundServicePort := false
	foundNoVNCServicePort := false
	for _, port := range servicePortList {
		if port.Name == PortNameNoVNC && port.Port == NoVNCPort && port.TargetPort.StrVal == PortNameNoVNC {
			foundNoVNCServicePort = true
		}
		if port.Name == "app-web" && port.Port == 23000 && port.TargetPort.StrVal == "app-web" {
			foundServicePort = true
		}
	}
	if !foundNoVNCServicePort {
		t.Fatalf("expected novnc service port to stay 6080 with named target, got %+v", servicePortList)
	}
	if !foundServicePort {
		t.Fatalf("expected app-web service port, got %+v", servicePortList)
	}
}

func TestResolveProxyTargetRequiresSessionAppPortSnapshot(t *testing.T) {
	session := &UserLabSession{
		ID:       147,
		VNCPort:  uint(NoVNCPort),
		AppPorts: []publishing.LabTemplateAppPort{{Name: "web", ContainerPort: 3000, Path: "/"}},
	}

	target, ok := resolveProxyTarget(session, "app-web")
	if !ok || target != "app-web" {
		t.Fatalf("expected app-web to resolve, got %q %v", target, ok)
	}
	if _, ok := resolveProxyTarget(session, "app-admin"); ok {
		t.Fatal("expected undeclared app target to be rejected")
	}
}

func TestPodReadinessDetailIncludesImagePullReason(t *testing.T) {
	pod := &corev1.Pod{
		Status: corev1.PodStatus{
			Phase: corev1.PodPending,
			ContainerStatuses: []corev1.ContainerStatus{
				{
					Name: "lab",
					State: corev1.ContainerState{Waiting: &corev1.ContainerStateWaiting{
						Reason:  "ImagePullBackOff",
						Message: "failed to pull image docker.io/library/opencode-lab:latest",
					}},
				},
			},
		},
	}
	detail := podReadinessDetail(pod)
	if !strings.Contains(detail, "ImagePullBackOff") || !strings.Contains(detail, "opencode-lab") {
		t.Fatalf("expected image pull detail, got %q", detail)
	}
}

func TestCreateRuntimeResourcesUsesCachedLatestImages(t *testing.T) {
	k8s := fake.NewSimpleClientset(&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "edu-runtime-dev"}})
	service := &Service{
		k8s: k8s,
		cfg: &config.Config{K8S: config.K8SConfig{RuntimeNamespace: "edu-runtime-dev"}},
	}
	session := &UserLabSession{
		ID:            188,
		UserID:        20,
		ContainerName: PodName(188),
		ImageName:     "docker.io/library/opencode-lab:latest",
		VNCPort:       uint(NoVNCPort),
		IDEPort:       uint(IDEPort),
		SSHPort:       uint(SSHPort),
		RuntimeMode:   RuntimeModeClassic,
	}
	if err := service.createRuntimeResources(t.Context(), session, "gitpod/openvscode-server:latest", "测试课", defaultRuntimeResourceProfile()); err != nil {
		t.Fatalf("create runtime resources: %v", err)
	}
	pod, err := k8s.CoreV1().Pods("edu-runtime-dev").Get(t.Context(), PodName(188), metav1.GetOptions{})
	if err != nil {
		t.Fatalf("get pod: %v", err)
	}
	for _, container := range pod.Spec.Containers {
		if container.ImagePullPolicy != corev1.PullIfNotPresent {
			t.Fatalf("expected %s image pull policy IfNotPresent, got %s", container.Name, container.ImagePullPolicy)
		}
	}
}

func TestLabRuntimeSpecAssertionsAllowSafeSpecs(t *testing.T) {
	pod := &corev1.Pod{
		Spec: corev1.PodSpec{
			Containers: []corev1.Container{{
				Name:  MainContainerName,
				Ports: []corev1.ContainerPort{{Name: PortNameNoVNC, ContainerPort: NoVNCPort}},
			}},
		},
	}
	if err := assertLabPodSpec(pod); err != nil {
		t.Fatalf("expected safe pod spec, got %v", err)
	}
	service := &corev1.Service{
		Spec: corev1.ServiceSpec{
			Type: corev1.ServiceTypeClusterIP,
			Ports: []corev1.ServicePort{{
				Name: PortNameNoVNC,
				Port: NoVNCPort,
			}},
		},
	}
	if err := assertLabServiceSpec(service); err != nil {
		t.Fatalf("expected safe service spec, got %v", err)
	}
}

func TestLabPodSpecAssertionsRejectDirectNodeExposure(t *testing.T) {
	hostNetworkPod := &corev1.Pod{Spec: corev1.PodSpec{HostNetwork: true}}
	if err := assertLabPodSpec(hostNetworkPod); err == nil || !strings.Contains(err.Error(), "hostNetwork") {
		t.Fatalf("expected hostNetwork rejection, got %v", err)
	}

	hostPortPod := &corev1.Pod{
		Spec: corev1.PodSpec{
			Containers: []corev1.Container{{
				Name:  MainContainerName,
				Ports: []corev1.ContainerPort{{Name: PortNameNoVNC, ContainerPort: NoVNCPort, HostPort: NoVNCPort}},
			}},
		},
	}
	if err := assertLabPodSpec(hostPortPod); err == nil || !strings.Contains(err.Error(), "HostPort") {
		t.Fatalf("expected HostPort rejection, got %v", err)
	}
}

func TestLabServiceSpecAssertionsRejectDirectNodeExposure(t *testing.T) {
	for _, serviceType := range []corev1.ServiceType{corev1.ServiceTypeNodePort, corev1.ServiceTypeLoadBalancer} {
		service := &corev1.Service{
			Spec: corev1.ServiceSpec{
				Type: serviceType,
				Ports: []corev1.ServicePort{{
					Name: PortNameNoVNC,
					Port: NoVNCPort,
				}},
			},
		}
		if err := assertLabServiceSpec(service); err == nil || !strings.Contains(err.Error(), string(serviceType)) {
			t.Fatalf("expected %s rejection, got %v", serviceType, err)
		}
	}

	service := &corev1.Service{
		Spec: corev1.ServiceSpec{
			Type: corev1.ServiceTypeClusterIP,
			Ports: []corev1.ServicePort{{
				Name:     PortNameNoVNC,
				Port:     NoVNCPort,
				NodePort: 30080,
			}},
		},
	}
	if err := assertLabServiceSpec(service); err == nil || !strings.Contains(err.Error(), "NodePort") {
		t.Fatalf("expected NodePort rejection, got %v", err)
	}
}
