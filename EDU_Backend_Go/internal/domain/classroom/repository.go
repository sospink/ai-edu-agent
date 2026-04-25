package classroom

import (
	"strings"

	"gorm.io/gorm"

	"edu-platform/internal/domain/user"
)

type TermListQuery struct {
	Keyword  string
	Statuses []TermStatus
}

type ClassListQuery struct {
	Page     int
	PageSize int
	Keyword  string
	TermID   *uint64
	Status   *ClassStatus
	OwnerID  *uint64
}

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Transaction(fn func(tx *gorm.DB) error) error {
	return r.db.Transaction(fn)
}

func (r *Repository) ListTerms(query TermListQuery) ([]TermListItem, error) {
	db := r.db.Table("terms AS t").
		Select(`t.*, COUNT(DISTINCT c.id) AS class_count`).
		Joins(`LEFT JOIN classes AS c ON c.term_id = t.id`).
		Group("t.id").
		Order("t.start_at DESC, t.id DESC")
	if strings.TrimSpace(query.Keyword) != "" {
		like := "%" + strings.TrimSpace(query.Keyword) + "%"
		db = db.Where("(t.name LIKE ? OR t.code LIKE ?)", like, like)
	}
	if len(query.Statuses) > 0 {
		db = db.Where("t.status IN ?", query.Statuses)
	}
	items := make([]TermListItem, 0)
	if err := db.Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) FindTermByID(id uint64) (*Term, error) {
	var item Term
	if err := r.db.First(&item, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *Repository) CreateTerm(term *Term) error {
	return r.db.Create(term).Error
}

func (r *Repository) SaveTerm(term *Term) error {
	return r.db.Save(term).Error
}

func (r *Repository) ListClasses(query ClassListQuery) ([]ClassListItem, int64, error) {
	base := r.db.Table("classes AS c").
		Joins("JOIN terms AS t ON t.id = c.term_id").
		Joins("JOIN sys_users AS u ON u.id = c.owner_teacher_id")
	if strings.TrimSpace(query.Keyword) != "" {
		like := "%" + strings.TrimSpace(query.Keyword) + "%"
		base = base.Where("(c.name LIKE ? OR c.code LIKE ? OR t.name LIKE ? OR u.full_name LIKE ? OR u.username LIKE ?)", like, like, like, like, like)
	}
	if query.TermID != nil {
		base = base.Where("c.term_id = ?", *query.TermID)
	}
	if query.Status != nil {
		base = base.Where("c.status = ?", *query.Status)
	}
	if query.OwnerID != nil {
		base = base.Where("c.owner_teacher_id = ?", *query.OwnerID)
	}

	var total int64
	if err := base.Session(&gorm.Session{}).Distinct("c.id").Count(&total).Error; err != nil {
		return nil, 0, err
	}

	items := make([]ClassListItem, 0)
	err := base.
		Select(`
			c.id AS id,
			c.term_id AS term_id,
			t.name AS term_name,
			t.code AS term_code,
			t.status AS term_status,
			c.name AS name,
			c.code AS code,
			c.description AS description,
			c.owner_teacher_id AS owner_teacher_id,
			COALESCE(NULLIF(u.full_name, ''), u.username) AS owner_teacher_name,
			c.status AS status,
			c.created_by AS created_by,
			c.created_at AS created_at,
			c.updated_at AS updated_at,
			(SELECT COUNT(1) FROM class_members AS cm_all WHERE cm_all.class_id = c.id) AS member_count,
			(SELECT COUNT(1) FROM class_members AS cm_active WHERE cm_active.class_id = c.id AND cm_active.status = 1) AS active_member_count`).
		Order("c.updated_at DESC").
		Offset((query.Page - 1) * query.PageSize).
		Limit(query.PageSize).
		Scan(&items).Error
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) FindClassByID(id uint64) (*Class, error) {
	var item Class
	if err := r.db.First(&item, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *Repository) FindClassDetail(id uint64) (*ClassDetail, error) {
	var item ClassDetail
	err := r.db.Table("classes AS c").
		Select(`
			c.id AS id,
			c.term_id AS term_id,
			t.name AS term_name,
			t.code AS term_code,
			t.status AS term_status,
			t.start_at AS term_start_at,
			t.end_at AS term_end_at,
			c.name AS name,
			c.code AS code,
			c.description AS description,
			c.owner_teacher_id AS owner_teacher_id,
			COALESCE(NULLIF(u.full_name, ''), u.username) AS owner_teacher_name,
			c.status AS status,
			c.created_by AS created_by,
			c.created_at AS created_at,
			c.updated_at AS updated_at,
			(SELECT COUNT(1) FROM class_members AS cm_all WHERE cm_all.class_id = c.id) AS member_count,
			(SELECT COUNT(1) FROM class_members AS cm_active WHERE cm_active.class_id = c.id AND cm_active.status = 1) AS active_member_count`).
		Joins("JOIN terms AS t ON t.id = c.term_id").
		Joins("JOIN sys_users AS u ON u.id = c.owner_teacher_id").
		Where("c.id = ?", id).
		Scan(&item).Error
	if err != nil {
		return nil, err
	}
	if item.ID == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	return &item, nil
}

func (r *Repository) CreateClass(tx *gorm.DB, class *Class) error {
	return tx.Create(class).Error
}

func (r *Repository) SaveClass(class *Class) error {
	return r.db.Save(class).Error
}

func (r *Repository) CreateClassTeacher(tx *gorm.DB, item *ClassTeacher) error {
	return tx.Create(item).Error
}

func (r *Repository) ListClassMembers(classID uint64) ([]ClassMemberItem, error) {
	items := make([]ClassMemberItem, 0)
	err := r.db.Table("class_members AS cm").
		Select(`
			cm.id AS id,
			cm.class_id AS class_id,
			cm.user_id AS user_id,
			u.username AS username,
			u.full_name AS full_name,
			u.email AS email,
			u.student_id AS student_id,
			u.role_type AS role_type,
			cm.status AS status,
			cm.joined_at AS joined_at,
			cm.removed_at AS removed_at`).
		Joins("JOIN sys_users AS u ON u.id = cm.user_id").
		Where("cm.class_id = ?", classID).
		Order("cm.status ASC, cm.joined_at DESC, cm.id DESC").
		Scan(&items).Error
	return items, err
}

func (r *Repository) FindClassMember(classID, userID uint64) (*ClassMember, error) {
	var item ClassMember
	if err := r.db.First(&item, "class_id = ? AND user_id = ?", classID, userID).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *Repository) CreateClassMember(member *ClassMember) error {
	return r.db.Create(member).Error
}

func (r *Repository) SaveClassMember(member *ClassMember) error {
	return r.db.Save(member).Error
}

func (r *Repository) FindUserForImport(studentID, username, email string) (*user.User, string, error) {
	type candidate struct {
		field string
		value string
	}
	candidates := []candidate{
		{field: "student_id", value: strings.TrimSpace(studentID)},
		{field: "username", value: strings.TrimSpace(username)},
		{field: "email", value: strings.TrimSpace(email)},
	}
	for _, item := range candidates {
		if item.value == "" {
			continue
		}
		var matched user.User
		if err := r.db.First(&matched, item.field+" = ?", item.value).Error; err == nil {
			switch item.field {
			case "student_id":
				return &matched, "studentId", nil
			case "username":
				return &matched, "username", nil
			default:
				return &matched, "email", nil
			}
		} else if err != nil && err != gorm.ErrRecordNotFound {
			return nil, "", err
		}
	}
	return nil, "", gorm.ErrRecordNotFound
}

func (r *Repository) ListStudentClasses(userID uint64) ([]ClassListItem, error) {
	items := make([]ClassListItem, 0)
	pendingTaskSelect := "0 AS pending_task_count"
	if r.db.Migrator().HasTable("teaching_assignments") && r.db.Migrator().HasTable("assignment_classes") && r.db.Migrator().HasTable("submissions") {
		pendingTaskSelect = `(SELECT COUNT(DISTINCT ta.id)
			 FROM assignment_classes AS ac_pending
			 JOIN teaching_assignments AS ta ON ta.id = ac_pending.assignment_id AND ta.status IN (1, 2)
			 LEFT JOIN submissions AS latest_submission ON latest_submission.id = (
			   SELECT s2.id
			   FROM submissions AS s2
			   WHERE s2.assignment_id = ta.id AND s2.student_id = cm.user_id
			   ORDER BY s2.attempt_no DESC, s2.id DESC
			   LIMIT 1
			 )
			 WHERE ac_pending.class_id = c.id
			   AND c.status = 1
			   AND (latest_submission.id IS NULL OR latest_submission.status = 'returned')
			) AS pending_task_count`
	}
	err := r.db.Table("class_members AS cm").
		Select(`
			c.id AS id,
			c.term_id AS term_id,
			t.name AS term_name,
			t.code AS term_code,
			t.status AS term_status,
			c.name AS name,
			c.code AS code,
			c.description AS description,
			c.owner_teacher_id AS owner_teacher_id,
			COALESCE(NULLIF(u.full_name, ''), u.username) AS owner_teacher_name,
			c.status AS status,
			c.created_by AS created_by,
			c.created_at AS created_at,
			c.updated_at AS updated_at,
			(SELECT COUNT(1) FROM class_members AS cm_all WHERE cm_all.class_id = c.id) AS member_count,
			(SELECT COUNT(1) FROM class_members AS cm_active WHERE cm_active.class_id = c.id AND cm_active.status = 1) AS active_member_count,
			`+pendingTaskSelect).
		Joins("JOIN classes AS c ON c.id = cm.class_id").
		Joins("JOIN terms AS t ON t.id = c.term_id").
		Joins("JOIN sys_users AS u ON u.id = c.owner_teacher_id").
		Where("cm.user_id = ? AND cm.status = ?", userID, ClassMemberStatusActive).
		Order("t.start_at DESC, c.name ASC, c.id ASC").
		Scan(&items).Error
	return items, err
}
