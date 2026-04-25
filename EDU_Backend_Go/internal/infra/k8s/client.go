package k8s

import (
	"go.uber.org/zap"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"

	"edu-platform/internal/config"
)

func New(cfg *config.Config, log *zap.Logger) (kubernetes.Interface, *rest.Config, error) {
	if !cfg.K8S.Enabled {
		log.Info("k8s disabled by config")
		return nil, nil, nil
	}

	var (
		restConfig *rest.Config
		err        error
	)
	if cfg.K8S.InCluster {
		restConfig, err = rest.InClusterConfig()
	} else {
		restConfig, err = clientcmd.BuildConfigFromFlags("", cfg.K8S.ResolvedKubeconfig())
	}
	if err != nil {
		return nil, nil, err
	}

	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return nil, nil, err
	}
	log.Info("k8s client ready",
		zap.String("namespace", cfg.K8S.Namespace),
		zap.String("runtime_namespace", cfg.K8S.RuntimeNamespace),
		zap.Bool("in_cluster", cfg.K8S.InCluster),
		zap.String("kubeconfig", cfg.K8S.ResolvedKubeconfig()),
	)
	return clientset, restConfig, nil
}
