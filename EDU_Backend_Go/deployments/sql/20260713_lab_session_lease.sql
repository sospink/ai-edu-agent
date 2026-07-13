ALTER TABLE `user_lab_sessions`
  ADD COLUMN `client_instance_id` VARCHAR(64) NOT NULL DEFAULT '' AFTER `default_app_port_name`,
  ADD COLUMN `lease_expires_at` DATETIME(3) NULL AFTER `client_instance_id`,
  ADD COLUMN `active_user_id` BIGINT UNSIGNED
    GENERATED ALWAYS AS (CASE WHEN `status` IN (0, 1) THEN `user_id` ELSE NULL END) STORED,
  ADD INDEX `idx_lab_sessions_client` (`client_instance_id`),
  ADD INDEX `idx_lab_sessions_lease` (`lease_expires_at`),
  ADD UNIQUE INDEX `uniq_lab_active_user` (`active_user_id`);

UPDATE `lab_templates`
SET
  `main_memory_request` = '1Gi',
  `main_memory_limit` = '2560Mi',
  `ide_memory_request` = '128Mi',
  `ide_memory_limit` = '768Mi',
  `updated_at` = NOW(3)
WHERE `env_image` IN ('opencode-lab:latest', 'docker.io/library/opencode-lab:latest')
  AND `status` = 1;
