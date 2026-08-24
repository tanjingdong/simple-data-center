package filestore

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func newTestAlistServer(t *testing.T, handler http.HandlerFunc) (*AlistClient, *httptest.Server) {
	t.Helper()
	server := httptest.NewServer(handler)
	client := NewAlistClient(server.URL, "test-token")
	return client, server
}

func TestAlistClient_Health(t *testing.T) {
	client, srv := newTestAlistServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/fs/list" {
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]any{"code": 200, "message": "success"})
			return
		}
		w.WriteHeader(http.StatusNotFound)
	})
	defer srv.Close()

	err := client.Health()
	if err != nil {
		t.Fatalf("Health() failed: %v", err)
	}
}

func TestAlistClient_Health_Fail(t *testing.T) {
	client, srv := newTestAlistServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	})
	defer srv.Close()

	err := client.Health()
	if err == nil {
		t.Fatal("expected error for unauthorized")
	}
}

func TestAlistClient_Put(t *testing.T) {
	client, srv := newTestAlistServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut || r.URL.Path != "/api/fs/put" {
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		if r.Header.Get("Authorization") != "test-token" {
			t.Errorf("missing auth header")
		}
		if r.Header.Get("File-Path") != "/test/file.txt" {
			t.Errorf("missing file-path header, got %s", r.Header.Get("File-Path"))
		}
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]any{"code": 200, "message": "success"})
	})
	defer srv.Close()

	body := bytes.NewReader([]byte("hello"))
	err := client.Put("/test/file.txt", int64(len("hello")), body)
	if err != nil {
		t.Fatalf("Put() failed: %v", err)
	}
}

func TestAlistClient_Remove(t *testing.T) {
	client, srv := newTestAlistServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && r.URL.Path == "/api/fs/remove" {
			var req struct {
				Dir   string   `json:"dir"`
				Names []string `json:"names"`
			}
			json.NewDecoder(r.Body).Decode(&req)
			if req.Dir == "/test" && len(req.Names) == 1 && req.Names[0] == "file.txt" {
				w.WriteHeader(http.StatusOK)
				json.NewEncoder(w).Encode(map[string]any{"code": 200, "message": "success"})
				return
			}
		}
		w.WriteHeader(http.StatusNotFound)
	})
	defer srv.Close()

	err := client.Remove("/test/file.txt")
	if err != nil {
		t.Fatalf("Remove() failed: %v", err)
	}
}

func TestAlistClient_Sign(t *testing.T) {
	client, srv := newTestAlistServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && r.URL.Path == "/api/fs/link" {
			var req struct {
				Path string `json:"path"`
			}
			json.NewDecoder(r.Body).Decode(&req)
			if req.Path == "/test/file.txt" {
				w.WriteHeader(http.StatusOK)
				json.NewEncoder(w).Encode(map[string]any{
					"code": 200,
					"data": map[string]any{"url": "http://alist/sign/file.txt?token=signed"},
				})
				return
			}
		}
		w.WriteHeader(http.StatusNotFound)
	})
	defer srv.Close()

	url, err := client.Sign("/test/file.txt")
	if err != nil {
		t.Fatalf("Sign() failed: %v", err)
	}
	if url != "http://alist/sign/file.txt?token=signed" {
		t.Errorf("url = %s, want http://alist/sign/file.txt?token=signed", url)
	}
}

func TestAlistClient_Get(t *testing.T) {
		expectedContent := "file content"
		var signURL string
		client, srv := newTestAlistServer(t, func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodPost && r.URL.Path == "/api/fs/link" {
				var req struct {
					Path string `json:"path"`
				}
				json.NewDecoder(r.Body).Decode(&req)
				if req.Path == "/test/file.txt" {
					json.NewEncoder(w).Encode(map[string]any{
						"code": 200,
						"data": map[string]any{"url": signURL},
					})
					return
				}
			}
			// Handle signed file download
			if r.URL.Path == "/signed/file.txt" {
				w.Header().Set("Content-Type", "text/plain")
				w.Header().Set("Content-Length", "12")
				w.Write([]byte(expectedContent))
				return
			}
			w.WriteHeader(http.StatusNotFound)
		})
		signURL = srv.URL + "/signed/file.txt"
		defer srv.Close()

	reader, size, mime, err := client.Get("/test/file.txt")
	if err != nil {
		t.Fatalf("Get() failed: %v", err)
	}
	defer reader.Close()

	if mime != "text/plain" {
		t.Errorf("mime = %s, want text/plain", mime)
	}
	data, _ := io.ReadAll(reader)
	if string(data) != expectedContent {
		t.Errorf("content = %s, want %s", string(data), expectedContent)
	}
	_ = size
}