package schemaaudit

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"gorm.io/gorm"
)

type Severity string

const (
	SeverityError   Severity = "error"
	SeverityWarning Severity = "warning"
)

type Issue struct {
	Severity Severity `json:"severity"`
	Table    string   `json:"table"`
	Target   string   `json:"target"`
	Message  string   `json:"message"`
}

type Report struct {
	Database string  `json:"database"`
	Errors   []Issue `json:"errors"`
	Warnings []Issue `json:"warnings"`
}

func (r Report) OK() bool {
	return len(r.Errors) == 0
}

type ColumnSpec struct {
	Name     string
	DataType string
	Nullable string
}

type IndexSpec struct {
	Name    string
	Columns []string
	Unique  bool
}

type TableSpec struct {
	Name         string
	Columns      []ColumnSpec
	Indexes      []IndexSpec
	WarnIfNoRows bool
}

type dbColumn struct {
	TableName  string `gorm:"column:table_name"`
	ColumnName string `gorm:"column:column_name"`
	DataType   string `gorm:"column:data_type"`
	IsNullable string `gorm:"column:is_nullable"`
}

type dbIndex struct {
	TableName string `gorm:"column:table_name"`
	IndexName string `gorm:"column:index_name"`
	NonUnique int    `gorm:"column:non_unique"`
	Columns   string `gorm:"column:columns"`
}

type tableCount struct {
	TableName string `gorm:"column:table_name"`
	Count     int64  `gorm:"column:count"`
}

func Check(ctx context.Context, db *gorm.DB) (Report, error) {
	if db == nil {
		return Report{}, fmt.Errorf("数据库未初始化")
	}

	database, err := currentDatabase(ctx, db)
	if err != nil {
		return Report{}, err
	}
	report := Report{Database: database}

	columns, err := loadColumns(ctx, db, database)
	if err != nil {
		return report, err
	}
	indexes, err := loadIndexes(ctx, db, database)
	if err != nil {
		return report, err
	}

	for _, table := range ExpectedTables() {
		tableColumns, ok := columns[table.Name]
		if !ok {
			report.addError(table.Name, "table", "缺少业务表")
			continue
		}
		for _, expectedColumn := range table.Columns {
			actualColumn, exists := tableColumns[expectedColumn.Name]
			if !exists {
				report.addError(table.Name, expectedColumn.Name, "缺少字段")
				continue
			}
			if expectedColumn.DataType != "" && !strings.EqualFold(actualColumn.DataType, expectedColumn.DataType) {
				report.addError(table.Name, expectedColumn.Name, fmt.Sprintf("字段类型不一致：期望 %s，实际 %s", expectedColumn.DataType, actualColumn.DataType))
			}
			if expectedColumn.Nullable != "" && !strings.EqualFold(actualColumn.IsNullable, expectedColumn.Nullable) {
				report.addError(table.Name, expectedColumn.Name, fmt.Sprintf("字段 NULL 约束不一致：期望 %s，实际 %s", expectedColumn.Nullable, actualColumn.IsNullable))
			}
		}

		tableIndexes := indexes[table.Name]
		for _, expectedIndex := range table.Indexes {
			actualIndex, exists := tableIndexes[expectedIndex.Name]
			if !exists {
				report.addError(table.Name, expectedIndex.Name, "缺少索引")
				continue
			}
			if expectedIndex.Unique && actualIndex.NonUnique != 0 {
				report.addError(table.Name, expectedIndex.Name, "索引唯一性不一致：期望唯一索引")
			}
			actualColumns := splitIndexColumns(actualIndex.Columns)
			if !sameStringSlice(actualColumns, expectedIndex.Columns) {
				report.addError(table.Name, expectedIndex.Name, fmt.Sprintf("索引字段不一致：期望 %s，实际 %s", strings.Join(expectedIndex.Columns, ","), strings.Join(actualColumns, ",")))
			}
		}
	}

	counts, err := loadRowCounts(ctx, db, database)
	if err == nil {
		for _, table := range ExpectedTables() {
			if table.WarnIfNoRows && counts[table.Name] == 0 {
				report.addWarning(table.Name, "rows", "关键业务表当前没有数据，请确认是否符合预期")
			}
		}
	}

	return report, nil
}

func currentDatabase(ctx context.Context, db *gorm.DB) (string, error) {
	var database string
	if err := db.WithContext(ctx).Raw("SELECT DATABASE()").Scan(&database).Error; err != nil {
		return "", err
	}
	if strings.TrimSpace(database) == "" {
		return "", fmt.Errorf("无法识别当前数据库")
	}
	return database, nil
}

func loadColumns(ctx context.Context, db *gorm.DB, database string) (map[string]map[string]dbColumn, error) {
	var rows []dbColumn
	err := db.WithContext(ctx).Raw(`
SELECT table_name AS table_name, column_name AS column_name, data_type AS data_type, is_nullable AS is_nullable
FROM information_schema.columns
WHERE table_schema = ?
`, database).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	result := map[string]map[string]dbColumn{}
	for _, row := range rows {
		if _, ok := result[row.TableName]; !ok {
			result[row.TableName] = map[string]dbColumn{}
		}
		result[row.TableName][row.ColumnName] = row
	}
	return result, nil
}

func loadIndexes(ctx context.Context, db *gorm.DB, database string) (map[string]map[string]dbIndex, error) {
	var rows []dbIndex
	err := db.WithContext(ctx).Raw(`
SELECT table_name AS table_name, index_name AS index_name, MIN(non_unique) AS non_unique, GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') AS columns
FROM information_schema.statistics
WHERE table_schema = ?
GROUP BY table_name, index_name
`, database).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	result := map[string]map[string]dbIndex{}
	for _, row := range rows {
		if _, ok := result[row.TableName]; !ok {
			result[row.TableName] = map[string]dbIndex{}
		}
		result[row.TableName][row.IndexName] = row
	}
	return result, nil
}

func loadRowCounts(ctx context.Context, db *gorm.DB, database string) (map[string]int64, error) {
	tableNames := make([]string, 0, len(ExpectedTables()))
	for _, table := range ExpectedTables() {
		tableNames = append(tableNames, table.Name)
	}
	sort.Strings(tableNames)

	counts := map[string]int64{}
	for _, table := range tableNames {
		var exists int64
		if err := db.WithContext(ctx).Raw(`
SELECT COUNT(1)
FROM information_schema.tables
WHERE table_schema = ? AND table_name = ?
`, database, table).Scan(&exists).Error; err != nil {
			return counts, err
		}
		if exists == 0 {
			continue
		}
		var count int64
		if err := db.WithContext(ctx).Table(table).Count(&count).Error; err != nil {
			return counts, err
		}
		counts[table] = count
	}
	return counts, nil
}

func (r *Report) addError(table, target, message string) {
	r.Errors = append(r.Errors, Issue{Severity: SeverityError, Table: table, Target: target, Message: message})
}

func (r *Report) addWarning(table, target, message string) {
	r.Warnings = append(r.Warnings, Issue{Severity: SeverityWarning, Table: table, Target: target, Message: message})
}

func splitIndexColumns(value string) []string {
	if value == "" {
		return []string{}
	}
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

func sameStringSlice(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
