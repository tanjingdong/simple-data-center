package links

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
)

// LinksHandler 持有链接管理各 handler 的依赖。
type LinksHandler struct {
	pb         *pocketbase.PocketBase
	loadConfig func() (Config, error)
}

// NewLinksHandler 创建 handler 实例。
func NewLinksHandler(pb *pocketbase.PocketBase) *LinksHandler {
	return &LinksHandler{
		pb: pb,
		loadConfig: func() (Config, error) {
			return LoadConfig(pb)
		},
	}
}

// RegisterHandlers 注册链接管理路由。
func (h *LinksHandler) RegisterHandlers(e *core.ServeEvent) {
	// 公开网关:导航「帮助中心」的固定入口(新标签页整页加载,不经 SPA)。
	e.Router.GET("/links/help-center", func(re *core.RequestEvent) error {
		return h.handleHelpCenterGateway(re)
	})

	// 管理端 API (superuser 专属)
	e.Router.GET("/api/links/config", func(re *core.RequestEvent) error {
		if !re.HasSuperuserAuth() {
			return re.ForbiddenError("", nil)
		}
		data, err := h.handleGetConfigRaw()
		return h.serveJSON(re, data, err)
	})

	e.Router.POST("/api/links/config", func(re *core.RequestEvent) error {
		if !re.HasSuperuserAuth() {
			return re.ForbiddenError("", nil)
		}
		data, err := h.handleSaveConfig(re)
		return h.serveJSON(re, data, err)
	})
}

// handleHelpCenterGateway 网关裁决:目标合法→302(no-store);否则→200 报错页。
// 配置读取失败(如 tools_settings 未导入)同样落报错页,不让公开页 500。
func (h *LinksHandler) handleHelpCenterGateway(re *core.RequestEvent) error {
	cfg, err := h.loadConfig()
	if err != nil {
		return re.HTML(http.StatusOK, renderErrorPage(cfg.ErrorHTMLOrDefault()))
	}
	if target := resolveGatewayTarget(cfg.HelpCenterURL); target != "" {
		re.Response.Header().Set("Cache-Control", "no-store")
		return re.Redirect(http.StatusFound, target)
	}
	return re.HTML(http.StatusOK, renderErrorPage(cfg.ErrorHTMLOrDefault()))
}

// resolveGatewayTarget 返回待跳转目标;未配置或非法(含脏数据)返回空串。
// 网关每次请求重新校验,脏数据永远到不了用户浏览器。
func resolveGatewayTarget(rawURL string) string {
	target := strings.TrimSpace(rawURL)
	if target == "" || ValidateURL(target) != nil {
		return ""
	}
	return target
}

// renderErrorPage 把管理员配置的 HTML 片段包成最小完整页面。
// 片段原样嵌入(管理员可信,不消毒);自带 <style> 等标签均可用。
func renderErrorPage(fragment string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>帮助中心</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;max-width:42rem;margin:3rem auto;padding:0 1.25rem;line-height:1.7;color:#334155}h1{font-size:1.4rem}</style>
</head>
<body>
%s
</body>
</html>
`, fragment)
}

// serveJSON 包装 JSON 响应:error 接口返回 400/500 + {ok:false,error}。
func (h *LinksHandler) serveJSON(re *core.RequestEvent, data any, err error) error {
	if err != nil {
		if httpErr, ok := err.(*router.ApiError); ok {
			return re.JSON(httpErr.Status, map[string]any{"ok": false, "error": httpErr.Message})
		}
		return re.JSON(http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
	}
	return re.JSON(http.StatusOK, data)
}

// handleGetConfigRaw 返回配置(键名 = option 去 links_ 前缀,供表单回填)。
func (h *LinksHandler) handleGetConfigRaw() (any, error) {
	cfg, err := h.loadConfig()
	if err != nil {
		return nil, fmt.Errorf("读取配置失败: %w", err)
	}
	return map[string]any{
		"help_center_url": cfg.HelpCenterURL,
		"error_html":      cfg.ErrorHTML,
	}, nil
}

// handleSaveConfig 校验并保存配置。
func (h *LinksHandler) handleSaveConfig(re *core.RequestEvent) (any, error) {
	var req struct {
		Items []ConfigItem `json:"items"`
	}
	if err := re.BindBody(&req); err != nil {
		return nil, router.NewBadRequestError("请求体格式错误", err)
	}
	normalized, err := ValidateConfigItems(req.Items)
	if err != nil {
		return nil, router.NewBadRequestError(err.Error(), nil)
	}
	// 只写请求中实际提交的项:未携带的 option(如 error_html)保持库中原值
	items := SelectNormalizedItems(req.Items, normalized)
	if err := SaveConfig(h.pb, items); err != nil {
		return nil, fmt.Errorf("保存配置失败: %w", err)
	}
	return map[string]any{"ok": true, "message": "配置已保存"}, nil
}
