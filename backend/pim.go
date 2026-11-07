package main

import (
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/security"
)

// encPrefix 是密文的前缀标记,用于加解密幂等判断(已加密的值不再重复加密)。
const encPrefix = "enc:"

// pimEncryptionKey 返回 PIM_ENC_KEY 环境变量的值(须为 32 字符的 AES-256 密钥)。
// 未设置时返回空字符串,表示不加密。
func pimEncryptionKey() string {
	return os.Getenv("PIM_ENC_KEY")
}

// encryptIdCard 对身份证号执行 AES-256-GCM 加密:
//   - 值为空或已带 enc: 前缀时原样返回(幂等);
//   - 密钥未设置时原样返回(不加密,setupPimHooks 启动时有警告日志);
//   - 加密成功返回 "enc:" + base64 密文;加密失败时原样返回并记录日志。
func encryptIdCard(value string) string {
	if value == "" || strings.HasPrefix(value, encPrefix) {
		return value
	}

	key := pimEncryptionKey()
	if key == "" {
		return value
	}

	encrypted, err := security.Encrypt([]byte(value), key)
	if err != nil {
		log.Printf("警告:persons.id_card 加密失败(该值以明文入库):%v", err)
		return value
	}

	return encPrefix + encrypted
}

// decryptIdCard 解密带 enc: 前缀的密文;
// 空值、无前缀值、密钥缺失或解密失败时原样返回(容忍历史明文与脏数据)。
func decryptIdCard(value string) string {
	if value == "" || !strings.HasPrefix(value, encPrefix) {
		return value
	}

	key := pimEncryptionKey()
	if key == "" {
		return value
	}

	cipherText := strings.TrimPrefix(value, encPrefix)
	// 密文过短(不足 12 字节 GCM nonce 的 base64 长度)时无法解密,原样返回,
	// 避免 security.Decrypt 内部切片越界 panic
	if len(cipherText) < 16 {
		return value
	}

	decrypted, err := security.Decrypt(cipherText, key)
	if err != nil {
		return value
	}

	return string(decrypted)
}

// normalizeRelationPair 返回规范有序的两个人 id(person_a 为较小者)。
func normalizeRelationPair(a, b string) (string, string) {
	if a > b {
		return b, a
	}
	return a, b
}

// personSearchText 构造人员聚合检索列:姓名两形态(姓+名 / 名+空格+姓)
// + 昵称 + 单位名 + 职务。无分隔符直接拼接(宁多召回,接受跨字段交界误命中),
// 字段留空即跳过。手机号不进聚合列(检索侧单独分支);历史任职不参与(只取当前单位)。
// 单位名经 resolveOrgName 取自已提交的组织行:组织改名级联挂在提交后钩子,
// 保证重算关联人员时读到的已是新单位名。
func personSearchText(lastName, firstName, nickname, orgName, adminPosition, techTitle string) string {
	return lastName + firstName +
		firstName + " " + lastName +
		nickname + orgName + adminPosition + techTitle
}

// resolveOrgName 解析当前任职单位的名称(id 为空或查不到时返回空串)。
func (app *application) resolveOrgName(currentOrgID string) string {
	if currentOrgID == "" {
		return ""
	}
	org, err := app.pb.FindRecordById("organizations", currentOrgID)
	if err != nil {
		return "" // 单位被并发删除等异常:单位名留空,不阻断保存
	}
	return org.GetString("name")
}

// syncPersonSearchText 按聚合口径重算并覆盖 search_text(所有写路径共用),
// 返回算出的值供回填做幂等比对。
func (app *application) syncPersonSearchText(record *core.Record) string {
	want := personSearchText(
		record.GetString("last_name"),
		record.GetString("first_name"),
		record.GetString("nickname"),
		app.resolveOrgName(record.GetString("current_org_id")),
		record.GetString("admin_position"),
		record.GetString("tech_title"),
	)
	record.Set("search_text", want)
	return want
}

// syncPersonSearchTexts 全量回填存量数据的聚合检索列(幂等,跳过已正确的值)。
// 先用 filter 探测字段存在:老库未导入新 schema 时 search_text 是未知字段,
// 直接查会报错;此时打警告并跳过,避免对未知字段盲 Save 触发无谓更新。
func (app *application) syncPersonSearchTexts() {
	if _, err := app.pb.FindRecordsByFilter("persons", "search_text != ''", "", 1, 1); err != nil {
		log.Printf("提示:persons 集合缺少 search_text 字段,聚合检索未启用;请先在管理后台导入最新 pb_schema.json:%v", err)
		return
	}
	records, err := app.pb.FindAllRecords("persons")
	if err != nil {
		log.Printf("persons 聚合列回填查询失败:%v", err)
		return
	}
	// 先比对再 Set:算出值与现值相同时一个 Set 都不发,重复启动零写入、不污染 updated。
	for _, rec := range records {
		want := personSearchText(
			rec.GetString("last_name"),
			rec.GetString("first_name"),
			rec.GetString("nickname"),
			app.resolveOrgName(rec.GetString("current_org_id")),
			rec.GetString("admin_position"),
			rec.GetString("tech_title"),
		)
		if rec.GetString("search_text") == want {
			continue
		}
		rec.Set("search_text", want)
		if err := app.pb.Save(rec); err != nil {
			log.Printf("persons 聚合列回填保存失败(id=%s):%v", rec.Id, err)
			return
		}
	}
}

// validateRating 校验 1-5 评级值;0(未设置)与越界值均视为无效。
func validateRating(v int, fieldName string) error {
	if v < 1 || v > 5 {
		return fmt.Errorf("%s 必须为 1-5 的整数(当前值: %d)", fieldName, v)
	}
	return nil
}

// setupPimHooks 注册 PIM 数据层的钩子:
//  1. persons 记录保存前对 id_card 加密,并重算聚合检索列 search_text
//     (OnModelCreate/OnModelUpdate 在校验前触发);
//  2. persons 记录响应序列化前对 id_card 解密(OnRecordEnrich,覆盖列表/详情/expand/管理后台);
//  3. 删除组织前,将引用该组织的 persons.current_org_id 置空
//     (替代 SQL 的 ON DELETE SET NULL;0.39.4 的 relation 字段无该语义,
//     cascadeDelete=false 会留下悬空 id);
//  4. 组织改名时在提交后钩子(OnModelAfterUpdateSuccess)级联重算关联人员的
//     search_text(保证读到新单位名);删除组织时在置空归属后立即重算;
//     服务启动时全量回填存量数据的 search_text。
func (app *application) setupPimHooks() {
	app.pb.OnModelCreate("persons").BindFunc(func(e *core.ModelEvent) error {
		record := e.Model.(*core.Record)
		if err := validateRating(record.GetInt("trust_level"), "trust_level"); err != nil {
			return err
		}
		record.Set("id_card", encryptIdCard(record.GetString("id_card")))
		app.syncPersonSearchText(record)
		return e.Next()
	})

	app.pb.OnModelUpdate("persons").BindFunc(func(e *core.ModelEvent) error {
		record := e.Model.(*core.Record)
		if err := validateRating(record.GetInt("trust_level"), "trust_level"); err != nil {
			return err
		}
		record.Set("id_card", encryptIdCard(record.GetString("id_card")))
		app.syncPersonSearchText(record)
		return e.Next()
	})

	app.pb.OnRecordEnrich("persons").BindFunc(func(e *core.RecordEnrichEvent) error {
		e.Record.Set("id_card", decryptIdCard(e.Record.GetString("id_card")))
		return e.Next()
	})

	// relations 记录保存前规范化 person_a/person_b 的字典序(person_a 为较小者),
	// 覆盖前端与外部的所有写路径,配合唯一索引去重。
	app.pb.OnModelCreate("relations").BindFunc(func(e *core.ModelEvent) error {
		record := e.Model.(*core.Record)
		a, b := normalizeRelationPair(record.GetString("person_a"), record.GetString("person_b"))
		record.Set("person_a", a)
		record.Set("person_b", b)
		return e.Next()
	})

	app.pb.OnModelUpdate("relations").BindFunc(func(e *core.ModelEvent) error {
		record := e.Model.(*core.Record)
		a, b := normalizeRelationPair(record.GetString("person_a"), record.GetString("person_b"))
		record.Set("person_a", a)
		record.Set("person_b", b)
		return e.Next()
	})

	// organizations 的 importance_level 必须为 1-5;0(未设置)与越界值均拒绝。
	app.pb.OnModelCreate("organizations").BindFunc(func(e *core.ModelEvent) error {
		record := e.Model.(*core.Record)
		if err := validateRating(record.GetInt("importance_level"), "importance_level"); err != nil {
			return err
		}
		return e.Next()
	})

	app.pb.OnModelUpdate("organizations").BindFunc(func(e *core.ModelEvent) error {
		record := e.Model.(*core.Record)
		if err := validateRating(record.GetInt("importance_level"), "importance_level"); err != nil {
			return err
		}
		return e.Next()
	})

	// 组织改名级联:无条件重算引用该组织的人员聚合列(组织数量小,成本可忽略)。
	// 必须挂在提交后钩子(OnModelAfterUpdateSuccess):OnModelUpdate 在保存前触发,
	// 循环里 resolveOrgName 走 DB 读取取到的还是旧单位名,会把人员聚合列回写旧名;
	// 提交成功后再读,拿到的才是新单位名。
	// 人员保存会再次触发 persons 的 OnModelUpdate 钩子,重复算列但幂等,无害。
	app.pb.OnModelAfterUpdateSuccess("organizations").BindFunc(func(e *core.ModelEvent) error {
		record := e.Model.(*core.Record)
		persons, err := app.pb.FindRecordsByFilter(
			"persons", "current_org_id = {:id}", "-created", 0, 0, dbx.Params{"id": record.Id},
		)
		if err != nil {
			return err
		}
		for _, p := range persons {
			app.syncPersonSearchText(p)
			if err := app.pb.Save(p); err != nil {
				return err
			}
		}
		return e.Next()
	})

	app.pb.OnModelDelete("organizations").BindFunc(func(e *core.ModelEvent) error {
		record := e.Model.(*core.Record)

		// 置空引用该组织的所有人员的 current_org_id
		persons, err := app.pb.FindRecordsByFilter(
			"persons", "current_org_id = {:id}", "-created", 0, 0, dbx.Params{"id": record.Id},
		)
		if err != nil {
			return err
		}
		for _, p := range persons {
			p.Set("current_org_id", "")
			// 置空归属后重算聚合列,旧单位名随之从 search_text 中消失
			app.syncPersonSearchText(p)
			if err := app.pb.Save(p); err != nil {
				return err
			}
		}

		return e.Next()
	})

	// 服务启动时全量回填存量数据的聚合检索列(幂等;老库缺字段时只警告并跳过)
	app.pb.OnServe().BindFunc(func(e *core.ServeEvent) error {
		app.syncPersonSearchTexts()
		return e.Next()
	})

	if key := pimEncryptionKey(); key == "" {
		log.Printf("警告:PIM_ENC_KEY 未设置,persons.id_card 将以明文存储(生产环境请设置 32 字符密钥)")
	} else if len(key) != 32 {
		log.Printf("警告:PIM_ENC_KEY 长度应为 32 字符(当前 %d),否则加密将失败(值以明文入库)或降级为 AES-128/192", len(key))
	}
}
