package usertoken

import (
	"testing"
	"time"
)

func TestParsePageParam(t *testing.T) {
	if v, err := parsePageParam("", 20); err != nil || v != 20 {
		t.Errorf("空参数应回退默认值, got (%d, %v)", v, err)
	}
	if v, err := parsePageParam("3", 20); err != nil || v != 3 {
		t.Errorf("合法参数 = (%d, %v), want (3, nil)", v, err)
	}
	for _, raw := range []string{"0", "-1", "abc"} {
		if _, err := parsePageParam(raw, 1); err == nil {
			t.Errorf("非法参数 %q 应报错", raw)
		}
	}
}

func TestUserTokenItem(t *testing.T) {
	created := time.Date(2026, 11, 5, 10, 0, 0, 0, time.UTC)
	item := userTokenItem(&User{
		ID:             "u1",
		Email:          "a@example.com",
		Username:       "alice",
		TokenHash:      "h",
		TokenCreatedAt: created,
	})
	if item["has_token"] != true || item["disabled"] != false {
		t.Errorf("item = %+v", item)
	}
	if _, ok := item["created_at"]; !ok {
		t.Errorf("已生成令牌应包含 created_at")
	}
	if _, ok := item["last_used_at"]; ok {
		t.Errorf("从未使用不应包含 last_used_at")
	}
}
