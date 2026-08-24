package filestore

import (
	"testing"
)

func TestConfig_WithDefaults(t *testing.T) {
	cfg := Config{}
	cfg.WithDefaults()
	if cfg.MaxSize != defaultMaxSize {
		t.Errorf("MaxSize = %d, want %d", cfg.MaxSize, defaultMaxSize)
	}
	if cfg.StoragePath != defaultStoragePath {
		t.Errorf("StoragePath = %s, want %s", cfg.StoragePath, defaultStoragePath)
	}
	if cfg.DownloadMode != defaultDownloadMode {
		t.Errorf("DownloadMode = %s, want %s", cfg.DownloadMode, defaultDownloadMode)
	}
}

func TestConfig_ApplyOption(t *testing.T) {
	cfg := Config{}
	tests := []struct {
		option     string
		value      string
		wantOK     bool
		wantErr    bool
		checkField func(*Config) bool
	}{
		{optionAlistURL, "http://alist:5244", true, false, func(c *Config) bool { return c.AlistURL == "http://alist:5244" }},
		{optionAlistToken, "mytoken", true, false, func(c *Config) bool { return c.AlistToken == "mytoken" }},
		{optionMaxSize, "2097152", true, false, func(c *Config) bool { return c.MaxSize == 2097152 }},
		{optionMaxSize, "notanumber", true, true, nil},
		{optionAllowedMimes, "image/jpeg,image/png", true, false, func(c *Config) bool { return c.AllowedMimes == "image/jpeg,image/png" }},
		{optionDownloadMode, "proxy", true, false, func(c *Config) bool { return c.DownloadMode == "proxy" }},
		{optionDownloadMode, "invalid", true, true, nil},
		{optionStoragePath, "/custom", true, false, func(c *Config) bool { return c.StoragePath == "/custom" }},
		{"unknown_option", "x", false, false, nil},
		{optionPlaceholderDenied, "<svg>denied</svg>", true, false, func(c *Config) bool { return c.PlaceholderDenied == "<svg>denied</svg>" }},
		{optionPlaceholderError, "<svg>error</svg>", true, false, func(c *Config) bool { return c.PlaceholderError == "<svg>error</svg>" }},
	}
	for _, tt := range tests {
		ok, err := cfg.ApplyOption(tt.option, tt.value)
		if ok != tt.wantOK || (err != nil) != tt.wantErr {
			t.Errorf("ApplyOption(%q, %q) = (%v, %v), want (%v, %v)", tt.option, tt.value, ok, err, tt.wantOK, tt.wantErr)
		}
		if tt.checkField != nil && !tt.checkField(&cfg) {
			t.Errorf("ApplyOption(%q, %q) field check failed", tt.option, tt.value)
		}
	}
}

func TestConfig_Validate(t *testing.T) {
	tests := []struct {
		name    string
		cfg     Config
		wantErr bool
	}{
		{"empty URL", Config{}, true},
		{"valid", Config{AlistURL: "http://alist:5244", AlistToken: "tok"}, false},
	}
	for _, tt := range tests {
		tt.cfg.WithDefaults()
		err := tt.cfg.Validate()
		if (err != nil) != tt.wantErr {
			t.Errorf("%s: Validate() error = %v, wantErr %v", tt.name, err, tt.wantErr)
		}
	}
}

func TestValidateConfigItems(t *testing.T) {
	items := []ConfigItem{
		{Option: optionAlistURL, Value: "http://alist:5244"},
		{Option: optionAlistToken, Value: "mytoken"},
		{Option: optionMaxSize, Value: "10485760"},
		{Option: optionDownloadMode, Value: "direct"},
		{Option: optionStoragePath, Value: "/test"},
	}
	normalized, err := ValidateConfigItems(items)
	if err != nil {
		t.Fatalf("ValidateConfigItems failed: %v", err)
	}
	if normalized[optionAlistURL] != "http://alist:5244" {
		t.Errorf("missing alist_url")
	}
}

func TestValidateConfigItems_Invalid(t *testing.T) {
	items := []ConfigItem{
		{Option: optionAlistURL, Value: "http://alist:5244"},
		{Option: optionAlistToken, Value: "mytoken"},
		{Option: optionDownloadMode, Value: "invalid_mode"},
	}
	_, err := ValidateConfigItems(items)
	if err == nil {
		t.Fatal("expected error for invalid download mode")
	}
}