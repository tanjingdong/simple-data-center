package usertoken

import "testing"

func TestConfigDefaultDisabled(t *testing.T) {
	cfg := Config{}
	if cfg.Enabled {
		t.Errorf("零值 Config 应默认关闭")
	}
}

func TestApplyOptionEnabled(t *testing.T) {
	cases := []struct {
		value   string
		want    bool
		wantErr bool
	}{
		{"true", true, false},
		{"false", false, false},
		{"1", true, false},
		{"0", false, false},
		{"yes", false, true},
		{"", false, true},
	}
	for _, tt := range cases {
		cfg := Config{}
		ok, err := cfg.ApplyOption(optionEnabled, tt.value)
		if !ok {
			t.Errorf("ApplyOption(%q) 未识别为已知配置项", tt.value)
			continue
		}
		if (err != nil) != tt.wantErr {
			t.Errorf("ApplyOption(%q) err = %v, wantErr %v", tt.value, err, tt.wantErr)
			continue
		}
		if err == nil && cfg.Enabled != tt.want {
			t.Errorf("ApplyOption(%q) Enabled = %v, want %v", tt.value, cfg.Enabled, tt.want)
		}
	}
}

func TestApplyOptionUnknown(t *testing.T) {
	cfg := Config{}
	ok, err := cfg.ApplyOption("unknown_option", "x")
	if ok || err != nil {
		t.Errorf("未知配置项应返回 (false, nil), got (%v, %v)", ok, err)
	}
}

func TestValidateConfigItems(t *testing.T) {
	norm, err := ValidateConfigItems([]ConfigItem{{Option: optionEnabled, Value: "true"}})
	if err != nil {
		t.Fatalf("合法配置项不应报错: %v", err)
	}
	if norm[optionEnabled] != "true" {
		t.Errorf("规范化值 = %q, want true", norm[optionEnabled])
	}

	if _, err := ValidateConfigItems([]ConfigItem{{Option: "nope", Value: "x"}}); err == nil {
		t.Errorf("未知配置项应报错")
	}
	if _, err := ValidateConfigItems([]ConfigItem{{Option: optionEnabled, Value: "not-bool"}}); err == nil {
		t.Errorf("非法布尔值应报错")
	}
}
