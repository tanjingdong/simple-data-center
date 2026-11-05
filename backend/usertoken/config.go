package usertoken

import (
	"fmt"
	"strconv"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

// optionEnabled 是 tools_settings 中控制令牌功能的配置项名称。
const optionEnabled = "usertoken_enabled"

// Config 是用户令牌功能的配置。
type Config struct {
	Enabled bool
}

// ApplyOption 将一行设置项写入配置;返回该 option 是否被识别。
func (c *Config) ApplyOption(option, value string) (bool, error) {
	if option != optionEnabled {
		return false, nil
	}
	enabled, err := strconv.ParseBool(value)
	if err != nil {
		return true, fmt.Errorf("配置项 %s 的值不是合法布尔值:%q", option, value)
	}
	c.Enabled = enabled
	return true, nil
}

// ConfigFromRecords 从 tools_settings 记录组装配置,未识别的 option 忽略。
func ConfigFromRecords(records []*core.Record) (Config, error) {
	cfg := Config{}
	for _, rec := range records {
		if _, err := cfg.ApplyOption(rec.GetString("option"), rec.GetString("value")); err != nil {
			return Config{}, err
		}
	}
	return cfg, nil
}

// LoadConfig 从 tools_settings 表读取令牌配置。
func LoadConfig(pb *pocketbase.PocketBase) (Config, error) {
	records, err := pb.FindRecordsByFilter("tools_settings", "option ~ 'usertoken_'", "", 0, 0)
	if err != nil {
		return Config{}, fmt.Errorf("读取 tools_settings 表失败: %w", err)
	}
	return ConfigFromRecords(records)
}

// ConfigItem 是待保存的单个配置项(option → value)。
type ConfigItem struct {
	Option string `json:"option"`
	Value  string `json:"value"`
}

// ValidateConfigItems 校验一组配置项并返回规范化映射;全有全无。
func ValidateConfigItems(items []ConfigItem) (map[string]string, error) {
	cfg := Config{}
	normalized := make(map[string]string, len(items))
	for _, item := range items {
		recognized, err := cfg.ApplyOption(item.Option, item.Value)
		if err != nil {
			return nil, err
		}
		if !recognized {
			return nil, fmt.Errorf("未知配置项:%s", item.Option)
		}
		normalized[item.Option] = item.Value
	}
	return normalized, nil
}

// SaveConfig 将配置项逐条 upsert 到 tools_settings 表(按 option 唯一索引)。
func SaveConfig(pb *pocketbase.PocketBase, items []ConfigItem) error {
	collection, err := pb.FindCollectionByNameOrId("tools_settings")
	if err != nil {
		return fmt.Errorf("tools_settings 表不存在: %w", err)
	}
	for _, item := range items {
		existing, err := pb.FindRecordsByFilter(
			"tools_settings", "option={:option}", "", 1, 0,
			dbx.Params{"option": item.Option},
		)
		if err != nil {
			return fmt.Errorf("查询配置项 %s 失败: %w", item.Option, err)
		}
		rec := core.NewRecord(collection)
		if len(existing) > 0 {
			rec = existing[0]
		} else {
			rec.Set("option", item.Option)
			rec.Set("type", "bool")
		}
		rec.Set("value", item.Value)
		if err := pb.Save(rec); err != nil {
			return fmt.Errorf("保存配置项 %s 失败: %w", item.Option, err)
		}
	}
	return nil
}
