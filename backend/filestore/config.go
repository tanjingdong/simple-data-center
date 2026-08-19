// Package filestore 封装文件存储管理系统的配置管理、Alist API 客户端与 HTTP handler。
// 配置来自 tools_settings 表中的 filestore_* 设置项,仅 superuser 可编辑。
// 上传/下载操作由普通用户通过通用端 API 完成,元数据记录在 filestore_files 集合。
package filestore

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

// tools_settings 表中 filestore 配置项的 option 名称
const (
	optionAlistURL           = "filestore_alist_url"
	optionAlistToken         = "filestore_alist_token"
	optionMaxSize            = "filestore_max_size"
	optionAllowedMimes       = "filestore_allowed_mimes"
	optionDownloadMode       = "filestore_download_mode"
	optionStoragePath        = "filestore_storage_path"
	optionPlaceholderDenied  = "filestore_placeholder_denied"
	optionPlaceholderError   = "filestore_placeholder_error"
)

// filestore 配置默认值
const (
	defaultMaxSize      = 10 * 1024 * 1024 // 10MB
	defaultStoragePath  = "/simple-data-center"
	defaultDownloadMode = "direct"
)

// 下载模式枚举
const (
	DownloadModeDirect = "direct"
	DownloadModeProxy  = "proxy"
)

// Config 是文件存储的配置,由 tools_settings 表组装而来。
type Config struct {
	AlistURL         string
	AlistToken       string
	MaxSize          int64
	AllowedMimes     string
	DownloadMode     string
	StoragePath      string
	PlaceholderDenied  string
	PlaceholderError   string
}

// WithDefaults 为零值字段填充默认值。
func (c *Config) WithDefaults() {
	if c.MaxSize == 0 {
		c.MaxSize = defaultMaxSize
	}
	if c.StoragePath == "" {
		c.StoragePath = defaultStoragePath
	}
	if c.DownloadMode == "" {
		c.DownloadMode = defaultDownloadMode
	}
}

// ApplyOption 将一行设置项(option/value)写入配置。
// 返回该 option 是否被识别;未知 option 忽略且不报错。
func (c *Config) ApplyOption(option, value string) (bool, error) {
	switch option {
	case optionAlistURL:
		c.AlistURL = value
	case optionAlistToken:
		c.AlistToken = value
	case optionMaxSize:
		size, err := strconv.ParseInt(value, 10, 64)
		if err != nil {
			return true, fmt.Errorf("配置项 %s 的值不是合法数字:%q", option, value)
		}
		if size < 1 {
			return true, fmt.Errorf("配置项 %s 的值必须大于 0", option)
		}
		c.MaxSize = size
	case optionAllowedMimes:
		c.AllowedMimes = value
	case optionDownloadMode:
		if value != DownloadModeDirect && value != DownloadModeProxy {
			return true, fmt.Errorf("配置项 %s 的值必须是 %q 或 %q, 收到 %q", option, DownloadModeDirect, DownloadModeProxy, value)
		}
		c.DownloadMode = value
	case optionStoragePath:
		c.StoragePath = value
	case optionPlaceholderDenied:
		c.PlaceholderDenied = value
	case optionPlaceholderError:
		c.PlaceholderError = value
	default:
		return false, nil
	}
	return true, nil
}

// Validate 校验配置,返回中文错误描述。
func (c Config) Validate() error {
	if c.AlistURL == "" {
		return fmt.Errorf("filestore_alist_url 不能为空,请先在管理后台填写 Alist 服务地址")
	}
	if c.AlistToken == "" {
		return fmt.Errorf("filestore_alist_token 不能为空,请先在管理后台填写 Alist 管理 token")
	}
	return nil
}

// ConfigFromRecords 从 tools_settings 记录列表组装配置:
// 未识别的 option 忽略,缺项使用默认值。
func ConfigFromRecords(records []*core.Record) (Config, error) {
	cfg := Config{}
	for _, rec := range records {
		if _, err := cfg.ApplyOption(rec.GetString("option"), rec.GetString("value")); err != nil {
			return Config{}, err
		}
	}
	cfg.WithDefaults()
	return cfg, nil
}

// LoadConfig 从 tools_settings 表读取全部 filestore 配置项。
func LoadConfig(pb *pocketbase.PocketBase) (Config, error) {
	records, err := pb.FindRecordsByFilter("tools_settings", "option ~ 'filestore_'", "", 0, 0)
	if err != nil {
		return Config{}, fmt.Errorf("读取 tools_settings 表失败: %w", err)
	}
	return ConfigFromRecords(records)
}

// ConfigItem 是待保存的单个配置项(option → value),来自前端配置表单。
type ConfigItem struct {
	Option string `json:"option"`
	Value  string `json:"value"`
}

// ValidateConfigItems 校验一组待保存的配置项,返回规范化后的 option→value 映射。
// 任一 option 未知、值为非法格式、或整体配置无效时返回错误。
// 全有全无:调用方应在全部校验通过后再写库。
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
	cfg.WithDefaults()
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	return normalized, nil
}

// optionSettingType 返回各配置项的 tools_settings.type 取值,与 ensureFilestoreSettings 的预置类型一致。
func optionSettingType(option string) string {
	switch option {
	case optionMaxSize:
		return "number"
	default:
		return "string"
	}
}

// SaveConfig 将配置项逐条 upsert 到 tools_settings 表(按 option 唯一索引)。
// 调用方须先用 ValidateConfigItems 完成校验(全有全无),本函数只负责写入。
func SaveConfig(pb *pocketbase.PocketBase, items []ConfigItem) error {
	collection, err := pb.FindCollectionByNameOrId("tools_settings")
	if err != nil {
		return fmt.Errorf("tools_settings 表不存在: %w", err)
	}
	for _, item := range items {
		existing, err := pb.FindRecordsByFilter(
			"tools_settings", "option={:option}", "", 1, 0,
			map[string]any{"option": item.Option},
		)
		if err != nil {
			return fmt.Errorf("查询配置项 %s 失败: %w", item.Option, err)
		}
		rec := core.NewRecord(collection)
		if len(existing) > 0 {
			rec = existing[0]
		} else {
			rec.Set("option", item.Option)
			rec.Set("type", optionSettingType(item.Option))
		}
		rec.Set("value", item.Value)
		if err := pb.Save(rec); err != nil {
			return fmt.Errorf("保存配置项 %s 失败: %w", item.Option, err)
		}
	}
	return nil
}

// IsMimeAllowed 检查 MIME 是否在白名单中(空白名单=允许所有)。
func (c Config) IsMimeAllowed(mime string) bool {
	if c.AllowedMimes == "" {
		return true
	}
	allowed := strings.Split(c.AllowedMimes, ",")
	for _, a := range allowed {
		if strings.TrimSpace(a) == mime {
			return true
		}
	}
	return false
}