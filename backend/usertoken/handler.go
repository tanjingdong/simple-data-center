package usertoken

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

// Handler 承载用户令牌相关路由。
type Handler struct {
	svc        *Service
	loadConfig func() (Config, error)
	saveConfig func(items []ConfigItem) error
}

// NewHandler 创建使用 PocketBase 的 handler。
func NewHandler(app *pocketbase.PocketBase) *Handler {
	return &Handler{
		svc:        NewService(app),
		loadConfig: func() (Config, error) { return LoadConfig(app) },
		saveConfig: func(items []ConfigItem) error { return SaveConfig(app, items) },
	}
}

// RegisterHandlers 注册用户自助与管理员路由。
func (h *Handler) RegisterHandlers(e *core.ServeEvent) {
	// 用户自助接口(需登录会话)
	e.Router.GET("/api/usertoken", func(re *core.RequestEvent) error {
		if re.Auth == nil {
			return re.UnauthorizedError("需要登录", nil)
		}
		st, err := h.svc.Status(re.Auth.Id)
		return h.serveJSON(re, st, err)
	})

	e.Router.POST("/api/usertoken/generate", func(re *core.RequestEvent) error {
		if re.Auth == nil {
			return re.UnauthorizedError("需要登录", nil)
		}
		token, createdAt, err := h.svc.Generate(re.Auth.Id)
		if err != nil {
			return h.serveJSON(re, nil, err)
		}
		return re.JSON(http.StatusOK, map[string]any{
			"ok":         true,
			"token":      token,
			"created_at": createdAt,
		})
	})

	e.Router.DELETE("/api/usertoken", func(re *core.RequestEvent) error {
		if re.Auth == nil {
			return re.UnauthorizedError("需要登录", nil)
		}
		return h.serveJSON(re, map[string]any{"ok": true}, h.svc.Revoke(re.Auth.Id))
	})

	// 管理员接口(superuser)
	e.Router.GET("/api/usertoken/config", func(re *core.RequestEvent) error {
		if !re.HasSuperuserAuth() {
			return re.ForbiddenError("", nil)
		}
		cfg, err := h.loadConfig()
		if err != nil {
			return h.serveJSON(re, nil, err)
		}
		return re.JSON(http.StatusOK, map[string]any{"enabled": cfg.Enabled})
	})

	e.Router.POST("/api/usertoken/config", func(re *core.RequestEvent) error {
		if !re.HasSuperuserAuth() {
			return re.ForbiddenError("", nil)
		}
		var body struct {
			Enabled bool `json:"enabled"`
		}
		if err := re.BindBody(&body); err != nil {
			return re.BadRequestError("请求体格式错误", nil)
		}
		items := []ConfigItem{{Option: optionEnabled, Value: strconv.FormatBool(body.Enabled)}}
		if _, err := ValidateConfigItems(items); err != nil {
			return h.serveJSON(re, nil, err)
		}
		if err := h.saveConfig(items); err != nil {
			return h.serveJSON(re, nil, err)
		}
		return re.JSON(http.StatusOK, map[string]any{"ok": true, "enabled": body.Enabled})
	})

	e.Router.GET("/api/admin/usertokens", func(re *core.RequestEvent) error {
		if !re.HasSuperuserAuth() {
			return re.ForbiddenError("", nil)
		}
		query := re.Request.URL.Query()
		page, err := parsePageParam(query.Get("page"), 1)
		if err != nil {
			return re.BadRequestError(err.Error(), nil)
		}
		perPage, err := parsePageParam(query.Get("perPage"), 20)
		if err != nil || perPage > 100 {
			return re.BadRequestError("分页参数 perPage 必须是 1-100 的整数", nil)
		}
		users, total, err := h.svc.AdminList(query.Get("query"), page, perPage)
		if err != nil {
			return h.serveJSON(re, nil, err)
		}
		items := make([]map[string]any, 0, len(users))
		for _, u := range users {
			items = append(items, userTokenItem(u))
		}
		return re.JSON(http.StatusOK, map[string]any{
			"ok":      true,
			"items":   items,
			"total":   total,
			"page":    page,
			"perPage": perPage,
		})
	})

	e.Router.PATCH("/api/admin/usertokens/{userId}", func(re *core.RequestEvent) error {
		if !re.HasSuperuserAuth() {
			return re.ForbiddenError("", nil)
		}
		var body struct {
			Disabled bool `json:"disabled"`
		}
		if err := re.BindBody(&body); err != nil {
			return re.BadRequestError("请求体格式错误", nil)
		}
		err := h.svc.AdminSetDisabled(re.Request.PathValue("userId"), body.Disabled)
		if errors.Is(err, ErrNoToken) {
			return re.JSON(http.StatusBadRequest, map[string]any{"ok": false, "error": err.Error()})
		}
		return h.serveJSON(re, map[string]any{"ok": true}, err)
	})

	e.Router.DELETE("/api/admin/usertokens/{userId}", func(re *core.RequestEvent) error {
		if !re.HasSuperuserAuth() {
			return re.ForbiddenError("", nil)
		}
		return h.serveJSON(re, map[string]any{"ok": true}, h.svc.AdminDelete(re.Request.PathValue("userId")))
	})
}

// serveJSON 按业务错误映射状态码;成功时返回 200+data。
func (h *Handler) serveJSON(re *core.RequestEvent, data any, err error) error {
	if err == nil {
		return re.JSON(http.StatusOK, data)
	}
	status := http.StatusInternalServerError
	switch {
	case errors.Is(err, ErrFeatureDisabled), errors.Is(err, ErrTokenDisabled):
		status = http.StatusForbidden
	case errors.Is(err, ErrInvalidToken):
		status = http.StatusUnauthorized
	case errors.Is(err, ErrUserNotFound), errors.Is(err, ErrNoToken):
		status = http.StatusNotFound
	}
	return re.JSON(status, map[string]any{"ok": false, "error": err.Error()})
}

// parsePageParam 解析分页参数;空串回退默认值,非正整数报错。
func parsePageParam(raw string, def int) (int, error) {
	if raw == "" {
		return def, nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < 1 {
		return 0, errors.New("分页参数必须是正整数")
	}
	return value, nil
}

// userTokenItem 构造管理员列表中的单条用户令牌信息(不含哈希)。
func userTokenItem(u *User) map[string]any {
	item := map[string]any{
		"id":        u.ID,
		"email":     u.Email,
		"username":  u.Username,
		"has_token": u.HasToken(),
		"disabled":  u.TokenDisabled,
	}
	if u.HasToken() {
		item["created_at"] = u.TokenCreatedAt
		if !u.TokenLastUsedAt.IsZero() {
			item["last_used_at"] = u.TokenLastUsedAt
		}
	}
	return item
}
