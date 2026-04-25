package password

import (
	"crypto/rand"
	"crypto/sha512"
	"encoding/hex"
	"strings"

	"golang.org/x/crypto/pbkdf2"
)

const (
	saltBytes  = 16
	iterations = 10000
	keyLength  = 64
)

func Hash(raw string) (string, error) {
	salt := make([]byte, saltBytes)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}

	saltHex := hex.EncodeToString(salt)
	derived := pbkdf2.Key([]byte(raw), []byte(saltHex), iterations, keyLength, sha512.New)
	return saltHex + ":" + hex.EncodeToString(derived), nil
}

func Compare(raw, hashed string) bool {
	saltHex, hashHex, ok := splitLegacyHash(hashed)
	if !ok {
		return false
	}
	derived := pbkdf2.Key([]byte(raw), []byte(saltHex), iterations, keyLength, sha512.New)
	return hex.EncodeToString(derived) == hashHex
}

func LooksLegacyHash(hashed string) bool {
	_, _, ok := splitLegacyHash(hashed)
	return ok
}

func splitLegacyHash(hashed string) (string, string, bool) {
	parts := strings.Split(strings.TrimSpace(hashed), ":")
	if len(parts) != 2 {
		return "", "", false
	}

	saltHex := strings.TrimSpace(parts[0])
	hashHex := strings.TrimSpace(parts[1])
	if len(saltHex) != saltBytes*2 || len(hashHex) != keyLength*2 {
		return "", "", false
	}

	if _, err := hex.DecodeString(saltHex); err != nil {
		return "", "", false
	}
	if _, err := hex.DecodeString(hashHex); err != nil {
		return "", "", false
	}

	return saltHex, hashHex, true
}
