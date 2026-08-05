package frpc

import (
	"context"
	"errors"
	"testing"
	"time"

	v1 "github.com/fatedier/frp/pkg/config/v1"
)

// fakeService 模拟 frp 客户端服务:阻塞直到被取消或 release 被关闭。
type fakeService struct {
	released chan struct{}
	runErr   error
}

func (f *fakeService) Run(ctx context.Context) error {
	select {
	case <-ctx.Done():
		return context.Canceled
	case <-f.released:
		return f.runErr
	}
}

func (f *fakeService) Close() {}

// newTestManager 构造一个注入假配置与假服务的 Manager。
// buildSvc 首次返回注入的 svc,后续返回新实例:Restart 会构建「新实例」,
// 若复用同一指针,manager.run 的实例替换判断(m.svr != svr)会误判,
// 导致重启后状态被旧 goroutine 改写为 stopped(见 TestManager_Restart)。
func newTestManager(cfg Config, svc *fakeService) *Manager {
	first := true
	return &Manager{
		loadConfig: func() (Config, error) { return cfg, nil },
		buildSvc: func(
			_ *v1.ClientCommonConfig,
			_ []v1.ProxyConfigurer,
		) (frpcService, error) {
			if first {
				first = false
				return svc, nil
			}
			return &fakeService{released: make(chan struct{})}, nil
		},
		status: StatusUnused,
	}
}

// waitFor 轮询等待条件成立,超时返回 false。
func waitFor(t *testing.T, timeout time.Duration, cond func() bool) bool {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if cond() {
			return true
		}
		time.Sleep(10 * time.Millisecond)
	}
	return false
}

// 启动成功后进入「运行中」,停止后进入「已停止」
func TestManager_StartThenStop(t *testing.T) {
	m := newTestManager(Config{ServerAddr: "x", ServerPort: 7000}, &fakeService{released: make(chan struct{})})

	if err := m.Start(); err != nil {
		t.Fatalf("Start 不应报错:%v", err)
	}
	if !waitFor(t, 2*time.Second, func() bool {
		return m.Status().Status == StatusRunning
	}) {
		t.Fatalf("启动后应进入运行中,当前 %s", m.Status().Status)
	}

	if err := m.Stop(); err != nil {
		t.Fatalf("Stop 不应报错:%v", err)
	}
	if got := m.Status().Status; got != StatusStopped {
		t.Errorf("停止后状态应为 stopped,实际 %s", got)
	}
}

// 配置加载失败:Start 返回错误,状态为「失败」并记录错误
func TestManager_StartConfigLoadError(t *testing.T) {
	m := &Manager{
		loadConfig: func() (Config, error) {
			return Config{}, errors.New("读取 tools_settings 表失败")
		},
		buildSvc: func(_ *v1.ClientCommonConfig, _ []v1.ProxyConfigurer) (frpcService, error) {
			return &fakeService{}, nil
		},
		status: StatusUnused,
	}

	if err := m.Start(); err == nil {
		t.Fatal("配置加载失败时 Start 应报错")
	}
	info := m.Status()
	if info.Status != StatusFailed {
		t.Errorf("状态应为 failed,实际 %s", info.Status)
	}
	if info.Error == "" {
		t.Error("应记录错误信息")
	}
}

// 配置校验失败(server_addr 为空):Start 返回错误,状态「失败」
func TestManager_StartValidationError(t *testing.T) {
	m := newTestManager(Config{}, &fakeService{released: make(chan struct{})})
	if err := m.Start(); err == nil {
		t.Fatal("配置无效时 Start 应报错")
	}
	if info := m.Status(); info.Status != StatusFailed {
		t.Errorf("状态应为 failed,实际 %s", info.Status)
	}
}

// 运行期间出错:状态转为「失败」并记录错误
func TestManager_RunErrorSetsFailed(t *testing.T) {
	svc := &fakeService{released: make(chan struct{}), runErr: errors.New("连接 frps 失败")}
	m := newTestManager(Config{ServerAddr: "x", ServerPort: 7000}, svc)

	if err := m.Start(); err != nil {
		t.Fatalf("Start 不应报错:%v", err)
	}
	if !waitFor(t, 2*time.Second, func() bool {
		return m.Status().Status == StatusRunning
	}) {
		t.Fatalf("启动后应进入运行中,当前 %s", m.Status().Status)
	}

	close(svc.released) // 模拟运行出错
	if !waitFor(t, 2*time.Second, func() bool {
		return m.Status().Status == StatusFailed
	}) {
		t.Fatalf("运行出错后应进入 failed,当前 %s", m.Status().Status)
	}
	if info := m.Status(); info.Error == "" {
		t.Error("应记录运行错误信息")
	}
}

// 已运行时再次 Start:返回错误且状态不变
func TestManager_StartWhileRunning(t *testing.T) {
	m := newTestManager(Config{ServerAddr: "x", ServerPort: 7000}, &fakeService{released: make(chan struct{})})
	if err := m.Start(); err != nil {
		t.Fatalf("首次 Start 不应报错:%v", err)
	}
	if !waitFor(t, 2*time.Second, func() bool {
		return m.Status().Status == StatusRunning
	}) {
		t.Fatalf("启动后应进入运行中,当前 %s", m.Status().Status)
	}
	if err := m.Start(); err == nil {
		t.Error("运行中再次 Start 应报错")
	}
	if got := m.Status().Status; got != StatusRunning {
		t.Errorf("状态应保持 running,实际 %s", got)
	}
}

// 未启动时 Stop 幂等返回 nil
func TestManager_StopWhenUnused(t *testing.T) {
	m := newTestManager(Config{ServerAddr: "x", ServerPort: 7000}, &fakeService{released: make(chan struct{})})
	if err := m.Stop(); err != nil {
		t.Errorf("未启动时 Stop 应幂等返回 nil,实际 %v", err)
	}
	if got := m.Status().Status; got != StatusUnused {
		t.Errorf("状态应保持 unused,实际 %s", got)
	}
}

// 重启:停掉旧实例并用最新配置启动新实例
func TestManager_Restart(t *testing.T) {
	svc := &fakeService{released: make(chan struct{})}
	m := newTestManager(Config{ServerAddr: "x", ServerPort: 7000}, svc)

	if err := m.Start(); err != nil {
		t.Fatalf("Start 不应报错:%v", err)
	}
	if !waitFor(t, 2*time.Second, func() bool {
		return m.Status().Status == StatusRunning
	}) {
		t.Fatalf("启动后应进入运行中,当前 %s", m.Status().Status)
	}

	if err := m.Restart(); err != nil {
		t.Fatalf("Restart 不应报错:%v", err)
	}
	if !waitFor(t, 2*time.Second, func() bool {
		return m.Status().Status == StatusRunning
	}) {
		t.Fatalf("重启后应进入运行中,当前 %s", m.Status().Status)
	}
	// 确认新实例生效:Stop 后状态为 stopped
	if err := m.Stop(); err != nil {
		t.Fatalf("Stop 不应报错:%v", err)
	}
}
