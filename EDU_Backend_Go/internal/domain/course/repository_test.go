package course

import "testing"

func TestNormalizeActivityDate(t *testing.T) {
	cases := map[string]string{
		"2026-06-24":              "2026-06-24",
		"2026-06-24T00:00:00Z":    "2026-06-24",
		"2026-06-24 00:00:00 UTC": "2026-06-24",
		"":                        "",
		"bad-value":               "bad-value",
	}

	for input, want := range cases {
		if got := normalizeActivityDate(input); got != want {
			t.Fatalf("normalizeActivityDate(%q) = %q, want %q", input, got, want)
		}
	}
}
