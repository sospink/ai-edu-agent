package project

import (
	"go.uber.org/zap"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"testing"
)

func TestDurationUsesVisibleUnitConfiguration(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	conn, _ := db.DB()
	defer conn.Close()
	if err = db.AutoMigrate(&Project{}, &ProjectUnit{}, &ProjectTag{}, &Tag{}); err != nil {
		t.Fatal(err)
	}
	p := Project{Title: "Workbench", Slug: "duration-test", Status: 1, LabsCount: 1}
	if err = db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}
	for _, u := range []ProjectUnit{{ProjectID: p.ID, TimeLimit: 105}, {ProjectID: p.ID, TimeLimit: 30, IsHidden: 1}, {ProjectID: p.ID, TimeLimit: -1}} {
		if err = db.Create(&u).Error; err != nil {
			t.Fatal(err)
		}
	}
	svc := NewService(db, zap.NewNop())
	rows, _, err := svc.List(1, 20, "", nil, nil, nil)
	if err != nil || len(rows) != 1 || rows[0].DurationMinutes != 105 {
		t.Fatalf("list duration: %v %v", rows, err)
	}
	detail, err := svc.FindByID(p.ID)
	if err != nil || detail.DurationMinutes != 105 {
		t.Fatalf("detail duration: %v %v", detail, err)
	}
}
