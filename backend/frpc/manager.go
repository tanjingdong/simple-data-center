package frpc

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"github.com/fatedier/frp/client"
	"github.com/fatedier/frp/pkg/config/source"
	"github.com/fatedier/frp/pkg/config/v1"
	"github.com/fatedier/frp/pkg/policy/security"
	"github.com/fatedier/frp/pkg/util/log"
	"github.com/pocketbase/pocketbase"
)

// Status 表示 frpc 的运行状态(仅存内存,主程序重启后回到 unused)。
type Status string

const (
	// StatusUnused 未启用:从未启动过,或主程序重启后的初始状态
	StatusUnused Status = "unused"
	// StatusStarting 启动中:服务进程已拉起,正在建立与 frps 的连接
	StatusStarting Status = "starting"
	// StatusRunning 运行中:frpc 服务进程存活。初始连接失败时约 10 秒
	// (拨号超时)后转为 failed;已建立连接后 frps 断线由 frp 内部自动
	// 重连,状态保持 running。
	StatusRunning Status = "running"
	// StatusStopped 已停止:管理员手动停止
	StatusStopped Status = "stopped"
	// StatusFailed 失败:启动失败或运行期间出错(附最近错误信息)
	StatusFailed Status = "failed"
)

// StatusInfo 是状态查询的返回结构(直接作为 JSON 响应体)。
type StatusInfo struct {
	Status Status `json:"status"`
	// Error 是最近一次失败的原因,无失败时为空
	Error string `json:"error,omitempty"`
}

// frpcService 抽象 frp 客户端服务的运行接口,便于测试替身。
type frpcService interface {
	Run(ctx context.Context) error
	Close()
}

// loadConfigFn 抽象配置来源,便于测试注入。
type loadConfigFn func() (Config, error)

// buildSvcFn 抽象 frp 服务的构建,便于测试注入。
type buildSvcFn func(common *v1.ClientCommonConfig, proxies []v1.ProxyConfigurer) (frpcService, error)

// Manager 管理 frpc 的生命周期与状态。
type Manager struct {
	pb         *pocketbase.PocketBase
	loadConfig loadConfigFn
	buildSvc   buildSvcFn

	mu      sync.Mutex
	status  Status
	lastErr error
	svr     frpcService // 当前运行中的服务实例
	cancel  context.CancelFunc
}

// NewManager 创建 frpc 管理器,默认从 tools_settings 表读取配置。
func NewManager(pb *pocketbase.PocketBase) *Manager {
	return &Manager{
		pb:         pb,
		loadConfig: func() (Config, error) { return LoadConfig(pb) },
		buildSvc:   buildService,
		status:     StatusUnused,
	}
}

// Status 返回当前状态与最近错误。
func (m *Manager) Status() StatusInfo {
	m.mu.Lock()
	defer m.mu.Unlock()
	info := StatusInfo{Status: m.status}
	if m.lastErr != nil {
		info.Error = m.lastErr.Error()
	}
	return info
}

// Start 启动 frpc。
// 配置读取或校验失败时返回错误,并将状态置为 failed;
// 已在运行或启动中时返回错误,不改变状态。
func (m *Manager) Start() error {
	m.mu.Lock()
	if m.status == StatusRunning || m.status == StatusStarting {
		m.mu.Unlock()
		return fmt.Errorf("frpc 已在运行或启动中")
	}

	cfg, err := m.loadConfig()
	if err != nil {
		m.status, m.lastErr = StatusFailed, err
		m.mu.Unlock()
		return err
	}
	common, proxies, err := cfg.BuildClientConfig()
	if err != nil {
		m.status, m.lastErr = StatusFailed, err
		m.mu.Unlock()
		return err
	}
	svr, err := m.buildSvc(common, proxies)
	if err != nil {
		m.status, m.lastErr = StatusFailed, err
		m.mu.Unlock()
		return err
	}

	ctx, cancel := context.WithCancel(context.Background())
	m.svr = svr
	m.cancel = cancel
	m.status = StatusStarting
	m.lastErr = nil
	m.mu.Unlock()

	go m.run(svr, ctx)
	return nil
}

// run 在后台运行 frpc,直到出错或被停止。
func (m *Manager) run(svr frpcService, ctx context.Context) {
	m.mu.Lock()
	if m.svr == svr {
		m.status = StatusRunning
	}
	m.mu.Unlock()

	err := svr.Run(ctx)

	m.mu.Lock()
	defer m.mu.Unlock()
	// 已被 Stop/Restart 替换的旧实例,其退出不改变状态
	if m.svr != svr {
		return
	}
	m.svr = nil
	m.cancel = nil
	if err != nil && !errors.Is(err, context.Canceled) {
		m.status = StatusFailed
		m.lastErr = err
		return
	}
	// 正常退出(被取消):状态已由 Stop 置为 stopped,这里兜底
	if m.status != StatusStopped {
		m.status = StatusStopped
	}
}

// Stop 停止 frpc。未运行时幂等返回 nil。
func (m *Manager) Stop() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.status != StatusRunning && m.status != StatusStarting {
		return nil
	}
	if m.cancel != nil {
		m.cancel()
	}
	m.svr = nil
	m.cancel = nil
	m.status = StatusStopped
	return nil
}

// Restart 停止当前实例并用最新配置重新启动。
func (m *Manager) Restart() error {
	if err := m.Stop(); err != nil {
		return err
	}
	return m.Start()
}

// buildService 构建真实的 frp 客户端服务(v0.70.1 API)。
func buildService(common *v1.ClientCommonConfig, proxies []v1.ProxyConfigurer) (frpcService, error) {
	log.InitLogger(common.Log.To, common.Log.Level, int(common.Log.MaxDays), common.Log.DisablePrintColor)

	configSource := source.NewConfigSource()
	if err := configSource.ReplaceAll(proxies, nil); err != nil {
		return nil, fmt.Errorf("设置代理配置失败: %w", err)
	}
	aggregator := source.NewAggregator(configSource)

	svr, err := client.NewService(client.ServiceOptions{
		Common:                 common,
		ConfigSourceAggregator: aggregator,
		UnsafeFeatures:         security.NewUnsafeFeatures(nil),
	})
	if err != nil {
		return nil, fmt.Errorf("创建 frpc 服务失败: %w", err)
	}
	return svr, nil
}
