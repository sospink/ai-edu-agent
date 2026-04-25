CREATE TABLE IF NOT EXISTS teaching_assignments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(128) NOT NULL DEFAULT '',
  description VARCHAR(1024) NOT NULL DEFAULT '',
  status INT NOT NULL DEFAULT 0,
  creator_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  due_at DATETIME NULL,
  published_at DATETIME NULL,
  closed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_teaching_assignments_status (status),
  KEY idx_teaching_assignments_creator_id (creator_id),
  KEY idx_teaching_assignments_due_at (due_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS assignment_resources (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  assignment_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  resource_type VARCHAR(32) NOT NULL DEFAULT '',
  resource_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  unit_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  lesson_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  manual_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_assignment_resources_assignment_id (assignment_id),
  KEY idx_assignment_resources_type (resource_type),
  KEY idx_assignment_resources_resource_id (resource_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS assignment_classes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  assignment_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  class_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_assignment_classes_assignment_class (assignment_id, class_id),
  KEY idx_assignment_classes_assignment_id (assignment_id),
  KEY idx_assignment_classes_class_id (class_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS assignment_rules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  assignment_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  attempt_limit INT NOT NULL DEFAULT 1,
  allow_late TINYINT(1) NOT NULL DEFAULT 0,
  allow_resubmit TINYINT(1) NOT NULL DEFAULT 0,
  score_mode VARCHAR(32) NOT NULL DEFAULT 'completion',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_assignment_rules_assignment_id (assignment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
