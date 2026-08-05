package frpc

import (
	"testing"

	v1 "github.com/fatedier/frp/pkg/config/v1"
)

func assertEqual(t *testing.T, got, want any, msg string) {
	t.Helper()
	if got != want {
		t.Errorf("%s: 得到 %v,期望 %v", msg, got, want)
	}
}

// ApplyOption:合法值逐项写入
func TestApplyOption_ValidValues(t *testing.T) {
	cfg := Config{}
	for _, tc := range []struct {
		option, value string
	}{
		{optionServerAddr, "frps.example.com"},
		{optionToken, "secret-token"},
		{optionProxyName, "my-habit"},
		{optionServerPort, "7001"},
		{optionLocalPort, "8080"},
		{optionRemotePort, "9000"},
	} {
		recognized, err := cfg.ApplyOption(tc.option, tc.value)
		if err != nil {
			t.Fatalf("ApplyOption(%s, %s) 不应报错:%v", tc.option, tc.value, err)
		}
		if !recognized {
			t.Errorf("ApplyOption(%s) 应被识别", tc.option)
		}
	}
	assertEqual(t, cfg.ServerAddr, "frps.example.com", "ServerAddr")
	assertEqual(t, cfg.Token, "secret-token", "Token")
	assertEqual(t, cfg.ProxyName, "my-habit", "ProxyName")
	assertEqual(t, cfg.ServerPort, 7001, "ServerPort")
	assertEqual(t, cfg.LocalPort, 8080, "LocalPort")
	assertEqual(t, cfg.RemotePort, 9000, "RemotePort")
}

// ApplyOption:未知 option 返回 unrecognized 且不报错
func TestApplyOption_UnknownOption(t *testing.T) {
	cfg := Config{}
	recognized, err := cfg.ApplyOption("frpc_unknown_key", "x")
	if err != nil {
		t.Fatalf("未知 option 不应报错:%v", err)
	}
	if recognized {
		t.Error("未知 option 应返回未被识别")
	}
}

// ApplyOption:非数字端口报错
func TestApplyOption_InvalidPort(t *testing.T) {
	cfg := Config{}
	if _, err := cfg.ApplyOption(optionServerPort, "abc"); err == nil {
		t.Error("非数字端口应报错")
	}
}

// WithDefaults:零值填充默认
func TestWithDefaults(t *testing.T) {
	cfg := Config{}
	cfg.WithDefaults()
	assertEqual(t, cfg.ServerPort, 7000, "默认 ServerPort")
	assertEqual(t, cfg.ProxyName, "longhabit", "默认 ProxyName")
	assertEqual(t, cfg.LocalPort, 8090, "默认 LocalPort")
	assertEqual(t, cfg.RemotePort, 8090, "默认 RemotePort")
}

// Validate:server_addr 必填
func TestValidate_EmptyAddr(t *testing.T) {
	cfg := Config{ServerAddr: "", ServerPort: 7000, LocalPort: 8090, RemotePort: 8090}
	if err := cfg.Validate(); err == nil {
		t.Error("server_addr 为空应报错")
	}
}

// Validate:端口越界
func TestValidate_PortOutOfRange(t *testing.T) {
	for _, port := range []int{0, -1, 65536} {
		cfg := Config{ServerAddr: "x", ServerPort: port, LocalPort: 8090, RemotePort: 8090}
		if err := cfg.Validate(); err == nil {
			t.Errorf("端口 %d 越界应报错", port)
		}
	}
}

// Validate:合法配置通过
func TestValidate_OK(t *testing.T) {
	cfg := Config{ServerAddr: "x", ServerPort: 7000, LocalPort: 8090, RemotePort: 8090}
	if err := cfg.Validate(); err != nil {
		t.Errorf("合法配置不应报错:%v", err)
	}
}

// BuildClientConfig:字段映射与默认值
func TestBuildClientConfig(t *testing.T) {
	cfg := Config{ServerAddr: "frps.example.com", ServerPort: 7000, Token: "tk"}
	cfg.WithDefaults()
	common, proxies, err := cfg.BuildClientConfig()
	if err != nil {
		t.Fatalf("BuildClientConfig 不应报错:%v", err)
	}
	assertEqual(t, common.ServerAddr, "frps.example.com", "ServerAddr 映射")
	assertEqual(t, common.ServerPort, 7000, "ServerPort 映射")
	assertEqual(t, string(common.Auth.Method), "token", "Auth 方法")
	assertEqual(t, common.Auth.Token, "tk", "Auth token 映射")

	if len(proxies) != 1 {
		t.Fatalf("应恰好有 1 个代理,实际 %d", len(proxies))
	}
	proxy, ok := proxies[0].(*v1.TCPProxyConfig)
	if !ok {
		t.Fatalf("代理类型应为 *v1.TCPProxyConfig,实际 %T", proxies[0])
	}
	assertEqual(t, proxy.Name, "longhabit", "代理名默认值")
	assertEqual(t, proxy.Type, "tcp", "代理类型")
	assertEqual(t, proxy.LocalIP, "127.0.0.1", "本地 IP")
	assertEqual(t, proxy.LocalPort, 8090, "本地端口默认值")
	assertEqual(t, proxy.RemotePort, 8090, "远程端口默认值")
}

// BuildClientConfig:配置无效时报错
func TestBuildClientConfig_Invalid(t *testing.T) {
	cfg := Config{} // ServerAddr 为空
	if _, _, err := cfg.BuildClientConfig(); err == nil {
		t.Error("无效配置应报错")
	}
}
