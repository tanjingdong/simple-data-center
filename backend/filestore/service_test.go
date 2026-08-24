package filestore

import (
	"database/sql"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

// newFilestoreTestApp 创建带 filestore_files + tools_settings 集合的测试应用,
// filestore_alist_url 配置项指向 alistURL(假 Alist)。
func newFilestoreTestApp(t *testing.T, alistURL string) *pocketbase.PocketBase {
	t.Helper()
	pb := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: t.TempDir()})
	if err := pb.Bootstrap(); err != nil {
		t.Fatalf("初始化测试应用失败: %v", err)
	}

	// filestore_files 集合(DeleteFile 只读 storage_key,其余字段给最小集)
	// 注意:PocketBase v0.39 的 FieldsList.Add 返回无值(void),不能接 err
	fsCol := core.NewBaseCollection("filestore_files")
	fsCol.Fields.Add(
		&core.TextField{Name: "owner"},
		&core.TextField{Name: "storage_key"},
		&core.TextField{Name: "original_name"},
		&core.TextField{Name: "mime"},
		&core.NumberField{Name: "size"},
	)
	if err := pb.Save(fsCol); err != nil {
		t.Fatalf("保存 filestore_files 集合失败: %v", err)
	}

	// tools_settings 集合 + filestore_alist_url/token 配置项
	tsCol := core.NewBaseCollection("tools_settings")
	tsCol.Fields.Add(
		&core.TextField{Name: "option"},
		&core.TextField{Name: "value"},
		&core.TextField{Name: "type"},
		&core.TextField{Name: "description"},
	)
	if err := pb.Save(tsCol); err != nil {
		t.Fatalf("保存 tools_settings 集合失败: %v", err)
	}
	for _, kv := range [][2]string{
		{"filestore_alist_url", alistURL},
		{"filestore_alist_token", "test-token"},
	} {
		rec := core.NewRecord(tsCol)
		rec.Set("option", kv[0])
		rec.Set("value", kv[1])
		rec.Set("type", "string")
		if err := pb.Save(rec); err != nil {
			t.Fatalf("写入配置项 %s 失败: %v", kv[0], err)
		}
	}
	return pb
}

// saveFilestoreFile 在 filestore_files 集合写一条记录,返回该记录。
func saveFilestoreFile(t *testing.T, pb *pocketbase.PocketBase, storageKey string) *core.Record {
	t.Helper()
	col, err := pb.FindCollectionByNameOrId("filestore_files")
	if err != nil {
		t.Fatalf("查找 filestore_files 集合失败: %v", err)
	}
	rec := core.NewRecord(col)
	rec.Set("owner", "u1")
	rec.Set("storage_key", storageKey)
	rec.Set("original_name", "test.jpg")
	rec.Set("mime", "image/jpeg")
	rec.Set("size", 1024)
	if err := pb.Save(rec); err != nil {
		t.Fatalf("保存 filestore_files 记录失败: %v", err)
	}
	return rec
}

// mockAlistSrv 起一个假 Alist,记录是否收到 /api/fs/remove。
func mockAlistSrv(t *testing.T, removeOK bool) (*httptest.Server, *bool) {
	t.Helper()
	removed := false
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/fs/remove" {
			removed = true
			if removeOK {
				w.Write([]byte(`{"code":200,"message":"success"}`))
				return
			}
			w.Write([]byte(`{"code":500,"message":"boom"}`))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	t.Cleanup(srv.Close)
	return srv, &removed
}

func TestDeleteFile_RemovesAlistAndRecord(t *testing.T) {
	srv, removed := mockAlistSrv(t, true)
	pb := newFilestoreTestApp(t, srv.URL)
	rec := saveFilestoreFile(t, pb, "/simple-data-center/2026/08/u1/test.jpg")

	if err := DeleteFile(pb, rec.Id); err != nil {
		t.Fatalf("DeleteFile 失败: %v", err)
	}
	if !*removed {
		t.Error("应调用 Alist /api/fs/remove 删除实际文件")
	}
	if _, err := pb.FindRecordById("filestore_files", rec.Id); !errors.Is(err, sql.ErrNoRows) {
		t.Errorf("filestore_files 记录应被删除,得到 err=%v", err)
	}
}

func TestDeleteFile_IdempotentWhenMissing(t *testing.T) {
	srv, _ := mockAlistSrv(t, true)
	pb := newFilestoreTestApp(t, srv.URL)
	// 删一个不存在的 ID:应幂等返回 nil,不报错
	if err := DeleteFile(pb, "nonexistent0001"); err != nil {
		t.Fatalf("删不存在记录应幂等返回 nil,得到 %v", err)
	}
}

func TestDeleteFile_ToleratesAlistFailure(t *testing.T) {
	// Alist 返回业务错误(500):DeleteFile 仍应删 DB 记录,不阻断
	srv, _ := mockAlistSrv(t, false)
	pb := newFilestoreTestApp(t, srv.URL)
	rec := saveFilestoreFile(t, pb, "/simple-data-center/2026/08/u1/test.jpg")

	if err := DeleteFile(pb, rec.Id); err != nil {
		t.Fatalf("Alist 删除失败时 DeleteFile 不应返回错误,得到 %v", err)
	}
	if _, err := pb.FindRecordById("filestore_files", rec.Id); !errors.Is(err, sql.ErrNoRows) {
		t.Error("Alist 失败仍应删除 filestore_files 记录")
	}
}
