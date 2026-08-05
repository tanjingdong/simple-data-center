package main

import (
	"net/http"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

// defaultFrpcSettings 是 tools_settings 表的预置 frpc 配置项。
// 主程序启动时幂等补插,管理员在管理后台填写 value 后即可使用。
var defaultFrpcSettings = []struct {
	option      string
	description string
	settingType string
	value       string
}{
	{"frpc_server_addr", "frps 服务器地址(IP 或域名),用于反向代理连接", "string", ""},
	{"frpc_server_port", "frps 服务端口", "number", "7000"},
	{"frpc_token", "frps 认证 token(未设置则留空)", "string", ""},
	{"frpc_proxy_name", "代理名称,在 frps 上须唯一", "string", "longhabit"},
	{"frpc_local_port", "本地服务端口(本服务监听端口)", "number", "8090"},
	{"frpc_remote_port", "frps 上暴露的远程端口", "number", "8090"},
}

// ensureFrpcSettings 幂等补插缺失的预置 frpc 配置项。
func ensureFrpcSettings(pb *pocketbase.PocketBase) error {
	collection, err := pb.FindCollectionByNameOrId("tools_settings")
	if err != nil {
		return err // tools_settings 表尚未导入
	}

	records, err := pb.FindRecordsByFilter("tools_settings", "option ~ 'frpc_'", "", 0, 0)
	if err != nil {
		return err
	}
	existing := make(map[string]bool, len(records))
	for _, rec := range records {
		existing[rec.GetString("option")] = true
	}

	for _, item := range defaultFrpcSettings {
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

// requireSuperuser 校验当前请求是否为 superuser。
func requireSuperuser(re *core.RequestEvent) bool {
	return re.HasSuperuserAuth()
}

// setupFrpc 挂载 frpc 管理 API,并在服务启动时幂等补插预置配置项。
func (app *application) setupFrpc() {
	app.pb.OnServe().BindFunc(func(e *core.ServeEvent) error {
		// 表尚未导入时仅记录警告,不阻断服务启动
		if err := ensureFrpcSettings(app.pb); err != nil {
			app.pb.Logger().Warn("frpc 配置项补插失败",
				"error", err.Error(),
				"提示", "请先在管理后台导入 pb_schema.json 中的 tools_settings 表")
		}

		e.Router.GET("/api/frpc/status", func(re *core.RequestEvent) error {
			if !requireSuperuser(re) {
				return re.ForbiddenError("", nil)
			}
			return re.JSON(http.StatusOK, app.frpc.Status())
		})

		e.Router.POST("/api/frpc/start", func(re *core.RequestEvent) error {
			if !requireSuperuser(re) {
				return re.ForbiddenError("", nil)
			}
			if err := app.frpc.Start(); err != nil {
				app.pb.Logger().Warn("frpc 启动失败", "error", err.Error())
			}
			// 统一返回最新状态,前端据此展示失败原因
			return re.JSON(http.StatusOK, app.frpc.Status())
		})

		e.Router.POST("/api/frpc/stop", func(re *core.RequestEvent) error {
			if !requireSuperuser(re) {
				return re.ForbiddenError("", nil)
			}
			if err := app.frpc.Stop(); err != nil {
				app.pb.Logger().Warn("frpc 停止失败", "error", err.Error())
			}
			return re.JSON(http.StatusOK, app.frpc.Status())
		})

		e.Router.POST("/api/frpc/restart", func(re *core.RequestEvent) error {
			if !requireSuperuser(re) {
				return re.ForbiddenError("", nil)
			}
			if err := app.frpc.Restart(); err != nil {
				app.pb.Logger().Warn("frpc 重启失败", "error", err.Error())
			}
			return re.JSON(http.StatusOK, app.frpc.Status())
		})

		return e.Next()
	})
}
