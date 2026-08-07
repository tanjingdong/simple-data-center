package main

import (
	"github.com/pocketbase/pocketbase/core"
)

// setupAuthHooks configures the application's authentication-related hooks.
// 当用户首次以密码登录时,标记 authWithPasswordAvailable 为 true。
func (app *application) setupAuthHooks() {
	app.pb.OnRecordAuthWithPasswordRequest().
		BindFunc(func(e *core.RecordAuthWithPasswordRequestEvent) error {
			userRecord := e.Record

			if isAvailable := userRecord.GetBool("authWithPasswordAvailable"); !isAvailable {
				userRecord.Set("authWithPasswordAvailable", true)
				app.pb.Save(userRecord)
			}

			return e.Next()
		})
}
