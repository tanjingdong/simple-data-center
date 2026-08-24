package filestore

import (
	"bytes"
	"crypto/rand"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
)

// FilestoreHandler 持有所有文件存储 handler 的依赖。
type FilestoreHandler struct {
	pb             *pocketbase.PocketBase
	loadConfig     func() (Config, error)
	newAlistClient func(cfg Config) *AlistClient
}

// NewFilestoreHandler 创建 handler 实例。
func NewFilestoreHandler(pb *pocketbase.PocketBase) *FilestoreHandler {
	return &FilestoreHandler{
		pb: pb,
		loadConfig: func() (Config, error) {
			return LoadConfig(pb)
		},
		newAlistClient: func(cfg Config) *AlistClient {
			return NewAlistClient(cfg.AlistURL, cfg.AlistToken)
		},
	}
}

// RegisterHandlers 注册所有 filestore 路由到 router。
func (h *FilestoreHandler) RegisterHandlers(e *core.ServeEvent) {
	// 管理端 API (superuser 专属)
	e.Router.GET("/api/filestore/config", func(re *core.RequestEvent) error {
		if !re.HasSuperuserAuth() {
			return re.ForbiddenError("", nil)
		}
		data, err := h.handleGetConfigRaw(re)
		return h.serveJSON(re, data, err)
	})

	e.Router.POST("/api/filestore/config", func(re *core.RequestEvent) error {
		if !re.HasSuperuserAuth() {
			return re.ForbiddenError("", nil)
		}
		data, err := h.handleSaveConfig(re)
		return h.serveJSON(re, data, err)
	})

	e.Router.POST("/api/filestore/check-alist", func(re *core.RequestEvent) error {
		if !re.HasSuperuserAuth() {
			return re.ForbiddenError("", nil)
		}
		data, err := h.handleCheckAlistRaw()
		return h.serveJSON(re, data, err)
	})

	e.Router.POST("/api/filestore/orphans/report", func(re *core.RequestEvent) error {
		if !re.HasSuperuserAuth() {
			return re.ForbiddenError("", nil)
		}
		data, err := h.handleOrphansReport(re)
		return h.serveJSON(re, data, err)
	})

	// 通用端 API (普通用户)
	e.Router.POST("/api/filestore/files/upload", func(re *core.RequestEvent) error {
		auth := re.Auth
		if auth == nil {
			return re.UnauthorizedError("需要登录", nil)
		}
		return h.handleUpload(re)
	})

	e.Router.GET("/api/filestore/files/{id}", func(re *core.RequestEvent) error {
		return h.handleGetFile(re)
	})

	e.Router.GET("/api/filestore/files", func(re *core.RequestEvent) error {
		return h.handleListFiles(re)
	})

	e.Router.GET("/api/filestore/files/{id}/download", func(re *core.RequestEvent) error {
		return h.handleDownload(re)
	})

	e.Router.PATCH("/api/filestore/files/{id}", func(re *core.RequestEvent) error {
		return h.handleUpdateFile(re)
	})

	e.Router.DELETE("/api/filestore/files/{id}", func(re *core.RequestEvent) error {
		return h.handleDeleteFile(re)
	})
}

// serveJSON 包装 JSON 响应，error 接口返回 200+{ok:false,error:...} 或 500。
func (h *FilestoreHandler) serveJSON(re *core.RequestEvent, data any, err error) error {
	if err != nil {
		if httpErr, ok := err.(*router.ApiError); ok {
			return re.JSON(httpErr.Status, map[string]any{"ok": false, "error": httpErr.Message})
		}
		return re.JSON(http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
	}
	return re.JSON(http.StatusOK, data)
}

// ---- 管理端 Handler ----

// handleGetConfigRaw 返回配置的 map 结构。
func (h *FilestoreHandler) handleGetConfigRaw(re *core.RequestEvent) (any, error) {
	cfg, err := h.loadConfig()
	if err != nil {
		return nil, fmt.Errorf("读取配置失败: %w", err)
	}
	return map[string]any{
		"alist_url":              cfg.AlistURL,
		"alist_token":            cfg.AlistToken,
		"max_size":               cfg.MaxSize,
		"allowed_mimes":          cfg.AllowedMimes,
		"download_mode":          cfg.DownloadMode,
		"storage_path":           cfg.StoragePath,
		"placeholder_denied":     cfg.PlaceholderDenied,
		"placeholder_error":      cfg.PlaceholderError,
	}, nil
}

// handleSaveConfig 保存配置。
func (h *FilestoreHandler) handleSaveConfig(re *core.RequestEvent) (any, error) {
	var req struct {
		Items []ConfigItem `json:"items"`
	}
	if err := re.BindBody(&req); err != nil {
		return nil, router.NewBadRequestError("请求体格式错误", err)
	}
	if len(req.Items) == 0 {
		return nil, router.NewBadRequestError("配置项不能为空", nil)
	}
	if _, err := ValidateConfigItems(req.Items); err != nil {
		return nil, router.NewBadRequestError(err.Error(), nil)
	}
	if err := SaveConfig(h.pb, req.Items); err != nil {
		return nil, fmt.Errorf("保存配置失败: %w", err)
	}
	return map[string]any{"ok": true, "message": "配置已保存"}, nil
}

// handleCheckAlistRaw 连通性自检。
func (h *FilestoreHandler) handleCheckAlistRaw() (any, error) {
	cfg, err := h.loadConfig()
	if err != nil {
		return map[string]any{"ok": false, "error": "读取配置失败: " + err.Error()}, nil
	}
	client := h.newAlistClient(cfg)
	if err := client.Health(); err != nil {
		return map[string]any{"ok": false, "error": err.Error()}, nil
	}
	return map[string]any{"ok": true, "message": "Alist 连通正常"}, nil
}

// handleOrphansReport 孤儿文件对账:列出 Alist 上有但 DB 无记录的文件(仅报告不删除)。
func (h *FilestoreHandler) handleOrphansReport(re *core.RequestEvent) (any, error) {
	cfg, err := h.loadConfig()
	if err != nil {
		return nil, fmt.Errorf("读取配置失败: %w", err)
	}
	client := h.newAlistClient(cfg)

	// 获取所有 DB 记录的 storage_key
	records, err := h.pb.FindRecordsByFilter("filestore_files", "", "", 0, 0)
	if err != nil {
		return nil, fmt.Errorf("查询 filestore_files 失败: %w", err)
	}
	dbKeys := make(map[string]bool, len(records))
	for _, rec := range records {
		dbKeys[rec.GetString("storage_key")] = true
	}

	// 列出 Alist 存储根路径下的文件
	alistFiles, err := client.List(cfg.StoragePath)
	if err != nil {
		return nil, fmt.Errorf("列出 Alist 文件失败: %w", err)
	}

	var orphans []string
	for _, f := range alistFiles {
		if !dbKeys[f] {
			orphans = append(orphans, f)
		}
	}

	return map[string]any{
		"ok":              true,
		"orphans":         orphans,
		"orphan_count":    len(orphans),
		"db_file_count":   len(records),
		"alist_file_count": len(alistFiles),
	}, nil
}

// ---- 通用端 Handler ----

// handleUpload 处理文件上传(流式转发,禁止内存缓冲整个文件)。
func (h *FilestoreHandler) handleUpload(re *core.RequestEvent) error {
	auth := re.Auth
	if auth == nil {
		return re.UnauthorizedError("需要登录", nil)
	}

	// 读取配置
	cfg, err := h.loadConfig()
	if err != nil {
		return re.JSON(http.StatusInternalServerError, map[string]any{"error": fmt.Sprintf("读取配置失败: %s", err.Error())})
	}
	client := h.newAlistClient(cfg)

	// 流式解析 multipart
	mr, err := re.Request.MultipartReader()
	if err != nil {
		return re.JSON(http.StatusBadRequest, map[string]any{"error": "请求格式错误"})
	}

	// 读取 file 字段 part
	part, err := mr.NextPart()
	if err != nil {
		return re.JSON(http.StatusBadRequest, map[string]any{"error": "未找到文件字段"})
	}
	defer part.Close()

	originalName := part.FileName()
	if originalName == "" {
		originalName = "untitled"
	}

	// 读取完整文件内容到内存(受大小限制保护)
	limitedReader := io.LimitReader(part, cfg.MaxSize+1)
	fileData, readErr := io.ReadAll(limitedReader)
	if readErr != nil {
		return re.JSON(http.StatusInternalServerError, map[string]any{"error": fmt.Sprintf("读取文件数据失败: %s", readErr.Error())})
	}
	fileSize := int64(len(fileData))
	if fileSize > cfg.MaxSize {
		return re.JSON(http.StatusRequestEntityTooLarge, map[string]any{
			"error": fmt.Sprintf("文件大小 %d 超过限制 %d", fileSize, cfg.MaxSize),
		})
	}

	// 检测 MIME 类型(取前 512 字节)
	mimeType := http.DetectContentType(fileData[:min(fileSize, 512)])

	// 校验 MIME 类型
	if !cfg.IsMimeAllowed(mimeType) {
		return re.JSON(http.StatusUnsupportedMediaType, map[string]any{
			"error": fmt.Sprintf("MIME 类型 %s 不在白名单中", mimeType),
		})
	}

	// 读取 visibility 参数(从下一个 part)
	visibility := "private"
	if nextPart, err := mr.NextPart(); err == nil {
		visData, _ := io.ReadAll(io.LimitReader(nextPart, 32))
		vis := strings.TrimSpace(string(visData))
		if vis == "public" || vis == "private" {
			visibility = vis
		}
		nextPart.Close()
	}

	// 生成 storage_key
	ext := filepath.Ext(originalName)
	now := time.Now().UTC()
	storageKey := fmt.Sprintf("%s/%04d/%02d/%s/%s%s",
		strings.TrimRight(cfg.StoragePath, "/"),
		now.Year(), now.Month(),
		auth.Id,
		generateUUID(),
		ext,
	)
	// 上传到 Alist
	if err := client.Put(storageKey, fileSize, bytes.NewReader(fileData)); err != nil {
		h.pb.Logger().Warn("上传到 Alist 失败", "storage_key", storageKey, "error", err.Error())
		return re.JSON(http.StatusInternalServerError, map[string]any{"error": fmt.Sprintf("上传到存储服务失败: %s", err.Error())})
	}

	// 创建 filestore_files 记录
	collection, err := h.pb.FindCollectionByNameOrId("filestore_files")
	if err != nil {
		client.Remove(storageKey) // 回滚 Alist 文件
		return re.JSON(http.StatusInternalServerError, map[string]any{"error": fmt.Sprintf("filestore_files 集合不存在: %s", err.Error())})
	}

	rec := core.NewRecord(collection)
	rec.Set("owner", auth.Id)
	rec.Set("storage_key", storageKey)
	rec.Set("original_name", originalName)
	rec.Set("mime", mimeType)
	rec.Set("size", fileSize)
	rec.Set("visibility", visibility)

	if err := h.pb.Save(rec); err != nil {
		client.Remove(storageKey) // 回滚 Alist 文件
		return re.JSON(http.StatusInternalServerError, map[string]any{"error": fmt.Sprintf("保存文件记录失败: %s", err.Error())})
	}

	return re.JSON(http.StatusCreated, map[string]any{
		"id":            rec.Id,
		"owner":         auth.Id,
		"storage_key":   storageKey,
		"original_name": originalName,
		"mime":          mimeType,
		"size":          fileSize,
		"visibility":    visibility,
		"created":       rec.GetString("created"),
	})
}

// handleGetFile 获取文件元数据。
func (h *FilestoreHandler) handleGetFile(re *core.RequestEvent) error {
	fileID := re.Request.PathValue("id")
	rec, err := h.pb.FindRecordById("filestore_files", fileID)
	if err != nil {
		return re.JSON(http.StatusNotFound, map[string]any{"error": "文件不存在"})
	}

	// 鉴权:private 仅 owner
	visibility := rec.GetString("visibility")
	auth := re.Auth
	if visibility == "private" && (auth == nil || auth.Id != rec.GetString("owner")) {
		return re.JSON(http.StatusForbidden, map[string]any{"error": "无权访问此文件"})
	}

	return re.JSON(http.StatusOK, map[string]any{
		"id":            rec.Id,
		"owner":         rec.GetString("owner"),
		"original_name": rec.GetString("original_name"),
		"mime":          rec.GetString("mime"),
		"size":          rec.GetInt("size"),
		"visibility":    visibility,
		"created":       rec.GetString("created"),
		"updated":       rec.GetString("updated"),
	})
}

// handleListFiles 列出文件(支持分页和过滤)。
func (h *FilestoreHandler) handleListFiles(re *core.RequestEvent) error {
	auth := re.Auth
	page := 1
	perPage := 20
	filter := "my"

	re.Request.ParseForm()
	if p := re.Request.Form.Get("page"); p != "" {
		fmt.Sscanf(p, "%d", &page)
	}
	if pp := re.Request.Form.Get("per_page"); pp != "" {
		fmt.Sscanf(pp, "%d", &perPage)
	}
	if f := re.Request.Form.Get("filter"); f != "" {
		filter = f
	}

	var records []*core.Record
	var err error

		limit := perPage
		offset := (page - 1) * perPage
		if offset < 0 {
			offset = 0
		}

	switch filter {
	case "public":
		records, err = h.pb.FindRecordsByFilter("filestore_files",
			"visibility = 'public'", "-created", limit, offset)
	case "all":
		if auth != nil {
			records, err = h.pb.FindRecordsByFilter("filestore_files",
				"owner = {:owner} || visibility = 'public'", "-created", limit, offset,
				map[string]any{"owner": auth.Id})
		} else {
			records, err = h.pb.FindRecordsByFilter("filestore_files",
				"visibility = 'public'", "-created", limit, offset)
		}
	default: // "my"
		if auth == nil {
			return re.JSON(http.StatusUnauthorized, map[string]any{"error": "需要登录"})
		}
		records, err = h.pb.FindRecordsByFilter("filestore_files",
			"owner = {:owner}", "-created", limit, offset,
			map[string]any{"owner": auth.Id})
	}

	if err != nil {
		return re.JSON(http.StatusInternalServerError, map[string]any{"error": err.Error()})
	}

	items := make([]map[string]any, 0, len(records))
	for _, rec := range records {
		items = append(items, map[string]any{
			"id":            rec.Id,
			"owner":         rec.GetString("owner"),
			"original_name": rec.GetString("original_name"),
			"mime":          rec.GetString("mime"),
			"size":          rec.GetInt("size"),
			"visibility":    rec.GetString("visibility"),
			"created":       rec.GetString("created"),
		})
	}

	return re.JSON(http.StatusOK, map[string]any{
		"items":    items,
		"page":     page,
		"per_page": perPage,
	})
}

// resolveDisposition 根据下载模式和 inline 标志返回 Content-Disposition 头值。
// proxy 模式:inline=true 返回 inline(浏览器内联显示,用于预览),否则 attachment(下载);
// direct 模式返回空串(不设头,302 重定向后由 Alist 响应决定)。
func resolveDisposition(inline bool, mode string, filename string) string {
	if mode != DownloadModeProxy {
		return ""
	}
	if inline {
		return fmt.Sprintf(`inline; filename="%s"`, filename)
	}
	return fmt.Sprintf(`attachment; filename="%s"`, filename)
}

// handleDownload 处理文件下载(按配置走 direct 或 proxy 模式)。
func (h *FilestoreHandler) handleDownload(re *core.RequestEvent) error {
	fileID := re.Request.PathValue("id")
	rec, err := h.pb.FindRecordById("filestore_files", fileID)
	if err != nil {
		// 文件不存在 → 尝试返回错误占位图
		cfg, _ := h.loadConfig()
		if cfg.PlaceholderError != "" {
			return h.servePlaceholderHTML(re, cfg.PlaceholderError)
		}
		return re.JSON(http.StatusNotFound, map[string]any{"error": "文件不存在"})
	}

	// 鉴权
	visibility := rec.GetString("visibility")
	auth := re.Auth
	if visibility == "private" && (auth == nil || auth.Id != rec.GetString("owner")) {
		cfg, _ := h.loadConfig()
		if cfg.PlaceholderDenied != "" {
			return h.servePlaceholderHTML(re, cfg.PlaceholderDenied)
		}
		return re.JSON(http.StatusForbidden, map[string]any{"error": "无权访问此文件"})
	}

	cfg, err := h.loadConfig()
	if err != nil {
		return re.JSON(http.StatusInternalServerError, map[string]any{"error": "读取配置失败"})
	}
	client := h.newAlistClient(cfg)
	storageKey := rec.GetString("storage_key")
	originalName := rec.GetString("original_name")
	inline := re.Request.URL.Query().Get("inline") == "1"

	if cfg.DownloadMode == DownloadModeProxy {
		// proxy 模式:后端流式代理
		reader, size, mimeType, err := client.Get(storageKey)
		if err != nil {
			if cfg.PlaceholderError != "" {
				return h.servePlaceholderHTML(re, cfg.PlaceholderError)
			}
			return re.JSON(http.StatusInternalServerError, map[string]any{"error": "读取文件失败"})
		}
		defer reader.Close()

		re.Response.Header().Set("Content-Type", mimeType)
		re.Response.Header().Set("Content-Length", fmt.Sprintf("%d", size))
		re.Response.Header().Set("Content-Disposition", resolveDisposition(inline, cfg.DownloadMode, originalName))
		re.Response.Header().Set("Cache-Control", "private, max-age=3600")

		io.Copy(re.Response, reader)
		return nil
	}

	// direct 模式:签发 sign 直链 → 302 重定向
	signURL, err := client.Sign(storageKey)
	if err != nil {
		if cfg.PlaceholderError != "" {
			return h.servePlaceholderHTML(re, cfg.PlaceholderError)
		}
		return re.JSON(http.StatusInternalServerError, map[string]any{"error": "签发下载链接失败"})
	}
	re.Response.Header().Set("Cache-Control", "private, max-age=3600")
	http.Redirect(re.Response, re.Request, signURL, http.StatusFound)
	return nil
}

// servePlaceholderHTML 返回占位 HTML 片段(如 img/svg 等),用于鉴权失败或服务异常时的视觉提示。
func (h *FilestoreHandler) servePlaceholderHTML(re *core.RequestEvent, html string) error {
	re.Response.Header().Set("Content-Type", "text/html; charset=utf-8")
	re.Response.Header().Set("Content-Security-Policy", "default-src 'none'; img-src *; style-src 'unsafe-inline'")
	re.Response.WriteHeader(http.StatusOK)
	_, err := re.Response.Write([]byte(html))
	return err
}

// handleUpdateFile 更新文件 visibility。
func (h *FilestoreHandler) handleUpdateFile(re *core.RequestEvent) error {
	fileID := re.Request.PathValue("id")
	rec, err := h.pb.FindRecordById("filestore_files", fileID)
	if err != nil {
		return re.JSON(http.StatusNotFound, map[string]any{"error": "文件不存在"})
	}

	// 仅 owner
	auth := re.Auth
	if auth == nil || auth.Id != rec.GetString("owner") {
		return re.JSON(http.StatusForbidden, map[string]any{"error": "仅文件所有者可修改"})
	}

	var req struct {
		Visibility string `json:"visibility"`
	}
	if err := re.BindBody(&req); err != nil {
		return re.JSON(http.StatusBadRequest, map[string]any{"error": "请求体格式错误"})
	}
	if req.Visibility != "public" && req.Visibility != "private" {
		return re.JSON(http.StatusBadRequest, map[string]any{"error": "visibility 必须是 public 或 private"})
	}

	rec.Set("visibility", req.Visibility)
	if err := h.pb.Save(rec); err != nil {
		return re.JSON(http.StatusInternalServerError, map[string]any{"error": "保存失败"})
	}

	return re.JSON(http.StatusOK, map[string]any{"ok": true, "visibility": req.Visibility})
}

// handleDeleteFile 删除文件。
func (h *FilestoreHandler) handleDeleteFile(re *core.RequestEvent) error {
	fileID := re.Request.PathValue("id")
	rec, err := h.pb.FindRecordById("filestore_files", fileID)
	if err != nil {
		return re.JSON(http.StatusNotFound, map[string]any{"error": "文件不存在"})
	}

	// 仅 owner
	auth := re.Auth
	if auth == nil || auth.Id != rec.GetString("owner") {
		return re.JSON(http.StatusForbidden, map[string]any{"error": "仅文件所有者可删除"})
	}

	storageKey := rec.GetString("storage_key")

	// 删除 Alist 上的文件
	cfg, err := h.loadConfig()
	if err == nil {
		client := h.newAlistClient(cfg)
		if err := client.Remove(storageKey); err != nil {
			h.pb.Logger().Warn("删除 Alist 文件失败", "storage_key", storageKey, "error", err.Error())
		}
	}

	// 删除 DB 记录
	if err := h.pb.Delete(rec); err != nil {
		return re.JSON(http.StatusInternalServerError, map[string]any{"error": "删除记录失败"})
	}

	return re.JSON(http.StatusOK, map[string]any{"ok": true, "message": "文件已删除"})
}

// generateUUID 生成随机 UUID v4(不依赖外部包)。
func generateUUID() string {
	b := make([]byte, 16)
	rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}