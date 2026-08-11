// Package frpc 封装 frp 客户端的配置组装与生命周期管理。
// 配置来自 tools_settings 表中的 frpc_* 设置项,仅 superuser 可编辑。
package frpc

import (
	"fmt"
	"strconv"

	v1 "github.com/fatedier/frp/pkg/config/v1"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

// tools_settings 表中 frpc 配置项的 option 名称
const (
	optionServerAddr = "frpc_server_addr"
	optionServerPort = "frpc_server_port"
	optionToken      = "frpc_token"
	optionProxyName  = "frpc_proxy_name"
	optionLocalPort  = "frpc_local_port"
	optionRemotePort = "frpc_remote_port"
)

// frpc 配置默认值
const (
	defaultServerPort = 7000
	defaultProxyName  = "simple-data-center"
	defaultLocalPort  = 8090
	defaultRemotePort = 8090
	defaultLocalIP    = "127.0.0.1"
)

// Config 是 frpc 的配置,由 tools_settings 表组装而来。
type Config struct {
	ServerAddr string
	ServerPort int
	Token      string
	ProxyName  string
	LocalPort  int
	RemotePort int
}

// WithDefaults 为零值字段填充默认值。
func (c *Config) WithDefaults() {
	if c.ServerPort == 0 {
		c.ServerPort = defaultServerPort
	}
	if c.ProxyName == "" {
		c.ProxyName = defaultProxyName
	}
	if c.LocalPort == 0 {
		c.LocalPort = defaultLocalPort
	}
	if c.RemotePort == 0 {
		c.RemotePort = defaultRemotePort
	}
}

// ApplyOption 将一行设置项(option/value)写入配置。
// 返回该 option 是否被识别;未知 option 忽略且不报错。
func (c *Config) ApplyOption(option, value string) (bool, error) {
	switch option {
	case optionServerAddr:
		c.ServerAddr = value
	case optionToken:
		c.Token = value
	case optionProxyName:
		c.ProxyName = value
	case optionServerPort, optionLocalPort, optionRemotePort:
		port, err := strconv.Atoi(value)
		if err != nil {
			return false, fmt.Errorf("配置项 %s 的值不是合法数字:%q", option, value)
		}
		switch option {
		case optionServerPort:
			c.ServerPort = port
		case optionLocalPort:
			c.LocalPort = port
		case optionRemotePort:
			c.RemotePort = port
		}
	default:
		return false, nil
	}
	return true, nil
}

// Validate 校验配置,返回中文错误描述。
func (c Config) Validate() error {
	if c.ServerAddr == "" {
		return fmt.Errorf("frpc_server_addr 不能为空,请先在管理后台的 tools_settings 表中填写 frps 服务器地址")
	}
	for name, port := range map[string]int{
		"frpc_server_port": c.ServerPort,
		"frpc_local_port":  c.LocalPort,
		"frpc_remote_port": c.RemotePort,
	} {
		if port < 1 || port > 65535 {
			return fmt.Errorf("%s 端口 %d 超出有效范围(1-65535)", name, port)
		}
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

// LoadConfig 从 tools_settings 表读取全部 frpc 配置项。
func LoadConfig(pb *pocketbase.PocketBase) (Config, error) {
	records, err := pb.FindRecordsByFilter("tools_settings", "option ~ 'frpc_'", "", 0, 0)
	if err != nil {
		return Config{}, fmt.Errorf("读取 tools_settings 表失败: %w", err)
	}
	return ConfigFromRecords(records)
}

// BuildClientConfig 将配置组装为 frp 客户端配置对象与 tcp 代理列表。
// 缺省字段先填充默认值;配置仍无效时返回错误。
func (c Config) BuildClientConfig() (*v1.ClientCommonConfig, []v1.ProxyConfigurer, error) {
	c.WithDefaults()
	if err := c.Validate(); err != nil {
		return nil, nil, err
	}

	common := &v1.ClientCommonConfig{
		ServerAddr: c.ServerAddr,
		ServerPort: c.ServerPort,
		Auth: v1.AuthClientConfig{
			Method: v1.AuthMethodToken,
			Token:  c.Token,
		},
		Log: v1.LogConfig{
			To:    "console",
			Level: "warn",
		},
	}

	proxy := &v1.TCPProxyConfig{
		ProxyBaseConfig: v1.ProxyBaseConfig{
			Name: c.ProxyName,
			Type: "tcp",
			ProxyBackend: v1.ProxyBackend{
				LocalIP:   defaultLocalIP,
				LocalPort: c.LocalPort,
			},
		},
		RemotePort: c.RemotePort,
	}

	return common, []v1.ProxyConfigurer{proxy}, nil
}

// ConfigItem 是待保存的单个配置项(option → value),来自前端配置表单。
type ConfigItem struct {
	Option string `json:"option"`
	Value  string `json:"value"`
}

// ValidateConfigItems 校验一组待保存的配置项,返回规范化后的 option→value 映射。
// 任一 option 未知、值为非法格式、或整体配置无效(如 server_addr 为空)时返回错误。
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

// SaveConfig 将配置项逐条 upsert 到 tools_settings 表(按 option 唯一索引)。
// 调用方须先用 ValidateConfigItems 完成校验(全有全无),本函数只负责写入。
func SaveConfig(pb *pocketbase.PocketBase, items []ConfigItem) error {
	collection, err := pb.FindCollectionByNameOrId("tools_settings")
	if err != nil {
		return fmt.Errorf("tools_settings 表不存在: %w", err)
	}
	for _, item := range items {
		// option 唯一索引,已有记录则更新,否则创建
		existing, err := pb.FindRecordsByFilter(
			"tools_settings", "option={:option}", "", 0, 1,
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
		}
		rec.Set("value", item.Value)
		if err := pb.Save(rec); err != nil {
			return fmt.Errorf("保存配置项 %s 失败: %w", item.Option, err)
		}
	}
	return nil
}
