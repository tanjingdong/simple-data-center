package usertoken

import (
	"errors"
	"strings"
	"testing"
	"time"
)

type fakeStore struct {
	users   map[string]*User
	updates int
	listArg struct {
		query   string
		page    int
		perPage int
	}
}

func newFakeStore(users ...*User) *fakeStore {
	s := &fakeStore{users: map[string]*User{}}
	for _, u := range users {
		s.users[u.ID] = u
	}
	return s
}

func (s *fakeStore) FindByTokenHash(hash string) (*User, error) {
	for _, u := range s.users {
		if u.TokenHash != "" && u.TokenHash == hash {
			clone := *u
			return &clone, nil
		}
	}
	return nil, ErrUserNotFound
}

func (s *fakeStore) FindByID(id string) (*User, error) {
	u, ok := s.users[id]
	if !ok {
		return nil, ErrUserNotFound
	}
	clone := *u
	return &clone, nil
}

func (s *fakeStore) List(query string, page, perPage int) ([]*User, int64, error) {
	s.listArg.query = query
	s.listArg.page = page
	s.listArg.perPage = perPage
	users := make([]*User, 0, len(s.users))
	for _, u := range s.users {
		clone := *u
		users = append(users, &clone)
	}
	return users, int64(len(users)), nil
}

func (s *fakeStore) UpdateToken(id, hash string, createdAt, lastUsedAt time.Time, disabled bool) error {
	u, ok := s.users[id]
	if !ok {
		return ErrUserNotFound
	}
	u.TokenHash = hash
	u.TokenCreatedAt = createdAt
	u.TokenLastUsedAt = lastUsedAt
	u.TokenDisabled = disabled
	s.updates++
	return nil
}

func (s *fakeStore) ClearToken(id string) error {
	u, ok := s.users[id]
	if !ok {
		return ErrUserNotFound
	}
	u.TokenHash = ""
	u.TokenCreatedAt = time.Time{}
	u.TokenLastUsedAt = time.Time{}
	u.TokenDisabled = false
	s.updates++
	return nil
}

var fixedNow = time.Date(2026, 11, 5, 12, 0, 0, 0, time.UTC)

func newTestService(store Store, enabled bool) *Service {
	return newService(
		store,
		func() (Config, error) { return Config{Enabled: enabled}, nil },
		func() time.Time { return fixedNow },
	)
}

func TestGenerateWhenDisabled(t *testing.T) {
	store := newFakeStore(&User{ID: "u1", Email: "a@example.com"})
	svc := newTestService(store, false)
	if _, _, err := svc.Generate("u1"); !errors.Is(err, ErrFeatureDisabled) {
		t.Fatalf("err = %v, want ErrFeatureDisabled", err)
	}
}

func TestGenerateResetsTokenAndClearsDisabled(t *testing.T) {
	old := "old-hash"
	store := newFakeStore(&User{
		ID:              "u1",
		TokenHash:       old,
		TokenCreatedAt:  fixedNow.Add(-time.Hour),
		TokenLastUsedAt: fixedNow.Add(-time.Minute),
		TokenDisabled:   true,
	})
	svc := newTestService(store, true)
	plain, createdAt, err := svc.Generate("u1")
	if err != nil {
		t.Fatalf("Generate 返回错误: %v", err)
	}
	if !IsValidFormat(plain) {
		t.Errorf("返回的令牌格式非法: %s", plain)
	}
	u := store.users["u1"]
	if u.TokenHash != HashToken(plain) {
		t.Errorf("存储的哈希与明文不匹配")
	}
	if u.TokenHash == old {
		t.Errorf("旧哈希未被覆盖")
	}
	if !u.TokenCreatedAt.Equal(createdAt) {
		t.Errorf("创建时间 = %v, want %v", u.TokenCreatedAt, createdAt)
	}
	if !u.TokenLastUsedAt.IsZero() {
		t.Errorf("生成后最后使用时间应清空, got %v", u.TokenLastUsedAt)
	}
	if u.TokenDisabled {
		t.Errorf("重建后禁用标记应清除")
	}
}

func TestRevoke(t *testing.T) {
	store := newFakeStore(&User{ID: "u1", TokenHash: "h"})
	svc := newTestService(store, true)
	if err := svc.Revoke("u1"); err != nil {
		t.Fatalf("Revoke 返回错误: %v", err)
	}
	if store.users["u1"].TokenHash != "" {
		t.Errorf("令牌未清空")
	}
}

func TestRevokeWithoutToken(t *testing.T) {
	svc := newTestService(newFakeStore(&User{ID: "u1"}), true)
	if err := svc.Revoke("u1"); !errors.Is(err, ErrNoToken) {
		t.Fatalf("err = %v, want ErrNoToken", err)
	}
}

func TestRevokeWhenDisabled(t *testing.T) {
	svc := newTestService(newFakeStore(&User{ID: "u1", TokenHash: "h"}), false)
	if err := svc.Revoke("u1"); !errors.Is(err, ErrFeatureDisabled) {
		t.Fatalf("err = %v, want ErrFeatureDisabled", err)
	}
}

func TestVerifyInvalidFormat(t *testing.T) {
	svc := newTestService(newFakeStore(), true)
	if _, err := svc.Verify("not-a-token"); !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("err = %v, want ErrInvalidToken", err)
	}
}

func TestVerifyFeatureDisabled(t *testing.T) {
	plain := TokenPrefix + strings.Repeat("a", 43)
	svc := newTestService(newFakeStore(&User{ID: "u1", TokenHash: HashToken(plain)}), false)
	if _, err := svc.Verify(plain); !errors.Is(err, ErrFeatureDisabled) {
		t.Fatalf("err = %v, want ErrFeatureDisabled", err)
	}
}

func TestVerifyUnknownToken(t *testing.T) {
	plain := TokenPrefix + strings.Repeat("a", 43)
	svc := newTestService(newFakeStore(&User{ID: "u1", TokenHash: "other"}), true)
	if _, err := svc.Verify(plain); !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("err = %v, want ErrInvalidToken", err)
	}
}

func TestVerifyDisabledToken(t *testing.T) {
	plain := TokenPrefix + strings.Repeat("a", 43)
	store := newFakeStore(&User{ID: "u1", TokenHash: HashToken(plain), TokenDisabled: true})
	svc := newTestService(store, true)
	if _, err := svc.Verify(plain); !errors.Is(err, ErrTokenDisabled) {
		t.Fatalf("err = %v, want ErrTokenDisabled", err)
	}
}

func TestVerifyUpdatesLastUsedThrottled(t *testing.T) {
	plain := TokenPrefix + strings.Repeat("a", 43)
	store := newFakeStore(&User{ID: "u1", TokenHash: HashToken(plain), TokenCreatedAt: fixedNow})
	svc := newTestService(store, true)
	if _, err := svc.Verify(plain); err != nil {
		t.Fatalf("Verify 返回错误: %v", err)
	}
	if store.updates != 1 || !store.users["u1"].TokenLastUsedAt.Equal(fixedNow) {
		t.Errorf("首次校验应更新最后使用时间")
	}

	store2 := newFakeStore(&User{
		ID:              "u1",
		TokenHash:       HashToken(plain),
		TokenLastUsedAt: fixedNow.Add(-10 * time.Second),
	})
	svc2 := newTestService(store2, true)
	if _, err := svc2.Verify(plain); err != nil {
		t.Fatalf("Verify 返回错误: %v", err)
	}
	if store2.updates != 0 {
		t.Errorf("节流期内不应写库, updates = %d", store2.updates)
	}
}

func TestAdminSetDisabled(t *testing.T) {
	store := newFakeStore(&User{ID: "u1", TokenHash: "h", TokenCreatedAt: fixedNow})
	svc := newTestService(store, true)
	if err := svc.AdminSetDisabled("u1", true); err != nil {
		t.Fatalf("AdminSetDisabled 返回错误: %v", err)
	}
	if !store.users["u1"].TokenDisabled {
		t.Errorf("禁用标记未写入")
	}
	if err := svc.AdminSetDisabled("u1", false); err != nil {
		t.Fatalf("AdminSetDisabled 返回错误: %v", err)
	}
	if store.users["u1"].TokenDisabled {
		t.Errorf("启用后禁用标记应为 false")
	}
}

func TestAdminSetDisabledWithoutToken(t *testing.T) {
	svc := newTestService(newFakeStore(&User{ID: "u1"}), true)
	if err := svc.AdminSetDisabled("u1", true); !errors.Is(err, ErrNoToken) {
		t.Fatalf("err = %v, want ErrNoToken", err)
	}
}

func TestAdminDelete(t *testing.T) {
	store := newFakeStore(&User{ID: "u1", TokenHash: "h"})
	svc := newTestService(store, true)
	if err := svc.AdminDelete("u1"); err != nil {
		t.Fatalf("AdminDelete 返回错误: %v", err)
	}
	if store.users["u1"].TokenHash != "" {
		t.Errorf("令牌未清空")
	}
}

func TestAdminListDefaults(t *testing.T) {
	store := newFakeStore(&User{ID: "u1"})
	svc := newTestService(store, true)
	if _, _, err := svc.AdminList("", 0, 0); err != nil {
		t.Fatalf("AdminList 返回错误: %v", err)
	}
	if store.listArg.page != 1 || store.listArg.perPage != 20 {
		t.Errorf("默认分页 = (%d, %d), want (1, 20)", store.listArg.page, store.listArg.perPage)
	}
	if _, _, err := svc.AdminList("q", 2, 500); err != nil {
		t.Fatalf("AdminList 返回错误: %v", err)
	}
	if store.listArg.page != 2 || store.listArg.perPage != 100 {
		t.Errorf("分页上限 = (%d, %d), want (2, 100)", store.listArg.page, store.listArg.perPage)
	}
}

func TestStatus(t *testing.T) {
	created := fixedNow.Add(-time.Hour)
	lastUsed := fixedNow.Add(-time.Minute)
	store := newFakeStore(&User{
		ID:              "u1",
		TokenHash:       "h",
		TokenCreatedAt:  created,
		TokenLastUsedAt: lastUsed,
	})
	svc := newTestService(store, true)
	st, err := svc.Status("u1")
	if err != nil {
		t.Fatalf("Status 返回错误: %v", err)
	}
	if !st.Enabled || !st.HasToken {
		t.Errorf("Status = %+v, want Enabled+HasToken", st)
	}
	if st.CreatedAt == nil || !st.CreatedAt.Equal(created) {
		t.Errorf("CreatedAt = %v, want %v", st.CreatedAt, created)
	}
	if st.LastUsedAt == nil || !st.LastUsedAt.Equal(lastUsed) {
		t.Errorf("LastUsedAt = %v, want %v", st.LastUsedAt, lastUsed)
	}
}

func TestStatusWithoutToken(t *testing.T) {
	svc := newTestService(newFakeStore(&User{ID: "u1"}), false)
	st, err := svc.Status("u1")
	if err != nil {
		t.Fatalf("Status 返回错误: %v", err)
	}
	if st.Enabled || st.HasToken {
		t.Errorf("Status = %+v, want 关闭且无令牌", st)
	}
	if st.CreatedAt != nil || st.LastUsedAt != nil {
		t.Errorf("无令牌时时间字段应为 nil")
	}
}
