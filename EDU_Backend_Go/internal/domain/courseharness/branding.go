package courseharness

import (
	"bytes"
	"io"
	"mime"
	"net/http"
	"strconv"
)

// 原版构建将产品标题编入HTML/JS；只替换其固定品牌短语，不处理用户内容或模型名称。
func brandResponse(resp *http.Response, request *http.Request, path, locale string) error {
	if resp.StatusCode != http.StatusOK || request.Method != http.MethodGet ||
		(path != "/" && !isFrontendAsset(request, path)) || resp.Header.Get("Content-Encoding") != "" {
		return nil
	}
	contentType, _, _ := mime.ParseMediaType(resp.Header.Get("Content-Type"))
	if contentType != "text/html" && contentType != "text/javascript" && contentType != "application/javascript" {
		return nil
	}
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
	title := "Agent EDU Tutor"
	if locale == "zh-CN" {
		title = "Agent EDU 智能助教"
	}
	updated := bytes.ReplaceAll(data, []byte("DeepSeek Harness"), []byte(title))
	resp.Body = io.NopCloser(bytes.NewReader(updated))
	resp.ContentLength = int64(len(updated))
	resp.Header.Set("Content-Length", strconv.Itoa(len(updated)))
	if !bytes.Equal(data, updated) {
		resp.Header.Del("ETag")
		resp.Header.Del("Last-Modified")
	}
	return nil
}
