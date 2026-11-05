package usertoken

import (
	"strings"
	"testing"
	"time"
)

func TestGenerateTokenFormat(t *testing.T) {
	plain, hash, err := GenerateToken()
	if err != nil {
		t.Fatalf("GenerateToken 返回错误: %v", err)
	}
	if !strings.HasPrefix(plain, TokenPrefix) {
		t.Errorf("令牌缺少前缀 %q: %s", TokenPrefix, plain)
	}
	if len(plain) != 47 {
		t.Errorf("令牌长度 = %d, 期望 47", len(plain))
	}
	if !IsValidFormat(plain) {
		t.Errorf("生成的令牌未通过格式校验: %s", plain)
	}
	if len(hash) != 64 {
		t.Errorf("哈希长度 = %d, 期望 64", len(hash))
	}
	if hash != HashToken(plain) {
		t.Errorf("返回的哈希与重新计算不一致")
	}
}

func TestGenerateTokenUnique(t *testing.T) {
	a, _, err := GenerateToken()
	if err != nil {
		t.Fatalf("GenerateToken 返回错误: %v", err)
	}
	b, _, err := GenerateToken()
	if err != nil {
		t.Fatalf("GenerateToken 返回错误: %v", err)
	}
	if a == b {
		t.Errorf("两次生成的令牌相同: %s", a)
	}
}

func TestIsValidFormatMatrix(t *testing.T) {
	valid := TokenPrefix + strings.Repeat("a", 43)
	cases := []struct {
		name string
		in   string
		want bool
	}{
		{"合法", valid, true},
		{"空", "", false},
		{"前缀错误", "abc_" + strings.Repeat("a", 43), false},
		{"长度短", TokenPrefix + strings.Repeat("a", 42), false},
		{"长度长", TokenPrefix + strings.Repeat("a", 44), false},
		{"含非法字符", TokenPrefix + strings.Repeat("!", 43), false},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsValidFormat(tt.in); got != tt.want {
				t.Errorf("IsValidFormat(%q) = %v, want %v", tt.in, got, tt.want)
			}
		})
	}
}

func TestHashTokenStable(t *testing.T) {
	token := TokenPrefix + strings.Repeat("b", 43)
	first := HashToken(token)
	if first != HashToken(token) {
		t.Errorf("同一令牌的哈希不稳定")
	}
	if len(first) != 64 {
		t.Errorf("哈希长度 = %d, 期望 64", len(first))
	}
}

func TestShouldUpdateLastUsed(t *testing.T) {
	now := time.Date(2026, 11, 5, 12, 0, 0, 0, time.UTC)
	cases := []struct {
		name     string
		lastUsed time.Time
		want     bool
	}{
		{"从未使用", time.Time{}, true},
		{"60 秒前", now.Add(-60 * time.Second), true},
		{"59 秒前", now.Add(-59 * time.Second), false},
		{"10 秒前", now.Add(-10 * time.Second), false},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			if got := ShouldUpdateLastUsed(tt.lastUsed, now); got != tt.want {
				t.Errorf("ShouldUpdateLastUsed(%v) = %v, want %v", tt.lastUsed, got, tt.want)
			}
		})
	}
}
