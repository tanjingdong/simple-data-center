package links

import (
	"strings"
	"testing"
)

func TestValidateURL_EmptyOK(t *testing.T) {
	if err := ValidateURL(""); err != nil {
		t.Errorf("空串应合法(未配置态), got %v", err)
	}
}

func TestValidateURL_Matrix(t *testing.T) {
	valid := []string{
		"https://example.com/help",
		"http://192.168.1.100:5244/docs/index.html",
		"ftp://files.example.com/a.html",
		"mailto:help@example.com",
		"/api/filestore/files/abc/download?inline=1", // 站点根相对
		"/帮助/首页.html",                                // 根相对含中文路径
		"//other.example.com/doc",                    // 协议相对(基准自足)
	}
	for _, v := range valid {
		if err := ValidateURL(v); err != nil {
			t.Errorf("ValidateURL(%q) 不应报错: %v", v, err)
		}
	}

	invalid := []string{
		"javascript:alert(1)",
		"JaVaScRiPt:alert(1)", // 大小写不敏感
		"data:text/html;base64,PHNjcmlwdD4=",
		"vbscript:msgbox(1)",
		"file:///etc/passwd",
		"https://example.com/a b", // 内部空白
		"https://example.com/a\nb",
		"https://example.com/a\tb",
		"   https://example.com   ", // 首尾空白(调用方应 trim,本函数直接拒绝)
		"help.html",                 // 裸相对:基准未定义,拒绝
		"./sub/about.html",          // 相对引用:拒绝
		"../up.html",                // 相对引用:拒绝
		"ftp.example.com/pub",       // 无 scheme 的裸写法:拒绝
		"docs/首页.html",              // 裸相对含中文:拒绝
	}
	for _, v := range invalid {
		if err := ValidateURL(v); err == nil {
			t.Errorf("ValidateURL(%q) 应报错", v)
		}
	}

	long := strings.Repeat("a", MaxURLLen+1)
	if err := ValidateURL(long); err == nil {
		t.Errorf("超过 %d 字符应报错", MaxURLLen)
	}
	// 恰好 MaxURLLen 字符的根相对(含 "/" 前缀)应合法
	exactLen := "/" + strings.Repeat("a", MaxURLLen-1)
	if err := ValidateURL(exactLen); err != nil {
		t.Errorf("恰好 %d 字符的根相对应合法, got %v", MaxURLLen, err)
	}
}

func TestValidateErrorHTML(t *testing.T) {
	if err := ValidateErrorHTML(""); err != nil {
		t.Errorf("空串应合法, got %v", err)
	}
	if err := ValidateErrorHTML("<h1>未配置</h1>"); err != nil {
		t.Errorf("短 HTML 应合法, got %v", err)
	}
	tooLong := strings.Repeat("字", MaxErrorHTMLLen+1)
	if err := ValidateErrorHTML(tooLong); err == nil {
		t.Errorf("超过 %d 字符应报错", MaxErrorHTMLLen)
	}
}

func TestSelectNormalizedItems_PartialUpdate(t *testing.T) {
	normalized := map[string]string{
		OptionHelpCenterURL: "https://example.com/help",
		OptionErrorHTML:     "",
	}
	// 只提交 URL:error_html 不应进入待写列表(保持库中原值)
	items := SelectNormalizedItems(
		[]ConfigItem{{Option: OptionHelpCenterURL, Value: "https://example.com/help"}},
		normalized,
	)
	if len(items) != 1 || items[0].Option != OptionHelpCenterURL {
		t.Errorf("部分更新应只含请求项, got %+v", items)
	}
	// 两项全提交:全部进入待写列表
	items = SelectNormalizedItems(
		[]ConfigItem{
			{Option: OptionHelpCenterURL, Value: "x"},
			{Option: OptionErrorHTML, Value: "<p>y</p>"},
		},
		normalized,
	)
	if len(items) != 2 {
		t.Errorf("全量更新应含两项, got %+v", items)
	}
}

func TestApplyOption(t *testing.T) {
	cfg := Config{}
	tests := []struct {
		option string
		value  string
		wantOK bool
		check  func(*Config) bool
	}{
		{OptionHelpCenterURL, "  https://example.com  ", true, func(c *Config) bool { return c.HelpCenterURL == "https://example.com" }}, // trim
		{OptionHelpCenterURL, "javascript:alert(1)", true, func(c *Config) bool { return c.HelpCenterURL == "javascript:alert(1)" }},     // 读取不校验,容脏数据
		{OptionErrorHTML, "<p>x</p>", true, func(c *Config) bool { return c.ErrorHTML == "<p>x</p>" }},
		{"unknown_option", "x", false, nil},
	}
	for _, tt := range tests {
		ok, err := cfg.ApplyOption(tt.option, tt.value)
		if ok != tt.wantOK || err != nil {
			t.Errorf("ApplyOption(%q, %q) = (%v, %v), want OK=%v err=nil", tt.option, tt.value, ok, err, tt.wantOK)
		}
		if tt.check != nil && !tt.check(&cfg) {
			t.Errorf("ApplyOption(%q) 字段检查失败", tt.option)
		}
	}
}

func TestErrorHTMLOrDefault(t *testing.T) {
	cfg := Config{}
	if got := cfg.ErrorHTMLOrDefault(); got != DefaultErrorHTML {
		t.Errorf("空 ErrorHTML 应回退内置默认")
	}
	cfg = Config{ErrorHTML: "  "}
	if got := cfg.ErrorHTMLOrDefault(); got != DefaultErrorHTML {
		t.Errorf("纯空白 ErrorHTML 应回退内置默认")
	}
	cfg = Config{ErrorHTML: "<h1>自定义</h1>"}
	if got := cfg.ErrorHTMLOrDefault(); got != "<h1>自定义</h1>" {
		t.Errorf("非空 ErrorHTML 应原样返回, got %q", got)
	}
}

func TestValidateConfigItems(t *testing.T) {
	norm, err := ValidateConfigItems([]ConfigItem{
		{Option: OptionHelpCenterURL, Value: "  /api/x  "},
		{Option: OptionErrorHTML, Value: "<p>hi</p>"},
	})
	if err != nil {
		t.Fatalf("合法项组不应报错: %v", err)
	}
	if norm[OptionHelpCenterURL] != "/api/x" {
		t.Errorf("URL 应存 trim 后的值, got %q", norm[OptionHelpCenterURL])
	}

	cases := []struct {
		name  string
		items []ConfigItem
	}{
		{"空项组", nil},
		{"未知项", []ConfigItem{{Option: "links_nope", Value: "x"}}},
		{"危险协议", []ConfigItem{{Option: OptionHelpCenterURL, Value: "javascript:alert(1)"}}},
		{"超长 HTML", []ConfigItem{{Option: OptionErrorHTML, Value: strings.Repeat("字", MaxErrorHTMLLen+1)}}},
	}
	for _, tt := range cases {
		if _, err := ValidateConfigItems(tt.items); err == nil {
			t.Errorf("%s 应报错", tt.name)
		}
	}
}
