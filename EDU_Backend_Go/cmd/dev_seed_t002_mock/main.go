package main

import (
	"fmt"
	"strings"
	"time"

	"go.uber.org/zap"
	"gorm.io/gorm"

	"edu-platform/internal/config"
	"edu-platform/internal/domain/assignment"
	"edu-platform/internal/domain/classroom"
	"edu-platform/internal/domain/course"
	"edu-platform/internal/domain/user"
	"edu-platform/internal/infra/database"
	apppassword "edu-platform/pkg/password"
)

const (
	teacherUsername = "T002"
	teacherPassword = "teacher@123"
	studentPassword = "student@123"
)

func main() {
	cfg, err := config.Load()
	must(err, "加载配置失败")
	db, err := database.New(cfg, zap.NewNop())
	must(err, "连接数据库失败")

	now := time.Now()
	teacher := ensureUser(db, user.User{
		Username:  teacherUsername,
		Email:     "t002@example.com",
		FullName:  "T002 提示词工程老师",
		RoleType:  user.RoleTeacher,
		Status:    user.StatusActive,
		StudentID: "",
	}, teacherPassword, false)

	promptCourse := ensurePromptCourse(db, teacher.ID)
	term := ensureTerm(db, teacher.ID, now)
	class := ensureClass(db, teacher.ID, term.ID)
	students := ensureStudents(db)
	for index, student := range students {
		ensureClassMember(db, class.ID, student.ID)
		ensureEnrollment(db, student.ID, promptCourse.ID, index, now)
	}
	assignmentRecord := ensureAssignment(db, teacher.ID, class.ID, promptCourse.ID, now)

	fmt.Printf("T002 mock seed completed\n")
	fmt.Printf("teacher=%s id=%d course=%s(%d) class=%s(%d) assignment=%s(%d) students=%d\n",
		teacher.Username, teacher.ID, promptCourse.Title, promptCourse.ID, class.Code, class.ID, assignmentRecord.Title, assignmentRecord.ID, len(students))
	for _, student := range students {
		fmt.Printf("student=%s studentId=%s password=%s\n", student.Username, student.StudentID, studentPassword)
	}
}

func ensureUser(db *gorm.DB, seed user.User, rawPassword string, resetPassword bool) user.User {
	var existing user.User
	if err := db.Where("username = ?", seed.Username).First(&existing).Error; err == nil {
		updates := map[string]any{
			"role_type": seed.RoleType,
			"status":    user.StatusActive,
		}
		if strings.TrimSpace(existing.FullName) == "" {
			updates["full_name"] = seed.FullName
		}
		if strings.TrimSpace(existing.Email) == "" {
			updates["email"] = seed.Email
		}
		if strings.TrimSpace(existing.StudentID) == "" && strings.TrimSpace(seed.StudentID) != "" {
			updates["student_id"] = seed.StudentID
		}
		if resetPassword {
			hashed, err := apppassword.Hash(rawPassword)
			must(err, "生成密码哈希失败")
			updates["password"] = hashed
		}
		must(db.Model(&existing).Updates(updates).Error, "更新用户失败")
		must(db.First(&existing, existing.ID).Error, "重新读取用户失败")
		return existing
	}
	hashed, err := apppassword.Hash(rawPassword)
	must(err, "生成密码哈希失败")
	seed.Password = hashed
	must(db.Create(&seed).Error, "创建用户失败")
	return seed
}

func ensurePromptCourse(db *gorm.DB, teacherID uint64) course.Course {
	var item course.Course
	err := db.Where("title LIKE ? OR slug = ?", "%提示词工程%", "prompt-engineering").Order("id ASC").First(&item).Error
	if err == nil {
		item.CreatorID = teacherID
		item.Status = course.CourseStatusPublished
		if item.Slug == "" {
			item.Slug = "prompt-engineering"
		}
		must(db.Save(&item).Error, "绑定提示词工程课程到 T002 失败")
		return item
	}

	item = course.Course{
		Title:          "提示词工程",
		Slug:           "prompt-engineering",
		Description:    "面向 AI 应用实训的提示词工程入门课程。",
		IconURL:        "Sparkles",
		CoverColor:     "from-cyan-500 to-slate-900",
		Difficulty:     1,
		TotalLessons:   3,
		TotalSkills:    1,
		EstimatedHours: 6,
		Status:         course.CourseStatusPublished,
		CreatorID:      teacherID,
	}
	must(db.Create(&item).Error, "创建提示词工程课程失败")

	stage := course.CourseStage{CourseID: item.ID, Title: "提示词工程基础", Description: "从结构化表达到迭代优化。", SortOrder: 1, LevelLabel: "M1"}
	must(db.Create(&stage).Error, "创建课程阶段失败")

	lessons := []course.CourseLesson{
		{CourseID: item.ID, StageID: stage.ID, Title: "提示词结构与角色设定", Type: 1, DurationMinutes: 35, Points: 20, SortOrder: 1},
		{CourseID: item.ID, StageID: stage.ID, Title: "上下文、约束与输出格式", Type: 1, DurationMinutes: 40, Points: 25, SortOrder: 2},
		{CourseID: item.ID, StageID: stage.ID, Title: "提示词测试与迭代优化", Type: 1, DurationMinutes: 45, Points: 30, SortOrder: 3},
	}
	must(db.Create(&lessons).Error, "创建课程课时失败")

	skill := ensureSkill(db)
	for _, lesson := range lessons {
		var count int64
		must(db.Model(&course.LessonSkill{}).Where("lesson_id = ? AND skill_id = ?", lesson.ID, skill.ID).Count(&count).Error, "检查课时技能失败")
		if count == 0 {
			must(db.Create(&course.LessonSkill{LessonID: lesson.ID, SkillID: skill.ID}).Error, "绑定课时技能失败")
		}
	}
	return item
}

func ensureSkill(db *gorm.DB) course.Skill {
	var skill course.Skill
	if err := db.Where("name = ?", "提示词工程").First(&skill).Error; err == nil {
		return skill
	}
	skill = course.Skill{Name: "提示词工程", Category: "AI 应用"}
	must(db.Create(&skill).Error, "创建提示词工程技能失败")
	return skill
}

func ensureTerm(db *gorm.DB, teacherID uint64, now time.Time) classroom.Term {
	var term classroom.Term
	if err := db.Where("code = ?", "MOCK-2026-SPRING").First(&term).Error; err == nil {
		term.Status = classroom.TermStatusActive
		must(db.Save(&term).Error, "更新模拟学期失败")
		return term
	}
	start := now.AddDate(0, -1, 0)
	end := now.AddDate(0, 3, 0)
	term = classroom.Term{
		Name:      "2026 春季模拟学期",
		Code:      "MOCK-2026-SPRING",
		StartAt:   &start,
		EndAt:     &end,
		Status:    classroom.TermStatusActive,
		CreatedBy: teacherID,
	}
	must(db.Create(&term).Error, "创建模拟学期失败")
	return term
}

func ensureClass(db *gorm.DB, teacherID, termID uint64) classroom.Class {
	var item classroom.Class
	if err := db.Where("code = ?", "T002-PROMPT-01").First(&item).Error; err == nil {
		item.TermID = termID
		item.OwnerTeacherID = teacherID
		item.Status = classroom.ClassStatusActive
		must(db.Save(&item).Error, "更新 T002 班级失败")
		ensureClassTeacher(db, item.ID, teacherID)
		return item
	}
	item = classroom.Class{
		TermID:         termID,
		Name:           "T002 提示词工程 1 班",
		Code:           "T002-PROMPT-01",
		Description:    "用于 M5 教学工作台与学生端任务联调的模拟班级。",
		OwnerTeacherID: teacherID,
		Status:         classroom.ClassStatusActive,
		CreatedBy:      teacherID,
	}
	must(db.Create(&item).Error, "创建 T002 班级失败")
	ensureClassTeacher(db, item.ID, teacherID)
	return item
}

func ensureClassTeacher(db *gorm.DB, classID, teacherID uint64) {
	var rel classroom.ClassTeacher
	if err := db.Where("class_id = ? AND teacher_id = ?", classID, teacherID).First(&rel).Error; err == nil {
		rel.Role = classroom.ClassTeacherRoleOwner
		rel.Status = classroom.ClassTeacherStatusActive
		must(db.Save(&rel).Error, "更新班级教师关系失败")
		return
	}
	rel = classroom.ClassTeacher{ClassID: classID, TeacherID: teacherID, Role: classroom.ClassTeacherRoleOwner, Status: classroom.ClassTeacherStatusActive}
	must(db.Create(&rel).Error, "创建班级教师关系失败")
}

func ensureStudents(db *gorm.DB) []user.User {
	seeds := []user.User{
		{Username: "t002_s001", Email: "t002_s001@example.com", FullName: "模拟学生 001", StudentID: "T002S001", RoleType: user.RoleStudent, Status: user.StatusActive},
		{Username: "t002_s002", Email: "t002_s002@example.com", FullName: "模拟学生 002", StudentID: "T002S002", RoleType: user.RoleStudent, Status: user.StatusActive},
		{Username: "t002_s003", Email: "t002_s003@example.com", FullName: "模拟学生 003", StudentID: "T002S003", RoleType: user.RoleStudent, Status: user.StatusActive},
		{Username: "t002_s004", Email: "t002_s004@example.com", FullName: "模拟学生 004", StudentID: "T002S004", RoleType: user.RoleStudent, Status: user.StatusActive},
		{Username: "t002_s005", Email: "t002_s005@example.com", FullName: "模拟学生 005", StudentID: "T002S005", RoleType: user.RoleStudent, Status: user.StatusActive},
		{Username: "t002_s006", Email: "t002_s006@example.com", FullName: "模拟学生 006", StudentID: "T002S006", RoleType: user.RoleStudent, Status: user.StatusActive},
	}
	students := make([]user.User, 0, len(seeds))
	for _, seed := range seeds {
		students = append(students, ensureUser(db, seed, studentPassword, true))
	}
	return students
}

func ensureClassMember(db *gorm.DB, classID, userID uint64) {
	var member classroom.ClassMember
	now := time.Now()
	if err := db.Where("class_id = ? AND user_id = ?", classID, userID).First(&member).Error; err == nil {
		member.Status = classroom.ClassMemberStatusActive
		member.JoinedAt = &now
		member.RemovedAt = nil
		must(db.Save(&member).Error, "更新班级成员失败")
		return
	}
	member = classroom.ClassMember{ClassID: classID, UserID: userID, Status: classroom.ClassMemberStatusActive, JoinedAt: &now}
	must(db.Create(&member).Error, "创建班级成员失败")
}

func ensureEnrollment(db *gorm.DB, userID, courseID uint64, index int, now time.Time) {
	var enrollment course.UserCourseEnrollment
	progress := []int{0, 25, 40, 60, 75, 90}[index%6]
	completed := progress / 30
	if err := db.Where("user_id = ? AND course_id = ?", userID, courseID).First(&enrollment).Error; err == nil {
		enrollment.Status = course.EnrollmentStatusInProgress
		enrollment.ProgressPercent = progress
		enrollment.CompletedLessonsCount = completed
		enrollment.LastActiveAt = now.Add(-time.Duration(index+1) * time.Hour)
		must(db.Save(&enrollment).Error, "更新课程报名失败")
		return
	}
	enrollment = course.UserCourseEnrollment{
		UserID:                userID,
		CourseID:              courseID,
		Status:                course.EnrollmentStatusInProgress,
		ProgressPercent:       progress,
		CompletedLessonsCount: completed,
		LastActiveAt:          now.Add(-time.Duration(index+1) * time.Hour),
		JoinedAt:              now.AddDate(0, 0, -index-1),
	}
	must(db.Create(&enrollment).Error, "创建课程报名失败")
}

func ensureAssignment(db *gorm.DB, teacherID, classID, courseID uint64, now time.Time) assignment.TeachingAssignment {
	var item assignment.TeachingAssignment
	dueAt := now.AddDate(0, 0, 7)
	if err := db.Where("title = ? AND creator_id = ?", "提示词工程首周实训", teacherID).First(&item).Error; err == nil {
		item.Status = assignment.AssignmentStatusPublished
		item.DueAt = &dueAt
		must(db.Save(&item).Error, "更新模拟作业失败")
		ensureAssignmentRelations(db, item.ID, classID, courseID)
		return item
	}
	publishedAt := now
	item = assignment.TeachingAssignment{
		Title:       "提示词工程首周实训",
		Description: "完成提示词结构化设计，并提交一次优化前后的对比说明。",
		Status:      assignment.AssignmentStatusPublished,
		CreatorID:   teacherID,
		DueAt:       &dueAt,
		PublishedAt: &publishedAt,
	}
	must(db.Create(&item).Error, "创建模拟作业失败")
	ensureAssignmentRelations(db, item.ID, classID, courseID)
	return item
}

func ensureAssignmentRelations(db *gorm.DB, assignmentID, classID, courseID uint64) {
	var ac assignment.AssignmentClass
	if err := db.Where("assignment_id = ? AND class_id = ?", assignmentID, classID).First(&ac).Error; err != nil {
		must(db.Create(&assignment.AssignmentClass{AssignmentID: assignmentID, ClassID: classID}).Error, "创建作业班级关系失败")
	}

	var ar assignment.AssignmentResource
	if err := db.Where("assignment_id = ? AND resource_type = ? AND resource_id = ?", assignmentID, assignment.ResourceTypeCourse, courseID).First(&ar).Error; err != nil {
		ar = assignment.AssignmentResource{AssignmentID: assignmentID, ResourceType: assignment.ResourceTypeCourse, ResourceID: courseID, SortOrder: 1}
		must(db.Create(&ar).Error, "创建作业资源关系失败")
	}

	var rule assignment.AssignmentRule
	if err := db.Where("assignment_id = ?", assignmentID).First(&rule).Error; err == nil {
		rule.AttemptLimit = 2
		rule.AllowLate = false
		rule.AllowReturn = true
		rule.AllowResubmit = true
		rule.ScoreMode = "completion"
		must(db.Save(&rule).Error, "更新作业规则失败")
	} else {
		rule = assignment.AssignmentRule{AssignmentID: assignmentID, AttemptLimit: 2, AllowLate: false, AllowReturn: true, AllowResubmit: true, ScoreMode: "completion"}
		must(db.Create(&rule).Error, "创建作业规则失败")
	}

	var rubric assignment.Rubric
	if err := db.Where("assignment_id = ?", assignmentID).First(&rubric).Error; err != nil {
		rubric = assignment.Rubric{AssignmentID: assignmentID, Title: "提示词工程 Rubric", TotalScore: 100}
		must(db.Create(&rubric).Error, "创建 Rubric 失败")
	}
	var count int64
	must(db.Model(&assignment.RubricItem{}).Where("rubric_id = ?", rubric.ID).Count(&count).Error, "检查 Rubric 条目失败")
	if count == 0 {
		items := []assignment.RubricItem{
			{RubricID: rubric.ID, Title: "结构清晰", Description: "角色、任务、约束和输出格式明确。", MaxScore: 40, SortOrder: 1},
			{RubricID: rubric.ID, Title: "可验证性", Description: "提示词产出可以对照标准检查。", MaxScore: 30, SortOrder: 2},
			{RubricID: rubric.ID, Title: "迭代说明", Description: "说明优化前后的差异和理由。", MaxScore: 30, SortOrder: 3},
		}
		must(db.Create(&items).Error, "创建 Rubric 条目失败")
	}
}

func must(err error, message string) {
	if err != nil {
		panic(fmt.Sprintf("%s: %v", message, err))
	}
}
