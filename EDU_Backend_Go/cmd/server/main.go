package main

import (
	"context"
	"errors"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"edu-platform/internal/app"
	"edu-platform/internal/config"
	"edu-platform/internal/domain/agent"
	"edu-platform/internal/domain/assignment"
	"edu-platform/internal/domain/classroom"
	"edu-platform/internal/domain/course"
	"edu-platform/internal/domain/lab"
	"edu-platform/internal/domain/operations"
	"edu-platform/internal/domain/project"
	"edu-platform/internal/domain/publishing"
	"edu-platform/internal/domain/user"
	infraauthz "edu-platform/internal/infra/authz"
	"edu-platform/internal/infra/cache"
	"edu-platform/internal/infra/database"
	k8sinfra "edu-platform/internal/infra/k8s"
	"edu-platform/internal/infra/logger"
	"edu-platform/internal/infra/schemaaudit"
	"edu-platform/internal/router"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		panic(err)
	}

	log, err := logger.New(cfg)
	if err != nil {
		panic(err)
	}
	defer func() { _ = log.Sync() }()

	db, err := database.New(cfg, log)
	if err != nil {
		log.Fatal("failed to connect database", logger.Error(err))
	}
	if cfg.App.Env == "production" && !cfg.Database.AutoMigrate {
		report, auditErr := schemaaudit.Check(context.Background(), db)
		if auditErr != nil {
			log.Fatal("database schema preflight failed", logger.Error(auditErr))
		}
		if !report.OK() {
			for _, issue := range report.Errors {
				log.Error("database schema mismatch",
					logger.String("table", issue.Table),
					logger.String("target", issue.Target),
					logger.String("message", issue.Message),
				)
			}
			log.Fatal("数据库结构不完整，请先执行 deployments/sql 下的迁移修复")
		}
	}
	if cfg.Database.AutoMigrate {
		if err := db.AutoMigrate(
			&user.User{},
			&course.Course{},
			&course.CourseTranslation{},
			&course.CourseStage{},
			&course.CourseStageTranslation{},
			&course.CourseLesson{},
			&course.CourseLessonTranslation{},
			&course.Skill{},
			&course.LessonSkill{},
			&course.LessonMaterial{},
			&course.LessonMaterialTranslation{},
			&course.UserCourseEnrollment{},
			&course.UserLessonRecord{},
			&course.UserActivityLog{},
			&project.Project{},
			&project.ProjectTranslation{},
			&project.ProjectUnit{},
			&project.ProjectUnitTranslation{},
			&project.Tag{},
			&project.ProjectTag{},
			&project.UserProjectProgress{},
			&agent.AgentManual{},
			&agent.AgentManualTranslation{},
			&agent.AgentStep{},
			&agent.AgentStepTranslation{},
			&agent.UserAgentProgress{},
			&agent.AgentLearningEvent{},
			&agent.AgentStepAttempt{},
			&agent.AgentChatSession{},
			&agent.AgentChatMessage{},
			&agent.AgentReflectionCard{},
			&agent.AgentStepSkillTag{},
			&agent.AgentFAQItem{},
			&agent.AgentInterventionRecord{},
			&agent.LabTerminalEvent{},
			&lab.UserLabSession{},
			&classroom.Term{},
			&classroom.Class{},
			&classroom.ClassMember{},
			&classroom.ClassTeacher{},
			&assignment.TeachingAssignment{},
			&assignment.AssignmentResource{},
			&assignment.AssignmentClass{},
			&assignment.AssignmentRule{},
			&assignment.Submission{},
			&assignment.SubmissionFile{},
			&assignment.SubmissionCheck{},
			&assignment.Rubric{},
			&assignment.RubricItem{},
			&assignment.Grade{},
			&assignment.TeacherFeedback{},
			&assignment.Notification{},
			&assignment.TeacherActionLog{},
			&assignment.SubmissionReopen{},
			&assignment.AIRequest{},
			&assignment.AISuggestion{},
			&assignment.AIFeatureSetting{},
			&operations.ResourceQuota{},
			&operations.RuntimeSessionEvent{},
			&operations.AuditLog{},
			&publishing.LabTemplate{},
			&publishing.ContentPublishCheck{},
			&publishing.PublishAuditLog{},
		); err != nil {
			log.Fatal("database auto migrate failed", logger.Error(err))
		}
		operationsService := operations.NewService(db, log)
		if err := operationsService.EnsureDefaultQuota(context.Background()); err != nil {
			log.Fatal("default resource quota migrate failed", logger.Error(err))
		}
	}

	rdb, err := cache.New(cfg, log)
	if err != nil {
		log.Fatal("failed to connect redis", logger.Error(err))
	}

	k8sClient, k8sRest, err := k8sinfra.New(cfg, log)
	if err != nil {
		log.Warn("k8s client init failed", logger.Error(err))
	}

	enforcer, err := infraauthz.New(cfg, log)
	if err != nil {
		log.Warn("casbin enforcer init failed", logger.Error(err))
	}

	userService := user.NewService(db, log)
	if err := userService.InitDefaultAdmin(cfg.Security.DefaultAdminPassword); err != nil {
		log.Warn("default admin bootstrap skipped", logger.Error(err))
	}

	labService := lab.NewService(db, log, cfg, k8sClient, k8sRest)
	labJanitor := lab.NewJanitor(labService, log)

	deps := app.Dependencies{
		Config:   cfg,
		Logger:   log,
		DB:       db,
		Redis:    rdb,
		K8S:      k8sClient,
		K8SRest:  k8sRest,
		Enforcer: enforcer,
	}

	engine := router.New(deps)
	srv := &http.Server{
		Addr:         cfg.Server.Address(),
		Handler:      engine,
		ReadTimeout:  cfg.Server.ReadTimeout(),
		WriteTimeout: cfg.Server.WriteTimeout(),
	}

	go func() {
		log.Info("server starting", logger.String("addr", srv.Addr))
		if serveErr := srv.ListenAndServe(); serveErr != nil && !errors.Is(serveErr, http.ErrServerClosed) {
			log.Fatal("server crashed", logger.Error(serveErr))
		}
	}()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	go labJanitor.Run(ctx)
	<-ctx.Done()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error("server shutdown failed", logger.Error(err))
	}
}
