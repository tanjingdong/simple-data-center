package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
)

func TestMergeText(t *testing.T) {
	cases := []struct {
		name string
		a, b string
		want string
	}{
		{"A 为空取 B", "", "x", "x"},
		{"B 为空取 A", "x", "", "x"},
		{"两边相同只留一份", "x", "x", "x"},
		{"两边不同拼接", "同事", "朋友", "同事,朋友"},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			if got := mergeText(tt.a, tt.b); got != tt.want {
				t.Errorf("mergeText(%q, %q) = %q, want %q", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

func TestMergeTagText(t *testing.T) {
	cases := []struct {
		name string
		a, b string
		want string
	}{
		{"整值相等只剩一份", "同事", "同事,朋友", "同事,朋友"},
		{"按元素去重并保序", "a, b", "b,c", "a,b,c"},
		{"A 侧重复与空项", "a,,a", "a", "a"},
		{"两边皆空", "", "", ""},
		{"A 元素在前 B 元素在后", "b,a", "a,c", "b,a,c"},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			if got := mergeTagText(tt.a, tt.b); got != tt.want {
				t.Errorf("mergeTagText(%q, %q) = %q, want %q", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

func TestSamePersonName(t *testing.T) {
	cases := []struct {
		name          string
		aLast, aFirst string
		bLast, bFirst string
		want          bool
	}{
		{"拼接形态相同", "张", "三", "张", "三", true},
		{"录入边界不同但拼接相同", "欧", "阳锋", "欧阳", "锋", true},
		{"姓名不同", "张", "三", "李", "四", false},
		// 与前端合并资格一致:身份列必须完整,缺姓/名不构成同名
		{"两边皆空不算同名", "", "", "", "", false},
		{"A 缺姓不算同名", "", "三", "张", "三", false},
		{"A 缺名不算同名", "张", "", "张", "", false},
		{"B 缺姓不算同名", "张", "三", "", "张三", false},
		{"B 缺名不算同名", "张", "三", "张三", "", false},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			if got := samePersonName(tt.aLast, tt.aFirst, tt.bLast, tt.bFirst); got != tt.want {
				t.Errorf("samePersonName(%q, %q, %q, %q) = %v, want %v",
					tt.aLast, tt.aFirst, tt.bLast, tt.bFirst, got, tt.want)
			}
		})
	}
}

func TestSameOrganizationName(t *testing.T) {
	cases := []struct {
		name string
		a, b string
		want bool
	}{
		{"忽略首尾空白", " 甲公司 ", "甲公司", true},
		{"名称不同", "甲", "乙", false},
		{"空名称不算同名", "", "  ", false},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			if got := sameOrganizationName(tt.a, tt.b); got != tt.want {
				t.Errorf("sameOrganizationName(%q, %q) = %v, want %v", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

func TestChooseSurvivor(t *testing.T) {
	aCreated := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	bCreated := aCreated.Add(time.Hour)

	cases := []struct {
		name          string
		aCreated      time.Time
		bCreated      time.Time
		wantID        string
		wantIsEditing bool
	}{
		{"A 更早保留正在编辑的 A", aCreated, bCreated, "editing", true},
		{"B 更早保留对方 B", bCreated, aCreated, "other", false},
		{"创建时间相同保留正在编辑的 A", aCreated, aCreated, "editing", true},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			gotID, gotEditing := chooseSurvivor(tt.aCreated, tt.bCreated, "editing", "other")
			if gotID != tt.wantID || gotEditing != tt.wantIsEditing {
				t.Errorf("chooseSurvivor() = (%q, %v), want (%q, %v)",
					gotID, gotEditing, tt.wantID, tt.wantIsEditing)
			}
		})
	}
}

func TestRewriteEventSummary(t *testing.T) {
	aID := strings.Repeat("a", 15)
	bID := strings.Repeat("b", 15)
	otherID := strings.Repeat("c", 15)

	t.Run("只改目标 id 并保留 label", func(t *testing.T) {
		summary := "与[[p:" + aID + "|张三]]和[[p:" + otherID + "|老张]]开会"
		want := "与[[p:" + bID + "|张三]]和[[p:" + otherID + "|老张]]开会"
		if got := rewriteEventSummary(summary, "p", aID, bID); got != want {
			t.Errorf("rewriteEventSummary() = %q, want %q", got, want)
		}
	})

	t.Run("同一人出现两次都改且不截断文本", func(t *testing.T) {
		summary := "[[p:" + aID + "|张三]]先到,[[p:" + aID + "|张三]]后到"
		want := "[[p:" + bID + "|张三]]先到,[[p:" + bID + "|张三]]后到"
		if got := rewriteEventSummary(summary, "p", aID, bID); got != want {
			t.Errorf("rewriteEventSummary() = %q, want %q", got, want)
		}
	})

	t.Run("不含目标原样返回", func(t *testing.T) {
		summary := "与[[o:" + otherID + "|甲公司]]开会"
		if got := rewriteEventSummary(summary, "p", aID, bID); got != summary {
			t.Errorf("rewriteEventSummary() = %q, want 原样 %q", got, summary)
		}
	})

	t.Run("类别不匹配原样返回", func(t *testing.T) {
		summary := "与[[o:" + aID + "|甲公司]]开会"
		if got := rewriteEventSummary(summary, "p", aID, bID); got != summary {
			t.Errorf("rewriteEventSummary() = %q, want 原样 %q", got, summary)
		}
	})
}

func TestMergeRecordPersonRules(t *testing.T) {
	app := newTestPimApp(t)

	col, err := app.pb.FindCollectionByNameOrId("persons")
	if err != nil {
		t.Fatalf("查找 persons 集合失败: %v", err)
	}
	b := core.NewRecord(col)
	b.Set("nickname", "小张")
	b.Set("mobile", "13900000000")
	b.Set("person_tags", "同事,朋友")
	b.Set("trust_level", 4)
	b.Set("gender", "男")

	// A 侧为正在编辑的表单值(JSON 数字解码后是 float64)
	aFields := map[string]any{
		"mobile":      "13800000000",
		"person_tags": "同事",
		"gender":      "男",
		"trust_level": float64(3),
	}

	merged, err := mergeRecord(app.pb, mergeKindPersons, aFields, b)
	if err != nil {
		t.Fatalf("mergeRecord 失败: %v", err)
	}

	byKey := make(map[string]mergedField, len(merged))
	for _, f := range merged {
		byKey[f.key] = f
	}

	cases := []struct {
		key        string
		wantValue  any
		wantResult string
		wantRule   string
	}{
		{"nickname", "小张", "小张", "pick-b"},
		{"mobile", "13800000000,13900000000", "13800000000,13900000000", "concat"},
		{"person_tags", "同事,朋友", "同事,朋友", "tag"},
		{"gender", "男", "男", "same"},
		{"trust_level", 3, "3", "pick-a"},
	}
	for _, tt := range cases {
		f, ok := byKey[tt.key]
		if !ok {
			t.Errorf("缺少字段 %s", tt.key)
			continue
		}
		if f.value != tt.wantValue {
			t.Errorf("%s.value = %#v, want %#v", tt.key, f.value, tt.wantValue)
		}
		if f.resultDisplay != tt.wantResult {
			t.Errorf("%s.resultDisplay = %q, want %q", tt.key, f.resultDisplay, tt.wantResult)
		}
		if f.rule != tt.wantRule {
			t.Errorf("%s.rule = %q, want %q", tt.key, f.rule, tt.wantRule)
		}
	}
}

// TestMergeRecordOrgRules 组织每个字段规则的单元覆盖(设计 §10 要求逐规则测试):
// 名称 trim/same、type/phone/email/address/notes 拼接、importance_level 与 map 取 A。
func TestMergeRecordOrgRules(t *testing.T) {
	app := newTestPimApp(t)

	col, err := app.pb.FindCollectionByNameOrId("organizations")
	if err != nil {
		t.Fatalf("查找 organizations 集合失败: %v", err)
	}
	b := core.NewRecord(col)
	b.Set("name", "甲公司")
	b.Set("type", "客户")
	b.Set("phone", "13900000000")
	b.Set("email", "b@example.com")
	b.Set("address", "地址B")
	b.Set("notes", "备注B")
	b.Set("map", "https://b.example.com")
	b.Set("importance_level", 3)

	aFields := map[string]any{
		"name":             " 甲公司 ",
		"type":             "供应商",
		"phone":            "13800000000",
		"email":            "a@example.com",
		"address":          "地址A",
		"notes":            "备注A",
		"map":              "https://a.example.com",
		"importance_level": float64(4),
	}

	merged, err := mergeRecord(app.pb, mergeKindOrganizations, aFields, b)
	if err != nil {
		t.Fatalf("mergeRecord 失败: %v", err)
	}
	byKey := make(map[string]mergedField, len(merged))
	for _, f := range merged {
		byKey[f.key] = f
	}

	cases := []struct {
		key        string
		wantValue  any
		wantResult string
		wantRule   string
	}{
		{"name", "甲公司", "甲公司", "same"},
		{"type", "供应商,客户", "供应商,客户", "concat"},
		{"phone", "13800000000,13900000000", "13800000000,13900000000", "concat"},
		{"email", "a@example.com,b@example.com", "a@example.com,b@example.com", "concat"},
		{"address", "地址A,地址B", "地址A,地址B", "concat"},
		{"notes", "备注A,备注B", "备注A,备注B", "concat"},
		{"importance_level", 4, "4", "pick-a"},
		{"map", "https://a.example.com", "https://a.example.com", "pick-a"},
	}
	for _, tt := range cases {
		f, ok := byKey[tt.key]
		if !ok {
			t.Errorf("缺少字段 %s", tt.key)
			continue
		}
		if f.value != tt.wantValue {
			t.Errorf("%s.value = %#v, want %#v", tt.key, f.value, tt.wantValue)
		}
		if f.resultDisplay != tt.wantResult {
			t.Errorf("%s.resultDisplay = %q, want %q", tt.key, f.resultDisplay, tt.wantResult)
		}
		if f.rule != tt.wantRule {
			t.Errorf("%s.rule = %q, want %q", tt.key, f.rule, tt.wantRule)
		}
	}

	t.Run("未知类型返回错误", func(t *testing.T) {
		_, err := mergeRecord(app.pb, mergeKind("users"), aFields, b)
		if err == nil || !strings.Contains(err.Error(), "未知的合并类型") {
			t.Errorf("未知类型应返回错误,得到 %v", err)
		}
	})
}

// ---- 合并预览 / 事务接口集成测试 ----

// saveTestPerson 创建一条人员记录。trust_level 默认 3:persons 钩子要求 1-5,
// 0(未设置)会被拒绝,而合并落库会再次触发该钩子。
func saveTestPerson(t *testing.T, app *application, lastName, firstName string, data map[string]any) *core.Record {
	t.Helper()
	collection, err := app.pb.FindCollectionByNameOrId("persons")
	if err != nil {
		t.Fatalf("查找 persons 集合失败: %v", err)
	}
	record := core.NewRecord(collection)
	record.Set("last_name", lastName)
	record.Set("first_name", firstName)
	record.Set("trust_level", 3)
	for key, value := range data {
		record.Set(key, value)
	}
	if err := app.pb.Save(record); err != nil {
		t.Fatalf("保存人员失败: %v", err)
	}
	return record
}

// saveTestOrganization 创建一条组织记录(importance_level 必须为 1-5)。
// 可选 data 用于覆盖/补充字段(合并测试需要区分 A/B 的文本、URL、评级等)。
func saveTestOrganization(t *testing.T, app *application, name string, data ...map[string]any) *core.Record {
	t.Helper()
	collection, err := app.pb.FindCollectionByNameOrId("organizations")
	if err != nil {
		t.Fatalf("查找 organizations 集合失败: %v", err)
	}
	record := core.NewRecord(collection)
	record.Set("name", name)
	record.Set("importance_level", 3)
	if len(data) > 0 {
		for key, value := range data[0] {
			record.Set(key, value)
		}
	}
	if err := app.pb.Save(record); err != nil {
		t.Fatalf("保存组织失败: %v", err)
	}
	return record
}

// saveTestRelation 创建一条关系(relations 钩子会规范化 person_a/person_b 顺序)。
func saveTestRelation(t *testing.T, app *application, personA, personB, description string) *core.Record {
	t.Helper()
	collection, err := app.pb.FindCollectionByNameOrId("relations")
	if err != nil {
		t.Fatalf("查找 relations 集合失败: %v", err)
	}
	record := core.NewRecord(collection)
	record.Set("person_a", personA)
	record.Set("person_b", personB)
	record.Set("relation_description", description)
	if err := app.pb.Save(record); err != nil {
		t.Fatalf("保存关系失败: %v", err)
	}
	return record
}

// saveTestEvent 创建一条带摘要的事件。
func saveTestEvent(t *testing.T, app *application, summary string) *core.Record {
	t.Helper()
	collection, err := app.pb.FindCollectionByNameOrId("events")
	if err != nil {
		t.Fatalf("查找 events 集合失败: %v", err)
	}
	record := core.NewRecord(collection)
	record.Set("happen_at", time.Date(2026, 11, 13, 0, 0, 0, 0, time.UTC))
	record.Set("type", "见面")
	record.Set("summary", summary)
	if err := app.pb.Save(record); err != nil {
		t.Fatalf("保存事件失败: %v", err)
	}
	return record
}

// relationRowsFor 返回所有引用该人员的关系行。
func relationRowsFor(t *testing.T, app *application, personID string) []*core.Record {
	t.Helper()
	rows, err := app.pb.FindRecordsByFilter("relations",
		"person_a = {:id} || person_b = {:id}", "", 0, 0, dbx.Params{"id": personID})
	if err != nil {
		t.Fatalf("查询人员关系失败: %v", err)
	}
	return rows
}

// relationPairRows 返回同时连接两个人员的关系行(用于断言重复对已去重)。
func relationPairRows(t *testing.T, app *application, id1, id2 string) []*core.Record {
	t.Helper()
	matched := make([]*core.Record, 0, 1)
	for _, row := range relationRowsFor(t, app, id1) {
		other := row.GetString("person_a")
		if other == id1 {
			other = row.GetString("person_b")
		}
		if other == id2 {
			matched = append(matched, row)
		}
	}
	return matched
}

// TestCommitMergePersonRewritesRelations 人员合并要把关系改指到保留者:
// 自关系删除、重复对描述拼接、其余改指;并且保留者要真正落库合并后的字段值。
func TestCommitMergePersonRewritesRelations(t *testing.T) {
	app := newTestPimApp(t)

	orgA := saveTestOrganization(t, app, "甲公司")
	orgB := saveTestOrganization(t, app, "乙公司")

	// B 先建、A 后建:A 是正在编辑的记录,B 的 created 更早,保留者是 B。
	// 两条记录的创建时间最小间隔 5ms,保证 created 排序确定(Windows 时钟精度)。
	// A/B 的值刻意不同,以便断言保留者落库的是合并结果而不是原值。
	b := saveTestPerson(t, app, "张", "三", map[string]any{
		"nickname":       "老张",
		"mobile":         "13900000000",
		"current_org_id": orgB.Id,
	})
	time.Sleep(5 * time.Millisecond)
	a := saveTestPerson(t, app, "张", "三", map[string]any{
		"nickname":       "小张",
		"mobile":         "13800000000",
		"current_org_id": orgA.Id,
	})
	c := saveTestPerson(t, app, "李", "四", nil)
	d := saveTestPerson(t, app, "王", "五", nil)

	// 关系:B-C("旧")、A-C("新")、A-B、A-D
	saveTestRelation(t, app, b.Id, c.Id, "旧")
	saveTestRelation(t, app, a.Id, c.Id, "新")
	saveTestRelation(t, app, a.Id, b.Id, "同事")
	saveTestRelation(t, app, a.Id, d.Id, "朋友")

	survivorID, err := app.commitMerge(app.pb, mergeRequest{
		Kind:      mergeKindPersons,
		EditingID: a.Id,
		OtherID:   b.Id,
		Fields: map[string]any{
			"last_name":      "张",
			"first_name":     "三",
			"nickname":       "小张",
			"mobile":         "13800000000",
			"current_org_id": orgA.Id,
			"trust_level":    float64(4),
		},
	})
	if err != nil {
		t.Fatalf("合并失败: %v", err)
	}
	if survivorID != b.Id {
		t.Fatalf("created 更早的 B 应被保留(%s),得到 %s", b.Id, survivorID)
	}
	if _, err := app.pb.FindRecordById("persons", a.Id); err == nil {
		t.Fatal("被合并的 A 应已删除")
	}

	// 保留者 B 必须真正收到合并结果:A 侧优先的 pick-a、两侧拼接的 concat,
	// 以及保存时由 persons 钩子按新单位重算的 search_text。
	survivor, err := app.pb.FindRecordById("persons", b.Id)
	if err != nil {
		t.Fatalf("重查保留者失败: %v", err)
	}
	if got := survivor.GetString("mobile"); got != "13800000000,13900000000" {
		t.Errorf("保留者 mobile 应为两侧拼接,得到 %q", got)
	}
	if got := survivor.GetString("nickname"); got != "小张,老张" {
		t.Errorf("保留者 nickname 应为 A,B 拼接,得到 %q", got)
	}
	if got := survivor.GetString("current_org_id"); got != orgA.Id {
		t.Errorf("保留者 current_org_id 应取 A 侧单位 %s,得到 %s", orgA.Id, got)
	}
	if got := survivor.GetInt("trust_level"); got != 4 {
		t.Errorf("保留者 trust_level 应取 A 侧值 4,得到 %d", got)
	}
	if got := survivor.GetString("search_text"); !strings.Contains(got, "甲公司") {
		t.Errorf("保留者 search_text 应按合并后的单位(甲公司)重算,得到 %q", got)
	}

	// 含 A 的关系必须全部改指或删除(A-B 改指后成为自关系,应删除)
	if rows := relationRowsFor(t, app, a.Id); len(rows) != 0 {
		t.Fatalf("不应残留含 A 的关系,得到 %d 条", len(rows))
	}

	// 关系集合必须恰好是 B-C 与 B-D:既无残留,也无 (B,B) 自关系。
	// (仅靠 person=id 查询返回 0 无法区分「自关系行已删」与「留待级联删除」。)
	rows := relationRowsFor(t, app, b.Id)
	if len(rows) != 2 {
		t.Fatalf("合并后 B 应恰好有 2 条关系(B-C、B-D),得到 %d 条", len(rows))
	}
	for _, row := range rows {
		if row.GetString("person_a") == row.GetString("person_b") {
			t.Errorf("合并后不应存在自关系,得到行 %s", row.Id)
		}
	}

	// B-C 只剩一条,描述按「已存在行在前、被吸收行在后」拼接
	pair := relationPairRows(t, app, b.Id, c.Id)
	if len(pair) != 1 {
		t.Fatalf("B-C 应只剩一条关系,得到 %d 条", len(pair))
	}
	if got := pair[0].GetString("relation_description"); got != "旧,新" {
		t.Errorf("B-C 描述应为 %q,得到 %q", "旧,新", got)
	}

	// A-D 改指为 B-D
	if pair := relationPairRows(t, app, b.Id, d.Id); len(pair) != 1 {
		t.Fatalf("A-D 应改指为 B-D,得到 %d 条", len(pair))
	}
}

// TestCommitMergePersonRewritesEvents 事件摘要里的 [[p:被删者|label]] 要改指保留者,
// 保留 label 与每一次出现。
func TestCommitMergePersonRewritesEvents(t *testing.T) {
	app := newTestPimApp(t)

	b := saveTestPerson(t, app, "张", "三", nil)
	time.Sleep(5 * time.Millisecond)
	a := saveTestPerson(t, app, "张", "三", nil)
	event := saveTestEvent(t, app, "与[[p:"+a.Id+"|张三]]和[[p:"+b.Id+"|老张]]开会")

	if _, err := app.commitMerge(app.pb, mergeRequest{
		Kind:      mergeKindPersons,
		EditingID: a.Id,
		OtherID:   b.Id,
		Fields:    map[string]any{"last_name": "张", "first_name": "三", "trust_level": float64(3)},
	}); err != nil {
		t.Fatalf("合并失败: %v", err)
	}

	reloaded, err := app.pb.FindRecordById("events", event.Id)
	if err != nil {
		t.Fatalf("重查事件失败: %v", err)
	}
	want := "与[[p:" + b.Id + "|张三]]和[[p:" + b.Id + "|老张]]开会"
	if got := reloaded.GetString("summary"); got != want {
		t.Errorf("事件摘要应为 %q,得到 %q", want, got)
	}
}

// TestCommitMergeOrganizationRepointsPersons 组织合并要把 current_org_id 改指保留者,
// 改指的人员要重算 search_text,事件里的 [[o:被删者|…]] 也要改指;
// 保留者还必须真正收到合并结果(A/B 值刻意不同,落库值可区分)。
func TestCommitMergeOrganizationRepointsPersons(t *testing.T) {
	app := newTestPimApp(t)

	// A(editing,后建)与 B(先建)同名;保留者是 created 更早的 B。
	b := saveTestOrganization(t, app, "甲公司", map[string]any{
		"type":             "客户",
		"phone":            "13900000000",
		"email":            "b@example.com",
		"address":          "地址B",
		"importance_level": 3,
	})
	time.Sleep(5 * time.Millisecond)
	a := saveTestOrganization(t, app, "甲公司", map[string]any{
		"type":             "供应商",
		"phone":            "13800000000",
		"email":            "a@example.com",
		"address":          "地址A",
		"importance_level": 4,
	})

	p := saveTestPerson(t, app, "张", "三", map[string]any{"current_org_id": a.Id})
	q := saveTestPerson(t, app, "李", "四", map[string]any{"current_org_id": b.Id})
	event := saveTestEvent(t, app, "参加[[o:"+a.Id+"|甲公司]]年会")

	survivorID, err := app.commitMerge(app.pb, mergeRequest{
		Kind:      mergeKindOrganizations,
		EditingID: a.Id,
		OtherID:   b.Id,
		Fields: map[string]any{
			"name":             " 甲公司 ",
			"type":             "供应商",
			"phone":            "13800000000",
			"email":            "a@example.com",
			"address":          "地址A",
			"importance_level": float64(4),
		},
	})
	if err != nil {
		t.Fatalf("合并失败: %v", err)
	}
	if survivorID != b.Id {
		t.Fatalf("created 更早的 B 应被保留(%s),得到 %s", b.Id, survivorID)
	}
	if _, err := app.pb.FindRecordById("organizations", a.Id); err == nil {
		t.Fatal("被合并的 A 组织应已删除")
	}

	// 保留者 B 必须收到合并结果:名称取 A 的 trim 值,文本拼接 A,B,单值取 A
	survivor, err := app.pb.FindRecordById("organizations", b.Id)
	if err != nil {
		t.Fatalf("重查保留者失败: %v", err)
	}
	if got := survivor.GetString("name"); got != "甲公司" {
		t.Errorf("保留者 name 应为 A 的 trim 值 %q,得到 %q", "甲公司", got)
	}
	if got := survivor.GetString("type"); got != "供应商,客户" {
		t.Errorf("保留者 type 应为两侧拼接,得到 %q", got)
	}
	if got := survivor.GetString("phone"); got != "13800000000,13900000000" {
		t.Errorf("保留者 phone 应为两侧拼接,得到 %q", got)
	}
	if got := survivor.GetString("email"); got != "a@example.com,b@example.com" {
		t.Errorf("保留者 email 应为两侧拼接,得到 %q", got)
	}
	if got := survivor.GetString("address"); got != "地址A,地址B" {
		t.Errorf("保留者 address 应为两侧拼接,得到 %q", got)
	}
	if got := survivor.GetInt("importance_level"); got != 4 {
		t.Errorf("保留者 importance_level 应取 A 侧值 4,得到 %d", got)
	}

	for _, person := range []*core.Record{p, q} {
		reloaded, err := app.pb.FindRecordById("persons", person.Id)
		if err != nil {
			t.Fatalf("重查人员失败: %v", err)
		}
		if got := reloaded.GetString("current_org_id"); got != b.Id {
			t.Errorf("人员 %s 的 current_org_id 应改为 B(%s),得到 %s", person.Id, b.Id, got)
		}
		if got := reloaded.GetString("search_text"); !strings.Contains(got, "甲公司") {
			t.Errorf("人员 %s 的 search_text 应含单位名,得到 %q", person.Id, got)
		}
	}

	reloaded, err := app.pb.FindRecordById("events", event.Id)
	if err != nil {
		t.Fatalf("重查事件失败: %v", err)
	}
	want := "参加[[o:" + b.Id + "|甲公司]]年会"
	if got := reloaded.GetString("summary"); got != want {
		t.Errorf("事件摘要应为 %q,得到 %q", want, got)
	}
}

// TestCommitMergeRejectsDifferentNames 姓名不同必须拒绝,且两边记录都保留。
func TestCommitMergeRejectsDifferentNames(t *testing.T) {
	app := newTestPimApp(t)

	b := saveTestPerson(t, app, "李", "四", nil)
	time.Sleep(5 * time.Millisecond)
	a := saveTestPerson(t, app, "张", "三", nil)

	_, err := app.commitMerge(app.pb, mergeRequest{
		Kind:      mergeKindPersons,
		EditingID: a.Id,
		OtherID:   b.Id,
		Fields:    map[string]any{"last_name": "张", "first_name": "三"},
	})
	if err == nil {
		t.Fatal("姓名不同应拒绝合并")
	}
	if !strings.Contains(err.Error(), "姓名") {
		t.Errorf("错误信息应说明姓名不一致,得到 %q", err.Error())
	}

	for _, id := range []string{a.Id, b.Id} {
		if _, err := app.pb.FindRecordById("persons", id); err != nil {
			t.Errorf("合并被拒绝后记录 %s 应保留: %v", id, err)
		}
	}
}

// TestCommitMergeRejectsInvalidRequest 校验 kind/id/记录存在,拒绝时不得改动任何记录。
func TestCommitMergeRejectsInvalidRequest(t *testing.T) {
	app := newTestPimApp(t)

	b := saveTestPerson(t, app, "张", "三", nil)
	time.Sleep(5 * time.Millisecond)
	a := saveTestPerson(t, app, "张", "三", nil)
	fields := map[string]any{"last_name": "张", "first_name": "三", "trust_level": float64(3)}

	cases := []struct {
		name string
		req  mergeRequest
	}{
		{"同一条记录", mergeRequest{Kind: mergeKindPersons, EditingID: a.Id, OtherID: a.Id, Fields: fields}},
		{"记录不存在", mergeRequest{Kind: mergeKindPersons, EditingID: a.Id, OtherID: "aaaaaaaaaaaaaaa", Fields: fields}},
		{"未知类型", mergeRequest{Kind: mergeKind("users"), EditingID: a.Id, OtherID: b.Id, Fields: fields}},
		{"缺少姓名", mergeRequest{Kind: mergeKindPersons, EditingID: a.Id, OtherID: b.Id, Fields: map[string]any{}}},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := app.commitMerge(app.pb, tt.req); err == nil {
				t.Fatal("非法请求应返回错误")
			}
			for _, id := range []string{a.Id, b.Id} {
				if _, err := app.pb.FindRecordById("persons", id); err != nil {
					t.Errorf("请求被拒绝后记录 %s 应保留: %v", id, err)
				}
			}
		})
	}
}

// TestBuildMergePreview 预览要算出保留者、被删者与逐字段结果(A 侧为表单值)。
func TestBuildMergePreview(t *testing.T) {
	app := newTestPimApp(t)

	orgA := saveTestOrganization(t, app, "甲公司")
	orgB := saveTestOrganization(t, app, "乙公司")
	b := saveTestPerson(t, app, "张", "三", map[string]any{
		"mobile":         "13900000000",
		"current_org_id": orgB.Id,
	})
	time.Sleep(5 * time.Millisecond)
	a := saveTestPerson(t, app, "张", "三", map[string]any{
		"mobile":         "13800000000",
		"current_org_id": orgA.Id,
	})

	preview, err := app.buildMergePreview(app.pb, mergeRequest{
		Kind:      mergeKindPersons,
		EditingID: a.Id,
		OtherID:   b.Id,
		Fields: map[string]any{
			"last_name":      "张",
			"first_name":     "三",
			"mobile":         "13800000000",
			"current_org_id": orgA.Id,
		},
	})
	if err != nil {
		t.Fatalf("生成预览失败: %v", err)
	}

	if preview.Kind != mergeKindPersons {
		t.Errorf("kind 应为 persons,得到 %q", preview.Kind)
	}
	if preview.SurvivorID != b.Id || preview.SurvivorIsEditing {
		t.Errorf("应从 preview 得到保留者 B(%s)且不是编辑侧,得到 survivorId=%s survivorIsEditing=%v",
			b.Id, preview.SurvivorID, preview.SurvivorIsEditing)
	}
	if preview.DeletedID != a.Id {
		t.Errorf("deletedId 应为 A(%s),得到 %s", a.Id, preview.DeletedID)
	}
	// 设计 §9.2:对话框要显示保留/删除记录的创建时间
	survivorCreated, err := time.Parse(time.RFC3339, preview.SurvivorCreated)
	if err != nil {
		t.Errorf("survivorCreated 应为 RFC3339 时间,得到 %q: %v", preview.SurvivorCreated, err)
	}
	deletedCreated, err := time.Parse(time.RFC3339, preview.DeletedCreated)
	if err != nil {
		t.Errorf("deletedCreated 应为 RFC3339 时间,得到 %q: %v", preview.DeletedCreated, err)
	}
	if survivorCreated.After(deletedCreated) {
		t.Errorf("保留者(B,创建更早)的创建时间应不晚于被删者: survivor=%v deleted=%v",
			survivorCreated, deletedCreated)
	}
	if len(preview.Fields) != len(personMergeFieldSpecs) {
		t.Errorf("字段行数应为 %d,得到 %d", len(personMergeFieldSpecs), len(preview.Fields))
	}

	byKey := make(map[string]mergeFieldPreview, len(preview.Fields))
	for _, field := range preview.Fields {
		byKey[field.Key] = field
	}

	mobile := byKey["mobile"]
	if mobile.A != "13800000000" || mobile.B != "13900000000" ||
		mobile.Result != "13800000000,13900000000" || mobile.Rule != "concat" {
		t.Errorf("mobile 行不符合预期: %+v", mobile)
	}

	org := byKey["current_org_id"]
	if org.A != "甲公司" || org.B != "乙公司" || org.Result != "甲公司" || org.Rule != "pick-a" {
		t.Errorf("current_org_id 行应显示单位名并优先 A: %+v", org)
	}

	// 预览只读:两条记录都还在
	for _, id := range []string{a.Id, b.Id} {
		if _, err := app.pb.FindRecordById("persons", id); err != nil {
			t.Errorf("预览不应删除记录 %s: %v", id, err)
		}
	}
}

// TestMergeJSONFieldNames 前端按 §8.1 的 camelCase 字段名解析请求与响应,
// 标签写错会让前端静默读到零值。
func TestMergeJSONFieldNames(t *testing.T) {
	preview := mergePreview{
		Kind:              mergeKindPersons,
		SurvivorID:        "bbbbbbbbbbbbbbb",
		SurvivorIsEditing: true,
		DeletedID:         "aaaaaaaaaaaaaaa",
		SurvivorCreated:   "2026-11-01T08:00:00Z",
		DeletedCreated:    "2026-11-02T08:00:00Z",
		Fields: []mergeFieldPreview{
			{Key: "mobile", A: "138", B: "139", Result: "138,139", Rule: "concat"},
		},
	}
	raw, err := json.Marshal(preview)
	if err != nil {
		t.Fatalf("序列化预览失败: %v", err)
	}
	want := `{"kind":"persons","survivorId":"bbbbbbbbbbbbbbb","survivorIsEditing":true,` +
		`"deletedId":"aaaaaaaaaaaaaaa","survivorCreated":"2026-11-01T08:00:00Z",` +
		`"deletedCreated":"2026-11-02T08:00:00Z",` +
		`"fields":[{"key":"mobile","a":"138","b":"139",` +
		`"result":"138,139","rule":"concat"}]}`
	if string(raw) != want {
		t.Errorf("预览 JSON 字段名不符合约定:\n得到 %s\n期望 %s", raw, want)
	}

	rawCommit, err := json.Marshal(mergeCommitResponse{SurvivorID: "bbbbbbbbbbbbbbb"})
	if err != nil {
		t.Fatalf("序列化提交响应失败: %v", err)
	}
	if string(rawCommit) != `{"survivorId":"bbbbbbbbbbbbbbb"}` {
		t.Errorf("提交响应 JSON 应为 survivorId,得到 %s", rawCommit)
	}

	var req mergeRequest
	if err := json.Unmarshal([]byte(`{"kind":"organizations","editingId":"aaaaaaaaaaaaaaa",`+
		`"otherId":"bbbbbbbbbbbbbbb","fields":{"name":"甲"}}`), &req); err != nil {
		t.Fatalf("解析请求失败: %v", err)
	}
	if req.Kind != mergeKindOrganizations || req.EditingID != "aaaaaaaaaaaaaaa" ||
		req.OtherID != "bbbbbbbbbbbbbbb" || req.Fields["name"] != "甲" {
		t.Errorf("请求 JSON 字段解析不符合约定: %+v", req)
	}
}

// TestDisplayOrg 预览的关系列:已存在显示名称,空 id 显示空串,查不到显示（已删除）。
func TestDisplayOrg(t *testing.T) {
	app := newTestPimApp(t)
	org := saveTestOrganization(t, app, "甲公司")

	if got := displayOrg(app.pb, org.Id); got != "甲公司" {
		t.Errorf("已存在组织应显示名称,得到 %q", got)
	}
	if got := displayOrg(app.pb, ""); got != "" {
		t.Errorf("空 id 应显示空串,得到 %q", got)
	}
	if got := displayOrg(app.pb, "aaaaaaaaaaaaaaa"); got != "（已删除）" {
		t.Errorf("不存在的组织应显示（已删除）,得到 %q", got)
	}
}

// TestCommitMergePersonEncryptedIdCard 身份证加密后的合并:合并对象(B)的 id_card
// 以 enc: 密文入库,预览/合成时先解密;保留者重新保存后仍须以 enc: 密文存储,
// 且可解密回原明文(pick 规则不能让密文搬来搬去或落成明文)。
func TestCommitMergePersonEncryptedIdCard(t *testing.T) {
	t.Setenv("PIM_ENC_KEY", testEncKey)
	app := newTestPimApp(t)

	const idCard = "430101199001011234"
	b := saveTestPerson(t, app, "张", "三", map[string]any{"id_card": idCard})
	rawB, err := app.pb.FindRecordById("persons", b.Id)
	if err != nil {
		t.Fatalf("重查 B 失败: %v", err)
	}
	if stored := rawB.GetString("id_card"); !strings.HasPrefix(stored, encPrefix) {
		t.Fatalf("B 的 id_card 应以 %q 前缀入库,得到 %q", encPrefix, stored)
	}
	time.Sleep(5 * time.Millisecond)
	a := saveTestPerson(t, app, "张", "三", nil) // A 侧身份证为空

	survivorID, err := app.commitMerge(app.pb, mergeRequest{
		Kind:      mergeKindPersons,
		EditingID: a.Id,
		OtherID:   b.Id,
		Fields:    map[string]any{"last_name": "张", "first_name": "三", "trust_level": float64(3)},
	})
	if err != nil {
		t.Fatalf("合并失败: %v", err)
	}
	if survivorID != b.Id {
		t.Fatalf("created 更早的 B 应被保留(%s),得到 %s", b.Id, survivorID)
	}

	rawSurvivor, err := app.pb.FindRecordById("persons", b.Id)
	if err != nil {
		t.Fatalf("重查保留者失败: %v", err)
	}
	stored := rawSurvivor.GetString("id_card")
	if !strings.HasPrefix(stored, encPrefix) {
		t.Errorf("保留者的 id_card 合并后仍应以 %q 前缀入库,得到 %q", encPrefix, stored)
	}
	if got := decryptIdCard(stored); got != idCard {
		t.Errorf("保留者 id_card 解密后应为 %q,得到 %q", idCard, got)
	}
}

// TestMergeRouteErrorMapping 内部错误不能把 SQL/驱动文本透给前端:
// 400 保留可读消息,其余错误记日志并返回通用中文错误。
func TestMergeRouteErrorMapping(t *testing.T) {
	app := newTestPimApp(t)
	// PocketBase 的 ApiError 会把消息规范成句子并补句号,断言前去掉
	messageOf := func(err error) string {
		var apiErr *router.ApiError
		if !errors.As(err, &apiErr) {
			t.Fatalf("应映射为 *router.ApiError,得到 %T", err)
		}
		return strings.TrimSuffix(apiErr.Message, ".")
	}

	bad := app.mergeRouteError(badMergeRequest("记录不存在"))
	var badAPI *router.ApiError
	if !errors.As(bad, &badAPI) {
		t.Fatalf("请求类错误应映射为 *router.ApiError,得到 %T", bad)
	}
	if badAPI.Status != http.StatusBadRequest {
		t.Errorf("请求类错误状态码应为 400,得到 %d", badAPI.Status)
	}
	if got := messageOf(bad); got != "记录不存在" {
		t.Errorf("请求类错误应保留原始消息,得到 %q", got)
	}

	internal := app.mergeRouteError(errors.New("SQLITE_BUSY: database is locked"))
	var internalAPI *router.ApiError
	if !errors.As(internal, &internalAPI) {
		t.Fatalf("内部错误应映射为 *router.ApiError,得到 %T", internal)
	}
	if internalAPI.Status != http.StatusInternalServerError {
		t.Errorf("内部错误状态码应为 500,得到 %d", internalAPI.Status)
	}
	if strings.Contains(internalAPI.Message, "SQLITE_BUSY") {
		t.Errorf("内部错误不应泄漏底层错误文本,得到 %q", internalAPI.Message)
	}
	if got := messageOf(internal); got != "合并失败,请稍后重试" {
		t.Errorf("内部错误应返回通用提示,得到 %q", got)
	}
}

// TestValidateMergeRequestNotFoundIsBadRequest 记录不存在是用户可理解的 400,
// 而不是数据库故障;消息要说明「记录不存在」。
func TestValidateMergeRequestNotFoundIsBadRequest(t *testing.T) {
	app := newTestPimApp(t)

	_, _, err := validateMergeRequest(app.pb, mergeRequest{
		Kind:      mergeKindPersons,
		EditingID: "aaaaaaaaaaaaaaa",
		OtherID:   "bbbbbbbbbbbbbbb",
	})
	var bad *mergeBadRequestError
	if !errors.As(err, &bad) {
		t.Fatalf("记录不存在应映射为请求错误,得到 %T(%v)", err, err)
	}
	if !strings.Contains(err.Error(), "记录不存在") {
		t.Errorf("错误消息应说明记录不存在,得到 %q", err.Error())
	}
}
