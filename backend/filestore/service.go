package filestore

import (
	"database/sql"
	"errors"

	"github.com/pocketbase/pocketbase"
)

// DeleteFile 删除单个 filestore_files 记录及其在 Alist 上的实际文件。
// 供后端内部调用(如 health 删事件级联删凭证),绕过 HTTP handler 的 owner 鉴权——
// 删除事件是系统行为,非用户对他人文件的操作。
//
// 行为:
//   - 记录不存在视为已删除(幂等,返回 nil)。
//   - Alist 删除失败仅记日志告警,不阻断 DB 记录删除(残留 Alist 文件由孤儿对账清理)。
//   - 配置读取失败(如 tools_settings 未初始化)也按零配置处理,容错删除 DB 记录。
func DeleteFile(pb *pocketbase.PocketBase, fileID string) error {
	rec, err := pb.FindRecordById("filestore_files", fileID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil // 幂等:记录已不存在
		}
		return err
	}

	// 读配置构造 Alist 客户端;配置缺失时零值继续(请求会失败但被容错)
	cfg, _ := LoadConfig(pb)
	client := NewAlistClient(cfg.AlistURL, cfg.AlistToken)
	if rerr := client.Remove(rec.GetString("storage_key")); rerr != nil {
		pb.Logger().Warn("级联删除 Alist 文件失败",
			"storage_key", rec.GetString("storage_key"),
			"error", rerr.Error())
		// 不阻断:继续删 DB 记录
	}
	return pb.Delete(rec)
}
