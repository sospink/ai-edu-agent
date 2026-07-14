package i18n

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
	"sync"
	"unicode"
)

type contextKey string

type MessageKey string

type Params map[string]any

var missingMessageWarnings sync.Map

const (
	LocaleZhCN = "zh-CN"
	LocaleEnUS = "en-US"

	localeContextKey contextKey = "locale"
)

func NormalizeLocale(raw string) string {
	value := strings.TrimSpace(raw)
	if value == "" {
		return LocaleEnUS
	}
	lower := strings.ToLower(value)
	switch {
	case strings.HasPrefix(lower, "en"):
		return LocaleEnUS
	default:
		return LocaleZhCN
	}
}

func WithLocale(ctx context.Context, locale string) context.Context {
	return context.WithValue(ctx, localeContextKey, NormalizeLocale(locale))
}

func LocaleFromContext(ctx context.Context) string {
	if ctx == nil {
		return LocaleEnUS
	}
	if value, ok := ctx.Value(localeContextKey).(string); ok {
		return NormalizeLocale(value)
	}
	return LocaleEnUS
}

func LanguageInstruction(ctx context.Context) string {
	if LocaleFromContext(ctx) == LocaleEnUS {
		return "Please respond in English. Keep user-provided code, commands, paths, logs, and quoted content unchanged."
	}
	return "请使用中文回答。用户提供的代码、命令、路径、日志和引用内容保持原样。"
}

func T(ctx context.Context, message string) string {
	if LocaleFromContext(ctx) != LocaleEnUS {
		return message
	}
	return TranslateMessage(message)
}

func HasHan(value string) bool {
	for _, current := range value {
		if unicode.Is(unicode.Han, current) {
			return true
		}
	}
	return false
}

// SystemText translates legacy system messages and guarantees that an English
// request never receives untranslated Chinese UI copy.
func SystemText(ctx context.Context, message, englishFallback string) string {
	translated := T(ctx, message)
	if LocaleFromContext(ctx) == LocaleEnUS && HasHan(translated) {
		return englishFallback
	}
	return translated
}

// OptionalDetail 翻译可附加在本地化前缀后的错误明细：
// 中文请求原样返回；英文请求若明细可翻译则返回译文，否则返回空串，
// 以保留可诊断信息的同时避免把未翻译的中文泄漏给英文用户。
func OptionalDetail(ctx context.Context, detail string) string {
	trimmed := strings.TrimSpace(detail)
	if trimmed == "" {
		return ""
	}
	translated := T(ctx, trimmed)
	if LocaleFromContext(ctx) == LocaleEnUS && HasHan(translated) {
		return ""
	}
	return translated
}

func Message(ctx context.Context, key MessageKey, params Params) string {
	locale := LocaleFromContext(ctx)
	catalog := keyedMessages[locale]
	template, ok := catalog[key]
	if !ok {
		template = keyedMessages[LocaleZhCN][key]
	}
	if template == "" {
		if strings.HasSuffix(os.Args[0], ".test") {
			panic(fmt.Sprintf("缺少国际化消息 key: %s", key))
		}
		if _, loaded := missingMessageWarnings.LoadOrStore(key, struct{}{}); !loaded {
			log.Printf("国际化消息 key 未注册: %s", key)
		}
		if locale == LocaleEnUS {
			return "Request failed"
		}
		return "请求失败"
	}
	for name, value := range params {
		template = strings.ReplaceAll(template, "{{"+name+"}}", fmt.Sprint(value))
	}
	return template
}

var keyedMessages = map[string]map[MessageKey]string{
	LocaleZhCN: {
		"common.success":        "操作成功",
		"common.created":        "创建成功",
		"common.requestFailed":  "请求失败",
		"common.invalidParams":  "请求参数无效",
		"auth.required":         "请先登录",
		"classroom.termsLoaded": "获取学期列表成功", "classroom.termCreated": "学期创建成功", "classroom.termUpdated": "学期更新成功", "classroom.termStatusUpdated": "学期状态更新成功", "classroom.classCreated": "班级创建成功", "classroom.classLoaded": "获取班级详情成功", "classroom.classUpdated": "班级更新成功", "classroom.membersLoaded": "获取班级成员成功", "classroom.membersImported": "班级成员导入完成", "classroom.memberRemoved": "班级成员已移除", "classroom.studentClassesLoaded": "获取我的班级成功", "classroom.classStatusUpdated": "班级状态更新成功", "classroom.uploadRequired": "请上传导入文件", "classroom.invalidTermId": "无效的学期ID", "classroom.invalidClassStatus": "无效的班级状态", "classroom.invalidStartDate": "开始日期格式错误，请使用 YYYY-MM-DD", "classroom.invalidEndDate": "结束日期格式错误，请使用 YYYY-MM-DD",
		"assignment.listLoaded": "获取作业列表成功", "assignment.created": "创建作业成功", "assignment.detailLoaded": "获取作业详情成功", "assignment.updated": "更新作业成功", "assignment.studentListLoaded": "获取我的任务成功", "assignment.studentDetailLoaded": "获取任务详情成功", "assignment.submitted": "提交成功", "assignment.submissionLoaded": "获取提交详情成功", "assignment.gradesLoaded": "获取成绩成功", "assignment.notificationsLoaded": "获取通知成功", "assignment.notificationRead": "通知已读", "assignment.overviewLoaded": "获取作业概览成功", "assignment.qualityLoaded": "获取教学质量概览成功", "assignment.reviewQueueLoaded": "获取待批改列表成功", "assignment.checksRecorded": "重新验证已记录", "assignment.gradeSaved": "评分已保存", "assignment.returned": "提交已退回", "assignment.gradePublished": "成绩已发布", "assignment.aiFeedbackCreated": "AI 反馈草稿已生成", "assignment.aiSummaryCreated": "AI 作业摘要已生成", "assignment.aiWeaknessCreated": "AI 薄弱点诊断已生成", "assignment.aiSuggestionUpdated": "AI 建议状态已更新", "assignment.agentStatsLoaded": "Agent 步骤统计已加载", "assignment.aiStepCreated": "AI 步骤诊断已生成", "assignment.observatoryLoaded": "Agent 观察台已加载", "assignment.agentDetailLoaded": "Agent 详情已加载", "assignment.skillTagsUpdated": "技能标签已更新", "assignment.weaknessLoaded": "Agent 薄弱点已加载", "assignment.aiFAQCreated": "AI FAQ 草稿已生成", "assignment.faqPublished": "FAQ 已发布", "assignment.faqLoaded": "FAQ 列表已加载", "assignment.faqArchived": "FAQ 已归档", "assignment.interventionCreated": "干预记录已创建", "assignment.interventionsLoaded": "干预记录已加载", "assignment.aiStatusLoaded": "AI 状态已加载", "assignment.aiSettingsLoaded": "AI 设置已加载", "assignment.aiSettingsUpdated": "AI 设置已更新", "assignment.workbenchLoaded": "获取教学工作台概览成功", "assignment.todosLoaded": "获取教学待办成功", "assignment.risksLoaded": "获取风险学生成功", "assignment.progressLoaded": "获取作业进度成功", "assignment.gradebookLoaded": "获取成绩簿成功", "assignment.reminderSent": "提醒已发送", "assignment.reopened": "提交已重开", "assignment.invalidId": "无效的作业 ID",
		"publishing.courseCheckCompleted": "课程发布检查完成", "publishing.coursePublished": "课程已发布", "publishing.courseUpdated": "课程更新成功", "publishing.courseUpdatedPublished": "课程更新并发布成功", "publishing.projectCheckCompleted": "项目发布检查完成", "publishing.projectPublished": "项目已发布", "publishing.projectUpdated": "项目更新成功", "publishing.projectUpdatedPublished": "项目更新并发布成功", "publishing.manualCheckCompleted": "手册发布检查完成", "publishing.teacherTemplatesLoaded": "获取可用 Lab 模板成功", "publishing.adminTemplatesLoaded": "获取 Lab 模板成功", "publishing.templateCreated": "Lab 模板创建成功", "publishing.templateUpdated": "Lab 模板更新成功", "publishing.templateStatusUpdated": "Lab 模板状态更新成功", "publishing.courseForbidden": "无权管理该课程", "publishing.projectForbidden": "无权管理该项目",
		"teacher.manualsLoaded": "获取手册列表成功", "teacher.progressLoaded": "获取学生进度成功",
		"common.invalidOrder": "排序数据格式错误",
		"course.listLoaded":   "获取课程列表成功", "course.assignedLoaded": "获取班级课程成功", "course.detailLoaded": "获取课程成功", "course.stagesLoaded": "获取阶段列表成功", "course.lessonsLoaded": "获取课时列表成功", "course.lessonLoaded": "获取课时成功", "course.materialsLoaded": "获取学习资料成功", "course.enrolled": "加入课程成功", "course.recordsLoaded": "获取课时记录成功", "course.lessonStarted": "开始学习成功", "course.lessonCompleted": "完成学习成功", "course.created": "课程创建成功", "course.updated": "课程更新成功", "course.deleted": "课程删除成功", "course.stageCreated": "阶段创建成功", "course.stageUpdated": "阶段更新成功", "course.stageDeleted": "阶段删除成功", "course.stagesReordered": "阶段排序更新成功", "course.lessonCreated": "课时创建成功", "course.lessonUpdated": "课时更新成功", "course.lessonDeleted": "课时删除成功", "course.lessonsReordered": "课时排序更新成功", "course.skillsLoaded": "获取技能列表成功", "course.skillCreated": "技能创建成功", "course.skillUpdated": "技能更新成功", "course.skillDeleted": "技能删除成功", "course.materialUploaded": "学习资料上传成功", "course.materialUpdated": "学习资料更新成功", "course.materialDeleted": "学习资料删除成功", "course.materialsReordered": "学习资料排序更新成功", "course.invalidId": "无效的课程ID", "course.invalidStageId": "无效的阶段ID", "course.invalidLessonId": "无效的课时ID", "course.invalidSkillId": "无效的技能ID", "course.invalidMaterialId": "无效的资料ID", "course.uploadRequired": "请选择要上传的文件", "course.uploadDirectoryFailed": "创建上传目录失败", "course.uploadSaveFailed": "保存文件失败",
		"project.listLoaded": "获取项目列表成功", "project.detailLoaded": "获取项目成功", "project.unitsLoaded": "获取单元列表成功", "project.tagsLoaded": "获取标签列表成功", "project.tagCreated": "标签创建成功", "project.tagUpdated": "标签更新成功", "project.tagDeleted": "标签删除成功", "project.created": "项目创建成功", "project.updated": "项目更新成功", "project.deleted": "项目删除成功", "project.unitCreated": "单元创建成功", "project.unitUpdated": "单元更新成功", "project.unitDeleted": "单元删除成功", "project.unitsReordered": "单元排序更新成功", "project.invalidId": "无效的项目ID", "project.invalidUnitId": "无效的单元ID", "project.invalidTagId": "无效的标签ID",
		"agent.invalidParams": "参数错误", "agent.requiredParams": "缺少必要参数", "agent.questionRequired": "请输入问题", "agent.manualIdRequired": "缺少 manualId", "agent.invalidReflectionId": "无效的复盘 ID", "agent.invalidInterventionId": "无效的提醒 ID", "agent.invalidStudentId": "无效的学生 ID", "agent.codeRequired": "请提供代码", "agent.errorDetailsRequired": "缺少错误信息", "agent.promptRequired": "请输入原始提示词", "agent.invalidSteps": "步骤数据格式错误", "agent.markdownRequired": "缺少 Markdown 内容", "agent.manualNotPublished": "手册不存在或未发布", "agent.reflectionNotFound": "复盘不存在", "agent.interventionNotFound": "提醒不存在", "agent.manualNotFound": "手册不存在", "agent.internalError": "服务器错误", "agent.historyFailed": "读取对话历史失败", "agent.reflectionUpdateFailed": "更新复盘状态失败", "agent.interventionsLoadFailed": "读取教师提醒失败", "agent.interventionUpdateFailed": "更新提醒状态失败", "agent.aiUnavailable": "AI 服务暂时不可用", "agent.requestFailed": "请求处理失败", "agent.forbidden": "无权执行此操作", "agent.verificationFailed": "验证服务错误", "agent.streamFailed": "AI 流式响应失败", "agent.promptEnhanced": "提示词优化完成", "agent.manualExists": "手册已存在", "agent.manualViewForbidden": "无权查看该手册", "agent.manualManageForbidden": "无权管理该手册", "agent.manualImportForbidden": "无权导入该手册",
		"operations.quotasLoaded": "资源配额已加载", "operations.quotaListFailed": "获取资源配额失败", "operations.quotaCreated": "资源配额已创建", "operations.quotaCreateFailed": "创建资源配额失败", "operations.quotaUpdated": "资源配额已更新", "operations.quotaUpdateFailed": "更新资源配额失败", "operations.quotaStatusUpdated": "资源配额状态已更新", "operations.quotaStatusFailed": "更新资源配额状态失败", "operations.auditLoaded": "审计日志已加载", "operations.auditListFailed": "获取审计日志失败", "operations.invalidId": "无效的 ID",
		"user.listLoaded": "获取用户列表成功", "user.leaderboardLoaded": "获取学习者排行成功", "user.invalidId": "无效的用户ID", "user.viewForbidden": "无权查看该用户信息", "user.detailLoaded": "获取用户成功", "user.created": "用户创建成功", "user.updateForbidden": "无权更新该用户信息", "user.updated": "用户更新成功", "user.deleted": "用户删除成功", "user.passwordForbidden": "无权修改该用户密码", "user.passwordsRequired": "旧密码和新密码为必填项", "user.newPasswordRequired": "新密码不能为空", "user.oldPasswordInvalid": "旧密码错误", "user.passwordUpdated": "密码修改成功", "user.frozen": "用户已冻结", "user.activated": "用户已激活",
		"integrations.k8sDisabled": "K8S client 未启用", "integrations.k8sUnavailable": "K8S API 不可用", "integrations.namespaceQueryFailed": "K8S namespace 查询失败", "integrations.exposureScanFailed": "Lab 暴露面扫描失败", "integrations.k8sHealthy": "K8S 连接正常", "integrations.configLoaded": "配置摘要已加载", "integrations.rbacReadFailed": "读取权限策略失败", "integrations.rbacParseFailed": "解析权限策略失败", "integrations.rbacLoaded": "获取权限策略成功",
		"dashboard.overviewFailed": "加载 K8S 概览失败", "dashboard.overviewLoaded": "K8S 运行概览已加载", "dashboard.sessionsFailed": "加载会话工作台失败", "dashboard.sessionsLoaded": "会话工作台已加载", "dashboard.invalidSessionId": "无效的会话 ID", "dashboard.sessionNotFound": "会话不存在", "dashboard.detailFailed": "加载会话详情失败", "dashboard.detailLoaded": "会话详情已加载", "dashboard.logsFailed": "加载会话日志失败", "dashboard.logsLoaded": "会话日志已加载", "dashboard.eventsUnavailable": "运维事件服务未初始化", "dashboard.eventsFailed": "加载会话事件失败", "dashboard.eventsLoaded": "会话事件已加载", "dashboard.labUnavailable": "Lab 服务未初始化", "dashboard.stopFailed": "停止会话失败", "dashboard.stopHandled": "会话停止请求已处理", "dashboard.integrationsLoaded": "集成健康状态已加载", "dashboard.k8sDisabledTitle": "K8S 客户端未启用", "dashboard.k8sDisabledDescription": "当前工作台无法读取运行时资源状态。", "dashboard.ingressScanFailed": "Lab 暴露面扫描未能读取 Ingress", "dashboard.missingPodTitle": "会话缺少 Pod", "dashboard.missingPodDescription": "会话 #{{id}} 当前没有对应的运行 Pod。", "dashboard.podNotReadyTitle": "Pod 尚未 Ready", "dashboard.podNotReadyDescription": "{{name}} 当前状态为 {{status}}。", "dashboard.missingServiceTitle": "会话缺少 Service", "dashboard.missingServiceDescription": "会话 #{{id}} 当前没有对应的访问 Service。", "dashboard.expiredTitle": "会话已过期待回收", "dashboard.expiredDescription": "会话 #{{id}} 已过期，但状态仍为 {{status}}。", "dashboard.exposureRiskTitle": "Lab 暴露面风险", "dashboard.runtimeReachable": "运行时可达", "dashboard.clusterHealthy": "集群接口连接正常", "dashboard.notEnabled": "未启用", "dashboard.k8sNotInitialized": "当前未初始化 K8S client", "dashboard.connectionError": "连接异常", "dashboard.k8sProbeFailed": "K8S 连接探测失败", "dashboard.configLoaded": "关键配置已加载", "dashboard.configReadable": "当前后端配置摘要可读取", "dashboard.connectionHealthy": "连接正常", "dashboard.lastProbeSuccessful": "最近一次探测成功", "dashboard.needsAttention": "待关注", "dashboard.integrationProbeFailed": "集成健康探测失败", "dashboard.notConfigured": "未配置", "dashboard.integrationNeedsAttention": "{{name}} 状态需要关注", "dashboard.exposureUnavailable": "K8S client 未启用，无法扫描 Lab 暴露面", "dashboard.noPublicExposure": "Lab 运行时未发现公网直连暴露面", "dashboard.networkPolicyNote": "当前防护不依赖 NetworkPolicy；flannel 场景下 NetworkPolicy 可能不会生效，仅能作为补充防线。", "dashboard.serviceTypeRisk": "Lab Service {{name}} 类型为 {{type}}，可能绕过平台代理暴露到公网。", "dashboard.externalIPRisk": "Lab Service {{name}} 配置了 externalIPs={{ips}}，可能绕过平台代理。", "dashboard.nodePortRisk": "Lab Service {{name}} 端口 {{port}} 配置了 NodePort {{nodePort}}，可能被公网直连。", "dashboard.hostNetworkRisk": "Lab Pod {{name}} 启用了 hostNetwork，可能绕过 ClusterIP 与平台代理。", "dashboard.hostPortRisk": "Lab Pod {{pod}} 容器 {{container}} 配置了 HostPort {{port}}，可能被公网直连。", "dashboard.ingressRisk": "Runtime namespace 存在 Ingress {{name}}，需确认没有把 Lab noVNC/App 入口暴露到公网。", "dashboard.exposureRisksFound": "发现 {{count}} 个 Lab 公网直连风险，请优先移除 NodePort/LoadBalancer/Ingress/HostPort/hostNetwork。",
		"classroom.listLoaded": "获取班级列表成功", "classroom.invalidClassId": "无效的班级ID", "classroom.invalidMemberId": "无效的成员ID", "assignment.published": "发布作业成功", "assignment.closed": "关闭作业成功", "assignment.drafted": "作业已设为草稿", "assignment.selectAgentContext": "请选择 Agent 手册来源和班级", "assignment.selectClass": "请选择班级", "publishing.courseArchived": "课程已下架", "publishing.courseDrafted": "课程已设为草稿", "publishing.projectArchived": "项目已下架", "publishing.projectDrafted": "项目已设为草稿", "publishing.manualUpdated": "手册更新成功", "publishing.auditLoaded": "获取发布审计成功", "publishing.invalidCourseId": "无效的课程ID", "publishing.invalidProjectId": "无效的项目ID", "publishing.invalidManualId": "无效的手册ID", "publishing.invalidTemplateId": "无效的模板ID",
		"common.notFound": "接口不存在", "common.originForbidden": "Origin 不在允许列表中", "common.configUnavailable": "服务配置未初始化",
		"auth.tokenRequired": "未提供认证令牌", "auth.tokenInvalid": "认证令牌无效或已过期", "auth.statusFailed": "认证状态校验失败", "auth.tokenRevoked": "认证令牌已失效", "auth.adminRequired": "需要管理员权限", "auth.teacherRequired": "需要教务端权限", "auth.permissionUnavailable": "权限服务未初始化", "auth.permissionCheckFailed": "权限校验失败", "auth.accessForbidden": "无权访问该资源", "auth.credentialsRequired": "请输入用户名和密码", "auth.loginSucceeded": "登录成功", "auth.logoutSucceeded": "退出登录成功", "auth.userLoaded": "获取当前用户成功", "auth.tokenRefreshed": "令牌刷新成功",
		"user.idRequired":        "缺少用户ID",
		"learning.recordsLoaded": "学习记录已加载", "learning.continueLoaded": "继续学习信息已加载", "learning.overviewLoaded": "学习概览已加载", "learning.activityLoaded": "学习动态已加载",
		"upload.imageRequired": "请选择图片文件", "upload.unsupportedType": "不支持的文件类型", "upload.imageUploaded": "图片上传成功", "upload.pathRequired": "缺少文件路径", "upload.invalidPath": "文件路径无效", "upload.fileNotFound": "文件不存在", "upload.deleteFailed": "删除文件失败", "upload.deleted": "文件删除成功", "upload.fileRequired": "请选择文件", "upload.saveFailed": "保存上传文件失败", "upload.completed": "文件上传成功",
		"lab.imagesConfiguredExternally": "K8S 运行时不枚举 Docker 镜像，请在课程或项目中配置镜像名", "lab.activeSessionFailed": "获取活跃实验会话失败", "lab.sessionListFailed": "获取实验会话列表失败", "lab.invalidSourceType": "无效的实验来源类型", "lab.sourceRequired": "缺少实验来源参数", "lab.createFailed": "创建实验环境失败", "lab.invalidSessionId": "无效的实验会话 ID", "lab.stopFailed": "停止实验环境失败", "lab.stopped": "实验环境已停止", "lab.releasing": "实验环境正在释放", "lab.releaseStatusFailed": "获取实验环境释放状态失败", "lab.urlsFailed": "获取实验环境访问地址失败", "lab.noActiveSession": "没有活跃的实验环境", "lab.commandRequired": "缺少命令参数", "lab.executeFailed": "执行实验命令失败", "lab.proxyFailed": "实验环境代理失败", "lab.sessionExpired": "实验会话不存在或已过期", "lab.proxyForbidden": "无权访问该代理目标", "lab.proxyTargetInvalid": "无效的代理目标", "lab.sessionInUse": "该账号的实验环境正在另一台设备使用，请使用独立测试账号或等待原设备退出", "lab.clientIdRequired": "缺少实验客户端标识，请刷新页面后重试", "lab.capacityReached": "当前 K8S 实验资源已满，系统将自动等待空闲名额", "lab.capacityReleasing": "上一实验环境正在释放，系统将自动重试",
		"terminal.tokenRequired": "缺少终端认证令牌", "terminal.tokenInvalid": "终端认证令牌无效", "terminal.authCheckFailed": "终端认证状态校验失败", "terminal.tokenRevoked": "终端认证令牌已失效", "terminal.labUnavailable": "Lab 服务未启用", "terminal.sessionIdInvalid": "缺少或无效的 sessionId", "terminal.sessionQueryFailed": "查询实验会话失败", "terminal.sessionExpired": "实验会话不存在或已过期", "terminal.execFailed": "终端执行失败",
	},
	LocaleEnUS: {
		"common.success":        "Operation completed successfully",
		"common.created":        "Created successfully",
		"common.requestFailed":  "Request failed",
		"common.invalidParams":  "Invalid request parameters",
		"auth.required":         "Please log in first",
		"classroom.termsLoaded": "Terms loaded", "classroom.termCreated": "Term created", "classroom.termUpdated": "Term updated", "classroom.termStatusUpdated": "Term status updated", "classroom.classCreated": "Class created", "classroom.classLoaded": "Class details loaded", "classroom.classUpdated": "Class updated", "classroom.membersLoaded": "Class members loaded", "classroom.membersImported": "Class member import completed", "classroom.memberRemoved": "Class member removed", "classroom.studentClassesLoaded": "Student classes loaded", "classroom.classStatusUpdated": "Class status updated", "classroom.uploadRequired": "Upload an import file", "classroom.invalidTermId": "Invalid term ID", "classroom.invalidClassStatus": "Invalid class status", "classroom.invalidStartDate": "Invalid start date. Use YYYY-MM-DD", "classroom.invalidEndDate": "Invalid end date. Use YYYY-MM-DD",
		"assignment.listLoaded": "Assignments loaded", "assignment.created": "Assignment created", "assignment.detailLoaded": "Assignment details loaded", "assignment.updated": "Assignment updated", "assignment.studentListLoaded": "Student assignments loaded", "assignment.studentDetailLoaded": "Task details loaded", "assignment.submitted": "Submission created", "assignment.submissionLoaded": "Submission details loaded", "assignment.gradesLoaded": "Grades loaded", "assignment.notificationsLoaded": "Notifications loaded", "assignment.notificationRead": "Notification marked as read", "assignment.overviewLoaded": "Assignment overview loaded", "assignment.qualityLoaded": "Teaching quality overview loaded", "assignment.reviewQueueLoaded": "Review queue loaded", "assignment.checksRecorded": "Verification results recorded", "assignment.gradeSaved": "Grade saved", "assignment.returned": "Submission returned", "assignment.gradePublished": "Grade published", "assignment.aiFeedbackCreated": "AI feedback draft generated", "assignment.aiSummaryCreated": "AI assignment summary generated", "assignment.aiWeaknessCreated": "AI weakness diagnosis generated", "assignment.aiSuggestionUpdated": "AI suggestion updated", "assignment.agentStatsLoaded": "Agent step statistics loaded", "assignment.aiStepCreated": "AI step diagnosis generated", "assignment.observatoryLoaded": "Agent observatory loaded", "assignment.agentDetailLoaded": "Agent details loaded", "assignment.skillTagsUpdated": "Skill tags updated", "assignment.weaknessLoaded": "Agent weaknesses loaded", "assignment.aiFAQCreated": "AI FAQ draft generated", "assignment.faqPublished": "FAQ published", "assignment.faqLoaded": "FAQ list loaded", "assignment.faqArchived": "FAQ archived", "assignment.interventionCreated": "Intervention created", "assignment.interventionsLoaded": "Interventions loaded", "assignment.aiStatusLoaded": "AI status loaded", "assignment.aiSettingsLoaded": "AI settings loaded", "assignment.aiSettingsUpdated": "AI settings updated", "assignment.workbenchLoaded": "Teaching workbench overview loaded", "assignment.todosLoaded": "Teaching tasks loaded", "assignment.risksLoaded": "At-risk students loaded", "assignment.progressLoaded": "Assignment progress loaded", "assignment.gradebookLoaded": "Gradebook loaded", "assignment.reminderSent": "Reminder sent", "assignment.reopened": "Submission reopened", "assignment.invalidId": "Invalid assignment ID",
		"publishing.courseCheckCompleted": "Course publish check completed", "publishing.coursePublished": "Course published", "publishing.courseUpdated": "Course updated", "publishing.courseUpdatedPublished": "Course updated and published", "publishing.projectCheckCompleted": "Project publish check completed", "publishing.projectPublished": "Project published", "publishing.projectUpdated": "Project updated", "publishing.projectUpdatedPublished": "Project updated and published", "publishing.manualCheckCompleted": "Manual publish check completed", "publishing.teacherTemplatesLoaded": "Available Lab templates loaded", "publishing.adminTemplatesLoaded": "Lab templates loaded", "publishing.templateCreated": "Lab template created", "publishing.templateUpdated": "Lab template updated", "publishing.templateStatusUpdated": "Lab template status updated", "publishing.courseForbidden": "You do not have permission to manage this course", "publishing.projectForbidden": "You do not have permission to manage this project",
		"teacher.manualsLoaded": "Manuals loaded", "teacher.progressLoaded": "Student progress loaded",
		"common.invalidOrder": "Invalid ordering data",
		"course.listLoaded":   "Courses loaded", "course.assignedLoaded": "Assigned courses loaded", "course.detailLoaded": "Course loaded", "course.stagesLoaded": "Course stages loaded", "course.lessonsLoaded": "Lessons loaded", "course.lessonLoaded": "Lesson loaded", "course.materialsLoaded": "Learning materials loaded", "course.enrolled": "Course joined", "course.recordsLoaded": "Lesson records loaded", "course.lessonStarted": "Lesson started", "course.lessonCompleted": "Lesson completed", "course.created": "Course created", "course.updated": "Course updated", "course.deleted": "Course deleted", "course.stageCreated": "Stage created", "course.stageUpdated": "Stage updated", "course.stageDeleted": "Stage deleted", "course.stagesReordered": "Stages reordered", "course.lessonCreated": "Lesson created", "course.lessonUpdated": "Lesson updated", "course.lessonDeleted": "Lesson deleted", "course.lessonsReordered": "Lessons reordered", "course.skillsLoaded": "Skills loaded", "course.skillCreated": "Skill created", "course.skillUpdated": "Skill updated", "course.skillDeleted": "Skill deleted", "course.materialUploaded": "Learning material uploaded", "course.materialUpdated": "Learning material updated", "course.materialDeleted": "Learning material deleted", "course.materialsReordered": "Learning materials reordered", "course.invalidId": "Invalid course ID", "course.invalidStageId": "Invalid stage ID", "course.invalidLessonId": "Invalid lesson ID", "course.invalidSkillId": "Invalid skill ID", "course.invalidMaterialId": "Invalid material ID", "course.uploadRequired": "Select a file to upload", "course.uploadDirectoryFailed": "Failed to create the upload directory", "course.uploadSaveFailed": "Failed to save the uploaded file",
		"project.listLoaded": "Projects loaded", "project.detailLoaded": "Project loaded", "project.unitsLoaded": "Project units loaded", "project.tagsLoaded": "Tags loaded", "project.tagCreated": "Tag created", "project.tagUpdated": "Tag updated", "project.tagDeleted": "Tag deleted", "project.created": "Project created", "project.updated": "Project updated", "project.deleted": "Project deleted", "project.unitCreated": "Unit created", "project.unitUpdated": "Unit updated", "project.unitDeleted": "Unit deleted", "project.unitsReordered": "Units reordered", "project.invalidId": "Invalid project ID", "project.invalidUnitId": "Invalid unit ID", "project.invalidTagId": "Invalid tag ID",
		"agent.invalidParams": "Invalid request parameters", "agent.requiredParams": "Required parameters are missing", "agent.questionRequired": "Enter a question", "agent.manualIdRequired": "manualId is required", "agent.invalidReflectionId": "Invalid reflection ID", "agent.invalidInterventionId": "Invalid intervention ID", "agent.invalidStudentId": "Invalid student ID", "agent.codeRequired": "Provide code to explain", "agent.errorDetailsRequired": "Error details are required", "agent.promptRequired": "Enter the original prompt", "agent.invalidSteps": "Invalid step data", "agent.markdownRequired": "Markdown content is required", "agent.manualNotPublished": "The manual does not exist or is not published", "agent.reflectionNotFound": "Reflection not found", "agent.interventionNotFound": "Intervention not found", "agent.manualNotFound": "Manual not found", "agent.internalError": "Agent service error", "agent.historyFailed": "Failed to load conversation history", "agent.reflectionUpdateFailed": "Failed to update the reflection", "agent.interventionsLoadFailed": "Failed to load teacher interventions", "agent.interventionUpdateFailed": "Failed to update the intervention", "agent.aiUnavailable": "AI service is temporarily unavailable", "agent.requestFailed": "Failed to process the request", "agent.forbidden": "You do not have permission to perform this action", "agent.verificationFailed": "Verification service failed", "agent.streamFailed": "AI stream failed", "agent.promptEnhanced": "Prompt enhancement completed", "agent.manualExists": "A manual already exists", "agent.manualViewForbidden": "You do not have permission to view this manual", "agent.manualManageForbidden": "You do not have permission to manage this manual", "agent.manualImportForbidden": "You do not have permission to import this manual",
		"operations.quotasLoaded": "Resource quotas loaded", "operations.quotaListFailed": "Failed to load resource quotas", "operations.quotaCreated": "Resource quota created", "operations.quotaCreateFailed": "Failed to create resource quota", "operations.quotaUpdated": "Resource quota updated", "operations.quotaUpdateFailed": "Failed to update resource quota", "operations.quotaStatusUpdated": "Resource quota status updated", "operations.quotaStatusFailed": "Failed to update resource quota status", "operations.auditLoaded": "Audit logs loaded", "operations.auditListFailed": "Failed to load audit logs", "operations.invalidId": "Invalid ID",
		"user.listLoaded": "Users loaded", "user.leaderboardLoaded": "Student leaderboard loaded", "user.invalidId": "Invalid user ID", "user.viewForbidden": "You do not have permission to view this user", "user.detailLoaded": "User loaded", "user.created": "User created", "user.updateForbidden": "You do not have permission to update this user", "user.updated": "User updated", "user.deleted": "User deleted", "user.passwordForbidden": "You do not have permission to change this user’s password", "user.passwordsRequired": "The current and new passwords are required", "user.newPasswordRequired": "The new password is required", "user.oldPasswordInvalid": "The current password is incorrect", "user.passwordUpdated": "Password updated", "user.frozen": "User frozen", "user.activated": "User activated",
		"integrations.k8sDisabled": "The K8S client is disabled", "integrations.k8sUnavailable": "The K8S API is unavailable", "integrations.namespaceQueryFailed": "Failed to query K8S namespaces", "integrations.exposureScanFailed": "Failed to scan Lab exposure", "integrations.k8sHealthy": "K8S connection healthy", "integrations.configLoaded": "Configuration summary loaded", "integrations.rbacReadFailed": "Failed to read RBAC policies", "integrations.rbacParseFailed": "Failed to parse RBAC policies", "integrations.rbacLoaded": "RBAC policies loaded",
		"dashboard.overviewFailed": "Failed to load the K8S overview", "dashboard.overviewLoaded": "K8S runtime overview loaded", "dashboard.sessionsFailed": "Failed to load the session workbench", "dashboard.sessionsLoaded": "Session workbench loaded", "dashboard.invalidSessionId": "Invalid session ID", "dashboard.sessionNotFound": "Session not found", "dashboard.detailFailed": "Failed to load session details", "dashboard.detailLoaded": "Session details loaded", "dashboard.logsFailed": "Failed to load session logs", "dashboard.logsLoaded": "Session logs loaded", "dashboard.eventsUnavailable": "Operations event service is unavailable", "dashboard.eventsFailed": "Failed to load session events", "dashboard.eventsLoaded": "Session events loaded", "dashboard.labUnavailable": "Lab service is unavailable", "dashboard.stopFailed": "Failed to stop the session", "dashboard.stopHandled": "Session stop request processed", "dashboard.integrationsLoaded": "Integration health loaded", "dashboard.k8sDisabledTitle": "K8S Client Disabled", "dashboard.k8sDisabledDescription": "The workbench cannot read runtime resource status.", "dashboard.ingressScanFailed": "Lab exposure scan could not read Ingress resources", "dashboard.missingPodTitle": "Session Pod Missing", "dashboard.missingPodDescription": "Session #{{id}} has no running Pod.", "dashboard.podNotReadyTitle": "Pod Is Not Ready", "dashboard.podNotReadyDescription": "{{name}} is currently {{status}}.", "dashboard.missingServiceTitle": "Session Service Missing", "dashboard.missingServiceDescription": "Session #{{id}} has no access Service.", "dashboard.expiredTitle": "Expired Session Pending Cleanup", "dashboard.expiredDescription": "Session #{{id}} has expired but remains {{status}}.", "dashboard.exposureRiskTitle": "Lab Exposure Risk", "dashboard.runtimeReachable": "Runtime Reachable", "dashboard.clusterHealthy": "Cluster API connection healthy", "dashboard.notEnabled": "Disabled", "dashboard.k8sNotInitialized": "The K8S client is not initialized", "dashboard.connectionError": "Connection Error", "dashboard.k8sProbeFailed": "K8S connection probe failed", "dashboard.configLoaded": "Critical Configuration Loaded", "dashboard.configReadable": "The backend configuration summary is available", "dashboard.connectionHealthy": "Connection Healthy", "dashboard.lastProbeSuccessful": "The latest probe succeeded", "dashboard.needsAttention": "Needs Attention", "dashboard.integrationProbeFailed": "Integration health probe failed", "dashboard.notConfigured": "Not Configured", "dashboard.integrationNeedsAttention": "{{name}} needs attention", "dashboard.exposureUnavailable": "The K8S client is disabled, so Lab exposure cannot be scanned", "dashboard.noPublicExposure": "No direct public exposure was found for Lab runtime resources", "dashboard.networkPolicyNote": "Protection does not depend on NetworkPolicy. In flannel environments, NetworkPolicy may be ineffective and should only be supplementary.", "dashboard.serviceTypeRisk": "Lab Service {{name}} uses type {{type}} and may bypass the platform proxy for public exposure.", "dashboard.externalIPRisk": "Lab Service {{name}} configures externalIPs={{ips}} and may bypass the platform proxy.", "dashboard.nodePortRisk": "Lab Service {{name}} port {{port}} configures NodePort {{nodePort}} and may be publicly reachable.", "dashboard.hostNetworkRisk": "Lab Pod {{name}} enables hostNetwork and may bypass ClusterIP and the platform proxy.", "dashboard.hostPortRisk": "Lab Pod {{pod}} container {{container}} configures HostPort {{port}} and may be publicly reachable.", "dashboard.ingressRisk": "Runtime namespace contains Ingress {{name}}. Confirm it does not expose Lab noVNC or application entry points publicly.", "dashboard.exposureRisksFound": "Found {{count}} direct public Lab exposure risks. Remove NodePort, LoadBalancer, Ingress, HostPort, or hostNetwork exposure first.",
		"classroom.listLoaded": "Classes loaded", "classroom.invalidClassId": "Invalid class ID", "classroom.invalidMemberId": "Invalid member ID", "assignment.published": "Assignment published", "assignment.closed": "Assignment closed", "assignment.drafted": "Assignment moved to draft", "assignment.selectAgentContext": "Select an Agent manual source and class", "assignment.selectClass": "Select a class", "publishing.courseArchived": "Course archived", "publishing.courseDrafted": "Course moved to draft", "publishing.projectArchived": "Project archived", "publishing.projectDrafted": "Project moved to draft", "publishing.manualUpdated": "Manual updated", "publishing.auditLoaded": "Publishing audit loaded", "publishing.invalidCourseId": "Invalid course ID", "publishing.invalidProjectId": "Invalid project ID", "publishing.invalidManualId": "Invalid manual ID", "publishing.invalidTemplateId": "Invalid template ID",
		"common.notFound": "API endpoint does not exist", "common.originForbidden": "Origin is not allowed", "common.configUnavailable": "Service configuration is unavailable",
		"auth.tokenRequired": "Authentication token is required", "auth.tokenInvalid": "Authentication token is invalid or expired", "auth.statusFailed": "Failed to verify authentication status", "auth.tokenRevoked": "Authentication token has been revoked", "auth.adminRequired": "Administrator permission is required", "auth.teacherRequired": "Teacher portal permission is required", "auth.permissionUnavailable": "Permission service is unavailable", "auth.permissionCheckFailed": "Permission check failed", "auth.accessForbidden": "You do not have permission to access this resource", "auth.credentialsRequired": "Enter your username and password", "auth.loginSucceeded": "Signed in successfully", "auth.logoutSucceeded": "Signed out successfully", "auth.userLoaded": "Current user loaded", "auth.tokenRefreshed": "Token refreshed",
		"user.idRequired":        "User ID is required",
		"learning.recordsLoaded": "Learning records loaded", "learning.continueLoaded": "Continue-learning information loaded", "learning.overviewLoaded": "Learning overview loaded", "learning.activityLoaded": "Learning activity loaded",
		"upload.imageRequired": "Select an image file", "upload.unsupportedType": "Unsupported file type", "upload.imageUploaded": "Image uploaded", "upload.pathRequired": "File path is required", "upload.invalidPath": "Invalid file path", "upload.fileNotFound": "File not found", "upload.deleteFailed": "Failed to delete the file", "upload.deleted": "File deleted", "upload.fileRequired": "Select a file", "upload.saveFailed": "Failed to save the uploaded file", "upload.completed": "File uploaded",
		"lab.imagesConfiguredExternally": "The K8S runtime does not enumerate Docker images. Configure the image name on the course or project.", "lab.activeSessionFailed": "Failed to load the active Lab session", "lab.sessionListFailed": "Failed to load Lab sessions", "lab.invalidSourceType": "Invalid Lab source type", "lab.sourceRequired": "Lab source parameters are required", "lab.createFailed": "Failed to create the Lab environment", "lab.invalidSessionId": "Invalid Lab session ID", "lab.stopFailed": "Failed to stop the Lab environment", "lab.stopped": "Lab environment stopped", "lab.releasing": "The Lab environment is being released", "lab.releaseStatusFailed": "Failed to load the Lab release status", "lab.urlsFailed": "Failed to load Lab access URLs", "lab.noActiveSession": "No active Lab environment", "lab.commandRequired": "Command is required", "lab.executeFailed": "Failed to execute the Lab command", "lab.proxyFailed": "Lab environment proxy failed", "lab.sessionExpired": "The Lab session does not exist or has expired", "lab.proxyForbidden": "You do not have permission to access this proxy target", "lab.proxyTargetInvalid": "Invalid proxy target", "lab.sessionInUse": "This account's Lab is active on another device. Use a separate test account or wait for the other device to leave.", "lab.clientIdRequired": "The Lab client identifier is missing. Refresh the page and try again.", "lab.capacityReached": "K8S Lab capacity is full. The system will wait for an available slot.", "lab.capacityReleasing": "The previous Lab is being released. The system will retry automatically.",
		"terminal.tokenRequired": "Terminal authentication token is required", "terminal.tokenInvalid": "Terminal authentication token is invalid", "terminal.authCheckFailed": "Failed to verify terminal authentication status", "terminal.tokenRevoked": "Terminal authentication token has been revoked", "terminal.labUnavailable": "Lab service is unavailable", "terminal.sessionIdInvalid": "sessionId is missing or invalid", "terminal.sessionQueryFailed": "Failed to query the Lab session", "terminal.sessionExpired": "The Lab session does not exist or has expired", "terminal.execFailed": "Terminal execution failed",
	},
}

func TranslateMessage(message string) string {
	trimmed := strings.TrimSpace(message)
	if trimmed == "" {
		return message
	}
	if translated, ok := zhToEnMessages[trimmed]; ok {
		return translated
	}
	for _, item := range prefixTranslations {
		if strings.HasPrefix(trimmed, item.zh) {
			return item.en + strings.TrimSpace(strings.TrimPrefix(trimmed, item.zh))
		}
	}
	return message
}

var prefixTranslations = []struct {
	zh string
	en string
}{
	{zh: "AI 生成失败:", en: "AI generation failed: "},
	{zh: "构建 AI 请求失败:", en: "Failed to build AI request: "},
	{zh: "创建 AI 请求失败:", en: "Failed to create AI request: "},
	{zh: "调用 AI 服务失败:", en: "Failed to call AI service: "},
	{zh: "AI 服务异常:", en: "AI service error: "},
	{zh: "读取 AI 流失败:", en: "Failed to read AI stream: "},
	{zh: "读取 AI 响应失败:", en: "Failed to read AI response: "},
	{zh: "解析 AI 响应失败:", en: "Failed to parse AI response: "},
}

var zhToEnMessages = map[string]string{
	"成功":                      "Success",
	"创建成功":                    "Created successfully",
	"请求参数无效":                  "Invalid request parameters",
	"Invalid response format": "Invalid response format",
	"Network error":           "Network error",
	"Upload failed":           "Upload failed",

	"未提供认证令牌":        "Authentication token is required",
	"认证令牌无效或已过期":     "Authentication token is invalid or expired",
	"认证状态校验失败":       "Failed to verify authentication status",
	"认证令牌已失效":        "Authentication token has been revoked",
	"请先登录":           "Please log in first",
	"需要管理员权限":        "Administrator permission is required",
	"需要教务端权限":        "Teacher portal permission is required",
	"权限服务未初始化":       "Permission service is not initialized",
	"权限校验失败":         "Permission check failed",
	"无权访问该资源":        "You do not have permission to access this resource",
	"Origin 不在允许列表中": "Origin is not allowed",
	"服务器内部错误":        "Internal server error",
	"接口不存在":          "API endpoint does not exist",

	"用户名或密码错误": "Username or password is incorrect",
	"用户不存在":    "User does not exist",
	"账号已被冻结":   "This account has been frozen",
	"用户已存在":    "User already exists",
	"邮箱已存在":    "Email already exists",
	"手机号已存在":   "Phone number already exists",
	"旧密码错误":    "Current password is incorrect",
	"密码不能为空":   "Password cannot be empty",
	"用户名不能为空":  "Username cannot be empty",

	"课程不存在":            "Course does not exist",
	"项目不存在":            "Project does not exist",
	"课时不存在":            "Lesson does not exist",
	"班级不存在":            "Class does not exist",
	"学期不存在":            "Term does not exist",
	"作业不存在":            "Assignment does not exist",
	"提交不存在":            "Submission does not exist",
	"手册不存在":            "Manual does not exist",
	"AI 建议不存在":         "AI suggestion does not exist",
	"无权处理该 AI 建议":      "You do not have permission to handle this AI suggestion",
	"不支持的 AI 建议操作":     "Unsupported AI suggestion action",
	"AI 建议已处理，不能重复操作":  "AI suggestion has already been handled",
	"AI 建议不存在或已不可用":    "AI suggestion does not exist or is no longer available",
	"AI 建议与当前提交不匹配":    "AI suggestion does not match the current submission",
	"AI 建议已处理或不属于当前教师": "AI suggestion has been handled or does not belong to the current teacher",
	"提交反馈草稿":           "Submission feedback draft",
	"作业提交摘要":           "Assignment submission summary",
	"学生薄弱点诊断":          "Student weakness diagnosis",

	"请选择班级后再生成诊断": "Please select a class before generating a diagnosis",
	"AI 辅助能力已关闭":  "AI assistant capability is disabled",
	"AI 服务未配置":    "AI service is not configured",
	"AI 返回内容为空":   "AI returned empty content",
	"AI 服务暂时不可用":  "AI service is temporarily unavailable",
	"暂时无法提供建议，请检查当前步骤与验证命令是否正确。": "Unable to provide suggestions for now. Please check the current step and verification command.",
	"抱歉，我暂时无法回答这个问题。":            "Sorry, I cannot answer this question right now.",
	"无法解释这段代码。":                  "Unable to explain this code.",
	"建议补充更多上下文与结果约束，以获得更稳定的输出。":  "Add more context and output constraints to get more stable results.",

	"K8S Lab 运行时未启用":            "K8S Lab runtime is not enabled",
	"该课程/项目未配置实验环境镜像":           "This course/project has no lab environment image configured",
	"K8S exec bridge 未启用":       "K8S exec bridge is not enabled",
	"K8S client 未启用":            "K8S client is not enabled",
	"K8S REST 配置未启用":            "K8S REST configuration is not enabled",
	"K8S runtime namespace 未配置": "K8S runtime namespace is not configured",
	"绑定的 Lab 模板不存在":             "The bound Lab template does not exist",
	"绑定的 Lab 模板已停用":             "The bound Lab template is disabled",
	"绑定的 Lab 模板未配置实验镜像":         "The bound Lab template has no lab image configured",
	"当前会话已停止，暂时无法读取运行日志":        "The current session has stopped. Runtime logs cannot be read.",
	"当前会话对应的运行 Pod 已不存在，环境可能已停止或已被清理": "The runtime Pod for this session no longer exists. The environment may have stopped or been cleaned up.",

	"发布检查未通过":       "Publish check failed",
	"课程发布成功":        "Course published successfully",
	"项目发布成功":        "Project published successfully",
	"手册发布成功":        "Manual published successfully",
	"课程已设为草稿":       "Course set as draft",
	"项目已设为草稿":       "Project set as draft",
	"手册已设为草稿":       "Manual set as draft",
	"课程已下架":         "Course archived",
	"项目已下架":         "Project archived",
	"最大并发会话数不能为负数":  "Maximum concurrent sessions cannot be negative",
	"单次运行时长必须大于 0":  "Single-session duration must be greater than 0",
	"配额作用域无效":       "Invalid quota scope",
	"班级或用户配额必须指定对象": "Class or user quota must specify a target",
}
