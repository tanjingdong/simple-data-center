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

// validateRating 校验 1-5 评级值;0(未设置)与越界值均视为无效。
func validateRating(v int, fieldName string) error {
	if v < 1 || v > 5 {
		return fmt.Errorf("%s 必须为 1-5 的整数(当前值: %d)", fieldName, v)
	}
	return nil
}

// setupPimHooks 注册 PIM 数据层的钩子:
//  1. persons 记录保存前对 id_card 加密(OnModelCreate/OnModelUpdate 在校验前触发);
//  2. persons 记录响应序列化前对 id_card 解密(OnRecordEnrich,覆盖列表/详情/expand/管理后台);
//  3. 删除组织前,将引用该组织的 events.org_id 与 persons.current_org_id 置空
//     (替代 SQL 的 ON DELETE SET NULL;0.39.4 的 relation 字段无该语义,
//     cascadeDelete=false 会留下悬空 id,cascadeDelete=true 会误删事件)。
func (app *application) setupPimHooks() {
	app.pb.OnModelCreate("persons").BindFunc(func(e *core.ModelEvent) error {
		record := e.Model.(*core.Record)
		if err := validateRating(record.GetInt("trust_level"), "trust_level"); err != nil {
			return err
		}
		record.Set("id_card", encryptIdCard(record.GetString("id_card")))
		return e.Next()
	})

	app.pb.OnModelUpdate("persons").BindFunc(func(e *core.ModelEvent) error {
		record := e.Model.(*core.Record)
		if err := validateRating(record.GetInt("trust_level"), "trust_level"); err != nil {
			return err
		}
		record.Set("id_card", encryptIdCard(record.GetString("id_card")))
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

	app.pb.OnModelDelete("organizations").BindFunc(func(e *core.ModelEvent) error {
		record := e.Model.(*core.Record)

		// 置空引用该组织的所有事件的 org_id
		events, err := app.pb.FindRecordsByFilter(
			"events", "org_id = {:id}", "-created", 0, 0, dbx.Params{"id": record.Id},
		)
		if err != nil {
			return err
		}
		for _, ev := range events {
			ev.Set("org_id", "")
			if err := app.pb.Save(ev); err != nil {
				return err
			}
		}

		// 置空引用该组织的所有人员的 current_org_id
		persons, err := app.pb.FindRecordsByFilter(
			"persons", "current_org_id = {:id}", "-created", 0, 0, dbx.Params{"id": record.Id},
		)
		if err != nil {
			return err
		}
		for _, p := range persons {
			p.Set("current_org_id", "")
			if err := app.pb.Save(p); err != nil {
				return err
			}
		}

		return e.Next()
	})

	if key := pimEncryptionKey(); key == "" {
		log.Printf("警告:PIM_ENC_KEY 未设置,persons.id_card 将以明文存储(生产环境请设置 32 字符密钥)")
	} else if len(key) != 32 {
		log.Printf("警告:PIM_ENC_KEY 长度应为 32 字符(当前 %d),否则加密将失败(值以明文入库)或降级为 AES-128/192", len(key))
	}
}
