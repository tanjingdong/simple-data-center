package main

import (
	"reflect"
	"regexp"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func TestParseHealthLinks_Basic(t *testing.T) {
	got := parseHealthLinks("体格检查:[[事件abc123def456ghi]],眼压正常")
	want := []string{"abc123def456ghi"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("应提取 %v,得到 %v", want, got)
	}
}

func TestParseHealthLinks_MultipleAndDedup(t *testing.T) {
	got := parseHealthLinks("[[事件aaa111bbb222ccc]][[事件ddd444eee555fff]][[事件aaa111bbb222ccc]]")
	want := []string{"aaa111bbb222ccc", "ddd444eee555fff"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("应去重且保持顺序 %v,得到 %v", want, got)
	}
}

func TestParseHealthLinks_EmptyAndInvalid(t *testing.T) {
	if got := parseHealthLinks(""); len(got) != 0 {
		t.Errorf("空文本应无链接,得到 %v", got)
	}
	// 非法格式:非 15 位、非事件前缀、普通 [[文本]] 均保持原样(不解析)
	got := parseHealthLinks("[[事件123]][[其他内容]][[事件@@@!!!@@@!!!@@@!]]普通文字")
	if len(got) != 0 {
		t.Errorf("非法格式不应解析出链接,得到 %v", got)
	}
}

func TestParseHealthLinks_LinkInsideLongText(t *testing.T) {
	detail := "主诉:眼睛疼痛。\n体格检查:眼压R=17mmHg [[事件abc123def456ghi]],眼压L=16mmHg [[事件bbb222ccc333ddd]]。\n诊断:过敏性结膜炎。"
	got := parseHealthLinks(detail)
	want := []string{"abc123def456ghi", "bbb222ccc333ddd"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("应提取 %v,得到 %v", want, got)
	}
}

func TestDiffHealthLinks_AddedRemoved(t *testing.T) {
	added, removed := diffHealthLinks(
		[]string{"aaa111bbb222ccc", "ddd444eee555fff"},
		[]string{"aaa111bbb222ccc", "ggg777hhh888iii"},
	)
	if !reflect.DeepEqual(added, []string{"ggg777hhh888iii"}) {
		t.Errorf("新增应为 [ggg777hhh888iii],得到 %v", added)
	}
	if !reflect.DeepEqual(removed, []string{"ddd444eee555fff"}) {
		t.Errorf("移除应为 [ddd444eee555fff],得到 %v", removed)
	}
}

func TestDiffHealthLinks_NoChange(t *testing.T) {
	added, removed := diffHealthLinks(
		[]string{"aaa111bbb222ccc"},
		[]string{"aaa111bbb222ccc"},
	)
	if len(added) != 0 || len(removed) != 0 {
		t.Errorf("无变化应无 diff,得到 added=%v removed=%v", added, removed)
	}
}

// newTestHealthApp 创建带 health_events 集合与钩子的测试应用实例。
func newTestHealthApp(t *testing.T) *application {
	t.Helper()
	app := &application{pb: pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: t.TempDir()})}
	// 必须显式 Bootstrap(NewWithConfig 不会初始化 DB/迁移/设置),否则首个 DB 操作 panic
	if err := app.pb.Bootstrap(); err != nil {
		t.Fatalf("初始化测试应用失败: %v", err)
	}
	app.setupHealthHooks()

	collection := core.NewBaseCollection(healthCollection)
	if err := collection.Fields.Add(
		&core.TextField{Name: "person", Required: true},
		&core.DateField{Name: "happen_at", Required: true},
		&core.TextField{Name: "event_type", Required: true},
		&core.TextField{Name: "item"},
		&core.TextField{Name: "department"},
		&core.TextField{Name: "institution"},
		&core.TextField{Name: "doctor"},
		&core.TextField{Name: "conclusion"},
		&core.TextField{Name: "detail"},
		&core.JSONField{Name: "referenced_by"},
	); err != nil {
		t.Fatalf("创建测试集合字段失败: %v", err)
	}
	if err := app.pb.Save(collection); err != nil {
		t.Fatalf("创建测试集合失败: %v", err)
	}
	return app
}

// saveHealthEvent 构造并保存一条健康事件(必填 person/happen_at/event_type 由默认值兜底)。
func saveHealthEvent(t *testing.T, app *application, data map[string]any) *core.Record {
	t.Helper()
	collection, err := app.pb.FindCollectionByNameOrId(healthCollection)
	if err != nil {
		t.Fatalf("查找集合失败: %v", err)
	}
	record := core.NewRecord(collection)
	record.Set("person", "李杰")
	record.Set("happen_at", time.Date(2026, 5, 23, 0, 0, 0, 0, time.UTC))
	record.Set("event_type", "门诊")
	for k, v := range data {
		record.Set(k, v)
	}
	if err := app.pb.Save(record); err != nil {
		t.Fatalf("保存健康事件失败: %v", err)
	}
	return record
}

func TestSyncOnCreate_AppendsTargetReferencedBy(t *testing.T) {
	app := newTestHealthApp(t)
	visit := saveHealthEvent(t, app, nil)

	child := saveHealthEvent(t, app, map[string]any{
		"event_type": "检查",
		"item":       "眼压R",
		"conclusion": "17mmHg",
		"detail":     "来源于[[事件" + visit.Id + "]]",
	})

	// 子事件引用就诊 → 就诊事件的 referenced_by 应包含子事件 ID
	visitReloaded, err := app.pb.FindRecordById(healthCollection, visit.Id)
	if err != nil {
		t.Fatalf("重查就诊事件失败: %v", err)
	}
	if got := visitReloaded.GetStringSlice("referenced_by"); !reflect.DeepEqual(got, []string{child.Id}) {
		t.Errorf("就诊事件 referenced_by 应为 [%s],得到 %v", child.Id, got)
	}
}

func TestSyncOnUpdate_AddAndRemoveLink(t *testing.T) {
	app := newTestHealthApp(t)
	target := saveHealthEvent(t, app, nil)
	source := saveHealthEvent(t, app, map[string]any{"event_type": "检查", "item": "眼压R", "conclusion": "17mmHg"})

	// 更新:追加链接
	source.Set("detail", "关联于[[事件"+target.Id+"]]")
	if err := app.pb.Save(source); err != nil {
		t.Fatalf("更新事件失败: %v", err)
	}
	reloaded, _ := app.pb.FindRecordById(healthCollection, target.Id)
	if got := reloaded.GetStringSlice("referenced_by"); !reflect.DeepEqual(got, []string{source.Id}) {
		t.Fatalf("追加链接后 referenced_by 应为 [%s],得到 %v", source.Id, got)
	}

	// 更新:移除链接(用户删掉文本中的 [[链接]],反链同步消失)
	source.Set("detail", "已删除链接")
	if err := app.pb.Save(source); err != nil {
		t.Fatalf("再次更新事件失败: %v", err)
	}
	reloaded, _ = app.pb.FindRecordById(healthCollection, target.Id)
	if got := reloaded.GetStringSlice("referenced_by"); len(got) != 0 {
		t.Fatalf("移除链接后 referenced_by 应为空,得到 %v", got)
	}
}

func TestSyncOnDelete_RemovesSelfFromTargets(t *testing.T) {
	app := newTestHealthApp(t)
	target := saveHealthEvent(t, app, nil)
	child := saveHealthEvent(t, app, map[string]any{
		"event_type": "检查", "item": "眼压R", "conclusion": "17mmHg",
		"detail": "来源于[[事件" + target.Id + "]]",
	})

	if err := app.pb.Delete(child); err != nil {
		t.Fatalf("删除子事件失败: %v", err)
	}
	reloaded, _ := app.pb.FindRecordById(healthCollection, target.Id)
	if got := reloaded.GetStringSlice("referenced_by"); len(got) != 0 {
		t.Fatalf("删除子事件后 referenced_by 应为空,得到 %v", got)
	}
}

func TestSync_SkipsMissingTarget(t *testing.T) {
	app := newTestHealthApp(t)
	// 引用一个不存在的 ID:保存不应报错,也不应有副作用
	rec := saveHealthEvent(t, app, map[string]any{
		"event_type": "检查",
		"detail":     "引用[[事件zzz111yyy222xxx]]",
	})
	if rec.Id == "" {
		t.Fatal("事件应保存成功并获得 ID")
	}
}

func TestSyncOnCreate_DuplicateLinkKeepsSingleEntry(t *testing.T) {
	app := newTestHealthApp(t)
	target := saveHealthEvent(t, app, nil)
	child := saveHealthEvent(t, app, map[string]any{
		"event_type": "检查",
		"detail":     "[[事件" + target.Id + "]][[事件" + target.Id + "]]",
	})
	reloaded, _ := app.pb.FindRecordById(healthCollection, target.Id)
	if got := reloaded.GetStringSlice("referenced_by"); !reflect.DeepEqual(got, []string{child.Id}) {
		t.Errorf("同一目标重复引用应只记录一次,得到 %v", got)
	}
}

func TestRebuildHealthReferencedBy(t *testing.T) {
	app := newTestHealthApp(t)
	target := saveHealthEvent(t, app, nil)
	child := saveHealthEvent(t, app, map[string]any{
		"event_type": "检查",
		"detail":     "[[事件" + target.Id + "]]",
	})

	// 模拟缓存过期:清空 target 的 referenced_by(绕过同步,直接改库)
	collection, _ := app.pb.FindCollectionByNameOrId(healthCollection)
	corrupted, _ := app.pb.FindRecordById(healthCollection, target.Id)
	corrupted.Set("referenced_by", []string{})
	if err := app.pb.SaveNoValidate(corrupted); err != nil {
		t.Fatalf("写入脏数据失败: %v", err)
	}

	if err := app.rebuildHealthReferencedBy(); err != nil {
		t.Fatalf("重建失败: %v", err)
	}

	reloaded, _ := app.pb.FindRecordById(healthCollection, target.Id)
	if got := reloaded.GetStringSlice("referenced_by"); !reflect.DeepEqual(got, []string{child.Id}) {
		t.Errorf("重建后 referenced_by 应为 [%s],得到 %v", child.Id, got)
	}
	_ = collection
}

func TestEnsureHealthRecordId(t *testing.T) {
	app := newTestHealthApp(t)
	collection, err := app.pb.FindCollectionByNameOrId(healthCollection)
	if err != nil {
		t.Fatal(err)
	}

	// 新记录:生成符合 [a-z0-9]{15} 的 ID
	rec := core.NewRecord(collection)
	if err := ensureHealthRecordId(rec); err != nil {
		t.Fatalf("生成 ID 失败: %v", err)
	}
	if len(rec.Id) != 15 || !regexp.MustCompile(`^[a-z0-9]{15}$`).MatchString(rec.Id) {
		t.Errorf("ID 应匹配 [a-z0-9]{15},得到 %q", rec.Id)
	}

	// 已有 ID:保持不变
	rec2 := core.NewRecord(collection)
	rec2.Set("id", "abc123def456ghi")
	if err := ensureHealthRecordId(rec2); err != nil {
		t.Fatal(err)
	}
	if rec2.Id != "abc123def456ghi" {
		t.Errorf("已有 ID 不应被覆盖,得到 %q", rec2.Id)
	}
}

func TestSetupHealthHooks_CreateGeneratesIdAndSyncs(t *testing.T) {
	app := newTestHealthApp(t)
	target := saveHealthEvent(t, app, nil)

	// 直接通过 app.Save 走完整钩子链(与 API 请求路径一致)
	collection, err := app.pb.FindCollectionByNameOrId(healthCollection)
	if err != nil {
		t.Fatal(err)
	}
	source := core.NewRecord(collection)
	source.Set("person", "李杰")
	source.Set("happen_at", time.Date(2026, 5, 23, 0, 0, 0, 0, time.UTC))
	source.Set("event_type", "检查")
	source.Set("item", "眼压R")
	source.Set("conclusion", "17mmHg")
	source.Set("detail", "[[事件"+target.Id+"]]")
	if err := app.pb.Save(source); err != nil {
		t.Fatalf("保存失败: %v", err)
	}
	if !regexp.MustCompile(`^[a-z0-9]{15}$`).MatchString(source.Id) {
		t.Fatalf("钩子应为新记录生成合法 ID,得到 %q", source.Id)
	}
	reloaded, _ := app.pb.FindRecordById(healthCollection, target.Id)
	if got := reloaded.GetStringSlice("referenced_by"); !reflect.DeepEqual(got, []string{source.Id}) {
		t.Errorf("referenced_by 应为 [%s],得到 %v", source.Id, got)
	}
}

func TestSetupHealthRoutes_RebuildHandlerRequiresAuth(t *testing.T) {
	// 路由的鉴权判断抽为纯逻辑辅助函数便于单测;本测试验证辅助函数的判定
	// (路由本身在实机验证环节以真实 HTTP 请求验证)
	// 重建索引是 health 业务功能:匿名拒绝,登录用户允许
	if rebuildRouteAllowed(nil) {
		t.Error("匿名请求应被拒绝")
	}
	if !rebuildRouteAllowed(&core.Record{}) {
		t.Error("登录用户应被允许")
	}
}
