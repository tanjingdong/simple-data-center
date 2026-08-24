package main

import (
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/s-petr/longhabit/filestore"
)

// defaultFilestoreSettings 是 tools_settings 表的预置 filestore 配置项。
var defaultFilestoreSettings = []struct {
	option      string
	description string
	settingType string
	value       string
}{
	{"filestore_alist_url", "Alist 服务地址(如 http://192.168.1.100:5244)", "string", ""},
	{"filestore_alist_token", "Alist 管理 token(用于签发 sign 和 API 调用)", "string", ""},
	{"filestore_max_size", "单文件大小上限(字节,默认 10MB)", "number", "10485760"},
	{"filestore_allowed_mimes", "允许的 MIME 类型(逗号分隔,空=允许所有)", "string", ""},
	{"filestore_download_mode", "下载通道:direct(直连 Alist)/proxy(经后端代理)", "string", "direct"},
	{"filestore_storage_path", "Alist 上的存储根路径", "string", "/simple-data-center"},
		{"filestore_placeholder_denied", "鉴权失败时返回的占位 HTML(如 img/svg 标签)", "string", "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"400\" height=\"200\" viewBox=\"0 0 400 200\"><rect width=\"100%25\" height=\"100%25\" fill=\"%23f3f4f6\"/><text x=\"200\" y=\"100\" text-anchor=\"middle\" fill=\"%239ca3af\" font-size=\"16\">🔒 该文件未公开</text></svg>"},
		{"filestore_placeholder_error", "服务异常时返回的占位 HTML(如 img/svg 标签)", "string", "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"400\" height=\"200\" viewBox=\"0 0 400 200\"><rect width=\"100%25\" height=\"100%25\" fill=\"%23fef2f2\"/><text x=\"200\" y=\"100\" text-anchor=\"middle\" fill=\"%23ef4444\" font-size=\"16\">⚠️ 文件暂时无法访问</text></svg>"},
}

// ensureFilestoreSettings 幂等补插缺失的预置 filestore 配置项。
func ensureFilestoreSettings(pb *pocketbase.PocketBase) error {
	collection, err := pb.FindCollectionByNameOrId("tools_settings")
	if err != nil {
		return err
	}

	records, err := pb.FindRecordsByFilter("tools_settings", "option ~ 'filestore_'", "", 0, 0)
	if err != nil {
		return err
	}
	existing := make(map[string]bool, len(records))
	for _, rec := range records {
		existing[rec.GetString("option")] = true
	}

	for _, item := range defaultFilestoreSettings {
		if existing[item.option] {
			continue
		}
		rec := core.NewRecord(collection)
		rec.Set("option", item.option)
		rec.Set("description", item.description)
		rec.Set("type", item.settingType)
		rec.Set("value", item.value)
		if err := pb.Save(rec); err != nil {
			return err
		}
	}
	return nil
}

// setupFilestore 挂载文件存储管理 API,并在服务启动时幂等补插预置配置项。
func (app *application) setupFilestore() {
	app.pb.OnServe().BindFunc(func(e *core.ServeEvent) error {
		if err := ensureFilestoreSettings(app.pb); err != nil {
			app.pb.Logger().Warn("filestore 配置项补插失败",
				"error", err.Error(),
				"提示", "请先在管理后台导入 pb_schema.json 中的 filestore_files 表和 tools_settings 表")
		}

		handler := filestore.NewFilestoreHandler(app.pb)
		handler.RegisterHandlers(e)

		return e.Next()
	})
}