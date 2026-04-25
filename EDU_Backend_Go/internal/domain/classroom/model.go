package classroom

import "time"

type TermStatus int

const (
	TermStatusPlanning TermStatus = 0
	TermStatusActive   TermStatus = 1
	TermStatusArchived TermStatus = 2
)

type ClassStatus int

const (
	ClassStatusActive   ClassStatus = 1
	ClassStatusDisabled ClassStatus = 2
	ClassStatusArchived ClassStatus = 3
)

type ClassMemberStatus int

const (
	ClassMemberStatusActive  ClassMemberStatus = 1
	ClassMemberStatusRemoved ClassMemberStatus = 2
)

type ClassTeacherStatus int

const (
	ClassTeacherStatusActive ClassTeacherStatus = 1
)

const ClassTeacherRoleOwner = "owner"

type Term struct {
	ID        uint64     `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	Name      string     `gorm:"column:name;size:128;not null;default:''" json:"name"`
	Code      string     `gorm:"column:code;size:64;not null;default:'';uniqueIndex:idx_terms_code" json:"code"`
	StartAt   *time.Time `gorm:"column:start_at" json:"startAt"`
	EndAt     *time.Time `gorm:"column:end_at" json:"endAt"`
	Status    TermStatus `gorm:"column:status;not null;default:0;index:idx_terms_status" json:"status"`
	CreatedBy uint64     `gorm:"column:created_by;not null;default:0" json:"createdBy"`
	CreatedAt time.Time  `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time  `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (Term) TableName() string {
	return "terms"
}

type Class struct {
	ID             uint64      `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	TermID         uint64      `gorm:"column:term_id;not null;default:0;index:idx_classes_term_id" json:"termId"`
	Name           string      `gorm:"column:name;size:128;not null;default:''" json:"name"`
	Code           string      `gorm:"column:code;size:64;not null;default:'';uniqueIndex:idx_classes_code" json:"code"`
	Description    string      `gorm:"column:description;size:512;not null;default:''" json:"description"`
	OwnerTeacherID uint64      `gorm:"column:owner_teacher_id;not null;default:0;index:idx_classes_owner_teacher_id" json:"ownerTeacherId"`
	Status         ClassStatus `gorm:"column:status;not null;default:1;index:idx_classes_status" json:"status"`
	CreatedBy      uint64      `gorm:"column:created_by;not null;default:0" json:"createdBy"`
	CreatedAt      time.Time   `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt      time.Time   `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (Class) TableName() string {
	return "classes"
}

type ClassMember struct {
	ID        uint64            `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	ClassID   uint64            `gorm:"column:class_id;not null;default:0;uniqueIndex:idx_class_members_class_user;index:idx_class_members_class_id" json:"classId"`
	UserID    uint64            `gorm:"column:user_id;not null;default:0;uniqueIndex:idx_class_members_class_user;index:idx_class_members_user_id" json:"userId"`
	Status    ClassMemberStatus `gorm:"column:status;not null;default:1;index:idx_class_members_status" json:"status"`
	JoinedAt  *time.Time        `gorm:"column:joined_at" json:"joinedAt"`
	RemovedAt *time.Time        `gorm:"column:removed_at" json:"removedAt"`
	CreatedAt time.Time         `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time         `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (ClassMember) TableName() string {
	return "class_members"
}

type ClassTeacher struct {
	ID        uint64             `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	ClassID   uint64             `gorm:"column:class_id;not null;default:0;index:idx_class_teachers_class_id" json:"classId"`
	TeacherID uint64             `gorm:"column:teacher_id;not null;default:0;index:idx_class_teachers_teacher_id" json:"teacherId"`
	Role      string             `gorm:"column:role;size:32;not null;default:'owner'" json:"role"`
	Status    ClassTeacherStatus `gorm:"column:status;not null;default:1" json:"status"`
	CreatedAt time.Time          `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time          `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (ClassTeacher) TableName() string {
	return "class_teachers"
}

type TermListItem struct {
	Term
	ClassCount int64 `json:"classCount"`
}

type ClassListItem struct {
	ID                uint64      `json:"id"`
	TermID            uint64      `json:"termId"`
	TermName          string      `json:"termName"`
	TermCode          string      `json:"termCode"`
	TermStatus        TermStatus  `json:"termStatus"`
	Name              string      `json:"name"`
	Code              string      `json:"code"`
	Description       string      `json:"description"`
	OwnerTeacherID    uint64      `json:"ownerTeacherId"`
	OwnerTeacherName  string      `json:"ownerTeacherName"`
	Status            ClassStatus `json:"status"`
	MemberCount       int64       `json:"memberCount"`
	ActiveMemberCount int64       `json:"activeMemberCount"`
	PendingTaskCount  int64       `json:"pendingTaskCount"`
	CreatedBy         uint64      `json:"createdBy"`
	CreatedAt         time.Time   `json:"createdAt"`
	UpdatedAt         time.Time   `json:"updatedAt"`
}

type ClassDetail struct {
	ClassListItem
	TermStartAt *time.Time `json:"termStartAt"`
	TermEndAt   *time.Time `json:"termEndAt"`
}

type ClassMemberItem struct {
	ID        uint64            `json:"id"`
	ClassID   uint64            `json:"classId"`
	UserID    uint64            `json:"userId"`
	Username  string            `json:"username"`
	FullName  string            `json:"fullName"`
	Email     string            `json:"email"`
	StudentID string            `json:"studentId"`
	RoleType  int               `json:"roleType"`
	Status    ClassMemberStatus `json:"status"`
	JoinedAt  *time.Time        `json:"joinedAt"`
	RemovedAt *time.Time        `json:"removedAt"`
}

type ImportMatchedUser struct {
	ID        uint64 `json:"id"`
	Username  string `json:"username"`
	FullName  string `json:"fullName"`
	Email     string `json:"email"`
	StudentID string `json:"studentId"`
}

type ImportRowResult struct {
	RowNumber int                `json:"rowNumber"`
	MatchedBy string             `json:"matchedBy"`
	Status    string             `json:"status"`
	Reason    string             `json:"reason"`
	User      *ImportMatchedUser `json:"user,omitempty"`
}

type ImportSummary struct {
	Total    int `json:"total"`
	Imported int `json:"imported"`
	Skipped  int `json:"skipped"`
	Failed   int `json:"failed"`
}

type ImportMembersResult struct {
	Summary ImportSummary     `json:"summary"`
	Rows    []ImportRowResult `json:"rows"`
}
