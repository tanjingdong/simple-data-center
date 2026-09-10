// Package links 实现「链接管理」工具:配置管理 + 公开网关入口。
// 配置来自 tools_settings 表的 links_* 设置项,仅 superuser 可编辑;
// 网关入口 /links/help-center 公开访问,由后端裁决:目标合法则 302,
// 未配置/非法则 200 返回管理员可配置的报错页。
package links

import (
	"fmt"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

// tools_settings 表中链接管理的 option 名称
const (
	OptionHelpCenterURL = "links_help_center_url"
	OptionErrorHTML     = "links_error_html"
)

// 校验上限(与前端 frontend/src/schemas/links-schema.ts 保持一致)
const (
	MaxURLLen       = 500
	MaxErrorHTMLLen = 32000
)

// DefaultErrorHTML 是内置默认报错页内容:种子补插写入 DB;网关遇空值时回退此值。
// 导出供 main 包 backend/links.go 种子使用,单一事实源。
const DefaultErrorHTML = `<h1>页面暂时无法使用</h1>
<p>管理员尚未配置该链接的目标地址,请稍后再试。</p>
<p>如需帮助,请联系系统管理员。</p>`

// 危险协议黑名单:这类 scheme 若出现在 <a href> 中,点击会在本站点上下文
// 执行脚本(React 属性转义无法阻止)。宽容策略下其余 scheme 一律放行。
var forbiddenSchemes = map[string]bool{
	"javascript": true,
	"data":       true,
	"vbscript":   true,
	"file":       true,
}

var schemePattern = regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9+.-]*:`)

// Config 是链接管理配置,由 tools_settings 表组装而来。
type Config struct {
	HelpCenterURL string
	ErrorHTML     string
}

// ApplyOption 将一行设置项写入配置(纯赋值,不做内容校验)。
// 读取时不校验,以容忍历史脏数据——管理页需能回读坏值让管理员修正;
// 内容校验只在保存(ValidateConfigItems)与网关跳转前(ValidateURL)进行。
// 返回该 option 是否被识别;未知 option 返回 false 且不报错。
func (c *Config) ApplyOption(option, value string) (bool, error) {
	switch option {
	case OptionHelpCenterURL:
		c.HelpCenterURL = strings.TrimSpace(value)
	case OptionErrorHTML:
		c.ErrorHTML = value
	default:
		return false, nil
	}
	return true, nil
}

// ValidateURL 校验目标 URL(中文报错)。
// 空串合法(未配置态);长度 ≤ MaxURLLen;不含空白/控制字符;
// 带 scheme 前缀时按危险协议黑名单拒绝,其余 scheme 宽容收受;
// 无 scheme 时仅接受 "/" 开头(站点根相对,含 "//host" 协议相对)。
// 裸相对(如 help.html、./x、../x)基准未定义——跳转目标随解析基准漂移,
// 一律拒绝并提示正确写法。
func ValidateURL(value string) error {
	if value == "" {
		return nil
	}
	if utf8.RuneCountInString(value) > MaxURLLen {
		return fmt.Errorf("链接地址过长(最多 %d 字符)", MaxURLLen)
	}
	for _, r := range value {
		if unicode.IsSpace(r) || unicode.IsControl(r) {
			return fmt.Errorf("链接地址不能包含空白或控制字符")
		}
	}
	if m := schemePattern.FindString(value); m != "" {
		scheme := strings.ToLower(strings.TrimSuffix(m, ":"))
		if forbiddenSchemes[scheme] {
			return fmt.Errorf("不允许使用 %s: 协议", scheme)
		}
		return nil
	}
	if !strings.HasPrefix(value, "/") {
		return fmt.Errorf("同源相对地址请以 / 开头,或填写完整绝对地址")
	}
	return nil
}

// ValidateErrorHTML 校验报错 HTML:空串合法;字符数 ≤ MaxErrorHTMLLen。
func ValidateErrorHTML(value string) error {
	if utf8.RuneCountInString(value) > MaxErrorHTMLLen {
		return fmt.Errorf("报错 HTML 过长(最多 %d 字符)", MaxErrorHTMLLen)
	}
	return nil
}

// ErrorHTMLOrDefault 返回待展示的报错 HTML:DB 值空/纯空白时回退内置默认。
func (c Config) ErrorHTMLOrDefault() string {
	if strings.TrimSpace(c.ErrorHTML) == "" {
		return DefaultErrorHTML
	}
	return c.ErrorHTML
}

// ConfigFromRecords 从 tools_settings 记录列表组装配置(不校验内容,见 ApplyOption 注释)。
func ConfigFromRecords(records []*core.Record) (Config, error) {
	cfg := Config{}
	for _, rec := range records {
		if _, err := cfg.ApplyOption(rec.GetString("option"), rec.GetString("value")); err != nil {
			return Config{}, err
		}
	}
	return cfg, nil
}

// LoadConfig 从 tools_settings 表读取全部链接管理配置项。
func LoadConfig(pb *pocketbase.PocketBase) (Config, error) {
	records, err := pb.FindRecordsByFilter("tools_settings", "option ~ 'links_'", "", 0, 0)
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

// ValidateConfigItems 校验一组待保存配置项,返回规范化后的 option→value 映射
// (URL 存 trim 后值)。任一 option 未知或值非法即返回错误;全有全无,调用方
// 应在全部校验通过后再写库。
func ValidateConfigItems(items []ConfigItem) (map[string]string, error) {
	if len(items) == 0 {
		return nil, fmt.Errorf("配置项不能为空")
	}
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
	}
	if err := ValidateURL(cfg.HelpCenterURL); err != nil {
		return nil, err
	}
	if err := ValidateErrorHTML(cfg.ErrorHTML); err != nil {
		return nil, err
	}
	normalized[OptionHelpCenterURL] = cfg.HelpCenterURL
	normalized[OptionErrorHTML] = cfg.ErrorHTML
	return normalized, nil
}

// SelectNormalizedItems 从请求项里挑出实际提交的 option,取校验后的规范化值,
// 组装待写入列表。请求未携带的 option 保持库中原值(部分更新语义,不清空)。
func SelectNormalizedItems(requested []ConfigItem, normalized map[string]string) []ConfigItem {
	items := make([]ConfigItem, 0, len(requested))
	for _, it := range requested {
		if value, ok := normalized[it.Option]; ok {
			items = append(items, ConfigItem{Option: it.Option, Value: value})
		}
	}
	return items
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
			rec.Set("type", "string")
		}
		rec.Set("value", item.Value)
		if err := pb.Save(rec); err != nil {
			return fmt.Errorf("保存配置项 %s 失败: %w", item.Option, err)
		}
	}
	return nil
}
