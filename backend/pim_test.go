package main

import (
	"strings"
	"testing"
)

// 32 字符的 AES-256 测试密钥
const testEncKey = "0123456789abcdef0123456789abcdef"

func TestEncryptIdCard_RoundTrip(t *testing.T) {
	t.Setenv("PIM_ENC_KEY", testEncKey)
	plain := "430101199001011234"
	enc := encryptIdCard(plain)
	if !strings.HasPrefix(enc, encPrefix) {
		t.Fatalf("密文应以 %q 开头,得到 %q", encPrefix, enc)
	}
	if got := decryptIdCard(enc); got != plain {
		t.Errorf("解密后应还原为 %q,得到 %q", plain, got)
	}
}

func TestEncryptIdCard_EmptyKeepsEmpty(t *testing.T) {
	t.Setenv("PIM_ENC_KEY", testEncKey)
	if got := encryptIdCard(""); got != "" {
		t.Errorf("空值应原样返回,得到 %q", got)
	}
}

func TestEncryptIdCard_AlreadyEncryptedIdempotent(t *testing.T) {
	t.Setenv("PIM_ENC_KEY", testEncKey)
	enc := encryptIdCard("430101199001011234")
	if got := encryptIdCard(enc); got != enc {
		t.Errorf("重复加密应保持原密文,得到 %q", got)
	}
}

func TestEncryptIdCard_NoKeyNoEncryption(t *testing.T) {
	t.Setenv("PIM_ENC_KEY", "")
	if got := encryptIdCard("430101199001011234"); got != "430101199001011234" {
		t.Errorf("密钥未设置时不应加密,得到 %q", got)
	}
}

func TestDecryptIdCard_PlaintextPassthrough(t *testing.T) {
	t.Setenv("PIM_ENC_KEY", testEncKey)
	if got := decryptIdCard("430101199001011234"); got != "430101199001011234" {
		t.Errorf("无前缀明文应原样返回,得到 %q", got)
	}
}

func TestDecryptIdCard_InvalidCiphertextKeepsRaw(t *testing.T) {
	t.Setenv("PIM_ENC_KEY", testEncKey)
	raw := encPrefix + "!!!not-base64!!!"
	if got := decryptIdCard(raw); got != raw {
		t.Errorf("无效密文应原样返回,得到 %q", got)
	}
}

func TestDecryptIdCard_WrongKeyKeepsRaw(t *testing.T) {
	t.Setenv("PIM_ENC_KEY", testEncKey)
	enc := encryptIdCard("430101199001011234")
	t.Setenv("PIM_ENC_KEY", "fedcba9876543210fedcba9876543210")
	if got := decryptIdCard(enc); got != enc {
		t.Errorf("密钥不匹配时应返回原密文,得到 %q", got)
	}
}

func TestDecryptIdCard_ShortBase64KeepsRaw(t *testing.T) {
	t.Setenv("PIM_ENC_KEY", testEncKey)
	raw := encPrefix + "YWJjZA==" // 解码后不足 GCM nonce(12 字节),不应 panic
	if got := decryptIdCard(raw); got != raw {
		t.Errorf("短密文应原样返回而不 panic,得到 %q", got)
	}
}

func TestNormalizeRelationPair_AlreadyCanonical(t *testing.T) {
	a, b := normalizeRelationPair("aaa111", "bbb222")
	if a != "aaa111" || b != "bbb222" {
		t.Errorf("已规范序不应交换,得到 %s / %s", a, b)
	}
}

func TestNormalizeRelationPair_Swaps(t *testing.T) {
	a, b := normalizeRelationPair("bbb222", "aaa111")
	if a != "aaa111" || b != "bbb222" {
		t.Errorf("应交换为规范序,得到 %s / %s", a, b)
	}
}

func TestValidateRating_Valid(t *testing.T) {
	for _, v := range []int{1, 2, 3, 4, 5} {
		if err := validateRating(v, "trust_level"); err != nil {
			t.Errorf("评级 %d 应通过,得到 %v", v, err)
		}
	}
}

func TestValidateRating_Invalid(t *testing.T) {
	for _, v := range []int{0, -1, 6, 99} {
		if err := validateRating(v, "trust_level"); err == nil {
			t.Errorf("评级 %d 应被拒绝", v)
		}
	}
}
