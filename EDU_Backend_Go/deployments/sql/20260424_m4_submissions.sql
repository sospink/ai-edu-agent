CREATE TABLE IF NOT EXISTS submissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  assignment_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  student_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  attempt_no INT NOT NULL DEFAULT 1,
  status VARCHAR(32) NOT NULL DEFAULT 'submitted',
  content_text TEXT,
  lab_session_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  openclaw_session_id VARCHAR(128) NOT NULL DEFAULT '',
  agent_manual_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  submitted_at DATETIME NULL,
  returned_at DATETIME NULL,
  graded_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_submissions_assignment_id (assignment_id),
  KEY idx_submissions_student_id (student_id),
  KEY idx_submissions_status (status),
  KEY idx_submissions_lab_session_id (lab_session_id),
  KEY idx_submissions_agent_manual_id (agent_manual_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS submission_files (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  submission_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  file_type VARCHAR(32) NOT NULL DEFAULT 'file',
  title VARCHAR(255) NOT NULL DEFAULT '',
  url VARCHAR(1024) NOT NULL DEFAULT '',
  metadata_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_submission_files_submission_id (submission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS submission_checks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  submission_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  check_type VARCHAR(32) NOT NULL DEFAULT '',
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  score DECIMAL(10,2) NOT NULL DEFAULT 0,
  max_score DECIMAL(10,2) NOT NULL DEFAULT 0,
  command TEXT,
  output TEXT,
  error TEXT,
  metadata_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_submission_checks_submission_id (submission_id),
  KEY idx_submission_checks_check_type (check_type),
  KEY idx_submission_checks_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rubrics (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  assignment_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  title VARCHAR(128) NOT NULL DEFAULT '作业评分 Rubric',
  total_score DECIMAL(10,2) NOT NULL DEFAULT 100,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY idx_rubrics_assignment_id (assignment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rubric_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  rubric_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  title VARCHAR(128) NOT NULL DEFAULT '',
  description VARCHAR(1024) NOT NULL DEFAULT '',
  max_score DECIMAL(10,2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_rubric_items_rubric_id (rubric_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS grades (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  submission_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  student_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  assignment_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  score DECIMAL(10,2) NOT NULL DEFAULT 0,
  max_score DECIMAL(10,2) NOT NULL DEFAULT 100,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  graded_by BIGINT UNSIGNED NOT NULL DEFAULT 0,
  rubric_scores_json JSON NULL,
  published_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY idx_grades_submission_id (submission_id),
  KEY idx_grades_student_id (student_id),
  KEY idx_grades_assignment_id (assignment_id),
  KEY idx_grades_status (status),
  KEY idx_grades_graded_by (graded_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS teacher_feedback (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  submission_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  teacher_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  content TEXT,
  visibility VARCHAR(32) NOT NULL DEFAULT 'student',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_teacher_feedback_submission_id (submission_id),
  KEY idx_teacher_feedback_teacher_id (teacher_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
