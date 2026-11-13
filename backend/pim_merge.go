package main

import (
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// mergeKind 标识参与合并的 PIM 集合。
type mergeKind string

const (
	mergeKindPersons       mergeKind = "persons"
	mergeKindOrganizations mergeKind = "organizations"
)

// mergeRule 是单字段合并规则(见设计 §6.1)。
type mergeRule int

const (
	ruleSame   mergeRule = iota // 身份列:永远取 A 的写法,不拼接
	ruleText                    // 文本:一侧为空取另一侧,不同则 A,B 拼接
	ruleTag                     // 标签集合:按元素去重后拼接
	rulePick                    // 单值:优先 A,为空取 B
	ruleNumber                  // 数字单值:优先 A,0 视为未设置
)

// fieldSpec 描述一个参与合并的字段及其规则。
type fieldSpec struct {
	name string
	rule mergeRule
}

// personMergeFieldSpecs 是联系人合并的字段白名单与顺序(前端预览按此顺序渲染)。
var personMergeFieldSpecs = []fieldSpec{
	{"last_name", ruleSame},
	{"first_name", ruleSame},
	{"nickname", ruleText},
	{"gender", rulePick},
	{"birthday", rulePick},
	{"id_card", rulePick},
	{"ethnicity", ruleText},
	{"blood_type", rulePick},
	{"zodiac", ruleText},
	{"native_place", ruleText},
	{"birth_place", ruleText},
	{"political_status", ruleText},
	{"person_tags", ruleTag},
	{"social_tags", ruleTag},
	{"current_org_id", rulePick},
	{"admin_position", ruleText},
	{"tech_title", ruleText},
	{"legal_info", ruleText},
	{"mobile", ruleText},
	{"office_phone", ruleText},
	{"email", ruleText},
	{"office_address", ruleText},
	{"home_address", ruleText},
	{"trust_level", ruleNumber},
	{"interests", ruleText},
	{"children_info", ruleText},
	{"taboo", ruleText},
	{"concern", ruleText},
	{"graduate_school", ruleText},
	{"degree", rulePick},
	{"major", ruleText},
	{"continuing_edu", ruleText},
}

// organizationMergeFieldSpecs 是组织合并的字段白名单与顺序。
var organizationMergeFieldSpecs = []fieldSpec{
	{"name", ruleSame},
	{"type", ruleText},
	{"importance_level", ruleNumber},
	{"phone", ruleText},
	{"email", ruleText},
	{"map", rulePick},
	{"address", ruleText},
	{"notes", ruleText},
}

// mergeText 按文本规则合并:A 侧在前;一侧为空取另一侧,相同只留一份,
// 不同则用半角逗号拼接。不做 trim,避免改写用户录入。
func mergeText(a, b string) string {
	switch {
	case a == "":
		return b
	case b == "":
		return a
	case a == b:
		return a
	default:
		return a + "," + b
	}
}

// splitTagList 按半角逗号拆分标签,去掉首尾空白与空项(不负责去重)。
func splitTagList(value string) []string {
	raw := strings.Split(value, ",")
	parts := make([]string, 0, len(raw))
	for _, part := range raw {
		if part = strings.TrimSpace(part); part != "" {
			parts = append(parts, part)
		}
	}
	return parts
}

// mergeTagText 把两侧标签按出现顺序去重后拼接(A 的元素在前、B 在后),
// 避免同一标签出现两次导致标签池计数翻倍。
func mergeTagText(a, b string) string {
	seen := make(map[string]struct{})
	merged := make([]string, 0)
	for _, value := range []string{a, b} {
		for _, tag := range splitTagList(value) {
			if _, ok := seen[tag]; ok {
				continue
			}
			seen[tag] = struct{}{}
			merged = append(merged, tag)
		}
	}
	return strings.Join(merged, ",")
}

// samePersonName 判断两种录入边界下的姓名是否为同一人:
// 「姓+名」拼接形态相等,或「名 空格 姓」形态相等。
// 与前端合并资格(merge-eligibility.ts)同口径:四个姓名部件都必须非空——
// 后端合并请求本来就拒绝缺姓/名,前端不应为这类记录提供合并入口。
func samePersonName(aLast, aFirst, bLast, bFirst string) bool {
	if aLast == "" || aFirst == "" || bLast == "" || bFirst == "" {
		return false
	}
	return aLast+aFirst == bLast+bFirst || aFirst+" "+aLast == bFirst+" "+bLast
}

// sameOrganizationName 判断组织名称是否为同一:去首尾空白后相等,且 A 侧非空。
func sameOrganizationName(a, b string) bool {
	a = strings.TrimSpace(a)
	return a != "" && a == strings.TrimSpace(b)
}

// chooseSurvivor 按创建时间选保留者:更早的那条保留;时间相同时保留正在编辑的记录。
func chooseSurvivor(aCreated, bCreated time.Time, editingID, otherID string) (survivorID string, survivorIsEditing bool) {
	switch {
	case aCreated.Before(bCreated):
		return editingID, true
	case bCreated.Before(aCreated):
		return otherID, false
	default:
		return editingID, true
	}
}

// eventTokenPattern 匹配事件摘要中的人/组织 token:[[p:<15 位 id>|label]] 或 [[o:...]]。
var eventTokenPattern = regexp.MustCompile(`\[\[(p|o):([a-z0-9]{15})\|([^\]]*)\]\]`)

// rewriteEventSummary 只把匹配 kind 且 id == oldID 的 token 换成 newID,
// 保留原 label 与每一次出现:删 token 会截断用户叙述,同一人出现两次是合并前的事实。
func rewriteEventSummary(summary, kind, oldID, newID string) string {
	return eventTokenPattern.ReplaceAllStringFunc(summary, func(token string) string {
		m := eventTokenPattern.FindStringSubmatch(token)
		if m[1] != kind || m[2] != oldID {
			return token
		}
		return "[[" + kind + ":" + newID + "|" + m[3] + "]]"
	})
}

// formString 从 A 侧表单值取字符串;缺失或为 nil 时返回空串。
func formString(fields map[string]any, key string) string {
	value, ok := fields[key]
	if !ok || value == nil {
		return ""
	}
	if text, ok := value.(string); ok {
		return text
	}
	return fmt.Sprint(value)
}

// formInt 从 A 侧表单值取整数;兼容 JSON 数字解码出的 float64 与数字字符串。
func formInt(fields map[string]any, key string) int {
	value, ok := fields[key]
	if !ok || value == nil {
		return 0
	}
	switch v := value.(type) {
	case int:
		return v
	case float64:
		return int(v)
	case string:
		if i, err := strconv.Atoi(strings.TrimSpace(v)); err == nil {
			return i
		}
	}
	return 0
}

// displayField 把字段原始值转成预览展示串:日期只取 yyyy-MM-dd。
func displayField(name, value string) string {
	if name == "birthday" && len(value) > 10 {
		return value[:10]
	}
	return value
}

// displayNumber 把数字字段转成展示串;0 表示未设置,展示为空。
func displayNumber(value int) string {
	if value == 0 {
		return ""
	}
	return strconv.Itoa(value)
}

// displayOrg 把 current_org_id 解析为组织名称;id 非空但查不到(已被删除)时给出提示串。
func displayOrg(base core.App, id string) string {
	if id == "" {
		return ""
	}
	org, err := base.FindRecordById("organizations", id)
	if err != nil {
		return "（已删除）"
	}
	return org.GetString("name")
}

// mergedField 是一个字段的合并结果:value 为落库值,其余为预览展示值。
type mergedField struct {
	key           string
	value         any
	aDisplay      string
	bDisplay      string
	resultDisplay string
	rule          string
}

// mergeRuleName 给出预览用的规则标签(按结果判定):两边展示相等或身份列 → same;
// A 空 → pick-b;B 空 → pick-a;文本 → concat;标签 → tag;单值/数字 → pick-a。
func mergeRuleName(rule mergeRule, aDisplay, bDisplay string) string {
	switch {
	case rule == ruleSame || aDisplay == bDisplay:
		return "same"
	case aDisplay == "":
		return "pick-b"
	case bDisplay == "":
		return "pick-a"
	case rule == ruleText:
		return "concat"
	case rule == ruleTag:
		return "tag"
	default:
		return "pick-a"
	}
}

// mergeFieldSpecs 返回指定集合的字段白名单;未知类型返回错误。
func mergeFieldSpecs(kind mergeKind) ([]fieldSpec, error) {
	switch kind {
	case mergeKindPersons:
		return personMergeFieldSpecs, nil
	case mergeKindOrganizations:
		return organizationMergeFieldSpecs, nil
	default:
		return nil, fmt.Errorf("未知的合并类型: %q", kind)
	}
}

// mergeRecord 按字段规则合成 A 侧表单值与 B 侧数据库记录,返回逐字段结果。
// A 是正在编辑的请求值,B 是对方记录;B 集合缺少某字段时按空值处理(测试用小集合)。
func mergeRecord(base core.App, kind mergeKind, aFields map[string]any, b *core.Record) ([]mergedField, error) {
	specs, err := mergeFieldSpecs(kind)
	if err != nil {
		return nil, err
	}

	merged := make([]mergedField, 0, len(specs))
	for _, spec := range specs {
		merged = append(merged, mergeField(base, kind, spec, aFields, b))
	}
	return merged, nil
}

// mergeField 按单字段规则合成 A/B 值并生成预览展示串。
func mergeField(base core.App, kind mergeKind, spec fieldSpec, aFields map[string]any, b *core.Record) mergedField {
	if spec.rule == ruleNumber {
		a := formInt(aFields, spec.name)
		bValue := b.GetInt(spec.name)
		value := a
		if a == 0 {
			value = bValue
		}
		field := mergedField{
			key:           spec.name,
			value:         value,
			aDisplay:      displayNumber(a),
			bDisplay:      displayNumber(bValue),
			resultDisplay: displayNumber(value),
		}
		field.rule = mergeRuleName(spec.rule, field.aDisplay, field.bDisplay)
		return field
	}

	a := formString(aFields, spec.name)
	bValue := b.GetString(spec.name)
	if spec.name == "id_card" {
		bValue = decryptIdCard(bValue)
	}
	display := func(value string) string {
		if spec.name == "current_org_id" {
			return displayOrg(base, value)
		}
		return displayField(spec.name, value)
	}

	field := mergedField{
		key:      spec.name,
		aDisplay: display(a),
		bDisplay: display(bValue),
	}
	switch spec.rule {
	case ruleText:
		field.value = mergeText(a, bValue)
	case ruleTag:
		field.value = mergeTagText(a, bValue)
	case ruleSame:
		field.value = a
		if kind == mergeKindOrganizations {
			field.value = strings.TrimSpace(a)
		}
	default: // rulePick
		field.value = a
		if a == "" {
			field.value = bValue
		}
	}

	switch value := field.value.(type) {
	case int:
		field.resultDisplay = displayNumber(value)
	case string:
		field.resultDisplay = display(value)
	}
	field.rule = mergeRuleName(spec.rule, field.aDisplay, field.bDisplay)
	return field
}

// ---- 合并预览与事务接口 ----

// mergeRequest 是两个合并接口共用的请求体。
// Fields 是 A 侧(正在编辑的表单)当前值,只按字段白名单读取,
// search_text/created/updated/id 等系统列一律忽略。
type mergeRequest struct {
	Kind      mergeKind      `json:"kind"`
	EditingID string         `json:"editingId"`
	OtherID   string         `json:"otherId"`
	Fields    map[string]any `json:"fields"`
}

// mergeFieldPreview 是预览中的一行字段结果;展示值均为字符串。
type mergeFieldPreview struct {
	Key    string `json:"key"`
	A      string `json:"a"`
	B      string `json:"b"`
	Result string `json:"result"`
	Rule   string `json:"rule"`
}

// mergePreview 是 POST /api/pim/merge/preview 的响应体。
type mergePreview struct {
	Kind              mergeKind `json:"kind"`
	SurvivorID        string    `json:"survivorId"`
	SurvivorIsEditing bool      `json:"survivorIsEditing"`
	DeletedID         string    `json:"deletedId"`
	// 创建时间(RFC3339)供前端在对话框里展示「保留哪条(创建时间)、删除哪条」
	SurvivorCreated string              `json:"survivorCreated"`
	DeletedCreated  string              `json:"deletedCreated"`
	Fields          []mergeFieldPreview `json:"fields"`
}

// mergeCommitResponse 是 POST /api/pim/merge 的响应体。
type mergeCommitResponse struct {
	SurvivorID string `json:"survivorId"`
}

// mergeBadRequestError 表示请求本身不可用(kind/id/记录/姓名不合法),
// 路由层把它映射为 400;其余错误(数据库故障等)按 500 返回。
type mergeBadRequestError struct {
	message string
}

func (e *mergeBadRequestError) Error() string {
	return e.message
}

// badMergeRequest 构造带中文说明的请求错误。
func badMergeRequest(format string, args ...any) error {
	return &mergeBadRequestError{message: fmt.Sprintf(format, args...)}
}

// mergeIDPattern 匹配 PocketBase 默认的 15 位记录 ID。
var mergeIDPattern = regexp.MustCompile(`^[a-z0-9]{15}$`)

// mergeCollection 返回合并 kind 对应的集合名。
func mergeCollection(kind mergeKind) string {
	if kind == mergeKindOrganizations {
		return "organizations"
	}
	return "persons"
}

// validateMergeRequest 校验 kind、两个 id、记录存在与姓名/名称相等,
// 返回编辑侧(A)与对方(B)记录。
// 姓名的「相等」取 A 的请求值(用户可能刚改名还没保存)与 B 的数据库值比较;
// A 的数据库旧值只用于比较 created 定保留者。
func validateMergeRequest(base core.App, req mergeRequest) (*core.Record, *core.Record, error) {
	if _, err := mergeFieldSpecs(req.Kind); err != nil {
		return nil, nil, badMergeRequest("%v", err)
	}
	if req.EditingID == "" || req.OtherID == "" {
		return nil, nil, badMergeRequest("editingId 与 otherId 不能为空")
	}
	if req.EditingID == req.OtherID {
		return nil, nil, badMergeRequest("editingId 与 otherId 不能相同")
	}
	if !mergeIDPattern.MatchString(req.EditingID) || !mergeIDPattern.MatchString(req.OtherID) {
		return nil, nil, badMergeRequest("editingId 与 otherId 必须是 15 位记录 ID")
	}

	collection := mergeCollection(req.Kind)
	editing, err := base.FindRecordById(collection, req.EditingID)
	if err != nil {
		// 记录不存在是用户可理解的请求错误;其余(连接/查询故障)按内部错误上抛,
		// 不能把一次数据库故障报成「记录不存在」。
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil, badMergeRequest("记录不存在:找不到正在编辑的记录(%s)", req.EditingID)
		}
		return nil, nil, fmt.Errorf("加载正在编辑的记录失败(%s): %w", req.EditingID, err)
	}
	other, err := base.FindRecordById(collection, req.OtherID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil, badMergeRequest("记录不存在:找不到要合并的记录(%s)", req.OtherID)
		}
		return nil, nil, fmt.Errorf("加载要合并的记录失败(%s): %w", req.OtherID, err)
	}

	switch req.Kind {
	case mergeKindPersons:
		aLast := formString(req.Fields, "last_name")
		aFirst := formString(req.Fields, "first_name")
		// 身份列取 A 的写法;缺姓名时拒绝,避免把姓名(唯一身份列)清空。
		if aLast == "" || aFirst == "" {
			return nil, nil, badMergeRequest("合并请求缺少姓名")
		}
		if !samePersonName(aLast, aFirst, other.GetString("last_name"), other.GetString("first_name")) {
			return nil, nil, badMergeRequest("两条联系人的姓名不一致,不能合并")
		}
	case mergeKindOrganizations:
		aName := formString(req.Fields, "name")
		if strings.TrimSpace(aName) == "" {
			return nil, nil, badMergeRequest("合并请求缺少组织名称")
		}
		if !sameOrganizationName(aName, other.GetString("name")) {
			return nil, nil, badMergeRequest("两条组织的名称不一致,不能合并")
		}
	}

	return editing, other, nil
}

// createdTimestamp 把记录的 created 转成 RFC3339 字符串供前端格式化展示;
// 记录缺失 created(零值)时返回空串,前端按空值降级。
func createdTimestamp(record *core.Record) string {
	created := record.GetDateTime("created")
	if created.IsZero() {
		return ""
	}
	return created.Time().UTC().Format(time.RFC3339)
}

// mergeSurvivor 按 created 选出保留者与被删者,并返回两者记录。
func mergeSurvivor(editing, other *core.Record) (survivor, loser *core.Record) {
	_, survivorIsEditing := chooseSurvivor(
		editing.GetDateTime("created").Time(),
		other.GetDateTime("created").Time(),
		editing.Id,
		other.Id,
	)
	if survivorIsEditing {
		return editing, other
	}
	return other, editing
}

// buildMergePreview 计算保留者与逐字段结果,不落库(与提交共用同一套规则)。
func (app *application) buildMergePreview(base core.App, req mergeRequest) (mergePreview, error) {
	editing, other, err := validateMergeRequest(base, req)
	if err != nil {
		return mergePreview{}, err
	}

	survivor, loser := mergeSurvivor(editing, other)

	merged, err := mergeRecord(base, req.Kind, req.Fields, other)
	if err != nil {
		return mergePreview{}, err
	}

	fields := make([]mergeFieldPreview, 0, len(merged))
	for _, field := range merged {
		fields = append(fields, mergeFieldPreview{
			Key:    field.key,
			A:      field.aDisplay,
			B:      field.bDisplay,
			Result: field.resultDisplay,
			Rule:   field.rule,
		})
	}

	return mergePreview{
		Kind:              req.Kind,
		SurvivorID:        survivor.Id,
		SurvivorIsEditing: survivor.Id == editing.Id,
		DeletedID:         loser.Id,
		SurvivorCreated:   createdTimestamp(survivor),
		DeletedCreated:    createdTimestamp(loser),
		Fields:            fields,
	}, nil
}

// commitMerge 在事务内预演合并并落库,返回保留者 id。
// 顺序:事务内加载校验 → 定保留者/被删者 → 合成字段 → 改指引用 → 保存保留者 → 删除被删者。
// 引用改写必须早于删除:relations 的 person_a/person_b 开启级联删除,
// 删人员时若仍被引用会连带删掉关系行。
func (app *application) commitMerge(base core.App, req mergeRequest) (string, error) {
	survivorID := ""
	err := base.RunInTransaction(func(tx core.App) error {
		editing, other, err := validateMergeRequest(tx, req)
		if err != nil {
			return err
		}

		survivor, loser := mergeSurvivor(editing, other)

		merged, err := mergeRecord(tx, req.Kind, req.Fields, other)
		if err != nil {
			return err
		}

		switch req.Kind {
		case mergeKindPersons:
			if err := rewriteRelations(tx, survivor.Id, loser.Id); err != nil {
				return err
			}
			if err := rewriteEventTokens(tx, "p", loser.Id, survivor.Id); err != nil {
				return err
			}
		case mergeKindOrganizations:
			// 逐条 Save 触发 persons 钩子重算 search_text(单位名可能变化)
			if err := repointPersons(tx, survivor.Id, loser.Id); err != nil {
				return err
			}
			if err := rewriteEventTokens(tx, "o", loser.Id, survivor.Id); err != nil {
				return err
			}
		}

		// 只 Set 集合里真实存在的字段(测试/旧库的最小集合可能缺字段)
		applyMergedFields(survivor, merged)
		if err := tx.Save(survivor); err != nil {
			return err
		}
		if err := tx.Delete(loser); err != nil {
			return err
		}

		survivorID = survivor.Id
		return nil
	})
	if err != nil {
		return "", err
	}
	return survivorID, nil
}

// rewriteRelations 把被删者(loserID)的所有关系改指到保留者(survivorID):
//   - 改指后成为自关系(对方就是保留者,或本来是被删者的自关系)的行直接删除;
//   - 若 (保留者, 对方) 关系行已存在,把描述按「已存在行在前、被吸收行在后」
//     拼接进已存在行,再删除被吸收行(唯一索引不允许出现第二条);
//   - 其余行把 loserID 换成 survivorID 并规范化顺序。
func rewriteRelations(base core.App, survivorID, loserID string) error {
	rows, err := base.FindRecordsByFilter(
		"relations", "person_a = {:id} || person_b = {:id}", "", 0, 0, dbx.Params{"id": loserID},
	)
	if err != nil {
		return err
	}

	for _, row := range rows {
		other := row.GetString("person_a")
		if other == loserID {
			other = row.GetString("person_b")
		}

		// 改指后自己连自己(含原本就是被删者自关系的脏行):直接删除
		if other == survivorID || other == loserID {
			if err := base.Delete(row); err != nil {
				return err
			}
			continue
		}

		newA, newB := normalizeRelationPair(survivorID, other)
		existing, err := base.FindFirstRecordByFilter(
			"relations", "person_a = {:a} && person_b = {:b}", dbx.Params{"a": newA, "b": newB},
		)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}

		if existing != nil {
			existing.Set("relation_description", mergeText(
				existing.GetString("relation_description"),
				row.GetString("relation_description"),
			))
			if err := base.Save(existing); err != nil {
				return err
			}
			if err := base.Delete(row); err != nil {
				return err
			}
			continue
		}

		row.Set("person_a", newA)
		row.Set("person_b", newB)
		if err := base.Save(row); err != nil {
			return err
		}
	}

	return nil
}

// rewriteEventTokens 把事件摘要里的 [[kind:oldID|label]] 全部改指 newID,
// 保留原 label 与每一次出现;摘要无变化时不写库(避免无谓刷新 updated)。
func rewriteEventTokens(base core.App, kind, oldID, newID string) error {
	events, err := base.FindRecordsByFilter(
		"events", "summary ~ {:needle}", "", 0, 0,
		dbx.Params{"needle": "[[" + kind + ":" + oldID + "|"},
	)
	if err != nil {
		return err
	}

	for _, event := range events {
		summary := event.GetString("summary")
		rewritten := rewriteEventSummary(summary, kind, oldID, newID)
		if rewritten == summary {
			continue
		}
		event.Set("summary", rewritten)
		if err := base.Save(event); err != nil {
			return err
		}
	}

	return nil
}

// repointPersons 把 current_org_id 指向被删组织的人员改为指向保留者。
// 逐条 Save(而非批量 SQL)是为了触发 persons 钩子重算 search_text。
func repointPersons(base core.App, survivorID, loserID string) error {
	persons, err := base.FindRecordsByFilter(
		"persons", "current_org_id = {:id}", "", 0, 0, dbx.Params{"id": loserID},
	)
	if err != nil {
		return err
	}

	for _, person := range persons {
		person.Set("current_org_id", survivorID)
		if err := base.Save(person); err != nil {
			return err
		}
	}

	return nil
}

// applyMergedFields 把合并结果 Set 到保留者记录上;集合没有的字段跳过
// (最小测试集合或未导入新 schema 的旧库)。
func applyMergedFields(record *core.Record, merged []mergedField) {
	for _, field := range merged {
		if record.Collection().Fields.GetByName(field.key) == nil {
			continue
		}
		record.Set(field.key, field.value)
	}
}

// bindMergeRequest 解析两个合并接口共用的请求体。
func bindMergeRequest(re *core.RequestEvent) (mergeRequest, error) {
	var req mergeRequest
	if err := re.BindBody(&req); err != nil {
		return mergeRequest{}, apis.NewBadRequestError("请求体解析失败: "+err.Error(), nil)
	}
	return req, nil
}

// mergeRouteError 把内部错误映射为 HTTP 响应:请求类错误 400,其余 500。
// 500 只返回通用中文提示,真实错误(可能含 SQL/驱动文本)写入服务端日志。
func (app *application) mergeRouteError(err error) error {
	var bad *mergeBadRequestError
	if errors.As(err, &bad) {
		return apis.NewBadRequestError(bad.message, nil)
	}
	app.pb.Logger().Error("合并接口内部错误", "error", err.Error())
	return apis.NewInternalServerError("合并失败,请稍后重试", nil)
}

// setupPimMergeRoutes 注册合并接口:
//  1. POST /api/pim/merge/preview —— 只读预览(保留者、逐字段结果);
//  2. POST /api/pim/merge —— 事务内执行合并,返回保留者 id。
//
// 权限与 PIM 现有集合规则一致:不要求登录态(现有 API 本就可公开增删改)。
func (app *application) setupPimMergeRoutes() {
	app.pb.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.POST("/api/pim/merge/preview", func(re *core.RequestEvent) error {
			req, err := bindMergeRequest(re)
			if err != nil {
				return err
			}
			preview, err := app.buildMergePreview(re.App, req)
			if err != nil {
				return app.mergeRouteError(err)
			}
			return re.JSON(http.StatusOK, preview)
		})

		se.Router.POST("/api/pim/merge", func(re *core.RequestEvent) error {
			req, err := bindMergeRequest(re)
			if err != nil {
				return err
			}
			survivorID, err := app.commitMerge(re.App, req)
			if err != nil {
				return app.mergeRouteError(err)
			}
			return re.JSON(http.StatusOK, mergeCommitResponse{SurvivorID: survivorID})
		})

		return se.Next()
	})
}
