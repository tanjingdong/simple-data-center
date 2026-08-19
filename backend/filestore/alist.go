package filestore

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// AlistClient 封装 Alist REST API 的调用。
type AlistClient struct {
	baseURL string
	token   string
	http    *http.Client
}

// alistResponse 是 Alist API 的通用响应结构。
type alistResponse struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data,omitempty"`
}

// NewAlistClient 创建 Alist API 客户端。
func NewAlistClient(baseURL, token string) *AlistClient {
	return &AlistClient{
		baseURL: baseURL,
		token:   token,
		http:    &http.Client{},
	}
}

// alistDo 执行 Alist API 请求。
func (c *AlistClient) alistDo(method, path string, body io.Reader, contentType string) (*http.Response, error) {
	req, err := http.NewRequest(method, c.baseURL+path, body)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}
	req.Header.Set("Authorization", c.token)
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求 Alist 失败: %w", err)
	}
	return resp, nil
}

// alistPostJSON 发送 JSON body 的 POST 请求，解析 Alist 标准响应。
func (c *AlistClient) alistPostJSON(path string, reqBody any) (*alistResponse, error) {
	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("序列化请求体失败: %w", err)
	}
	resp, err := c.alistDo(http.MethodPost, path, bytes.NewReader(body), "application/json")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var ar alistResponse
	if err := json.NewDecoder(resp.Body).Decode(&ar); err != nil {
		return nil, fmt.Errorf("解析 Alist 响应失败: %w", err)
	}
	if ar.Code != 200 {
		return nil, fmt.Errorf("Alist 返回错误(%d): %s", ar.Code, ar.Message)
	}
	return &ar, nil
}

// Put 上传文件到 Alist。body 是文件内容的 io.Reader,必须流式读取。
// 使用 PUT 方法 + File-Path 头,符合 Alist /api/fs/put 协议。
func (c *AlistClient) Put(path string, size int64, body io.Reader) error {
	req, err := http.NewRequest(http.MethodPut, c.baseURL+"/api/fs/put", body)
	if err != nil {
		return fmt.Errorf("创建上传请求失败: %w", err)
	}
	req.Header.Set("Authorization", c.token)
	req.Header.Set("File-Path", path)
	req.ContentLength = size

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("上传到 Alist 失败: %w", err)
	}
	defer resp.Body.Close()

	// Alist 始终返回 HTTP 200,需解析 JSON 判断业务状态码
	respBody, _ := io.ReadAll(resp.Body)
	var ar alistResponse
	if err := json.Unmarshal(respBody, &ar); err != nil {
		return fmt.Errorf("解析 Alist 响应失败: %w", err)
	}
	if ar.Code != 200 {
		return fmt.Errorf("Alist 上传失败(%d): %s", ar.Code, ar.Message)
	}
	return nil
}

// Get 从 Alist 获取文件内容。通过 sign URL 获取实际字节(用于 proxy 模式)。
func (c *AlistClient) Get(path string) (io.ReadCloser, int64, string, error) {
	// 先通过 sign 获取可访问的直链
	signURL, err := c.Sign(path)
	if err != nil {
		return nil, 0, "", fmt.Errorf("获取 sign 直链失败: %w", err)
	}

	// 从 sign URL 拉取文件内容
	fileResp, err := http.Get(signURL)
	if err != nil {
		return nil, 0, "", fmt.Errorf("获取文件内容失败: %w", err)
	}
	if fileResp.StatusCode != http.StatusOK {
		fileResp.Body.Close()
		return nil, 0, "", fmt.Errorf("文件下载返回 %d", fileResp.StatusCode)
	}

	return fileResp.Body, fileResp.ContentLength, fileResp.Header.Get("Content-Type"), nil
}

// Sign 获取 Alist 文件的 sign 直链(sign URL),用于 direct 下载模式。
func (c *AlistClient) Sign(path string) (string, error) {
	ar, err := c.alistPostJSON("/api/fs/link", map[string]string{"path": path})
	if err != nil {
		return "", err
	}
	var data struct {
		URL string `json:"url"`
	}
	if err := json.Unmarshal(ar.Data, &data); err != nil {
		return "", fmt.Errorf("解析 sign URL 失败: %w", err)
	}
	return data.URL, nil
}

// Remove 删除 Alist 上的文件。Alist API 使用 dir + names 格式。
func (c *AlistClient) Remove(path string) error {
	dir, name := splitPath(path)
	if name == "" {
		return fmt.Errorf("文件路径无效: %s", path)
	}
	_, err := c.alistPostJSON("/api/fs/remove", map[string]any{
		"dir":   dir,
		"names": []string{name},
	})
	return err
}

// splitPath 将完整路径拆分为目录和文件名。
func splitPath(path string) (dir, name string) {
	path = strings.TrimRight(path, "/")
	idx := strings.LastIndex(path, "/")
	if idx < 0 {
		return "/", path
	}
	return path[:idx], path[idx+1:]
}

// Health 检查 Alist 连通性。通过调用 /api/fs/list 验证。
func (c *AlistClient) Health() error {
	_, err := c.alistPostJSON("/api/fs/list", map[string]any{
		"path":     "/",
		"page":     1,
		"per_page": 1,
	})
	return err
}

// List 列出 Alist 上指定路径下的文件路径(仅单层,不递归子目录)。
func (c *AlistClient) List(path string) ([]string, error) {
	ar, err := c.alistPostJSON("/api/fs/list", map[string]any{
		"path":     path,
		"page":     1,
		"per_page": 1000,
	})
	if err != nil {
		return nil, err
	}
	var data struct {
		Content []struct {
			Name  string `json:"name"`
			IsDir bool   `json:"is_dir"`
		} `json:"content"`
	}
	if err := json.Unmarshal(ar.Data, &data); err != nil {
		return nil, fmt.Errorf("解析列表数据失败: %w", err)
	}
	var files []string
	for _, item := range data.Content {
		if !item.IsDir {
			files = append(files, path+"/"+item.Name)
		}
	}
	return files, nil
}