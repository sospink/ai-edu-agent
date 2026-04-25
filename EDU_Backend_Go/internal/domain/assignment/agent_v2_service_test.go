package assignment

import "testing"

func TestHeatmapStatusUsesFailCount(t *testing.T) {
	if got := heatmapStatus(1, 0, false, 1); got != "orange" {
		t.Fatalf("expected low-failure in-progress status orange, got %s", got)
	}
	if got := heatmapStatus(3, 0, false, 3); got != "red" {
		t.Fatalf("expected repeated failures status red, got %s", got)
	}
}
