package main

import (
	"strings"
	"testing"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

// 32 字符的 AES-256 测试密钥
const testEncKey = "0123456789abcdef0123456789abcdef"

func TestEncryptIdCard_RoundTrip(t *testing.T) {
	t.Setenv("PIM_ENC_KEY", testEncKey)
	plain := "430101199001011234"
	enc := encryptIdCard(plain)
	if !strings.HasPrefix(enc, encPrefix) {
		t.Fatalf("密文应以 %q 开头,得到 %q", encPrefix, enc)
	}
	if got := decryptIdCard(enc); got != plain {
		t.Errorf("解密后应还原为 %q,得到 %q", plain, got)
	}
}

func TestEncryptIdCard_EmptyKeepsEmpty(t *testing.T) {
	t.Setenv("PIM_ENC_KEY", testEncKey)
	if got := encryptIdCard(""); got != "" {
		t.Errorf("空值应原样返回,得到 %q", got)
	}
}

func TestEncryptIdCard_AlreadyEncryptedIdempotent(t *testing.T) {
	t.Setenv("PIM_ENC_KEY", testEncKey)
	enc := encryptIdCard("430101199001011234")
	if got := encryptIdCard(enc); got != enc {
		t.Errorf("重复加密应保持原密文,得到 %q", got)
	}
}

func TestEncryptIdCard_NoKeyNoEncryption(t *testing.T) {
	t.Setenv("PIM_ENC_KEY", "")
	if got := encryptIdCard("430101199001011234"); got != "430101199001011234" {
		t.Errorf("密钥未设置时不应加密,得到 %q", got)
	}
}

func TestDecryptIdCard_PlaintextPassthrough(t *testing.T) {
	t.Setenv("PIM_ENC_KEY", testEncKey)
	if got := decryptIdCard("430101199001011234"); got != "430101199001011234" {
		t.Errorf("无前缀明文应原样返回,得到 %q", got)
	}
}

func TestDecryptIdCard_InvalidCiphertextKeepsRaw(t *testing.T) {
	t.Setenv("PIM_ENC_KEY", testEncKey)
	raw := encPrefix + "!!!not-base64!!!"
	if got := decryptIdCard(raw); got != raw {
		t.Errorf("无效密文应原样返回,得到 %q", got)
	}
}

func TestDecryptIdCard_WrongKeyKeepsRaw(t *testing.T) {
	t.Setenv("PIM_ENC_KEY", testEncKey)
	enc := encryptIdCard("430101199001011234")
	t.Setenv("PIM_ENC_KEY", "fedcba9876543210fedcba9876543210")
	if got := decryptIdCard(enc); got != enc {
		t.Errorf("密钥不匹配时应返回原密文,得到 %q", got)
	}
}

func TestDecryptIdCard_ShortBase64KeepsRaw(t *testing.T) {
	t.Setenv("PIM_ENC_KEY", testEncKey)
	raw := encPrefix + "YWJjZA==" // 解码后不足 GCM nonce(12 字节),不应 panic
	if got := decryptIdCard(raw); got != raw {
		t.Errorf("短密文应原样返回而不 panic,得到 %q", got)
	}
}

func TestNormalizeRelationPair_AlreadyCanonical(t *testing.T) {
	a, b := normalizeRelationPair("aaa111", "bbb222")
	if a != "aaa111" || b != "bbb222" {
		t.Errorf("已规范序不应交换,得到 %s / %s", a, b)
	}
}

func TestNormalizeRelationPair_Swaps(t *testing.T) {
	a, b := normalizeRelationPair("bbb222", "aaa111")
	if a != "aaa111" || b != "bbb222" {
		t.Errorf("应交换为规范序,得到 %s / %s", a, b)
	}
}

func TestValidateRating_Valid(t *testing.T) {
	for _, v := range []int{1, 2, 3, 4, 5} {
		if err := validateRating(v, "trust_level"); err != nil {
			t.Errorf("评级 %d 应通过,得到 %v", v, err)
		}
	}
}

func TestValidateRating_Invalid(t *testing.T) {
	for _, v := range []int{0, -1, 6, 99} {
		if err := validateRating(v, "trust_level"); err == nil {
			t.Errorf("评级 %d 应被拒绝", v)
		}
	}
}

// personSearchText 构造人员聚合检索列:姓名两形态(姓+名 / 名 空格 姓)
// + 昵称 + 单位名 + 职务,无分隔符直接拼接(宁多召回,接受跨字段交界误命中)。
// 手机号不进聚合列(检索侧单独分支);历史任职不参与(只取当前单位)。
func TestPersonSearchText(t *testing.T) {
	cases := []struct {
		name          string
		lastName      string
		firstName     string
		nickname      string
		orgName       string
		adminPosition string
		techTitle     string
		want          string
	}{
		{
			"全字段", "康", "勇", "老王", "南海航运", "局长", "高工",
			"康勇勇 康老王南海航运局长高工",
		},
		{"仅姓名", "康", "勇", "", "", "", "", "康勇勇 康"},
		{"空姓容忍", "", "勇", "", "", "", "", "勇勇 "},
	}
	for _, tt := range cases {
		got := personSearchText(tt.lastName, tt.firstName, tt.nickname, tt.orgName, tt.adminPosition, tt.techTitle)
		if got != tt.want {
			t.Errorf("personSearchText(%q,%q,%q,%q,%q,%q) = %q, want %q",
				tt.lastName, tt.firstName, tt.nickname, tt.orgName, tt.adminPosition, tt.techTitle, got, tt.want)
		}
	}
}

// newTestPimApp 创建带 organizations/persons/relations/events 集合与 PIM 钩子的测试应用实例。
// 集合只保留钩子与合并逻辑读写的最小字段(外加合并测试要用的 mobile/person_tags/gender)。
func newTestPimApp(t *testing.T) *application {
	t.Helper()
	app := &application{pb: pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: t.TempDir()})}
	// 必须显式 Bootstrap(NewWithConfig 不会初始化 DB/迁移/设置),否则首个 DB 操作 panic
	if err := app.pb.Bootstrap(); err != nil {
		t.Fatalf("初始化测试应用失败: %v", err)
	}
	// 测试结束时释放数据库连接:Windows 下 t.TempDir 清理
	// 删不掉仍被占用的 auxiliary.db,会让用例在断言全过后误报失败
	t.Cleanup(func() {
		if err := app.pb.ResetBootstrapState(); err != nil {
			t.Logf("释放测试应用数据库连接失败(可忽略残留锁警告): %v", err)
		}
	})
	app.setupPimHooks()

	orgs := core.NewBaseCollection("organizations")
	orgs.Fields.Add(
		&core.TextField{Name: "name", Required: true},
		&core.TextField{Name: "search_text"},
		&core.NumberField{Name: "importance_level"},
		// 组织合并的文本/URL 字段(类型、电话、邮箱、地址、备注、地图)
		&core.TextField{Name: "type"},
		&core.TextField{Name: "phone"},
		&core.TextField{Name: "email"},
		&core.TextField{Name: "address"},
		&core.TextField{Name: "notes"},
		&core.URLField{Name: "map"},
		// 组织级联重算人员聚合列时按 -created 排序,需要 autodate 字段
		&core.AutodateField{Name: "created", OnCreate: true},
		&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
	)
	if err := app.pb.Save(orgs); err != nil {
		t.Fatalf("创建 organizations 集合失败: %v", err)
	}

	persons := core.NewBaseCollection("persons")
	persons.Fields.Add(
		&core.TextField{Name: "last_name", Required: true},
		&core.TextField{Name: "first_name", Required: true},
		&core.TextField{Name: "search_text"},
		&core.TextField{Name: "nickname"},
		&core.RelationField{Name: "current_org_id", CollectionId: orgs.Id, MaxSelect: 1},
		&core.TextField{Name: "admin_position"},
		&core.TextField{Name: "tech_title"},
		&core.NumberField{Name: "trust_level"},
		// 后续合并任务的测试要读写以下字段
		&core.TextField{Name: "mobile"},
		&core.TextField{Name: "person_tags"},
		&core.TextField{Name: "id_card"},
		&core.SelectField{Name: "gender", MaxSelect: 1, Values: []string{"男", "女"}},
		&core.AutodateField{Name: "created", OnCreate: true},
		&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
	)
	if err := app.pb.Save(persons); err != nil {
		t.Fatalf("创建 persons 集合失败: %v", err)
	}

	// 合并集成测试需要的关系集合:person_a/person_b 指向 persons,
	// 与生产 schema 一致开启 cascadeDelete(删除人员时级联删除关系行),
	// 并加 (person_a, person_b) 唯一索引,覆盖「改指后重复对」的处理。
	relations := core.NewBaseCollection("relations")
	relations.Fields.Add(
		&core.RelationField{Name: "person_a", CollectionId: persons.Id, MaxSelect: 1, Required: true, CascadeDelete: true},
		&core.RelationField{Name: "person_b", CollectionId: persons.Id, MaxSelect: 1, Required: true, CascadeDelete: true},
		&core.TextField{Name: "relation_description", Required: true},
		&core.AutodateField{Name: "created", OnCreate: true},
		&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
	)
	relations.Indexes = append(relations.Indexes, "CREATE UNIQUE INDEX `idx_relations_ab` ON `relations` (`person_a`, `person_b`)")
	if err := app.pb.Save(relations); err != nil {
		t.Fatalf("创建 relations 集合失败: %v", err)
	}

	// 合并集成测试需要的事件集合:合并要把摘要里的 [[p:/o:id|label]] 改指到保留者。
	events := core.NewBaseCollection("events")
	events.Fields.Add(
		&core.DateField{Name: "happen_at", Required: true},
		&core.TextField{Name: "type"},
		&core.TextField{Name: "summary", Required: true},
		&core.AutodateField{Name: "created", OnCreate: true},
		&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
	)
	if err := app.pb.Save(events); err != nil {
		t.Fatalf("创建 events 集合失败: %v", err)
	}

	return app
}

// clearSearchText 直接改库把聚合列清空,模拟未回填的存量行;
// 绕过钩子是为了构造「需要回填」的初始状态而不触发保存逻辑。
func clearSearchText(t *testing.T, app *application, collection, id string) {
	t.Helper()
	if _, err := app.pb.DB().NewQuery("UPDATE " + collection + " SET search_text = '' WHERE id = {:id}").
		Bind(dbx.Params{"id": id}).Execute(); err != nil {
		t.Fatalf("清空 %s.search_text 失败: %v", collection, err)
	}
}

// TestSyncPersonSearchTextsContinuesAfterInvalidRow 回填遇到存量非法评级行(trust_level=0)
// 时只记录失败并继续,后续合法行必须被修复(此前会 return,后续行永远留空)。
func TestSyncPersonSearchTextsContinuesAfterInvalidRow(t *testing.T) {
	app := newTestPimApp(t)

	// 坏行先入库(FindAllRecords 按插入顺序返回),随后直接改库把评级置 0 并清空聚合列
	bad := saveTestPerson(t, app, "坏", "数据", nil)
	if _, err := app.pb.DB().NewQuery("UPDATE persons SET trust_level = 0, search_text = '' WHERE id = {:id}").
		Bind(dbx.Params{"id": bad.Id}).Execute(); err != nil {
		t.Fatalf("构造非法人员行失败: %v", err)
	}
	good := saveTestPerson(t, app, "好", "数据", nil)
	clearSearchText(t, app, "persons", good.Id)

	app.syncPersonSearchTexts(app.pb)

	reloadedBad, err := app.pb.FindRecordById("persons", bad.Id)
	if err != nil {
		t.Fatalf("重查非法行失败: %v", err)
	}
	if got := reloadedBad.GetString("search_text"); got != "" {
		t.Errorf("非法行保存应被钩子拒绝并保留空值,得到 %q", got)
	}
	reloadedGood, err := app.pb.FindRecordById("persons", good.Id)
	if err != nil {
		t.Fatalf("重查合法行失败: %v", err)
	}
	want := personSearchText("好", "数据", "", "", "", "")
	if got := reloadedGood.GetString("search_text"); got != want {
		t.Errorf("非法行之后的合法行应被回填为 %q,得到 %q(回填可能提前中止)", want, got)
	}
}

// TestSyncOrganizationSearchTextsContinuesAndSuppressesCascade 组织回填要:
//  1. 遇到存量非法 importance_level 行时继续处理后续行;
//  2. 回填期间的保存不触发组织改名级联(否则会重写整张 persons 表、刷新 updated);
//  3. 回填结束后级联恢复正常(flag 必须复位)。
func TestSyncOrganizationSearchTextsContinuesAndSuppressesCascade(t *testing.T) {
	app := newTestPimApp(t)

	bad := saveTestOrganization(t, app, "坏组织")
	good := saveTestOrganization(t, app, "好组织")
	person := saveTestPerson(t, app, "张", "三", map[string]any{"current_org_id": good.Id})
	before, err := app.pb.FindRecordById("persons", person.Id)
	if err != nil {
		t.Fatalf("重查人员失败: %v", err)
	}
	updatedBefore := before.GetDateTime("updated").Time()

	// 坏行:评级越界且聚合列为空;好行:只清空聚合列
	if _, err := app.pb.DB().NewQuery("UPDATE organizations SET importance_level = 0, search_text = '' WHERE id = {:id}").
		Bind(dbx.Params{"id": bad.Id}).Execute(); err != nil {
		t.Fatalf("构造非法组织行失败: %v", err)
	}
	clearSearchText(t, app, "organizations", good.Id)

	app.syncOrganizationSearchTexts(app.pb)

	reloadedBad, err := app.pb.FindRecordById("organizations", bad.Id)
	if err != nil {
		t.Fatalf("重查非法组织失败: %v", err)
	}
	if got := reloadedBad.GetString("search_text"); got != "" {
		t.Errorf("非法组织保存应被钩子拒绝并保留空值,得到 %q", got)
	}
	reloadedGood, err := app.pb.FindRecordById("organizations", good.Id)
	if err != nil {
		t.Fatalf("重查合法组织失败: %v", err)
	}
	if got := reloadedGood.GetString("search_text"); got != "好组织" {
		t.Errorf("非法行之后的合法组织应被回填为 %q,得到 %q(回填可能提前中止)", "好组织", got)
	}

	// 回填期间的组织保存不得级联重写人员表
	personAfter, err := app.pb.FindRecordById("persons", person.Id)
	if err != nil {
		t.Fatalf("回填后重查人员失败: %v", err)
	}
	if updatedAfter := personAfter.GetDateTime("updated").Time(); !updatedAfter.Equal(updatedBefore) {
		t.Errorf("回填期间不应级联保存人员:updated 从 %v 变为 %v", updatedBefore, updatedAfter)
	}

	// 回填结束后组织改名仍须级联重算人员聚合列(flag 已复位)
	reloadedGood.Set("name", "好组织改名")
	if err := app.pb.Save(reloadedGood); err != nil {
		t.Fatalf("回填结束后改组织名失败: %v", err)
	}
	personFinal, err := app.pb.FindRecordById("persons", person.Id)
	if err != nil {
		t.Fatalf("改名后重查人员失败: %v", err)
	}
	if got := personFinal.GetString("search_text"); !strings.Contains(got, "好组织改名") {
		t.Errorf("回填结束后组织改名应级联重算人员聚合列,得到 %q", got)
	}
}

// TestOrganizationSearchTextHook 组织创建/改名后 search_text 应自动写入 trim 后的名称。
func TestOrganizationSearchTextHook(t *testing.T) {
	app := newTestPimApp(t)

	col, err := app.pb.FindCollectionByNameOrId("organizations")
	if err != nil {
		t.Fatalf("查找 organizations 集合失败: %v", err)
	}
	org := core.NewRecord(col)
	org.Set("name", "  甲公司  ")
	org.Set("importance_level", 3)
	if err := app.pb.Save(org); err != nil {
		t.Fatal(err)
	}
	if got := org.GetString("search_text"); got != "甲公司" {
		t.Fatalf("期望 甲公司,得到 %q", got)
	}

	org.Set("name", "乙公司")
	if err := app.pb.Save(org); err != nil {
		t.Fatal(err)
	}
	if got := org.GetString("search_text"); got != "乙公司" {
		t.Fatalf("期望 乙公司,得到 %q", got)
	}
}

// TestPersonSearchTextUsesSameTransaction 人员钩子必须用事件提供的 App 读写,
// 才能读到同一事务里刚改的组织名(合并接口依赖这一点)。
func TestPersonSearchTextUsesSameTransaction(t *testing.T) {
	app := newTestPimApp(t)

	orgCol, err := app.pb.FindCollectionByNameOrId("organizations")
	if err != nil {
		t.Fatalf("查找 organizations 集合失败: %v", err)
	}
	org := core.NewRecord(orgCol)
	org.Set("name", "甲")
	org.Set("importance_level", 3)
	if err := app.pb.Save(org); err != nil {
		t.Fatalf("保存组织失败: %v", err)
	}

	personCol, err := app.pb.FindCollectionByNameOrId("persons")
	if err != nil {
		t.Fatalf("查找 persons 集合失败: %v", err)
	}
	person := core.NewRecord(personCol)
	person.Set("last_name", "张")
	person.Set("first_name", "三")
	person.Set("trust_level", 3)
	person.Set("current_org_id", org.Id)
	if err := app.pb.Save(person); err != nil {
		t.Fatalf("保存人员失败: %v", err)
	}

	if err := app.pb.RunInTransaction(func(tx core.App) error {
		org.Set("name", "乙")
		if err := tx.Save(org); err != nil {
			return err
		}

		person.Set("current_org_id", org.Id)
		if err := tx.Save(person); err != nil {
			return err
		}

		if !strings.Contains(person.GetString("search_text"), "乙") {
			t.Fatalf("事务内应读到新组织名,得到 %q", person.GetString("search_text"))
		}
		return nil
	}); err != nil {
		t.Fatalf("事务执行失败: %v", err)
	}
}
