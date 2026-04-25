package jwt

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	gjwt "github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID   uint64 `json:"userId"`
	Username string `json:"username"`
	RoleType int    `json:"roleType"`
	Portal   string `json:"portal"`
	gjwt.RegisteredClaims
}

type Manager struct {
	secret []byte
	issuer string
	ttl    time.Duration
}

func NewManager(secret, issuer, expiresIn string) (*Manager, error) {
	ttl, err := parseTTL(expiresIn)
	if err != nil {
		return nil, err
	}
	return &Manager{
		secret: []byte(secret),
		issuer: issuer,
		ttl:    ttl,
	}, nil
}

func (m *Manager) GenerateToken(userID uint64, username string, roleType int) (string, error) {
	claims := Claims{
		UserID:   userID,
		Username: username,
		RoleType: roleType,
		Portal:   derivePortal(roleType),
		RegisteredClaims: gjwt.RegisteredClaims{
			Issuer:    m.issuer,
			ExpiresAt: gjwt.NewNumericDate(time.Now().Add(m.ttl)),
			IssuedAt:  gjwt.NewNumericDate(time.Now()),
		},
	}
	token := gjwt.NewWithClaims(gjwt.SigningMethodHS256, claims)
	return token.SignedString(m.secret)
}

func derivePortal(roleType int) string {
	switch {
	case roleType >= 10:
		return "admin"
	case roleType >= 2:
		return "teacher"
	default:
		return "student"
	}
}

func (m *Manager) ParseToken(token string) (*Claims, error) {
	parsed, err := gjwt.ParseWithClaims(token, &Claims{}, func(_ *gjwt.Token) (interface{}, error) {
		return m.secret, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := parsed.Claims.(*Claims)
	if !ok || !parsed.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}

func ExtractBearerToken(header string) string {
	if !strings.HasPrefix(header, "Bearer ") {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
}

func parseTTL(value string) (time.Duration, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return 0, errors.New("jwt expires_in is required")
	}
	if ttl, err := time.ParseDuration(trimmed); err == nil {
		return ttl, nil
	}

	unit := trimmed[len(trimmed)-1]
	numberPart := strings.TrimSpace(trimmed[:len(trimmed)-1])
	amount, err := strconv.Atoi(numberPart)
	if err != nil {
		return 0, fmt.Errorf("invalid jwt expires_in: %s", value)
	}

	switch unit {
	case 'd', 'D':
		return time.Duration(amount) * 24 * time.Hour, nil
	case 'w', 'W':
		return time.Duration(amount) * 7 * 24 * time.Hour, nil
	default:
		return 0, fmt.Errorf("invalid jwt expires_in: %s", value)
	}
}
