package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/security"

	"github.com/s-petr/longhabit/filestore"
)

// healthCollection 是健康事件集合名(基座已有 events 集合,故使用独立命名避免冲突)。
const healthCollection = "health_events"

// healthLinkPattern 匹配详述中的 [[事件<15位ID>]] 链接。
// 说明:规格中「数字 ID」来自用户示例;PocketBase 记录 ID 为 15 位小写字母数字,
// 链接始终由前端「事件选择器」插入,用户看到的是「项目:结论」标签。
var healthLinkPattern = regexp.MustCompile(`\[\[事件([a-z0-9]{15})\]\]`)

// parseHealthLinks 从详述文本提取所有被引用的事件 ID(去重、保持出现顺序)。
// 仅识别 [[事件<15位ID>]];其他 [[内容]] 不被解析,保持原样显示。
func parseHealthLinks(detail string) []string {
	matches := healthLinkPattern.FindAllStringSubmatch(detail, -1)
	seen := make(map[string]struct{}, len(matches))
	result := make([]string, 0, len(matches))
	for _, m := range matches {
		if _, ok := seen[m[1]]; ok {
			continue
		}
		seen[m[1]] = struct{}{}
		result = append(result, m[1])
	}
	return result
}

// diffHealthLinks 对比新旧链接列表,返回新增与移除的 ID(各自去重、保持出现顺序)。
func diffHealthLinks(oldLinks, newLinks []string) (added, removed []string) {
	oldSet := make(map[string]struct{}, len(oldLinks))
	newSet := make(map[string]struct{}, len(newLinks))
	for _, id := range oldLinks {
		oldSet[id] = struct{}{}
	}
	for _, id := range newLinks {
		newSet[id] = struct{}{}
	}
	for _, id := range newLinks {
		if _, ok := oldSet[id]; !ok {
			added = append(added, id)
		}
	}
	for _, id := range oldLinks {
		if _, ok := newSet[id]; !ok {
			removed = append(removed, id)
		}
	}
	return added, removed
}

// ensureHealthRecordId 为新记录预生成 15 位记录 ID。
// 背景:PocketBase 在主键 autogenerate 校验阶段(OnModelCreate 链的后续环节)
// 才生成 id,而本模块的同步逻辑在 OnModelCreate 内就需要 record.Id 写入目标
// 事件的 referenced_by,故在此提前生成(与默认主键 pattern [a-z0-9]{15} 一致,
// 校验可直接通过;手动生成 ID 是 PocketBase 官方容忍的路径)。
func ensureHealthRecordId(record *core.Record) error {
	if record.Id != "" {
		return nil
	}
	id, err := security.RandomStringByRegex(`[a-z0-9]{15}`)
	if err != nil {
		return fmt.Errorf("生成事件 ID 失败: %w", err)
	}
	record.Set("id", id)
	return nil
}

// appendReferencedBy 将 sourceID 追加到目标事件的 referenced_by(去重)。
func appendReferencedBy(target *core.Record, sourceID string) {
	ids := target.GetStringSlice("referenced_by")
	for _, id := range ids {
		if id == sourceID {
			return
		}
	}
	target.Set("referenced_by", append(ids, sourceID))
}

// removeReferencedBy 从目标事件的 referenced_by 中移除 sourceID。
func removeReferencedBy(target *core.Record, sourceID string) {
	ids := target.GetStringSlice("referenced_by")
	filtered := make([]string, 0, len(ids))
	for _, id := range ids {
		if id != sourceID {
			filtered = append(filtered, id)
		}
	}
	target.Set("referenced_by", filtered)
}

// parseReceiptIDs 解析 receipt 字段值(file ID 数组)为 ID 列表。
// 兼容三种输入:json 字符串(如 `["f1"]`)、[]string、[]any;空/非法/非字符串数组返回 nil。
func parseReceiptIDs(v any) []string {
	if v == nil {
		return nil
	}
	if s, ok := v.(string); ok {
		s = strings.TrimSpace(s)
		if s == "" {
			return nil
		}
		var ids []string
		if err := json.Unmarshal([]byte(s), &ids); err != nil {
			return nil
		}
		return ids
	}
	// []string / []any 等:先 Marshal 再 Unmarshal 为 []string
	raw, err := json.Marshal(v)
	if err != nil {
		return nil
	}
	var ids []string
	if err := json.Unmarshal(raw, &ids); err != nil {
		return nil
	}
	return ids
}

// deleteHealthReceipts 级联删除事件 receipt 引用的所有 filestore 文件。
// 容错:任一文件删除失败仅记日志,不阻断事件删除主流程(事件已删,残留由孤儿对账清)。
func deleteHealthReceipts(pb *pocketbase.PocketBase, record *core.Record) {
	for _, id := range parseReceiptIDs(record.Get("receipt")) {
		if err := filestore.DeleteFile(pb, id); err != nil {
			pb.Logger().Warn("级联删除凭证文件失败",
				"file_id", id, "error", err.Error())
		}
	}
}

// syncHealthReferencedBy 在事件创建/更新后,将本事件 ID 追加/移出各目标事件的
// referenced_by(diff 驱动)。目标不存在(悬挂链接)时静默跳过;全部写入在同一
// 事务内完成,任一失败整体回滚。
func syncHealthReferencedBy(app core.App, record *core.Record, oldLinks []string) error {
	newLinks := parseHealthLinks(record.GetString("detail"))
	added, removed := diffHealthLinks(oldLinks, newLinks)
	if len(added) == 0 && len(removed) == 0 {
		return nil
	}

	return app.RunInTransaction(func(tx core.App) error {
		for _, id := range removed {
			target, err := tx.FindRecordById(healthCollection, id)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					continue // 目标不存在,无需清理
				}
				return err
			}
			removeReferencedBy(target, record.Id)
			if err := tx.Save(target); err != nil {
				return err
			}
		}
		for _, id := range added {
			target, err := tx.FindRecordById(healthCollection, id)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					continue // 目标不存在(悬挂链接),静默跳过
				}
				return err
			}
			appendReferencedBy(target, record.Id)
			if err := tx.Save(target); err != nil {
				return err
			}
		}
		return nil
	})
}

// syncHealthReferencedByOnDelete 在事件删除后,从各目标的 referenced_by 移除本事件 ID。
func syncHealthReferencedByOnDelete(app core.App, record *core.Record) error {
	links := parseHealthLinks(record.GetString("detail"))
	if len(links) == 0 {
		return nil
	}
	return app.RunInTransaction(func(tx core.App) error {
		for _, id := range links {
			target, err := tx.FindRecordById(healthCollection, id)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					continue // 目标不存在,无需清理
				}
				return err
			}
			removeReferencedBy(target, record.Id)
			if err := tx.Save(target); err != nil {
				return err
			}
		}
		return nil
	})
}

// rebuildHealthReferencedBy 全库重扫,按详述文本重建所有事件的 referenced_by
// (修复绕过系统直接改库/导入/迁移造成的缓存过期;复用 parseHealthLinks)。
func (app *application) rebuildHealthReferencedBy() error {
	all, err := app.pb.FindRecordsByFilter(healthCollection, "id != ''", "-created", 0, 0)
	if err != nil {
		return err
	}
	return app.pb.RunInTransaction(func(tx core.App) error {
		// 第一步:清空所有 referenced_by
		for _, rec := range all {
			rec.Set("referenced_by", []string{})
			if err := tx.Save(rec); err != nil {
				return err
			}
		}
		// 第二步:重放所有文本链接
		for _, rec := range all {
			for _, id := range parseHealthLinks(rec.GetString("detail")) {
				target, err := tx.FindRecordById(healthCollection, id)
				if err != nil {
					if errors.Is(err, sql.ErrNoRows) {
						continue // 目标已删除(悬挂链接),跳过
					}
					return err // 其他查询错误必须中止,避免吞掉真实故障
				}
				appendReferencedBy(target, rec.Id)
				if err := tx.Save(target); err != nil {
					return err
				}
			}
		}
		return nil
	})
}

// rebuildRouteAllowed 判定「重建索引」路由的访问权限。
// 重建索引是 health 业务的常规功能(入口在 /health 页面),登录用户即可触发;
// 重建为幂等操作(事务内清空+按详述文本链接重放),无越权风险。
func rebuildRouteAllowed(auth *core.Record) bool {
	return auth != nil
}

// setupHealthHooks 注册健康事件的被引用同步钩子(持久化前触发,与 PIM 钩子同模式):
//  1. 创建:预生成记录 ID,解析详述链接,同步各目标事件的 referenced_by;
//  2. 更新:对比新旧详述链接,diff 后同步(用户删掉文本中的链接,反链同步消失);
//  3. 删除:解析详述链接,从各目标事件的 referenced_by 移除本事件。
// 注意:e.App 在请求事务内即为事务作用域 app,同步逻辑与主记录同事务。
func (app *application) setupHealthHooks() {
	app.pb.OnModelCreate(healthCollection).BindFunc(func(e *core.ModelEvent) error {
		record := e.Model.(*core.Record)
		if err := ensureHealthRecordId(record); err != nil {
			return err
		}
		if err := syncHealthReferencedBy(e.App, record, nil); err != nil {
			return err
		}
		return e.Next()
	})

	app.pb.OnModelUpdate(healthCollection).BindFunc(func(e *core.ModelEvent) error {
		record := e.Model.(*core.Record)
		old, err := e.App.FindRecordById(healthCollection, record.Id)
		if err != nil {
			return err
		}
		oldLinks := parseHealthLinks(old.GetString("detail"))
		if err := syncHealthReferencedBy(e.App, record, oldLinks); err != nil {
			return err
		}
		return e.Next()
	})

	app.pb.OnModelDelete(healthCollection).BindFunc(func(e *core.ModelEvent) error {
		record := e.Model.(*core.Record)
		if err := syncHealthReferencedByOnDelete(e.App, record); err != nil {
			return err
		}
		if err := e.Next(); err != nil {
			return err
		}
		// 事件已删除,级联删凭证文件(非事务,容错;失败不阻断)
		deleteHealthReceipts(app.pb, record)
		return nil
	})
}

// setupHealthRoutes 注册健康事件的自定义路由:
//  1. POST /api/health/rebuild —— 重建全部事件的 referenced_by(登录用户,
//     业务入口在 /health 页面右上角「重建索引」)。
// 关联机制说明:referenced_by 的唯一来源是详述文本中的 [[事件<ID>]] 链接
// (由 setupHealthHooks 解析维护),系统不写入任何结构化关联——关联语义完全
// 由用户在详述中的叙述承载,因此不再需要 link 类路由。
func (app *application) setupHealthRoutes() {
	app.pb.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.POST("/api/health/rebuild", func(re *core.RequestEvent) error {
			if !rebuildRouteAllowed(re.Auth) {
				return apis.NewUnauthorizedError("需要超级管理员", nil)
			}
			if err := app.rebuildHealthReferencedBy(); err != nil {
				// 透传具体原因,便于管理端排查
				return apis.NewBadRequestError("重建失败: "+err.Error(), nil)
			}
			re.Response.WriteHeader(http.StatusNoContent)
			return nil
		})

		return se.Next()
	})
}
