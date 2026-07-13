package schemaaudit

func ExpectedTables() []TableSpec {
	return []TableSpec{
		base("sys_users", true, "id", "username", "email", "password", "phone", "student_id", "full_name", "avatar_url", "bio", "github_link", "role_type", "status", "created_at", "updated_at"),
		base("courses", true, "id", "title", "slug", "description", "icon_url", "cover_color", "difficulty", "total_lessons", "total_skills", "estimated_hours", "status", "env_image", "ide_image", "lab_template_id", "creator_id", "created_at", "updated_at"),
		base("course_stages", true, "id", "course_id", "title", "description", "sort_order", "level_label", "created_at"),
		base("course_lessons", true, "id", "course_id", "stage_id", "title", "type", "duration_minutes", "lab_identifier", "points", "sort_order", "created_at"),
		base("lesson_materials", false, "id", "lesson_id", "title", "type", "file_url", "file_name", "file_size", "sort_order", "created_at", "updated_at"),
		base("lesson_skills", false, "id", "lesson_id", "skill_id"),
		base("skills", false, "id", "name", "category", "created_at"),
		base("user_course_enrollments", false, "id", "user_id", "course_id", "status", "progress_percent", "completed_lessons_count", "last_lesson_id", "last_active_at", "joined_at", "completed_at"),
		base("user_lesson_records", false, "id", "user_id", "course_id", "lesson_id", "status", "score", "started_at", "finished_at"),
		base("user_activity_logs", false, "id", "user_id", "activity_date", "contribution_count"),
		base("projects", true, "id", "title", "slug", "subtitle", "cover_url", "difficulty", "status", "description", "learning_goals", "prerequisites", "labs_count", "challenges_count", "students_count", "env_image", "ide_image", "lab_template_id", "created_by", "created_at", "updated_at", "deleted_at"),
		base("project_units", true, "id", "project_id", "title", "description", "type", "mode_group", "env_id", "time_limit", "points", "sort_order", "is_hidden", "created_at", "updated_at"),
		base("tags", true, "id", "name", "style_color", "created_at"),
		base("project_tags", true, "id", "project_id", "tag_id"),
		base("user_project_progress", false, "id", "user_id", "project_id", "status", "current_unit_id", "finished_units_count", "progress_percent", "last_active_at", "started_at", "completed_at"),
		base("agent_manuals", true, "id", "source_type", "source_id", "title", "description", "is_published", "creator_id", "created_at", "updated_at"),
		base("agent_steps", true, "id", "manual_id", "step_order", "title", "content", "quick_questions", "verification", "created_at", "updated_at"),
		base("user_agent_progress", false, "id", "user_id", "manual_id", "current_step", "completed_steps", "chat_history", "started_at", "last_active_at"),
		base("user_lab_sessions", false, "id", "user_id", "source_type", "source_id", "container_id", "container_name", "image_name", "vnc_port", "ide_port", "ssh_port", "status", "error_message", "expires_at", "created_at", "updated_at", "runtime_mode", "gateway_port", "gateway_token", "desktop_enabled", "app_ports", "default_app_port_name", "client_instance_id", "lease_expires_at"),
		withIndexes("terms", []string{"id", "name", "code", "start_at", "end_at", "status", "created_by", "created_at", "updated_at"}, []IndexSpec{{Name: "idx_terms_code", Columns: []string{"code"}, Unique: true}, {Name: "idx_terms_status", Columns: []string{"status"}}}),
		withIndexes("classes", []string{"id", "term_id", "name", "code", "description", "owner_teacher_id", "status", "created_by", "created_at", "updated_at"}, []IndexSpec{{Name: "idx_classes_code", Columns: []string{"code"}, Unique: true}, {Name: "idx_classes_term_id", Columns: []string{"term_id"}}, {Name: "idx_classes_owner_teacher_id", Columns: []string{"owner_teacher_id"}}, {Name: "idx_classes_status", Columns: []string{"status"}}}),
		withIndexes("class_members", []string{"id", "class_id", "user_id", "status", "joined_at", "removed_at", "created_at", "updated_at"}, []IndexSpec{{Name: "idx_class_members_class_user", Columns: []string{"class_id", "user_id"}, Unique: true}, {Name: "idx_class_members_class_id", Columns: []string{"class_id"}}, {Name: "idx_class_members_user_id", Columns: []string{"user_id"}}, {Name: "idx_class_members_status", Columns: []string{"status"}}}),
		withIndexes("class_teachers", []string{"id", "class_id", "teacher_id", "role", "status", "created_at", "updated_at"}, []IndexSpec{{Name: "idx_class_teachers_class_id", Columns: []string{"class_id"}}, {Name: "idx_class_teachers_teacher_id", Columns: []string{"teacher_id"}}}),
		withIndexes("lab_templates", []string{"id", "name", "code", "description", "runtime_mode", "env_image", "ide_image", "main_cpu_request", "main_memory_request", "main_cpu_limit", "main_memory_limit", "ide_cpu_request", "ide_memory_request", "ide_cpu_limit", "ide_memory_limit", "desktop_enabled", "app_ports", "default_app_port_name", "exposed_ports", "status", "created_by", "created_at", "updated_at"}, []IndexSpec{{Name: "idx_lab_templates_code", Columns: []string{"code"}, Unique: true}, {Name: "idx_lab_templates_status", Columns: []string{"status"}}}),
		base("content_publish_checks", false, "id", "content_type", "content_id", "actor_id", "can_publish", "errors", "warnings", "summary", "snapshot", "created_at"),
		base("publish_audit_logs", false, "id", "content_type", "content_id", "content_title", "action", "actor_id", "result", "message", "check_id", "errors", "warnings", "snapshot", "created_at"),
		withIndexes("teaching_assignments", []string{"id", "title", "description", "status", "creator_id", "due_at", "published_at", "closed_at", "created_at", "updated_at"}, []IndexSpec{{Name: "idx_teaching_assignments_status", Columns: []string{"status"}}, {Name: "idx_teaching_assignments_creator_id", Columns: []string{"creator_id"}}, {Name: "idx_teaching_assignments_due_at", Columns: []string{"due_at"}}}),
		base("assignment_resources", false, "id", "assignment_id", "resource_type", "resource_id", "unit_id", "lesson_id", "manual_id", "sort_order", "created_at", "updated_at"),
		withIndexes("assignment_classes", []string{"id", "assignment_id", "class_id", "created_at"}, []IndexSpec{{Name: "idx_assignment_classes_assignment_class", Columns: []string{"assignment_id", "class_id"}, Unique: true}, {Name: "idx_assignment_classes_assignment_id", Columns: []string{"assignment_id"}}, {Name: "idx_assignment_classes_class_id", Columns: []string{"class_id"}}}),
		withIndexes("assignment_rules", []string{"id", "assignment_id", "attempt_limit", "allow_late", "allow_return", "allow_resubmit", "score_mode", "created_at", "updated_at"}, []IndexSpec{{Name: "idx_assignment_rules_assignment_id", Columns: []string{"assignment_id"}, Unique: true}}),
		base("submissions", false, "id", "assignment_id", "student_id", "attempt_no", "status", "content_text", "lab_session_id", "openclaw_session_id", "agent_manual_id", "submitted_at", "returned_at", "graded_at", "created_at", "updated_at"),
		base("submission_files", false, "id", "submission_id", "file_type", "title", "url", "metadata_json", "created_at"),
		base("submission_checks", false, "id", "submission_id", "check_type", "status", "score", "max_score", "command", "output", "error", "metadata_json", "created_at"),
		base("rubrics", false, "id", "assignment_id", "title", "total_score", "created_at", "updated_at"),
		base("rubric_items", false, "id", "rubric_id", "title", "description", "max_score", "sort_order", "created_at", "updated_at"),
		base("grades", false, "id", "submission_id", "student_id", "assignment_id", "score", "max_score", "status", "graded_by", "rubric_scores_json", "published_at", "created_at", "updated_at"),
		base("teacher_feedback", false, "id", "submission_id", "teacher_id", "content", "visibility", "created_at", "updated_at"),
		base("notifications", false, "id", "user_id", "type", "title", "content", "source_type", "source_id", "read_at", "created_at"),
		base("teacher_action_logs", false, "id", "teacher_id", "action_type", "target_type", "target_id", "assignment_id", "note", "created_at"),
		base("submission_reopens", false, "id", "assignment_id", "student_id", "granted_by", "extra_attempts", "used_attempts", "reason", "expires_at", "created_at"),
		withIndexes("resource_quotas", []string{"id", "scope_type", "scope_id", "name", "max_concurrent_sessions", "max_session_minutes", "enabled", "created_by", "updated_by", "created_at", "updated_at"}, []IndexSpec{{Name: "idx_resource_quotas_scope", Columns: []string{"scope_type", "scope_id"}, Unique: true}, {Name: "idx_resource_quotas_enabled", Columns: []string{"enabled"}}}),
		base("runtime_session_events", false, "id", "session_id", "user_id", "event_type", "status", "message", "metadata_json", "operator_id", "created_at"),
		base("audit_logs", false, "id", "actor_id", "actor_role", "action", "target_type", "target_id", "result", "message", "metadata_json", "ip", "user_agent", "created_at"),
		base("ai_requests", false, "id", "actor_id", "action", "source_type", "source_id", "model", "prompt_tokens", "total_tokens", "latency_ms", "status", "error", "created_at"),
		base("ai_suggestions", false, "id", "request_id", "suggestion_type", "source_type", "source_id", "created_by", "title", "content", "evidence_json", "status", "confirmed_by", "confirmed_at", "adopted_content", "created_at", "updated_at"),
		base("ai_feature_settings", false, "id", "enabled", "updated_by", "updated_at"),
		base("agent_learning_events", false, "id", "user_id", "manual_id", "step_order", "event_type", "meta_json", "created_at"),
		base("agent_step_attempts", false, "id", "user_id", "manual_id", "step_id", "step_order", "lab_session_id", "attempt_type", "success", "failure_reason", "evidence_json", "created_at"),
		withIndexes("agent_chat_sessions", []string{"id", "user_id", "manual_id", "step_order", "last_active_at", "created_at", "updated_at"}, []IndexSpec{{Name: "idx_chat_session_key", Columns: []string{"user_id", "manual_id", "step_order"}, Unique: true}, {Name: "idx_agent_chat_sessions_user", Columns: []string{"user_id"}}, {Name: "idx_agent_chat_sessions_manual", Columns: []string{"manual_id"}}}),
		base("agent_chat_messages", false, "id", "session_id", "role", "content", "created_at"),
		withIndexes("agent_reflection_cards", []string{"id", "user_id", "manual_id", "summary", "strengths", "stuck_points", "review_suggestions", "evidence_json", "status", "created_at", "updated_at"}, []IndexSpec{{Name: "idx_reflection_user_manual", Columns: []string{"user_id", "manual_id"}, Unique: true}, {Name: "idx_agent_reflection_user", Columns: []string{"user_id"}}, {Name: "idx_agent_reflection_manual", Columns: []string{"manual_id"}}}),
		base("agent_step_skill_tags", false, "id", "manual_id", "step_id", "skill_tag", "created_at", "updated_at"),
		base("agent_faq_items", false, "id", "manual_id", "class_id", "step_id", "step_order", "question", "answer", "source_suggestion_id", "status", "created_by", "published_at", "created_at", "updated_at"),
		base("agent_intervention_records", false, "id", "manual_id", "class_id", "step_id", "student_id", "teacher_id", "action_type", "title", "content", "status", "read_at", "created_at", "updated_at"),
		base("lab_terminal_events", false, "id", "user_id", "lab_session_id", "manual_id", "step_order", "command", "output_summary", "exit_code", "created_at"),
	}
}

func base(name string, warnIfNoRows bool, columns ...string) TableSpec {
	spec := TableSpec{Name: name, WarnIfNoRows: warnIfNoRows}
	for _, column := range columns {
		spec.Columns = append(spec.Columns, ColumnSpec{Name: column})
	}
	spec.Indexes = []IndexSpec{{Name: "PRIMARY", Columns: []string{"id"}, Unique: true}}
	return spec
}

func withIndexes(name string, columns []string, indexes []IndexSpec) TableSpec {
	spec := base(name, false, columns...)
	spec.Indexes = append(spec.Indexes, indexes...)
	return spec
}
