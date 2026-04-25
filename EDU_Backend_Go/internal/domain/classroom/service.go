package classroom

import (
	"encoding/csv"
	"errors"
	"io"
	"mime/multipart"
	"path/filepath"
	"strings"
	"time"

	"github.com/xuri/excelize/v2"
	"go.uber.org/zap"
	"gorm.io/gorm"

	"edu-platform/internal/domain/user"
	apperrors "edu-platform/pkg/errors"
)

type Service struct {
	repo   *Repository
	logger *zap.Logger
}

type ListClassesParams struct {
	Page     int
	PageSize int
	Keyword  string
	TermID   *uint64
	Status   *ClassStatus
}

type CreateTermParams struct {
	Name      string
	Code      string
	StartAt   *time.Time
	EndAt     *time.Time
	Status    *TermStatus
	CreatedBy uint64
}

type UpdateTermParams struct {
	Name    *string
	Code    *string
	StartAt *time.Time
	EndAt   *time.Time
}

type CreateClassParams struct {
	TermID         uint64
	Name           string
	Code           string
	Description    string
	OwnerTeacherID uint64
	CreatedBy      uint64
}

type UpdateClassParams struct {
	TermID      *uint64
	Name        *string
	Code        *string
	Description *string
}

func NewService(db *gorm.DB, logger *zap.Logger) *Service {
	return &Service{
		repo:   NewRepository(db),
		logger: logger,
	}
}

func (s *Service) ListTeacherTerms() ([]TermListItem, error) {
	return s.repo.ListTerms(TermListQuery{
		Statuses: []TermStatus{TermStatusPlanning, TermStatusActive},
	})
}

func (s *Service) ListAdminTerms(keyword string) ([]TermListItem, error) {
	return s.repo.ListTerms(TermListQuery{Keyword: strings.TrimSpace(keyword)})
}

func (s *Service) CreateTerm(params CreateTermParams) (*Term, error) {
	name := strings.TrimSpace(params.Name)
	code := strings.TrimSpace(params.Code)
	if name == "" || code == "" {
		return nil, apperrors.BadRequest("学期名称和编码不能为空")
	}
	status := TermStatusPlanning
	if params.Status != nil {
		status = *params.Status
	}
	term := &Term{
		Name:      name,
		Code:      code,
		StartAt:   params.StartAt,
		EndAt:     params.EndAt,
		Status:    status,
		CreatedBy: params.CreatedBy,
	}
	if err := s.repo.CreateTerm(term); err != nil {
		return nil, s.translateDBError(err, "学期编码已存在")
	}
	return term, nil
}

func (s *Service) UpdateTerm(id uint64, params UpdateTermParams) (*Term, error) {
	term, err := s.repo.FindTermByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("学期不存在")
		}
		return nil, err
	}
	if params.Name != nil {
		term.Name = strings.TrimSpace(*params.Name)
	}
	if params.Code != nil {
		term.Code = strings.TrimSpace(*params.Code)
	}
	if term.Name == "" || term.Code == "" {
		return nil, apperrors.BadRequest("学期名称和编码不能为空")
	}
	if params.StartAt != nil {
		term.StartAt = params.StartAt
	}
	if params.EndAt != nil {
		term.EndAt = params.EndAt
	}
	if err := s.repo.SaveTerm(term); err != nil {
		return nil, s.translateDBError(err, "学期编码已存在")
	}
	return term, nil
}

func (s *Service) UpdateTermStatus(id uint64, status TermStatus) (*Term, error) {
	term, err := s.repo.FindTermByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("学期不存在")
		}
		return nil, err
	}
	term.Status = status
	if err := s.repo.SaveTerm(term); err != nil {
		return nil, err
	}
	return term, nil
}

func (s *Service) ListClassesForTeacher(actorID uint64, roleType int, params ListClassesParams) ([]ClassListItem, int64, error) {
	query := ClassListQuery{
		Page:     params.Page,
		PageSize: params.PageSize,
		Keyword:  strings.TrimSpace(params.Keyword),
		TermID:   params.TermID,
		Status:   params.Status,
	}
	if roleType < int(user.RoleAdmin) {
		query.OwnerID = &actorID
		if query.Status == nil {
			active := ClassStatusActive
			query.Status = &active
		}
	}
	return s.repo.ListClasses(query)
}

func (s *Service) ListAdminClasses(params ListClassesParams) ([]ClassListItem, int64, error) {
	return s.repo.ListClasses(ClassListQuery{
		Page:     params.Page,
		PageSize: params.PageSize,
		Keyword:  strings.TrimSpace(params.Keyword),
		TermID:   params.TermID,
		Status:   params.Status,
	})
}

func (s *Service) GetClassDetailForTeacher(actorID uint64, roleType int, id uint64) (*ClassDetail, error) {
	class, err := s.repo.FindClassByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("班级不存在")
		}
		return nil, err
	}
	if err := ensureTeacherClassReadable(actorID, roleType, class.OwnerTeacherID); err != nil {
		return nil, err
	}
	return s.repo.FindClassDetail(id)
}

func (s *Service) GetClassDetailForAdmin(id uint64) (*ClassDetail, error) {
	item, err := s.repo.FindClassDetail(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("班级不存在")
		}
		return nil, err
	}
	return item, nil
}

func (s *Service) CreateClass(actorID uint64, params CreateClassParams) (*ClassDetail, error) {
	term, err := s.repo.FindTermByID(params.TermID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.BadRequest("所选学期不存在")
		}
		return nil, err
	}
	if term.Status == TermStatusArchived {
		return nil, apperrors.BadRequest("归档学期不能新建班级")
	}
	name := strings.TrimSpace(params.Name)
	code := strings.TrimSpace(params.Code)
	if name == "" || code == "" {
		return nil, apperrors.BadRequest("班级名称和编码不能为空")
	}
	class := &Class{
		TermID:         params.TermID,
		Name:           name,
		Code:           code,
		Description:    strings.TrimSpace(params.Description),
		OwnerTeacherID: params.OwnerTeacherID,
		Status:         ClassStatusActive,
		CreatedBy:      params.CreatedBy,
	}
	err = s.repo.Transaction(func(tx *gorm.DB) error {
		if err := s.repo.CreateClass(tx, class); err != nil {
			return err
		}
		return s.repo.CreateClassTeacher(tx, &ClassTeacher{
			ClassID:   class.ID,
			TeacherID: params.OwnerTeacherID,
			Role:      ClassTeacherRoleOwner,
			Status:    ClassTeacherStatusActive,
		})
	})
	if err != nil {
		return nil, s.translateDBError(err, "班级编码已存在")
	}
	return s.repo.FindClassDetail(class.ID)
}

func (s *Service) UpdateClassForTeacher(actorID uint64, roleType int, id uint64, params UpdateClassParams) (*ClassDetail, error) {
	class, err := s.repo.FindClassByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("班级不存在")
		}
		return nil, err
	}
	if err := ensureTeacherClassReadable(actorID, roleType, class.OwnerTeacherID); err != nil {
		return nil, err
	}
	if params.TermID != nil {
		term, findErr := s.repo.FindTermByID(*params.TermID)
		if findErr != nil {
			if errors.Is(findErr, gorm.ErrRecordNotFound) {
				return nil, apperrors.BadRequest("所选学期不存在")
			}
			return nil, findErr
		}
		if term.Status == TermStatusArchived {
			return nil, apperrors.BadRequest("归档学期不能关联班级")
		}
		class.TermID = *params.TermID
	}
	if params.Name != nil {
		class.Name = strings.TrimSpace(*params.Name)
	}
	if params.Code != nil {
		class.Code = strings.TrimSpace(*params.Code)
	}
	if params.Description != nil {
		class.Description = strings.TrimSpace(*params.Description)
	}
	if class.Name == "" || class.Code == "" {
		return nil, apperrors.BadRequest("班级名称和编码不能为空")
	}
	if err := s.repo.SaveClass(class); err != nil {
		return nil, s.translateDBError(err, "班级编码已存在")
	}
	return s.repo.FindClassDetail(class.ID)
}

func (s *Service) UpdateClassStatusForAdmin(id uint64, status ClassStatus) (*ClassDetail, error) {
	class, err := s.repo.FindClassByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("班级不存在")
		}
		return nil, err
	}
	class.Status = status
	if err := s.repo.SaveClass(class); err != nil {
		return nil, err
	}
	return s.repo.FindClassDetail(class.ID)
}

func (s *Service) ListMembersForTeacher(actorID uint64, roleType int, classID uint64) ([]ClassMemberItem, error) {
	class, err := s.repo.FindClassByID(classID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("班级不存在")
		}
		return nil, err
	}
	if err := ensureTeacherClassReadable(actorID, roleType, class.OwnerTeacherID); err != nil {
		return nil, err
	}
	return s.repo.ListClassMembers(classID)
}

func (s *Service) RemoveMemberForTeacher(actorID uint64, roleType int, classID, userID uint64) error {
	class, err := s.repo.FindClassByID(classID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apperrors.NotFound("班级不存在")
		}
		return err
	}
	if err := ensureTeacherClassReadable(actorID, roleType, class.OwnerTeacherID); err != nil {
		return err
	}
	member, err := s.repo.FindClassMember(classID, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apperrors.NotFound("班级成员不存在")
		}
		return err
	}
	now := time.Now()
	member.Status = ClassMemberStatusRemoved
	member.RemovedAt = &now
	return s.repo.SaveClassMember(member)
}

func (s *Service) ImportMembersForTeacher(actorID uint64, roleType int, classID uint64, fileHeader *multipart.FileHeader) (*ImportMembersResult, error) {
	class, err := s.repo.FindClassByID(classID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("班级不存在")
		}
		return nil, err
	}
	if err := ensureTeacherClassReadable(actorID, roleType, class.OwnerTeacherID); err != nil {
		return nil, err
	}
	if fileHeader == nil {
		return nil, apperrors.BadRequest("请上传导入文件")
	}

	file, err := fileHeader.Open()
	if err != nil {
		return nil, apperrors.BadRequest("读取导入文件失败")
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	var rows []importRow
	switch ext {
	case ".csv":
		rows, err = parseImportCSV(file)
	case ".xlsx":
		rows, err = parseImportXLSX(file)
	default:
		return nil, apperrors.BadRequest("仅支持上传 CSV 或 XLSX 文件")
	}
	if err != nil {
		if appErr, ok := err.(*apperrors.AppError); ok {
			return nil, appErr
		}
		return nil, apperrors.BadRequest("解析导入文件失败")
	}
	return s.consumeImportRows(classID, rows)
}

func (s *Service) ListClassesForStudent(userID uint64) ([]ClassListItem, error) {
	return s.repo.ListStudentClasses(userID)
}

func (s *Service) EnsureClassAcceptsAssignments(id uint64) error {
	class, err := s.repo.FindClassByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apperrors.NotFound("班级不存在")
		}
		return err
	}
	if class.Status != ClassStatusActive {
		return apperrors.Forbidden("当前班级已停用，暂不允许发布新作业")
	}
	return nil
}

func (s *Service) consumeImportRows(classID uint64, rows []importRow) (*ImportMembersResult, error) {
	result := &ImportMembersResult{
		Summary: ImportSummary{},
		Rows:    make([]ImportRowResult, 0, len(rows)),
	}
	seen := make(map[string]struct{})
	for _, row := range rows {
		if row.isEmpty() {
			result.Summary.Total++
			result.Summary.Skipped++
			result.Rows = append(result.Rows, ImportRowResult{
				RowNumber: row.RowNumber,
				Status:    "skipped",
				Reason:    "空行已跳过",
			})
			continue
		}
		result.Summary.Total++
		key := row.dedupeKey()
		if key != "" {
			if _, ok := seen[key]; ok {
				result.Summary.Skipped++
				result.Rows = append(result.Rows, ImportRowResult{
					RowNumber: row.RowNumber,
					Status:    "skipped",
					Reason:    "同一文件内存在重复成员",
				})
				continue
			}
			seen[key] = struct{}{}
		}

		matchedUser, matchedBy, err := s.repo.FindUserForImport(row.StudentID, row.Username, row.Email)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				result.Summary.Failed++
				result.Rows = append(result.Rows, ImportRowResult{
					RowNumber: row.RowNumber,
					Status:    "failed",
					Reason:    "未匹配到学生账号",
				})
				continue
			}
			return nil, err
		}
		userInfo := &ImportMatchedUser{
			ID:        matchedUser.ID,
			Username:  matchedUser.Username,
			FullName:  matchedUser.FullName,
			Email:     matchedUser.Email,
			StudentID: matchedUser.StudentID,
		}
		if matchedUser.RoleType != user.RoleStudent {
			result.Summary.Failed++
			result.Rows = append(result.Rows, ImportRowResult{
				RowNumber: row.RowNumber,
				MatchedBy: matchedBy,
				Status:    "failed",
				Reason:    "仅允许导入学生账号",
				User:      userInfo,
			})
			continue
		}
		if matchedUser.Status != user.StatusActive {
			result.Summary.Failed++
			result.Rows = append(result.Rows, ImportRowResult{
				RowNumber: row.RowNumber,
				MatchedBy: matchedBy,
				Status:    "failed",
				Reason:    "学生账号当前不是激活状态",
				User:      userInfo,
			})
			continue
		}

		member, findErr := s.repo.FindClassMember(classID, matchedUser.ID)
		if findErr == nil {
			if member.Status == ClassMemberStatusActive {
				result.Summary.Skipped++
				result.Rows = append(result.Rows, ImportRowResult{
					RowNumber: row.RowNumber,
					MatchedBy: matchedBy,
					Status:    "skipped",
					Reason:    "该学生已在班级中",
					User:      userInfo,
				})
				continue
			}
			now := time.Now()
			member.Status = ClassMemberStatusActive
			member.JoinedAt = &now
			member.RemovedAt = nil
			if err := s.repo.SaveClassMember(member); err != nil {
				return nil, err
			}
			result.Summary.Imported++
			result.Rows = append(result.Rows, ImportRowResult{
				RowNumber: row.RowNumber,
				MatchedBy: matchedBy,
				Status:    "imported",
				Reason:    "成员已重新加入班级",
				User:      userInfo,
			})
			continue
		}
		if !errors.Is(findErr, gorm.ErrRecordNotFound) {
			return nil, findErr
		}

		now := time.Now()
		if err := s.repo.CreateClassMember(&ClassMember{
			ClassID:  classID,
			UserID:   matchedUser.ID,
			Status:   ClassMemberStatusActive,
			JoinedAt: &now,
		}); err != nil {
			return nil, err
		}
		result.Summary.Imported++
		result.Rows = append(result.Rows, ImportRowResult{
			RowNumber: row.RowNumber,
			MatchedBy: matchedBy,
			Status:    "imported",
			Reason:    "导入成功",
			User:      userInfo,
		})
	}
	return result, nil
}

func (s *Service) translateDBError(err error, duplicatedMessage string) error {
	if err == nil {
		return nil
	}
	lower := strings.ToLower(err.Error())
	if strings.Contains(lower, "duplicate") || strings.Contains(lower, "unique") {
		return apperrors.BadRequest(duplicatedMessage)
	}
	return err
}

func ensureTeacherClassReadable(actorID uint64, roleType int, ownerTeacherID uint64) error {
	if roleType >= int(user.RoleAdmin) {
		return nil
	}
	if actorID != ownerTeacherID {
		return apperrors.Forbidden("无权访问该班级")
	}
	return nil
}

type importRow struct {
	RowNumber int
	StudentID string
	Username  string
	Email     string
}

func (r importRow) isEmpty() bool {
	return strings.TrimSpace(r.StudentID) == "" && strings.TrimSpace(r.Username) == "" && strings.TrimSpace(r.Email) == ""
}

func (r importRow) dedupeKey() string {
	if strings.TrimSpace(r.StudentID) != "" {
		return "studentId:" + strings.TrimSpace(strings.ToLower(r.StudentID))
	}
	if strings.TrimSpace(r.Username) != "" {
		return "username:" + strings.TrimSpace(strings.ToLower(r.Username))
	}
	if strings.TrimSpace(r.Email) != "" {
		return "email:" + strings.TrimSpace(strings.ToLower(r.Email))
	}
	return ""
}

func parseImportCSV(reader io.Reader) ([]importRow, error) {
	csvReader := csv.NewReader(reader)
	rows, err := csvReader.ReadAll()
	if err != nil {
		return nil, err
	}
	return parseSheetRows(rows)
}

func parseImportXLSX(reader io.Reader) ([]importRow, error) {
	file, err := excelize.OpenReader(reader)
	if err != nil {
		return nil, err
	}
	defer func() { _ = file.Close() }()

	sheetName := file.GetSheetName(0)
	if sheetName == "" {
		return nil, apperrors.BadRequest("导入文件没有可读取的工作表")
	}
	rows, err := file.GetRows(sheetName)
	if err != nil {
		return nil, err
	}
	return parseSheetRows(rows)
}

func parseSheetRows(rows [][]string) ([]importRow, error) {
	if len(rows) == 0 {
		return nil, nil
	}
	headerMap := make(map[string]int)
	for index, cell := range rows[0] {
		if key := canonicalImportHeader(cell); key != "" {
			headerMap[key] = index
		}
	}
	if _, hasStudentID := headerMap["studentid"]; !hasStudentID {
		if _, hasUsername := headerMap["username"]; !hasUsername {
			if _, hasEmail := headerMap["email"]; !hasEmail {
				return nil, apperrors.BadRequest("导入文件首行需包含 studentId / username / email 中至少一列")
			}
		}
	}
	result := make([]importRow, 0, len(rows)-1)
	for rowIndex, row := range rows[1:] {
		item := importRow{
			RowNumber: rowIndex + 2,
			StudentID: readColumn(row, headerMap, "studentid"),
			Username:  readColumn(row, headerMap, "username"),
			Email:     readColumn(row, headerMap, "email"),
		}
		result = append(result, item)
	}
	return result, nil
}

func normalizeImportHeader(value string) string {
	normalized := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(value)), "\ufeff")
	normalized = strings.ReplaceAll(normalized, "_", "")
	normalized = strings.ReplaceAll(normalized, "-", "")
	normalized = strings.ReplaceAll(normalized, " ", "")
	normalized = strings.ReplaceAll(normalized, "/", "")
	return normalized
}

func canonicalImportHeader(value string) string {
	switch normalizeImportHeader(value) {
	case "studentid", "studentno", "studentnumber", "student", "学号", "学生学号", "学生id", "学生编号":
		return "studentid"
	case "username", "user", "account", "login", "账号", "用户名", "学生账号", "账户":
		return "username"
	case "email", "mail", "邮箱", "电子邮箱", "邮件":
		return "email"
	default:
		return ""
	}
}

func readColumn(row []string, headerMap map[string]int, key string) string {
	index, ok := headerMap[key]
	if !ok {
		return ""
	}
	if index < 0 || index >= len(row) {
		return ""
	}
	return strings.TrimSpace(row[index])
}
