// Package usertoken 实现用户 API 令牌的生成、校验、撤销与服务端管理。
package usertoken

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"regexp"
	"time"
)

const (
	// TokenPrefix 是令牌明文前缀，便于识别与日志过滤。
	TokenPrefix = "sdc_"

	tokenRandomBytes = 32
	// lastUsedThrottle 是 last_used_at 的最小更新间隔，避免每次请求写库。
	lastUsedThrottle = 60 * time.Second
)

var tokenFormatPattern = regexp.MustCompile(`^sdc_[A-Za-z0-9_-]{43}$`)

// GenerateToken 生成新令牌，返回明文与 SHA-256 哈希。
func GenerateToken() (plain string, hash string, err error) {
	buf := make([]byte, tokenRandomBytes)
	if _, err := rand.Read(buf); err != nil {
		return "", "", fmt.Errorf("生成随机令牌失败: %w", err)
	}
	plain = TokenPrefix + base64.RawURLEncoding.EncodeToString(buf)
	return plain, HashToken(plain), nil
}

// HashToken 返回令牌明文的 SHA-256 小写十六进制哈希。
func HashToken(plain string) string {
	sum := sha256.Sum256([]byte(plain))
	return hex.EncodeToString(sum[:])
}

// IsValidFormat 检查令牌是否符合固定格式，避免对非法输入查库。
func IsValidFormat(plain string) bool {
	return tokenFormatPattern.MatchString(plain)
}

// ShouldUpdateLastUsed 判断是否应按节流间隔更新最后使用时间。
func ShouldUpdateLastUsed(lastUsed, now time.Time) bool {
	if lastUsed.IsZero() {
		return true
	}
	return now.Sub(lastUsed) >= lastUsedThrottle
}
