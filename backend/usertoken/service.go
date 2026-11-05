package usertoken

import (
	"database/sql"
	"errors"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/search"
)

// 业务错误:handler 据此映射 HTTP 状态码。
var (
	ErrFeatureDisabled = errors.New("API 令牌功能未启用")
	ErrInvalidToken    = errors.New("API 令牌无效")
	ErrTokenDisabled   = errors.New("API 令牌已被管理员禁用")
	ErrNoToken         = errors.New("该用户尚未生成 API 令牌")
	ErrUserNotFound    = errors.New("用户不存在")
)

// User 是令牌业务所需的用户视图。
type User struct {
	ID              string
	Email           string
	Username        string
	TokenHash       string
	TokenCreatedAt  time.Time
	TokenLastUsedAt time.Time
	TokenDisabled   bool
}

// HasToken 报告用户是否已生成令牌。
func (u *User) HasToken() bool { return u.TokenHash != "" }

// Status 是用户自助状态接口的响应。
type Status struct {
	Enabled       bool       `json:"enabled"`
	HasToken      bool       `json:"has_token"`
	CreatedAt     *time.Time `json:"created_at,omitempty"`
	LastUsedAt    *time.Time `json:"last_used_at,omitempty"`
	AdminDisabled bool       `json:"admin_disabled"`
}

// Store 抽象令牌持久化,便于单元测试注入 fake 实现。
type Store interface {
	FindByTokenHash(hash string) (*User, error)
	FindByID(id string) (*User, error)
	List(query string, page, perPage int) ([]*User, int64, error)
	UpdateToken(id, hash string, createdAt, lastUsedAt time.Time, disabled bool) error
	ClearToken(id string) error
}

// Service 实现用户令牌的业务逻辑。
type Service struct {
	store  Store
	config func() (Config, error)
	now    func() time.Time
	warn   func(msg string, args ...any)
}

// NewService 创建使用 PocketBase 存储的服务实例。
func NewService(app *pocketbase.PocketBase) *Service {
	return &Service{
		store:  &pbStore{app: app},
		config: func() (Config, error) { return LoadConfig(app) },
		now:    time.Now,
		warn: func(msg string, args ...any) {
			app.Logger().Warn(msg, args...)
		},
	}
}

// newService 供单元测试构造服务。
func newService(store Store, config func() (Config, error), now func() time.Time) *Service {
	return &Service{
		store:  store,
		config: config,
		now:    now,
		warn:   func(string, ...any) {},
	}
}

func (s *Service) enabled() (bool, error) {
	cfg, err := s.config()
	if err != nil {
		return false, err
	}
	return cfg.Enabled, nil
}

// Status 返回用户令牌状态。
func (s *Service) Status(userID string) (*Status, error) {
	user, err := s.store.FindByID(userID)
	if err != nil {
		return nil, err
	}
	enabled, cfgErr := s.enabled()
	if cfgErr != nil {
		s.warn("读取 API 令牌功能开关失败", "error", cfgErr.Error())
	}
	st := &Status{
		Enabled:       cfgErr == nil && enabled,
		HasToken:      user.HasToken(),
		AdminDisabled: user.TokenDisabled,
	}
	if user.HasToken() {
		created := user.TokenCreatedAt
		st.CreatedAt = &created
		if !user.TokenLastUsedAt.IsZero() {
			lastUsed := user.TokenLastUsedAt
			st.LastUsedAt = &lastUsed
		}
	}
	return st, nil
}

// Generate 为用户生成/重置令牌,返回明文与生成时间。
func (s *Service) Generate(userID string) (string, time.Time, error) {
	enabled, err := s.enabled()
	if err != nil {
		return "", time.Time{}, err
	}
	if !enabled {
		return "", time.Time{}, ErrFeatureDisabled
	}
	user, err := s.store.FindByID(userID)
	if err != nil {
		return "", time.Time{}, err
	}
	plain, hash, err := GenerateToken()
	if err != nil {
		return "", time.Time{}, err
	}
	createdAt := s.now()
	if err := s.store.UpdateToken(user.ID, hash, createdAt, time.Time{}, false); err != nil {
		return "", time.Time{}, err
	}
	return plain, createdAt, nil
}

// Revoke 删除用户自己的令牌。
func (s *Service) Revoke(userID string) error {
	enabled, err := s.enabled()
	if err != nil {
		return err
	}
	if !enabled {
		return ErrFeatureDisabled
	}
	user, err := s.store.FindByID(userID)
	if err != nil {
		return err
	}
	if !user.HasToken() {
		return ErrNoToken
	}
	return s.store.ClearToken(userID)
}

// AdminList 分页查询用户令牌状态。
func (s *Service) AdminList(query string, page, perPage int) ([]*User, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage <= 0 {
		perPage = 20
	}
	if perPage > 100 {
		perPage = 100
	}
	return s.store.List(query, page, perPage)
}

// AdminSetDisabled 禁用/启用指定用户的令牌。
func (s *Service) AdminSetDisabled(userID string, disabled bool) error {
	user, err := s.store.FindByID(userID)
	if err != nil {
		return err
	}
	if !user.HasToken() {
		return ErrNoToken
	}
	return s.store.UpdateToken(user.ID, user.TokenHash, user.TokenCreatedAt, user.TokenLastUsedAt, disabled)
}

// AdminDelete 删除指定用户的令牌。
func (s *Service) AdminDelete(userID string) error {
	user, err := s.store.FindByID(userID)
	if err != nil {
		return err
	}
	if !user.HasToken() {
		return ErrNoToken
	}
	return s.store.ClearToken(userID)
}

// Verify 校验令牌并返回对应用户;成功后按节流更新最后使用时间。
func (s *Service) Verify(token string) (*User, error) {
	if !IsValidFormat(token) {
		return nil, ErrInvalidToken
	}
	enabled, err := s.enabled()
	if err != nil {
		return nil, err
	}
	if !enabled {
		return nil, ErrFeatureDisabled
	}
	user, err := s.store.FindByTokenHash(HashToken(token))
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			return nil, ErrInvalidToken
		}
		return nil, err
	}
	if user.TokenDisabled {
		return nil, ErrTokenDisabled
	}
	now := s.now()
	if ShouldUpdateLastUsed(user.TokenLastUsedAt, now) {
		if err := s.store.UpdateToken(user.ID, user.TokenHash, user.TokenCreatedAt, now, false); err != nil {
			s.warn("更新 API 令牌最后使用时间失败", "error", err.Error(), "user", user.ID)
		} else {
			user.TokenLastUsedAt = now
		}
	}
	return user, nil
}

// pbStore 是 Store 的 PocketBase 实现。
type pbStore struct {
	app *pocketbase.PocketBase
}

func recordToUser(rec *core.Record) *User {
	return &User{
		ID:              rec.Id,
		Email:           rec.GetString("email"),
		Username:        rec.GetString("username"),
		TokenHash:       rec.GetString("api_token_hash"),
		TokenCreatedAt:  rec.GetDateTime("api_token_created_at").Time(),
		TokenLastUsedAt: rec.GetDateTime("api_token_last_used_at").Time(),
		TokenDisabled:   rec.GetBool("api_token_disabled"),
	}
}

func (s *pbStore) FindByTokenHash(hash string) (*User, error) {
	records, err := s.app.FindRecordsByFilter(
		"users", "api_token_hash = {:hash}", "", 1, 0,
		dbx.Params{"hash": hash},
	)
	if err != nil {
		return nil, err
	}
	if len(records) == 0 {
		return nil, ErrUserNotFound
	}
	return recordToUser(records[0]), nil
}

func (s *pbStore) FindByID(id string) (*User, error) {
	rec, err := s.app.FindRecordById("users", id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return recordToUser(rec), nil
}

func (s *pbStore) List(query string, page, perPage int) ([]*User, int64, error) {
	filter := ""
	params := dbx.Params{}
	if query != "" {
		filter = "(email ~ {:q} || username ~ {:q})"
		params["q"] = query
	}
	records, err := s.app.FindRecordsByFilter(
		"users", filter, "-created", perPage, (page-1)*perPage, params,
	)
	if err != nil {
		return nil, 0, err
	}
	var countExprs []dbx.Expression
	if query != "" {
		collection, err := s.app.FindCollectionByNameOrId("users")
		if err != nil {
			return nil, 0, err
		}
		expr, err := search.FilterData(filter).BuildExpr(
			core.NewRecordFieldResolver(s.app, collection, nil, true),
			params,
		)
		if err != nil {
			return nil, 0, err
		}
		countExprs = append(countExprs, expr)
	}
	total, err := s.app.CountRecords("users", countExprs...)
	if err != nil {
		return nil, 0, err
	}
	users := make([]*User, 0, len(records))
	for _, rec := range records {
		users = append(users, recordToUser(rec))
	}
	return users, total, nil
}

func (s *pbStore) UpdateToken(id, hash string, createdAt, lastUsedAt time.Time, disabled bool) error {
	rec, err := s.app.FindRecordById("users", id)
	if err != nil {
		return err
	}
	rec.Set("api_token_hash", hash)
	rec.Set("api_token_created_at", createdAt)
	rec.Set("api_token_last_used_at", lastUsedAt)
	rec.Set("api_token_disabled", disabled)
	return s.app.Save(rec)
}

func (s *pbStore) ClearToken(id string) error {
	rec, err := s.app.FindRecordById("users", id)
	if err != nil {
		return err
	}
	rec.Set("api_token_hash", "")
	rec.Set("api_token_created_at", time.Time{})
	rec.Set("api_token_last_used_at", time.Time{})
	rec.Set("api_token_disabled", false)
	return s.app.Save(rec)
}
