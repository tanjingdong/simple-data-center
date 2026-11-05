package usertoken

import (
	"net/http/httptest"
	"testing"
)

func TestBearerToken(t *testing.T) {
	cases := []struct {
		name   string
		header string
		want   string
		ok     bool
	}{
		{"合法", "Bearer sdc_abc", "sdc_abc", true},
		{"前后空格", "Bearer  sdc_abc  ", "sdc_abc", true},
		{"空头", "", "", false},
		{"错误前缀", "Basic abc", "", false},
		{"只有前缀", "Bearer ", "", false},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			r := httptest.NewRequest("GET", "/", nil)
			if tt.header != "" {
				r.Header.Set("Authorization", tt.header)
			}
			got, ok := BearerToken(r)
			if got != tt.want || ok != tt.ok {
				t.Errorf("BearerToken = (%q, %v), want (%q, %v)", got, ok, tt.want, tt.ok)
			}
		})
	}
}
