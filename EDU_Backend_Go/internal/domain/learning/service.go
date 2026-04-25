package learning

import (
	"context"
	"math"
	"time"

	"gorm.io/gorm"

	"edu-platform/internal/domain/agent"
	"edu-platform/internal/domain/assignment"
	"edu-platform/internal/domain/classroom"
	"edu-platform/internal/domain/course"
)

type Service struct {
	db      *gorm.DB
	courses *course.Service
}

func NewService(db *gorm.DB, courses *course.Service) *Service {
	return &Service{db: db, courses: courses}
}

func (s *Service) GetUserEnrollments(userID uint64) ([]course.EnrollmentWithCourse, error) {
	return s.courses.GetUserEnrollments(userID)
}

func (s *Service) GetContinueLearning(userID uint64) (*course.ContinueLearningPayload, error) {
	return s.courses.GetContinueLearning(userID)
}

func (s *Service) GetUserActivityLogs(userID uint64, days int) ([]course.UserActivityLog, error) {
	return s.courses.GetUserActivityLogs(userID, days)
}

type OverviewMilestone struct {
	Type    string `json:"type"`
	Label   string `json:"label"`
	Current int    `json:"current"`
	Target  int    `json:"target"`
}

type OverviewOutcomeSummary struct {
	SubmittedAssignments   int64 `json:"submittedAssignments"`
	GradedAssignments      int64 `json:"gradedAssignments"`
	PublishedGrades        int64 `json:"publishedGrades"`
	AgentManualsInProgress int64 `json:"agentManualsInProgress"`
	AgentCompletedSteps    int   `json:"agentCompletedSteps"`
}

type OverviewResponse struct {
	Level                  int                    `json:"level"`
	LevelName              string                 `json:"levelName"`
	OverallProgressPercent int                    `json:"overallProgressPercent"`
	CompletedCourses       int                    `json:"completedCourses"`
	InProgressCourses      int                    `json:"inProgressCourses"`
	CompletedLessons       int                    `json:"completedLessons"`
	TotalLessons           int                    `json:"totalLessons"`
	CurrentStreakDays      int                    `json:"currentStreakDays"`
	ActiveDaysLast7        int                    `json:"activeDaysLast7"`
	Milestones             []OverviewMilestone    `json:"milestones"`
	OutcomeSummary         OverviewOutcomeSummary `json:"outcomeSummary"`
}

type overviewEnrollmentRow struct {
	CourseID              uint64 `gorm:"column:course_id"`
	Status                int    `gorm:"column:status"`
	CompletedLessonsCount int    `gorm:"column:completed_lessons_count"`
	TotalLessons          int    `gorm:"column:total_lessons"`
}

func (s *Service) GetOverview(ctx context.Context, userID uint64) (*OverviewResponse, error) {
	rows, err := s.loadEnrollmentRows(ctx, userID)
	if err != nil {
		return nil, err
	}
	completedRecordCounts, err := s.loadCompletedLessonRecordCounts(ctx, userID)
	if err != nil {
		return nil, err
	}

	var completedCourses, inProgressCourses, completedLessons, totalLessons int
	for _, row := range rows {
		completed := row.CompletedLessonsCount
		if fallback := completedRecordCounts[row.CourseID]; completed <= 0 && fallback > 0 {
			completed = fallback
		}
		if row.TotalLessons > 0 && completed > row.TotalLessons {
			completed = row.TotalLessons
		}
		completedLessons += completed
		totalLessons += row.TotalLessons
		isCompleted := row.TotalLessons > 0 && completed >= row.TotalLessons
		if row.Status == int(course.EnrollmentStatusCompleted) || isCompleted {
			completedCourses++
		} else {
			inProgressCourses++
		}
	}

	overall := 0
	if totalLessons > 0 {
		overall = int(math.Round(float64(completedLessons) * 100 / float64(totalLessons)))
	}

	activityDates, err := s.loadActivityDateSet(ctx, userID)
	if err != nil {
		return nil, err
	}
	streak := calculateCurrentStreak(activityDates, time.Now())
	activeDaysLast7 := calculateActiveDaysLast7(activityDates, time.Now())
	level, levelName := resolveLevel(completedCourses, completedLessons)

	outcome, err := s.loadOutcomeSummary(ctx, userID)
	if err != nil {
		return nil, err
	}

	return &OverviewResponse{
		Level:                  level,
		LevelName:              levelName,
		OverallProgressPercent: overall,
		CompletedCourses:       completedCourses,
		InProgressCourses:      inProgressCourses,
		CompletedLessons:       completedLessons,
		TotalLessons:           totalLessons,
		CurrentStreakDays:      streak,
		ActiveDaysLast7:        activeDaysLast7,
		Milestones:             buildMilestones(level, completedCourses, completedLessons, streak),
		OutcomeSummary:         outcome,
	}, nil
}

func (s *Service) loadEnrollmentRows(ctx context.Context, userID uint64) ([]overviewEnrollmentRow, error) {
	var rows []overviewEnrollmentRow
	err := s.db.WithContext(ctx).Table("user_course_enrollments AS e").
		Select(`
			e.course_id,
			e.status,
			e.completed_lessons_count,
			COALESCE(lesson_stats.total_lessons, 0) AS total_lessons`).
		Joins(`
			LEFT JOIN (
				SELECT cs.course_id, COUNT(cl.id) AS total_lessons
				FROM course_lessons cl
				JOIN course_stages cs ON cs.id = cl.stage_id
				GROUP BY cs.course_id
			) AS lesson_stats ON lesson_stats.course_id = e.course_id`).
		Where("e.user_id = ?", userID).
		Scan(&rows).Error
	return rows, err
}

func (s *Service) loadCompletedLessonRecordCounts(ctx context.Context, userID uint64) (map[uint64]int, error) {
	type row struct {
		CourseID uint64 `gorm:"column:course_id"`
		Count    int    `gorm:"column:count"`
	}
	var rows []row
	err := s.db.WithContext(ctx).Table("user_lesson_records").
		Select("course_id, COUNT(DISTINCT lesson_id) AS count").
		Where("user_id = ? AND status = ?", userID, course.LessonRecordStatusCompleted).
		Group("course_id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	result := make(map[uint64]int, len(rows))
	for _, item := range rows {
		result[item.CourseID] = item.Count
	}
	return result, nil
}

func (s *Service) loadActivityDateSet(ctx context.Context, userID uint64) (map[string]struct{}, error) {
	var logs []course.UserActivityLog
	if err := s.db.WithContext(ctx).Where("user_id = ?", userID).Find(&logs).Error; err != nil {
		return nil, err
	}
	result := make(map[string]struct{}, len(logs))
	for _, log := range logs {
		key := log.ActivityDate
		if len(key) >= 10 {
			key = key[:10]
		}
		if key != "" {
			result[key] = struct{}{}
		}
	}
	return result, nil
}

func calculateCurrentStreak(activityDates map[string]struct{}, now time.Time) int {
	today := dateKey(now)
	start := now
	if _, ok := activityDates[today]; !ok {
		start = now.AddDate(0, 0, -1)
	}
	streak := 0
	for day := start; ; day = day.AddDate(0, 0, -1) {
		if _, ok := activityDates[dateKey(day)]; !ok {
			return streak
		}
		streak++
	}
}

func calculateActiveDaysLast7(activityDates map[string]struct{}, now time.Time) int {
	count := 0
	for i := 0; i < 7; i++ {
		if _, ok := activityDates[dateKey(now.AddDate(0, 0, -i))]; ok {
			count++
		}
	}
	return count
}

func dateKey(t time.Time) string {
	return t.Format("2006-01-02")
}

func resolveLevel(completedCourses, completedLessons int) (int, string) {
	switch {
	case completedCourses >= 25 || completedLessons >= 150:
		return 5, "Master"
	case completedCourses >= 15 || completedLessons >= 80:
		return 4, "Expert"
	case completedCourses >= 8 || completedLessons >= 30:
		return 3, "Practitioner"
	case completedCourses >= 3 || completedLessons >= 10:
		return 2, "Builder"
	default:
		return 1, "Explorer"
	}
}

func buildMilestones(level, completedCourses, completedLessons, streak int) []OverviewMilestone {
	courseTarget, lessonTarget := nextLevelTargets(level, completedCourses)
	return []OverviewMilestone{
		{Type: "courses", Label: "完成 " + itoa(courseTarget) + " 个课程", Current: completedCourses, Target: courseTarget},
		{Type: "lessons", Label: "完成 " + itoa(lessonTarget) + " 个课时", Current: completedLessons, Target: lessonTarget},
		{Type: "streak", Label: "连续学习 7 天", Current: streak, Target: 7},
	}
}

func nextLevelTargets(level, completedCourses int) (int, int) {
	switch level {
	case 1:
		return 3, 10
	case 2:
		return 8, 30
	case 3:
		return 15, 80
	case 4:
		return 25, 150
	default:
		return completedCourses + 5, 150
	}
}

func itoa(value int) string {
	if value == 0 {
		return "0"
	}
	digits := make([]byte, 0, 10)
	for value > 0 {
		digits = append(digits, byte('0'+value%10))
		value /= 10
	}
	for i, j := 0, len(digits)-1; i < j; i, j = i+1, j-1 {
		digits[i], digits[j] = digits[j], digits[i]
	}
	return string(digits)
}

func (s *Service) loadOutcomeSummary(ctx context.Context, userID uint64) (OverviewOutcomeSummary, error) {
	var summary OverviewOutcomeSummary
	base := s.db.WithContext(ctx).Table("submissions AS s").
		Joins("JOIN teaching_assignments AS ta ON ta.id = s.assignment_id").
		Joins("JOIN assignment_classes AS ac ON ac.assignment_id = ta.id").
		Joins("JOIN class_members AS cm ON cm.class_id = ac.class_id AND cm.user_id = s.student_id AND cm.status = ?", classroom.ClassMemberStatusActive).
		Where("s.student_id = ?", userID)
	if err := base.Session(&gorm.Session{}).Distinct("s.id").Count(&summary.SubmittedAssignments).Error; err != nil {
		return summary, err
	}
	if err := base.Session(&gorm.Session{}).
		Joins("JOIN grades AS g ON g.submission_id = s.id AND g.status IN ?", []string{assignment.GradeStatusReviewed, assignment.GradeStatusPublished}).
		Distinct("g.id").Count(&summary.GradedAssignments).Error; err != nil {
		return summary, err
	}
	if err := base.Session(&gorm.Session{}).
		Joins("JOIN grades AS g ON g.submission_id = s.id AND g.status = ?", assignment.GradeStatusPublished).
		Distinct("g.id").Count(&summary.PublishedGrades).Error; err != nil {
		return summary, err
	}

	var progresses []agent.UserAgentProgress
	if err := s.db.WithContext(ctx).Where("user_id = ?", userID).Find(&progresses).Error; err != nil {
		return summary, err
	}
	summary.AgentManualsInProgress = int64(len(progresses))
	for _, progress := range progresses {
		summary.AgentCompletedSteps += len(progress.CompletedSteps)
	}
	return summary, nil
}
