package llm

import (
	"context"
	"errors"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"strings"
	"time"
)

func publicIP(ip net.IP) bool {
	addr, ok := netip.AddrFromSlice(ip)
	if !ok {
		return false
	}
	addr = addr.Unmap()
	for _, cidr := range []string{"100.64.0.0/10", "0.0.0.0/8", "192.0.0.0/24", "198.18.0.0/15", "240.0.0.0/4", "64:ff9b::/96", "2002::/16"} {
		if netip.MustParsePrefix(cidr).Contains(addr) {
			return false
		}
	}
	return ip != nil && ip.IsGlobalUnicast() && !ip.IsPrivate() && !ip.IsLoopback() &&
		!ip.IsLinkLocalUnicast() && !ip.IsUnspecified()
}

func ValidateURL(raw string) (string, error) {
	if len(raw) > 2048 {
		return "", ErrInvalid
	}
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || u.Scheme != "https" || u.Hostname() == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return "", ErrInvalid
	}
	host := strings.ToLower(u.Hostname())
	if host == "localhost" || strings.HasSuffix(host, ".localhost") || !strings.Contains(host, ".") {
		return "", ErrInvalid
	}
	if ip := net.ParseIP(host); ip != nil && !publicIP(ip) {
		return "", ErrInvalid
	}
	u.Path = strings.TrimRight(u.Path, "/")
	// 接受粘贴完整接口地址，统一保存为基础地址。
	u.Path = strings.TrimSuffix(u.Path, "/chat/completions")
	u.RawPath = ""
	return strings.TrimRight(u.String(), "/"), nil
}

// DNS 在实际连接时校验并固定 IP，禁止借助重定向或代理访问内网。
func NewHTTPClient() *http.Client {
	t := http.DefaultTransport.(*http.Transport).Clone()
	t.Proxy = nil
	t.DialContext = func(ctx context.Context, network, address string) (net.Conn, error) {
		host, port, err := net.SplitHostPort(address)
		if err != nil {
			return nil, err
		}
		ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
		if err != nil {
			return nil, errors.New("模型服务域名解析失败")
		}
		for _, ip := range ips {
			if !publicIP(ip.IP) {
				return nil, errors.New("模型地址不允许访问内网")
			}
		}
		dialer := net.Dialer{Timeout: 10 * time.Second}
		for _, ip := range ips {
			conn, dialErr := dialer.DialContext(ctx, network, net.JoinHostPort(ip.IP.String(), port))
			if dialErr == nil {
				return conn, nil
			}
		}
		return nil, errors.New("无法连接模型服务")
	}
	return &http.Client{Transport: t, Timeout: 90 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return errors.New("模型服务不允许重定向") }}
}
