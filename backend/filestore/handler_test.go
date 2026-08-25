package filestore

import (
	"testing"
)

func TestHandler_GetConfig(t *testing.T) {
	h := &FilestoreHandler{
		loadConfig: func() (Config, error) {
			return Config{AlistURL: "http://alist:5244", AlistToken: "tok"}, nil
		},
	}

	data, err := h.handleGetConfigRaw(nil)
	if err != nil {
		t.Fatalf("handleGetConfigRaw failed: %v", err)
	}
	m := data.(map[string]any)
	if m["alist_url"] != "http://alist:5244" {
		t.Errorf("alist_url = %v, want http://alist:5244", m["alist_url"])
	}
}

func TestHandler_CheckAlist(t *testing.T) {
	h := &FilestoreHandler{
		loadConfig: func() (Config, error) {
			return Config{AlistURL: "http://alist:5244", AlistToken: "tok"}, nil
		},
		newAlistClient: func(cfg Config) *AlistClient {
			return NewAlistClient(cfg.AlistURL, cfg.AlistToken)
		},
	}

	data, err := h.handleCheckAlistRaw()
	if err != nil {
		t.Fatalf("handleCheckAlistRaw returned error: %v", err)
	}
	m := data.(map[string]any)
	if m["ok"] != false {
		t.Errorf("ok = %v, want false (no real Alist)", m["ok"])
	}
}

func TestGenerateUUID(t *testing.T) {
	u1 := generateUUID()
	u2 := generateUUID()
	if u1 == u2 {
		t.Errorf("expected different UUIDs, got same: %s", u1)
	}
	if len(u1) != 36 {
		t.Errorf("UUID length = %d, want 36", len(u1))
	}
}

// TestResolveDisposition 验证 inline 参数如何影响 Content-Disposition:
// proxy 模式按 inline 切换 inline/attachment;direct 模式不设头(302 由 Alist 决定)。
func TestResolveDisposition(t *testing.T) {
	cases := []struct {
		name     string
		inline   bool
		mode     string
		filename string
		want     string
	}{
		{"proxy+inline 返回 inline", true, DownloadModeProxy, "a.jpg", `inline; filename="a.jpg"`},
		{"proxy+非inline 返回 attachment", false, DownloadModeProxy, "a.jpg", `attachment; filename="a.jpg"`},
		{"direct+inline 不设头", true, DownloadModeDirect, "a.jpg", ""},
		{"direct+非inline 不设头", false, DownloadModeDirect, "a.jpg", ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := resolveDisposition(c.inline, c.mode, c.filename)
			if got != c.want {
				t.Errorf("resolveDisposition(%v, %q, %q) = %q, want %q",
					c.inline, c.mode, c.filename, got, c.want)
			}
		})
	}
}