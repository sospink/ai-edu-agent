package auth

import (
	"edu-platform/internal/domain/user"
	appjwt "edu-platform/pkg/jwt"
)

type Service struct {
	users      *user.Service
	jwtManager *appjwt.Manager
}

func NewService(users *user.Service, jwtManager *appjwt.Manager) *Service {
	return &Service{
		users:      users,
		jwtManager: jwtManager,
	}
}

func (s *Service) Login(keyword, password string) (*user.User, string, error) {
	u, err := s.users.ValidateLogin(keyword, password)
	if err != nil {
		return nil, "", err
	}
	token, err := s.jwtManager.GenerateToken(u.ID, u.Username, int(u.RoleType))
	if err != nil {
		return nil, "", err
	}
	return u, token, nil
}

func (s *Service) Refresh(u *user.User) (string, error) {
	return s.jwtManager.GenerateToken(u.ID, u.Username, int(u.RoleType))
}
