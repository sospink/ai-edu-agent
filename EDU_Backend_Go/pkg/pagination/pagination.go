package pagination

import "math"

type Query struct {
	Page     int
	PageSize int
}

func Normalize(page, pageSize int) Query {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}
	if pageSize > 100 {
		pageSize = 100
	}
	return Query{
		Page:     page,
		PageSize: pageSize,
	}
}

func Offset(page, pageSize int) int {
	q := Normalize(page, pageSize)
	return (q.Page - 1) * q.PageSize
}

func TotalPages(total int64, pageSize int) int {
	if pageSize <= 0 {
		return 0
	}
	return int(math.Ceil(float64(total) / float64(pageSize)))
}
