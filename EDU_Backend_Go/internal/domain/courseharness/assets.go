package courseharness

import (
	"bytes"
	"crypto/sha256"
	"fmt"
	"io"
	"mime"
	"net/http"
	"strings"
)

func isFrontendAsset(request *http.Request, path string) bool {
	return request.Method == http.MethodGet &&
		((strings.HasPrefix(path, "/assets/") && (strings.HasSuffix(path, ".js") || strings.HasSuffix(path, ".css"))) ||
			(path == "/plugins/" && strings.HasPrefix(request.URL.RawQuery, "?")))
}

// 仅原版前端脚本和样式参与私有缓存；每次使用仍经过代理鉴权和内容校验。
func revalidateAsset(resp *http.Response, request *http.Request, path string) error {
	resp.Header.Set("Cache-Control", "no-store")
	if !isFrontendAsset(request, path) || len(resp.Cookies()) != 0 {
		return nil
	}
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNotModified {
		return nil
	}
	if resp.StatusCode == http.StatusNotModified {
		resp.Header.Set("Cache-Control", "private, no-cache")
		resp.Header.Add("Vary", "Cookie")
		return nil
	}
	contentType, _, _ := mime.ParseMediaType(resp.Header.Get("Content-Type"))
	if contentType != "text/javascript" && contentType != "application/javascript" && contentType != "text/css" {
		return nil
	}
	etag := resp.Header.Get("ETag")
	if etag == "" {
		// 原版插件合并脚本没有ETag；限量读取，避免缓冲其他流式或超大响应。
		const limit = 16 << 20
		body := resp.Body
		data, err := io.ReadAll(io.LimitReader(body, limit+1))
		if err != nil {
			_ = body.Close()
			return err
		}
		if len(data) > limit {
			resp.Body = struct {
				io.Reader
				io.Closer
			}{io.MultiReader(bytes.NewReader(data), body), body}
			return nil
		}
		_ = body.Close()
		resp.Body = io.NopCloser(bytes.NewReader(data))
		etag = fmt.Sprintf(`W/"%x"`, sha256.Sum256(data))
		resp.Header.Set("ETag", etag)
	}
	resp.Header.Set("Cache-Control", "private, no-cache")
	resp.Header.Add("Vary", "Cookie")
	for _, candidate := range strings.Split(request.Header.Get("If-None-Match"), ",") {
		if candidate = strings.TrimSpace(candidate); candidate == "*" ||
			strings.TrimPrefix(candidate, "W/") == strings.TrimPrefix(etag, "W/") {
			_ = resp.Body.Close()
			resp.Body = http.NoBody
			resp.StatusCode = http.StatusNotModified
			resp.Status = "304 Not Modified"
			resp.ContentLength = 0
			resp.Header.Del("Content-Length")
			resp.Header.Del("Content-Encoding")
			break
		}
	}
	return nil
}
