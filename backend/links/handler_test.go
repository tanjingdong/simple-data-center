package links

import (
	"strings"
	"testing"
)

func TestResolveGatewayTarget(t *testing.T) {
	// 合法目标:trim 后应原样返回,可跳转
	valid := []string{
		"https://example.com/help",
		"/api/filestore/files/abc/download?inline=1",
		"  https://example.com  ",
	}
	for _, v := range valid {
		got := resolveGatewayTarget(v)
		want := strings.TrimSpace(v)
		if got != want {
			t.Errorf("resolveGatewayTarget(%q) = %q, want %q", v, got, want)
		}
	}

	// 非法/未配置:返回空串,不跳转
	invalid := []string{"", "   ", "javascript:alert(1)", "https://exa mple.com", "file:///etc/passwd", "help.html"}
	for _, v := range invalid {
		if got := resolveGatewayTarget(v); got != "" {
			t.Errorf("resolveGatewayTarget(%q) 应为空(不跳转), got %q", v, got)
		}
	}
}

func TestRenderErrorPage(t *testing.T) {
	page := renderErrorPage("<h1>自定义</h1>")
	if !strings.Contains(page, `<meta charset="utf-8">`) {
		t.Errorf("报错页应含 charset 声明")
	}
	if !strings.Contains(page, "<h1>自定义</h1>") {
		t.Errorf("报错页应内嵌配置片段")
	}
	if !strings.Contains(page, "自定义") {
		t.Errorf("片段中文不应被转义")
	}
}

func TestHandler_GetConfigRaw(t *testing.T) {
	h := &LinksHandler{
		loadConfig: func() (Config, error) {
			return Config{HelpCenterURL: "https://example.com", ErrorHTML: "<p>缺省</p>"}, nil
		},
	}
	data, err := h.handleGetConfigRaw()
	if err != nil {
		t.Fatalf("handleGetConfigRaw failed: %v", err)
	}
	m := data.(map[string]any)
	if m["help_center_url"] != "https://example.com" {
		t.Errorf("help_center_url = %v", m["help_center_url"])
	}
	if m["error_html"] != "<p>缺省</p>" {
		t.Errorf("error_html = %v", m["error_html"])
	}
}
