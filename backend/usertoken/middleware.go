package usertoken

import (
	"errors"
	"net/http"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/hook"
)

// BearerToken 从 Authorization 头提取 Bearer 令牌。
func BearerToken(r *http.Request) (string, bool) {
	const prefix = "Bearer "
	header := r.Header.Get("Authorization")
	if !strings.HasPrefix(header, prefix) {
		return "", false
	}
	token := strings.TrimSpace(strings.TrimPrefix(header, prefix))
	if token == "" {
		return "", false
	}
	return token, true
}

// RequireAuth 返回供未来公开 API 绑定的令牌校验中间件。
//
// 用法:
//
//	e.Router.GET("/api/public/xxx", handler).Bind(usertoken.RequireAuth(app.pb))
func RequireAuth(app *pocketbase.PocketBase) *hook.Handler[*core.RequestEvent] {
	return &hook.Handler[*core.RequestEvent]{
		Id:   "usertokenRequireAuth",
		Func: RequireAuthFunc(app),
	}
}

// RequireAuthFunc 返回中间件函数形式,便于 .BindFunc 使用。
func RequireAuthFunc(app *pocketbase.PocketBase) func(e *core.RequestEvent) error {
	svc := NewService(app)
	return func(e *core.RequestEvent) error {
		if e.Auth != nil {
			return e.Next()
		}
		token, ok := BearerToken(e.Request)
		if !ok {
			return e.UnauthorizedError(ErrInvalidToken.Error(), nil)
		}
		user, err := svc.Verify(token)
		switch {
		case errors.Is(err, ErrFeatureDisabled), errors.Is(err, ErrTokenDisabled):
			return e.ForbiddenError(err.Error(), nil)
		case err != nil:
			if errors.Is(err, ErrInvalidToken) {
				return e.UnauthorizedError(err.Error(), nil)
			}
			return e.InternalServerError("API 令牌校验失败", nil)
		}
		record, err := app.FindRecordById("users", user.ID)
		if err != nil {
			return e.InternalServerError("API 令牌校验失败", nil)
		}
		e.Auth = record
		return e.Next()
	}
}
