package user

import "time"

type RoleType int

const (
	RoleStudent RoleType = 1
	RoleTeacher RoleType = 2
	RoleAdmin   RoleType = 10
)

type UserStatus int

const (
	StatusActive  UserStatus = 1
	StatusFrozen  UserStatus = 2
	StatusDeleted UserStatus = 3
)

type User struct {
	ID         uint64     `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	Username   string     `gorm:"column:username;size:64;unique;not null;default:''" json:"username"`
	Email      string     `gorm:"column:email;size:128;unique;not null;default:''" json:"email"`
	Password   string     `gorm:"column:password;size:255;not null;default:''" json:"-"`
	Phone      string     `gorm:"column:phone;size:20;not null;default:''" json:"phone"`
	StudentID  string     `gorm:"column:student_id;size:64;not null;default:''" json:"studentId"`
	FullName   string     `gorm:"column:full_name;size:64;not null;default:''" json:"fullName"`
	AvatarURL  string     `gorm:"column:avatar_url;size:512;not null;default:''" json:"avatarUrl"`
	Bio        string     `gorm:"column:bio;size:1024;not null;default:''" json:"bio"`
	GithubLink string     `gorm:"column:github_link;size:255;not null;default:''" json:"githubLink"`
	RoleType   RoleType   `gorm:"column:role_type;not null;default:1" json:"roleType"`
	Status     UserStatus `gorm:"column:status;not null;default:1" json:"status"`
	CreatedAt  time.Time  `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt  time.Time  `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (User) TableName() string {
	return "sys_users"
}

type StudentLeaderboardItem struct {
	ID               uint64     `json:"id"`
	Rank             int        `json:"rank"`
	Username         string     `json:"username"`
	DisplayName      string     `json:"displayName"`
	AvatarURL        string     `json:"avatarUrl"`
	SkillsCount      int        `json:"skillsCount"`
	CompletedLessons int        `json:"completedLessons"`
	EnrolledCourses  int        `json:"enrolledCourses"`
	LastActiveAt     *time.Time `json:"lastActiveAt,omitempty"`
	IsCurrentUser    bool       `json:"isCurrentUser"`
}
