package main

import (
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/s-petr/longhabit/links"
)

// defaultLinksSettings 是 tools_settings 表的预置链接管理配置项。
var defaultLinksSettings = []struct {
	option      string
	description string
	settingType string
	value       string
}{
	{"links_help_center_url",
		"帮助中心目标地址(空=未配置,点击入口显示报错页;支持绝对地址或 / 开头的根相对路径)",
		"string", ""},
	{"links_error_html",
		"报错页 HTML 内容(任一链接未配置/非法时展示;留空使用内置默认)",
		"string", links.DefaultErrorHTML},
}

// ensureLinksSettings 幂等补插缺失的预置链接管理配置项。
func ensureLinksSettings(pb *pocketbase.PocketBase) error {
	collection, err := pb.FindCollectionByNameOrId("tools_settings")
	if err != nil {
		return err
	}

	records, err := pb.FindRecordsByFilter("tools_settings", "option ~ 'links_'", "", 0, 0)
	if err != nil {
		return err
	}
	existing := make(map[string]bool, len(records))
	for _, rec := range records {
		existing[rec.GetString("option")] = true
	}

	for _, item := range defaultLinksSettings {
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

// setupLinks 挂载链接管理 API 与公开网关,并在服务启动时幂等补插预置配置项。
func (app *application) setupLinks() {
	app.pb.OnServe().BindFunc(func(e *core.ServeEvent) error {
		if err := ensureLinksSettings(app.pb); err != nil {
			app.pb.Logger().Warn("链接管理配置项补插失败",
				"error", err.Error(),
				"提示", "请先在管理后台导入 pb_schema.json 中的 tools_settings 表")
		}

		handler := links.NewLinksHandler(app.pb)
		handler.RegisterHandlers(e)

		return e.Next()
	})
}
