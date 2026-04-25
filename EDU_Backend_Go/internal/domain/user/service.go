package user

import (
	"errors"
	"strings"

	"go.uber.org/zap"
	"gorm.io/gorm"

	apperrors "edu-platform/pkg/errors"
	apppassword "edu-platform/pkg/password"
)

type Service struct {
	repo *Repository
	log  *zap.Logger
}

type ListParams struct {
	Page     int
	PageSize int
	Keyword  string
	RoleType *int
	Status   *int
}

type CreateParams struct {
	Username   string
	Email      string
	Password   string
	Phone      string
	StudentID  string
	FullName   string
	AvatarURL  string
	Bio        string
	GithubLink string
	RoleType   RoleType
}

type UpdateParams struct {
	Phone      *string
	StudentID  *string
	FullName   *string
	AvatarURL  *string
	Bio        *string
	GithubLink *string
	RoleType   *RoleType
	Status     *UserStatus
}

func NewService(db *gorm.DB, log *zap.Logger) *Service {
	return &Service{
		repo: NewRepository(db),
		log:  log,
	}
}

func (s *Service) InitDefaultAdmin(seed string) error {
	count, err := s.repo.Count()
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	password := strings.TrimSpace(seed)
	if len(password) < 8 {
		return apperrors.BadRequest("DEFAULT_ADMIN_PASSWORD 未配置或长度不足 8 位，已跳过默认管理员初始化")
	}
	_, err = s.Create(CreateParams{
		Username: "admin",
		Email:    "admin@edu.com",
		Password: password,
		FullName: "系统管理员",
		RoleType: RoleAdmin,
	})
	return err
}

func (s *Service) Create(params CreateParams) (*User, error) {
	if strings.TrimSpace(params.Username) == "" || strings.TrimSpace(params.Email) == "" || params.Password == "" {
		return nil, apperrors.BadRequest("用户名、邮箱和密码为必填项")
	}
	if existing, err := s.repo.FindByUsername(params.Username); err == nil && existing != nil {
		return nil, apperrors.BadRequest("用户名已存在")
	} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if existing, err := s.repo.FindByEmail(params.Email); err == nil && existing != nil {
		return nil, apperrors.BadRequest("邮箱已存在")
	} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	hashed, err := passwordpkgHash(params.Password)
	if err != nil {
		return nil, err
	}
	user := &User{
		Username:   params.Username,
		Email:      params.Email,
		Password:   string(hashed),
		Phone:      params.Phone,
		StudentID:  params.StudentID,
		FullName:   params.FullName,
		AvatarURL:  params.AvatarURL,
		Bio:        params.Bio,
		GithubLink: params.GithubLink,
		RoleType:   params.RoleType,
		Status:     StatusActive,
	}
	if user.RoleType == 0 {
		user.RoleType = RoleStudent
	}
	if err := s.repo.Create(user); err != nil {
		return nil, err
	}
	return user, nil
}

func (s *Service) FindByID(id uint64) (*User, error) {
	user, err := s.repo.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("用户不存在")
		}
		return nil, err
	}
	return user, nil
}

func (s *Service) FindByUsername(username string) (*User, error) {
	user, err := s.repo.FindByUsername(username)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("用户不存在")
		}
		return nil, err
	}
	return user, nil
}

func (s *Service) FindByEmail(email string) (*User, error) {
	user, err := s.repo.FindByEmail(email)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("用户不存在")
		}
		return nil, err
	}
	return user, nil
}

func (s *Service) FindByStudentID(studentID string) (*User, error) {
	user, err := s.repo.FindByStudentID(studentID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("用户不存在")
		}
		return nil, err
	}
	return user, nil
}

func (s *Service) ValidatePassword(u *User, password string) bool {
	return passwordpkgCompare(password, u.Password)
}

func (s *Service) ValidateLogin(keyword, password string) (*User, error) {
	user, err := s.repo.FindForLogin(keyword)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.Unauthorized("用户名或密码错误")
		}
		return nil, err
	}
	if user.Status == StatusFrozen {
		return nil, apperrors.Forbidden("账号已被冻结，请联系管理员")
	}
	if user.Status == StatusDeleted {
		return nil, apperrors.Forbidden("账号已注销")
	}
	if !passwordpkgCompare(password, user.Password) {
		return nil, apperrors.Unauthorized("用户名或密码错误")
	}
	return user, nil
}

func (s *Service) List(params ListParams) ([]User, int64, error) {
	return s.repo.List(params.Page, params.PageSize, params.Keyword, params.RoleType, params.Status)
}

func (s *Service) StudentLeaderboard(limit int, currentUserID uint64) ([]StudentLeaderboardItem, error) {
	items, err := s.repo.StudentLeaderboard(limit)
	if err != nil {
		return nil, err
	}
	if currentUserID == 0 {
		return items, nil
	}
	for i := range items {
		items[i].IsCurrentUser = items[i].ID == currentUserID
	}
	return items, nil
}

func (s *Service) Update(id uint64, params UpdateParams) error {
	_, err := s.FindByID(id)
	if err != nil {
		return err
	}

	attrs := make(map[string]any)
	if params.Phone != nil {
		attrs["phone"] = *params.Phone
	}
	if params.StudentID != nil {
		attrs["student_id"] = *params.StudentID
	}
	if params.FullName != nil {
		attrs["full_name"] = *params.FullName
	}
	if params.AvatarURL != nil {
		attrs["avatar_url"] = *params.AvatarURL
	}
	if params.Bio != nil {
		attrs["bio"] = *params.Bio
	}
	if params.GithubLink != nil {
		attrs["github_link"] = *params.GithubLink
	}
	if params.RoleType != nil {
		attrs["role_type"] = *params.RoleType
	}
	if params.Status != nil {
		attrs["status"] = *params.Status
	}

	if len(attrs) == 0 {
		return nil
	}

	updated, err := s.repo.Update(id, attrs)
	if err != nil {
		return err
	}
	if !updated {
		return apperrors.NotFound("用户不存在")
	}
	return nil
}

func (s *Service) UpdatePassword(id uint64, password string) error {
	hashed, err := passwordpkgHash(password)
	if err != nil {
		return err
	}
	updated, err := s.repo.Update(id, map[string]any{"password": string(hashed)})
	if err != nil {
		return err
	}
	if !updated {
		return apperrors.NotFound("用户不存在")
	}
	return nil
}

func passwordpkgHash(raw string) (string, error) {
	return apppassword.Hash(raw)
}

func passwordpkgCompare(raw, hashed string) bool {
	return apppassword.Compare(raw, hashed)
}

func (s *Service) Freeze(id uint64) error {
	updated, err := s.repo.Update(id, map[string]any{"status": StatusFrozen})
	if err != nil {
		return err
	}
	if !updated {
		return apperrors.NotFound("用户不存在")
	}
	return nil
}

func (s *Service) Activate(id uint64) error {
	updated, err := s.repo.Update(id, map[string]any{"status": StatusActive})
	if err != nil {
		return err
	}
	if !updated {
		return apperrors.NotFound("用户不存在")
	}
	return nil
}

func (s *Service) Delete(id uint64) error {
	updated, err := s.repo.Update(id, map[string]any{"status": StatusDeleted})
	if err != nil {
		return err
	}
	if !updated {
		return apperrors.NotFound("用户不存在")
	}
	return nil
}
