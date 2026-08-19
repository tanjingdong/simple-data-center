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