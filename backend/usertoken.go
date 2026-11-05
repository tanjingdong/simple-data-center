package main

import (
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/s-petr/longhabit/usertoken"
)

// defaultUsertokenSettings 是 tools_settings 表的预置令牌配置项。
var defaultUsertokenSettings = []struct {
	option      string
	description string
	settingType string
	value       string
}{
	{"usertoken_enabled", "用户 API 令牌功能总开关(true=启用)", "bool", "false"},
}

// ensureUsertokenSettings 幂等补插缺失的预置令牌配置项。
func ensureUsertokenSettings(pb *pocketbase.PocketBase) error {
	collection, err := pb.FindCollectionByNameOrId("tools_settings")
	if err != nil {
		return err
	}

	records, err := pb.FindRecordsByFilter("tools_settings", "option ~ 'usertoken_'", "", 0, 0)
	if err != nil {
		return err
	}
	existing := make(map[string]bool, len(records))
	for _, rec := range records {
		existing[rec.GetString("option")] = true
	}

	for _, item := range defaultUsertokenSettings {
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

// hasTokenFieldValue 报告请求记录中是否携带了令牌字段值。
func hasTokenFieldValue(rec *core.Record) bool {
	return rec.GetString("api_token_hash") != "" ||
		!rec.GetDateTime("api_token_created_at").IsZero() ||
		!rec.GetDateTime("api_token_last_used_at").IsZero() ||
		rec.GetBool("api_token_disabled")
}

// tokenFieldsChanged 比较令牌字段是否被请求修改。
func tokenFieldsChanged(cur, orig *core.Record) bool {
	return cur.GetString("api_token_hash") != orig.GetString("api_token_hash") ||
		cur.GetBool("api_token_disabled") != orig.GetBool("api_token_disabled") ||
		!cur.GetDateTime("api_token_created_at").Equal(orig.GetDateTime("api_token_created_at")) ||
		!cur.GetDateTime("api_token_last_used_at").Equal(orig.GetDateTime("api_token_last_used_at"))
}

// setupUsertoken 注册防篡改 hook、补插配置项并挂载令牌路由。
func (app *application) setupUsertoken() {
	// 防篡改:禁止通过 PB API(含 superuser)直接读写令牌字段。
	app.pb.OnRecordCreateRequest("users").BindFunc(func(e *core.RecordRequestEvent) error {
		if hasTokenFieldValue(e.Record) {
			return e.BadRequestError("API 令牌字段不允许直接写入", nil)
		}
		return e.Next()
	})
	app.pb.OnRecordUpdateRequest("users").BindFunc(func(e *core.RecordRequestEvent) error {
		if orig := e.Record.Original(); orig != nil && tokenFieldsChanged(e.Record, orig) {
			return e.BadRequestError("API 令牌字段不允许直接修改", nil)
		}
		return e.Next()
	})

	app.pb.OnServe().BindFunc(func(e *core.ServeEvent) error {
		if err := ensureUsertokenSettings(app.pb); err != nil {
			app.pb.Logger().Warn("usertoken 配置项补插失败",
				"error", err.Error(),
				"提示", "请先在管理后台导入 pb_schema.json 中的 tools_settings 表")
		}
		usertoken.NewHandler(app.pb).RegisterHandlers(e)
		return e.Next()
	})
}
