import { FeishuArtifact, FeishuClient, FeishuMessageBrief } from './FeishuClient';
import { OpenClawClient } from './OpenClawClient';
import { logger } from '../utils/logger';
import {
  CompletedArtifact,
  CompletedFinalMessage,
  CompletedMetrics,
  CompletedStep,
  CompletedView,
  ExecutingEvent,
  ExecutingToolchainSkill,
  ExecutingView,
  ThinkingMessage,
  ThinkingView,
} from '../types/openclawView';

interface OpenClawChatMessage {
  id?: string;
  messageId?: string;
  role?: string;
  content?: unknown;
  timestamp?: number;
  ts?: number;
  createdAt?: number;
  createTime?: number;
  time?: number;
}

export type OpenclawViewScope = 'all' | 'latest_turn';

interface ViewOptions {
  scope?: OpenclawViewScope;
  sinceTs?: number;
}

export class OpenclawViewService {
  private readonly openClawClient: OpenClawClient;
  private readonly feishuClient: FeishuClient;
  private readonly feishuChatId: string;
  private readonly feishuBotOpenId: string;
  /** 平台发送的消息 ID，用于过滤回显 */
  private readonly platformSentIds = new Set<string>();

  constructor() {
    this.openClawClient = new OpenClawClient();
    this.feishuClient = new FeishuClient();
    this.feishuChatId = (process.env.FEISHU_CHAT_ID || '').trim();
    this.feishuBotOpenId = (process.env.FEISHU_BOT_OPEN_ID || '').trim();
  }

  /** 记录平台发送的消息 ID，防止它被当作 Bot 回复显示 */
  trackSentMessageId(messageId: string): void {
    if (!messageId) return;
    this.platformSentIds.add(messageId);
    // 最多保留 200 条，避免内存泄漏
    if (this.platformSentIds.size > 200) {
      const first = this.platformSentIds.values().next().value;
      if (first) this.platformSentIds.delete(first);
    }
  }

  async getOpenClawHealth(): Promise<Record<string, unknown>> {
    const health = await this.openClawClient.getHealth();

    return {
      provider: 'openclaw',
      configured: this.openClawClient.isConfigured(),
      gateway: process.env.OPENCLAW_GATEWAY_URL || 'http://127.0.0.1:18789',
      ...health,
    };
  }

  async getFeishuHealth(): Promise<Record<string, unknown>> {
    const health = await this.feishuClient.getHealth();

    return {
      provider: 'feishu',
      configured: this.feishuClient.isConfigured(),
      ...health,
    };
  }

  async getThinkingView(sessionId: string, limit = 20, options: ViewOptions = {}): Promise<ThinkingView> {
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const scopeStartTs = await this.resolveScopeStartTs(options);
    const pullLimit = options.scope === 'latest_turn' ? Math.max(80, safeLimit) : safeLimit;

    // 主数据源：飞书消息
    const feishuMessages = await this.fetchFeishuBotMessages(pullLimit, scopeStartTs);
    logger.info(`[ThinkingView] Step1: fetched ${feishuMessages.length} feishu messages (scopeStartTs=${scopeStartTs ? new Date(scopeStartTs).toISOString() : 'none'})`);

    const mapped = this.mapFeishuToThinkingMessages(feishuMessages);
    logger.info(`[ThinkingView] Step2: mapped ${mapped.length} messages (roles: ${mapped.map(m => m.role).join(',')})`);

    const assistantOnly = mapped
      .filter((message) => message.role === 'assistant');
    logger.info(`[ThinkingView] Step3: ${assistantOnly.length} assistant messages after role filter`);

    const scoped = assistantOnly
      .filter((message) => !scopeStartTs || message.ts >= scopeStartTs);
    logger.info(`[ThinkingView] Step4: ${scoped.length} messages after scope filter`);

    const cleaned = scoped
      .filter((message) => {
        const text = message.content.trim();
        return text && !text.includes('请升级至最新版本客户端');
      });
    logger.info(`[ThinkingView] Step5: ${cleaned.length} messages after content filter, types: [${cleaned.map(m => m.msgType || 'text').join(',')}]`);

    // 对 [卡片消息] 用 OpenClaw chat.history 获取真实内容
    const cardMessages = cleaned.filter(m => m.content.trim() === '[卡片消息]');
    let enriched = cleaned;

    if (cardMessages.length > 0) {
      try {
        const sessionKey = this.feishuChatId
          ? `agent:main:feishu:group:${this.feishuChatId}`
          : `agent:main:default`;
        const history = await this.openClawClient.getChatHistory(sessionKey, pullLimit);
        const ocMessages = this.mapOpenClawToThinkingMessages(history);

        // 用 OpenClaw 的 assistant 文本消息替换飞书的 [卡片消息]
        // 策略：按时间倒序匹配，最新的卡片对应最新的 OpenClaw 消息
        const ocTexts = ocMessages.map(m => m.content);
        let ocIndex = ocTexts.length - 1;

        enriched = cleaned.map(m => {
          if (m.content.trim() !== '[卡片消息]' || ocIndex < 0) return m;
          const cardContent = ocTexts[ocIndex--];
          if (cardContent) {
            return { ...m, content: cardContent, msgType: 'text' };
          }
          return m;
        });

        logger.info(`[ThinkingView] Card enrichment: ${cardMessages.length} cards, ${ocTexts.length} OC messages available, remaining unmatched cards: ${enriched.filter(m => m.content.trim() === '[卡片消息]').length}`);
      } catch (err) {
        logger.warn(`[ThinkingView] OpenClaw card enrichment failed`, err);
      }
    }

    const normalized = enriched
      .filter((m): m is ThinkingMessage => m !== null && Boolean(m.content.trim()))
      .sort((a, b) => a.ts - b.ts)
      .slice(-safeLimit);

    logger.info(`[ThinkingView] Final: returning ${normalized.length} messages`);

    return {
      messages: normalized,
    };
  }

  async getExecutingView(sessionId: string, options: ViewOptions = {}): Promise<ExecutingView> {
    const sessionKey = this.feishuChatId
      ? `agent:main:feishu:group:${this.feishuChatId}`
      : `agent:main:default`;

    const [chatHistory, skillsStatusResult] = await Promise.all([
      this.openClawClient.getChatHistory(sessionKey, 200).catch((error) => ({
        messages: [],
        __gatewayError: this.normalizeErrorMessage(error),
      })),
      this.openClawClient.getSkillsStatus().catch(() => ({ skills: [] })),
    ]);

    const messages = Array.isArray((chatHistory as { messages?: unknown[] }).messages)
      ? ((chatHistory as { messages?: unknown[] }).messages as Array<Record<string, unknown>>)
      : [];

    const events = this.buildEventsFromChatHistory(messages);
    const gatewayError = this.pickString((chatHistory as { __gatewayError?: unknown }).__gatewayError);

    if (events.length === 0 && gatewayError) {
      events.push({
        id: `gateway-error-${Date.now()}`,
        ts: Date.now(),
        title: '网关连接异常',
        desc: this.translateGatewayError(gatewayError),
        level: 'warn',
      });
    }

    const currentStep = events.length > 0 ? events[events.length - 1].title : '等待执行任务';
    const inferredProgress = Math.min(99, Math.max(5, events.length * 6));

    // 从事件推导任务是否完成
    const hasAgentReply = events.some(e => (e as { kind?: string }).kind === 'agent_reply');
    const progress = hasAgentReply ? 100 : inferredProgress;
    const status = events.some(e => e.level === 'error')
      ? 'error'
      : hasAgentReply ? 'completed' : 'running';

    const toolchain = this.mapSkillsStatusToToolchain(skillsStatusResult);

    logger.info(`[ExecutingView] Final: events=${events.length} toolchain=${toolchain.length} progress=${progress} status=${status} currentStep=${currentStep}`);

    return {
      status,
      progress,
      currentStep,
      events,
      toolchain,
    };
  }

  /**
   * 从 chat.history 解析结构化执行事件
   * 消息类型：user → tool_use → tool_result → assistant text
   */
  private buildEventsFromChatHistory(allMessages: Array<Record<string, unknown>>): ExecutingEvent[] {
    // 只取最后一轮对话（从最后一条 user 消息开始）
    let lastUserIndex = -1;
    for (let i = allMessages.length - 1; i >= 0; i--) {
      if (String(allMessages[i].role || '').toLowerCase() === 'user') {
        lastUserIndex = i;
        break;
      }
    }
    const messages = lastUserIndex >= 0 ? allMessages.slice(lastUserIndex) : allMessages;

    // ★ 调试：打印每条消息的结构（role、content 类型、content keys）
    logger.info(`[ExecutingView] chat.history: ${allMessages.length} total, ${messages.length} in latest turn (lastUserIndex=${lastUserIndex})`);
    for (let i = 0; i < Math.min(messages.length, 15); i++) {
      const msg = messages[i];
      const role = String(msg.role || '');
      const content = msg.content;
      const contentType = Array.isArray(content) ? 'array' : typeof content;
      let contentDetail = '';
      if (Array.isArray(content)) {
        contentDetail = (content as Array<Record<string, unknown>>)
          .map((p) => `{type:${p?.type || '?'}, name:${p?.name || '-'}, keys:[${Object.keys(p || {}).join(',')}]}`)
          .join(', ');
      } else if (typeof content === 'string') {
        contentDetail = content.slice(0, 60);
      } else if (content && typeof content === 'object') {
        contentDetail = `keys:[${Object.keys(content).join(',')}]`;
      }
      logger.info(`[ExecutingView] msg[${i}] role=${role} contentType=${contentType} → ${contentDetail}`);
    }

    const events: ExecutingEvent[] = [];
    let eventIndex = 0;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const role = String(msg.role || '').toLowerCase();
      const ts = this.extractTimestamp(msg as OpenClawChatMessage);
      const content = msg.content;

      // --- user 消息 → 接收用户指令 ---
      if (role === 'user') {
        const text = this.extractMessageText(content);
        if (text.trim()) {
          events.push({
            id: `user-${i}-${eventIndex++}`,
            ts,
            title: '接收用户指令',
            desc: text.length > 100 ? text.slice(0, 100) + '…' : text,
            level: 'info',
            source: 'system',
            kind: 'user_input',
          });
        }
        continue;
      }

      // --- assistant 消息（可能包含 text 和/或 tool_use）---
      if (role === 'assistant') {
        if (Array.isArray(content)) {
          for (const part of content as Array<Record<string, unknown>>) {
            if (!part || typeof part !== 'object') continue;
            const partType = String(part.type || '');

            // toolCall → 工具调用事件（OpenClaw gateway 格式）
            if (partType === 'toolCall' || partType === 'tool_use') {
              const toolName = String(part.name || 'unknown_tool');
              // gateway 用 arguments，标准 API 用 input
              const inputObj = (part.arguments || part.input) as Record<string, unknown> | undefined;
              const command = this.pickString(
                inputObj?.command, inputObj?.cmd, inputObj?.path, inputObj?.query,
              );
              const desc = command
                ? `\`${command.length > 150 ? command.slice(0, 150) + '…' : command}\``
                : toolName;

              events.push({
                id: `tool-call-${i}-${eventIndex++}`,
                ts,
                title: this.buildToolEventTitle(toolName),
                desc,
                level: 'info',
                source: 'assistant',
                kind: 'tool_call',
              });
            }

            // text → Agent 最终回复（只有纯 text 的 assistant 消息才算 agent_reply）
            if (partType === 'text') {
              const text = typeof part.text === 'string' ? part.text.trim() : '';
              // 只有不包含 toolCall/tool_use 的 assistant 消息才是最终回复
              const hasToolUse = (content as Array<Record<string, unknown>>).some(
                p => p && (String(p.type || '') === 'toolCall' || String(p.type || '') === 'tool_use'),
              );
              if (text && !hasToolUse) {
                events.push({
                  id: `reply-${i}-${eventIndex++}`,
                  ts,
                  title: 'Agent 回复完成',
                  desc: text.length > 200 ? text.slice(0, 200) + '…' : text,
                  level: 'info',
                  source: 'assistant',
                  kind: 'agent_reply',
                });
              }
            }
          }
        } else {
          // content 是纯字符串的 assistant 消息
          const text = this.extractMessageText(content);
          if (text.trim()) {
            events.push({
              id: `reply-${i}-${eventIndex++}`,
              ts,
              title: 'Agent 回复完成',
              desc: text.length > 200 ? text.slice(0, 200) + '…' : text,
              level: 'info',
              source: 'assistant',
              kind: 'agent_reply',
            });
          }
        }
        continue;
      }

      // --- toolResult 角色 → 工具执行结果（OpenClaw gateway 用 toolResult，标准 API 用 tool）---
      if (role === 'tool' || role === 'toolresult') {
        if (Array.isArray(content)) {
          for (const part of content as Array<Record<string, unknown>>) {
            if (!part || typeof part !== 'object') continue;
            const resultText = typeof part.text === 'string' ? part.text.trim() : '';
            const isError = Boolean(part.is_error);
            if (!resultText && !isError) continue;

            const displayText = resultText.length > 200
              ? resultText.slice(0, 200) + '…'
              : resultText || '(no output)';

            events.push({
              id: `tool-result-${i}-${eventIndex++}`,
              ts: ts + 1, // 排在调用之后
              title: isError ? 'Tool Error' : 'Tool Output',
              desc: displayText,
              level: isError ? 'error' : 'info',
              source: 'assistant',
              kind: 'tool_result',
            });
          }
        } else {
          const text = this.extractMessageText(content);
          if (text.trim()) {
            events.push({
              id: `tool-result-${i}-${eventIndex++}`,
              ts: ts + 1,
              title: 'Tool Output',
              desc: text.length > 200 ? text.slice(0, 200) + '…' : text,
              level: 'info',
              source: 'assistant',
              kind: 'tool_result',
            });
          }
        }
        continue;
      }
    }

    // 按时间排序、去重
    events.sort((a, b) => a.ts - b.ts);
    const deduped: ExecutingEvent[] = [];
    const seen = new Set<string>();
    for (const event of events) {
      const key = `${event.ts}|${event.title}|${(event as { kind?: string }).kind}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(event);
    }

    return deduped.slice(-120);
  }

  private buildAssistantEventTitle(content: string): string {
    const firstLine = content.split('\n').find((line) => line.trim().length > 0) || 'Agent 输出';
    if (firstLine.length <= 26) {
      return firstLine;
    }
    return `${firstLine.slice(0, 25)}…`;
  }

  private mapSkillsStatusToToolchain(result: Record<string, unknown>): ExecutingToolchainSkill[] {
    const skills = Array.isArray((result as { skills?: unknown[] }).skills)
      ? ((result as { skills?: unknown[] }).skills as Array<Record<string, unknown>>)
      : [];

    // 调试日志：查看 Gateway 返回的 skills 实际 source 分布
    if (skills.length > 0) {
      const bySource: Record<string, number> = {};
      skills.forEach((s) => {
        const src = String(s.source || 'undefined');
        bySource[src] = (bySource[src] || 0) + 1;
      });
      logger.info(`[OpenclawViewService] skills.status: total=${skills.length} sources=${JSON.stringify(bySource)}`);
    }

    const mapped = skills.map((skill, index) => {
      const name = this.pickString(skill.name, skill.skillKey, `skill-${index + 1}`);
      const source = this.pickString(skill.source, 'unknown');
      const disabled = Boolean(skill.disabled);
      const blocked = Boolean(skill.blockedByAllowlist);
      const eligible = Boolean(skill.eligible);
      const missing = this.countMissingRequirements(skill.missing);
      const state = this.resolveSkillState({
        disabled,
        blocked,
        eligible,
        missing,
      });

      return {
        id: this.pickString(skill.skillKey, skill.name, `skill-${index + 1}`),
        name,
        active: state === 'ready',
        state,
        source,
        detail: this.buildSkillDetail(state, missing, source),
      };
    });

    const weight = (state: ExecutingToolchainSkill['state']) => {
      if (state === 'ready') return 0;
      if (state === 'missing') return 1;
      if (state === 'disabled') return 2;
      if (state === 'blocked') return 3;
      return 4;
    };

    // 展示工作空间技能和自定义扩展技能（不展示 bundled 内置的 51 个）
    // 从 Gateway 返回的 source 分布：openclaw-workspace(12) + openclaw-extra(5) = 有意义的技能
    const relevantSources = new Set(['openclaw-workspace', 'openclaw-extra', 'openclaw-managed']);

    const filtered = mapped
      .filter((skill) => relevantSources.has(skill.source))
      .sort((a, b) => {
        const stateDiff = weight(a.state) - weight(b.state);
        if (stateDiff !== 0) return stateDiff;
        return a.name.localeCompare(b.name, 'zh-CN');
      })
      .slice(0, 20);

    logger.info(`[OpenclawViewService] toolchain: ${mapped.length} total → ${filtered.length} after source filter (sources: ${[...new Set(filtered.map(s => s.source))].join(',')})`);

    return filtered;
  }

  private resolveSkillState(input: {
    disabled: boolean;
    blocked: boolean;
    eligible: boolean;
    missing: number;
  }): ExecutingToolchainSkill['state'] {
    if (input.disabled) return 'disabled';
    if (input.blocked) return 'blocked';
    if (input.missing > 0) return 'missing';
    if (input.eligible) return 'ready';
    return 'unavailable';
  }

  private countMissingRequirements(raw: unknown): number {
    if (!raw || typeof raw !== 'object') return 0;
    const record = raw as Record<string, unknown>;
    const keys = ['bins', 'anyBins', 'env', 'config', 'os'];
    return keys.reduce((sum, key) => {
      const value = record[key];
      if (!Array.isArray(value)) return sum;
      return sum + value.length;
    }, 0);
  }

  private buildSkillDetail(
    state: ExecutingToolchainSkill['state'],
    missing: number,
    source: string,
  ): string {
    if (state === 'ready') {
      return source === 'openclaw-managed' ? '已安装（自定义）' : '可用';
    }

    if (state === 'missing') {
      return `缺少依赖 ${missing} 项`;
    }

    if (state === 'disabled') {
      return '已禁用';
    }

    if (state === 'blocked') {
      return '被策略阻止';
    }

    return '不可用';
  }

  async getCompletedView(sessionId: string, options: ViewOptions = {}): Promise<CompletedView> {
    const sessionKey = this.feishuChatId
      ? `agent:main:feishu:group:${this.feishuChatId}`
      : `agent:main:default`;

    const [chatHistory, feishuMessages, executingView] = await Promise.all([
      this.openClawClient.getChatHistory(sessionKey, 200).catch(() => ({ messages: [] })),
      this.fetchFeishuBotMessages(120),
      this.getExecutingView(sessionId, options).catch(() => null),
    ]);

    // 从 chat.history 找到最新一轮用户消息的时间戳
    const allMessages = Array.isArray((chatHistory as { messages?: unknown[] }).messages)
      ? ((chatHistory as { messages?: unknown[] }).messages as Array<Record<string, unknown>>)
      : [];

    let latestUserTs = 0;
    for (let i = allMessages.length - 1; i >= 0; i--) {
      if (String(allMessages[i].role || '').toLowerCase() === 'user') {
        latestUserTs = this.extractTimestamp(allMessages[i] as OpenClawChatMessage);
        break;
      }
    }

    // 过滤飞书消息：只保留最新一轮之后的
    const scopedFeishuMessages = latestUserTs > 0
      ? feishuMessages.filter((m) => {
          const msgTs = Number(m.createTime || 0);
          return msgTs >= latestUserTs || msgTs === 0;
        })
      : feishuMessages;

    // 从 chat.history 提取最新一轮的 assistant 文本回复作为总结
    const latestAssistantTexts: string[] = [];
    for (let i = allMessages.length - 1; i >= 0; i--) {
      const msg = allMessages[i];
      if (String(msg.role || '').toLowerCase() === 'user') break; // 到上一条用户消息为止
      if (String(msg.role || '').toLowerCase() === 'assistant') {
        const text = this.extractMessageText(msg.content);
        if (text.trim()) latestAssistantTexts.unshift(text);
      }
    }

    const summary = latestAssistantTexts.length > 0
      ? latestAssistantTexts[latestAssistantTexts.length - 1]
      : '执行完成，暂无总结内容';

    const finalMessages: CompletedFinalMessage[] = latestAssistantTexts
      .slice(-6)
      .map((text, idx) => ({
        id: `completed-msg-${idx}`,
        ts: latestUserTs + idx + 1,
        content: text,
      }));

    const feishuArtifacts = this.mapFeishuArtifacts(scopedFeishuMessages);
    const artifacts = this.mergeArtifacts(feishuArtifacts);

    // 从 executingView 提取步骤和指标
    const { steps, metrics } = this.buildCompletedStepsAndMetrics(executingView);

    return {
      summary,
      artifacts,
      finalMessages,
      steps,
      metrics,
    };
  }

  /** 从执行态数据构建完成态步骤和指标 */
  private buildCompletedStepsAndMetrics(executingView: ExecutingView | null): {
    steps: CompletedStep[];
    metrics: CompletedMetrics;
  } {
    const defaultMetrics: CompletedMetrics = {
      durationSeconds: 0,
      successRate: 100,
      totalSteps: 0,
      totalEvents: 0,
      activeSkills: 0,
    };

    if (!executingView || !executingView.events?.length) {
      return { steps: [], metrics: defaultMetrics };
    }

    const events = executingView.events;

    const steppableEvents = events;

    // 将事件去重后转为步骤（按标题去重，保留最后一个同名事件）
    const stepMap = new Map<string, CompletedStep>();
    for (const event of steppableEvents) {
      stepMap.set(event.title, {
        id: event.id,
        title: event.title,
        desc: event.level === 'error' ? '执行失败' : '已完成',
        ts: event.ts,
        status: event.level === 'error' ? 'error' : event.level === 'warn' ? 'warning' : 'success',
      });
    }
    const steps = Array.from(stepMap.values()).sort((a, b) => a.ts - b.ts);

    // 计算指标
    const timestamps = events.map((e) => e.ts).filter((t) => t > 0);
    const minTs = timestamps.length > 0 ? Math.min(...timestamps) : 0;
    const maxTs = timestamps.length > 0 ? Math.max(...timestamps) : 0;
    const durationSeconds = minTs > 0 && maxTs > minTs ? Math.round((maxTs - minTs) / 1000) : 0;

    const errorCount = events.filter((e) => e.level === 'error').length;
    const successRate = events.length > 0 ? Math.round(((events.length - errorCount) / events.length) * 100) : 100;

    const activeSkills = executingView.toolchain?.filter((s) => s.active).length || 0;

    return {
      steps,
      metrics: {
        durationSeconds,
        successRate,
        totalSteps: steps.length,
        totalEvents: events.length,
        activeSkills,
      },
    };
  }

  private async fetchOpenClawAssistantMessages(sessionId: string, limit: number): Promise<ThinkingMessage[]> {
    const history = await this.openClawClient.getChatHistory(sessionId, limit);
    const messages = Array.isArray((history as { messages?: unknown[] }).messages)
      ? ((history as { messages?: unknown[] }).messages as OpenClawChatMessage[])
      : [];

    return messages
      .filter((message) => (message.role || '').toLowerCase() === 'assistant')
      .map((message, index) => {
        const messageId = this.pickString(message.id, message.messageId, `openclaw-${index}-${Date.now()}`);
        return {
          id: messageId,
          ts: this.extractTimestamp(message),
          source: 'feishu' as const,
          role: 'assistant' as const,
          content: this.extractMessageText(message.content),
          messageId,
        };
      })
      .filter((message) => Boolean(message.content?.trim()))
      .sort((a, b) => a.ts - b.ts);
  }

  /** 生成友好的工具事件标题 */
  private buildToolEventTitle(toolName: string): string {
    const toolNameMap: Record<string, string> = {
      exec: 'Exec 执行命令',
      read_file: '读取文件',
      write_file: '写入文件',
      search: '搜索代码',
      list_dir: '浏览目录',
      browser: '浏览器操作',
      ask_human: '等待人工确认',
    };
    return toolNameMap[toolName] || `Tool: ${toolName}`;
  }

  private async fetchFeishuBotMessages(limit: number, sinceTs?: number): Promise<FeishuMessageBrief[]> {
    if (!this.feishuClient.isConfigured() || !this.feishuChatId) {
      return [];
    }

    const messages = await this.feishuClient.listRecentBotReplies({
      chatId: this.feishuChatId,
      limit: Math.max(20, Math.min(limit, 120)),
      botOpenId: this.feishuBotOpenId || undefined,
    });

    if (!sinceTs) {
      return messages;
    }

    return messages.filter((message) => this.normalizeTimestamp(message.createTime) >= sinceTs);
  }

  /**
   * 将 OpenClaw chat.history 的返回值转换为 ThinkingMessage[]
   * 注意：chat.history 中同一轮回复可能出现多次（中间态+最终态），需要去重
   */
  private mapOpenClawToThinkingMessages(
    history: Record<string, unknown>,
    sinceTs?: number,
  ): ThinkingMessage[] {
    const messages = (history as { messages?: unknown[] }).messages;
    if (!Array.isArray(messages)) return [];

    // 第一步：提取所有 assistant 文本消息
    const raw: Array<{ index: number; content: string; ts: number }> = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i] as Record<string, unknown>;
      if (msg.role !== 'assistant') continue;

      const parts = msg.content as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(parts)) continue;

      const textParts: string[] = [];
      for (const part of parts) {
        if (part.type === 'text' && typeof part.text === 'string') {
          let t = part.text.trim();
          // 去掉 OpenClaw 有时在开头加的 --- 分隔线
          if (t.startsWith('---')) t = t.replace(/^---\s*\n?/, '').trim();
          if (t) textParts.push(t);
        }
      }

      if (textParts.length === 0) continue;

      const content = textParts.join('\n\n');
      const ts = typeof msg.ts === 'number' ? msg.ts
        : typeof msg.createdAt === 'number' ? msg.createdAt
        : Date.now() - (messages.length - i) * 1000;

      raw.push({ index: i, content, ts });
    }

    // 第二步：去重 — 如果后一条消息的文本包含前一条的文本，说明是同一轮回复，只保留后一条
    const deduped: typeof raw = [];
    for (let i = 0; i < raw.length; i++) {
      const current = raw[i];
      const next = raw[i + 1];

      // 如果下一条包含当前这条的内容，跳过当前（保留更完整的后一条）
      if (next && next.content.includes(current.content)) {
        continue;
      }
      // 如果当前和上一条内容完全一样，跳过
      if (deduped.length > 0 && deduped[deduped.length - 1].content === current.content) {
        continue;
      }

      deduped.push(current);
    }

    // 第三步：转换为 ThinkingMessage
    return deduped
      .filter(m => !sinceTs || m.ts >= sinceTs)
      .map(m => ({
        id: `oc-${m.index}-${m.ts}`,
        ts: m.ts,
        source: 'openclaw' as const,
        role: 'assistant' as const,
        content: m.content,
        msgType: 'text',
      }));
  }

  private mapFeishuToThinkingMessages(messages: FeishuMessageBrief[]): ThinkingMessage[] {
    return messages
      .filter((message) => message.text.trim())
      // 过滤掉平台发送的消息（避免用户消息被当作 Bot 回复显示）
      .filter((message) => !this.platformSentIds.has(message.messageId))
      .map((message) => {
        const base: ThinkingMessage = {
          id: `feishu-${message.messageId}`,
          ts: Number.isFinite(message.createTime) ? message.createTime : Date.now(),
          source: 'feishu',
          role: 'assistant',
          content: message.text,
          messageId: message.messageId,
          msgType: message.msgType,
        };

        // 文件消息：提取 fileKey 和 fileName
        if (message.msgType === 'file' && message.rawContent) {
          try {
            const parsed = JSON.parse(message.rawContent);
            if (parsed.file_key) {
              base.fileKey = parsed.file_key;
              base.fileName = parsed.file_name || message.text.replace('[文件] ', '');
            }
          } catch {
            // ignore parse errors
          }
        }

        return base;
      });
  }

  private mapLogLinesToEvents(
    logsResult: Record<string, unknown>,
    sinceTs?: number,
    feishuMessageMap?: Map<string, string>,
  ): ExecutingEvent[] {
    const lines = Array.isArray((logsResult as { lines?: unknown[] }).lines)
      ? ((logsResult as { lines?: unknown[] }).lines as unknown[])
      : [];

    const sourceLines = lines
      .filter((line): line is string => typeof line === 'string' && line.trim().length > 0)
      .filter((line) => !this.isGatewayAuthNoise(line))
      .filter((line) => !this.isGatewayTelemetryNoise(line, Boolean(sinceTs)))
      .filter((line) => !this.isInfrastructureChannelNoise(line, Boolean(sinceTs)))
      .slice(-120);

    const now = Date.now();
    const mapped = sourceLines.map((line, index) => {
      const parsed = this.parseLogLine(line);
      const rawTs = parsed.ts;
      const ts = rawTs || now - (sourceLines.length - index) * 2000;
      const normalized = this.normalizeFocusedLogLine({
        rawLine: line,
        parsedTitle: parsed.title || `执行日志 #${index + 1}`,
        parsedDesc: parsed.desc || line,
        parsedLevel: parsed.level,
      }, feishuMessageMap);

      return {
        rawLine: line,
        rawTs,
        ts,
        ...normalized,
      };
    })
      .filter((item) => this.shouldKeepFocusedLogLine(item.rawLine, item.level));

    const filtered = sinceTs
      ? mapped.filter((item) => !item.rawTs || item.rawTs >= sinceTs)
      : mapped;

    const events = filtered.map((item, index) => {
      return {
        id: `event-${item.ts}-${index}`,
        ts: item.ts,
        title: item.title,
        desc: item.desc,
        level: item.level,
        source: item.source,
        kind: item.kind,
        method: item.method,
        messageId: item.messageId,
        cardId: item.cardId,
        sessionKey: item.sessionKey,
        queuedFinal: item.queuedFinal,
        replies: item.replies,
      };
    });

    return this.compactFocusedEvents(events);
  }

  private compactFocusedEvents(events: ExecutingEvent[]): ExecutingEvent[] {
    if (events.length === 0) return events;

    const nonTailEvents = events.filter((event) => !this.isLogsTailEvent(event));
    if (nonTailEvents.length > 0) {
      // 有更高价值事件时，不展示 logs.tail 轮询噪音
      return this.compactGatewayStatusEvents(nonTailEvents);
    }

    // 只有 logs.tail 时，保留最近一条作为“网关仍在线”心跳
    const latestTail = events[events.length - 1];
    return latestTail ? [latestTail] : [];
  }

  private isLogsTailEvent(event: ExecutingEvent): boolean {
    const text = `${event.title} ${event.desc}`.toLowerCase();
    return text.includes('logs.tail');
  }

  private compactGatewayStatusEvents(events: ExecutingEvent[]): ExecutingEvent[] {
    const sorted = [...events].sort((a, b) => a.ts - b.ts);
    const kept: ExecutingEvent[] = [];
    const minGapMs = 15000;

    for (const event of sorted) {
      const isSkillsPolling = event.kind === 'gateway_res' && event.method === 'skills.status';
      if (!isSkillsPolling) {
        kept.push(event);
        continue;
      }

      const last = kept[kept.length - 1];
      const canMergeWithLastSkills = Boolean(
        last
        && last.kind === 'gateway_res'
        && last.method === 'skills.status'
        && (event.ts - last.ts) < minGapMs,
      );

      if (canMergeWithLastSkills) {
        kept[kept.length - 1] = event;
        continue;
      }

      kept.push(event);
    }

    return kept;
  }

  private shouldKeepFocusedLogLine(line: string, level: 'info' | 'warn' | 'error'): boolean {
    if (!line) {
      return false;
    }

    const lowered = line.toLowerCase();

    // 排除 gateway 噪音日志
    if (lowered.includes('loopback connection')
        || lowered.includes('non-local host header')
        || lowered.includes('trustedproxies')
        || lowered.includes('x-forwarded-for')
        || lowered.includes('x-real-ip')) {
      return false;
    }

    // OpenClaw action lines (tool calls, agent actions) — 高优先级
    if (this.looksLikeOpenclawActionLine(line)) {
      return true;
    }

    // warn/error 级日志保留（排除噪音后）
    if (level === 'warn' || level === 'error') {
      return true;
    }

    // 飞书通道事件 — 高价值
    const isFeishuStreaming = lowered.includes('gateway/channels/feishu')
      && (
        lowered.includes('message in group')
        || lowered.includes('dispatching to agent')
        || lowered.includes('started streaming')
        || lowered.includes('closed streaming')
        || lowered.includes('dispatch complete')
        || lowered.includes('inbound')
      );
    if (isFeishuStreaming) {
      return true;
    }

    // Gateway WS 响应 — 只保留 skills.status 和 logs.tail（排除普通的连接心跳噪音）
    const wsMethod = this.extractGatewayResponseMethod(line);
    const wsAllowedMethods = new Set(['skills.status', 'logs.tail', 'chat.send', 'chat.history', 'sessions.list']);
    const isGatewayWsResponse = lowered.includes('gateway/ws')
      && lowered.includes('res')
      && lowered.includes('✓')
      && Boolean(wsMethod)
      && wsAllowedMethods.has(wsMethod || '');
    if (isGatewayWsResponse) {
      return true;
    }

    return false;
  }

  private normalizeFocusedLogLine(input: {
    rawLine: string;
    parsedTitle: string;
    parsedDesc: string;
    parsedLevel: 'info' | 'warn' | 'error';
  }, feishuMessageMap?: Map<string, string>): {
    title: string;
    desc: string;
    level: 'info' | 'warn' | 'error';
    source?: 'gateway_ws' | 'feishu_channel' | 'assistant' | 'system';
    kind?:
      | 'gateway_res'
      | 'feishu_inbound'
      | 'feishu_dispatch'
      | 'feishu_stream_start'
      | 'feishu_stream_end'
      | 'feishu_dispatch_complete'
      | 'assistant_output'
      | 'system';
    method?: string;
    messageId?: string;
    cardId?: string;
    sessionKey?: string;
    queuedFinal?: boolean;
    replies?: number;
  } {
    const lowered = input.rawLine.toLowerCase();
    const defaultEvent = {
      title: input.parsedTitle,
      desc: input.parsedDesc,
      level: input.parsedLevel,
    };

    const wsMethod = this.extractGatewayResponseMethod(input.rawLine);
    if (lowered.includes('gateway/ws') && wsMethod) {
      const duration = this.extractDuration(input.rawLine);
      const payload = this.pickString(
        this.extractAfterResMark(input.parsedDesc),
        this.extractAfterResMark(input.rawLine),
        input.parsedDesc,
      );
      const desc = this.cleanLogPayload(payload || `${wsMethod}${duration ? ` · ${duration}` : ''}`);
      const isTailMethod = wsMethod === 'logs.tail';
      return {
        title: isTailMethod ? '网关轮询心跳' : `网关响应 · ${wsMethod}`,
        desc,
        level: 'info',
        source: 'gateway_ws',
        kind: 'gateway_res',
        method: wsMethod,
      };
    }

    if (!lowered.includes('gateway/channels/feishu')) {
      if (this.looksLikeOpenclawActionLine(input.rawLine)) {
        const tagged = this.extractTaggedMessage(this.cleanLogPayload(this.pickString(input.parsedDesc, input.rawLine)));
        const tag = tagged.tag.toLowerCase();
        const actionTitle = tag === 'tools'
          ? 'OpenClaw 工具动作'
          : tag
            ? `OpenClaw 执行动作 · ${tag}`
            : 'OpenClaw 执行动作';
        const actionDesc = this.pickString(tagged.message, input.parsedDesc, input.rawLine);

        return {
          title: actionTitle,
          desc: actionDesc,
          level: input.parsedLevel,
          source: 'system',
          kind: 'system',
        };
      }

      return defaultEvent;
    }

    const inboundMessage = this.extractMessageInGroupText(input.rawLine);
    const dispatchSession = this.extractDispatchSession(input.rawLine);

    const cardId = this.extractKvValue(input.rawLine, 'cardId');
    const messageId = this.extractKvValue(input.rawLine, 'messageId');
    const queuedFinal = this.extractKvValue(input.rawLine, 'queuedFinal');
    const replies = this.extractKvValue(input.rawLine, 'replies');
    const enrichedMessage = messageId && feishuMessageMap?.get(messageId) ? feishuMessageMap.get(messageId) || '' : '';

    if (inboundMessage) {
      return {
        title: '飞书收到用户指令',
        desc: trimTextLocal(this.cleanLogPayload(inboundMessage), 120),
        level: 'info',
        source: 'feishu_channel',
        kind: 'feishu_inbound',
      };
    }

    if (dispatchSession) {
      return {
        title: '任务已分派到 Agent',
        desc: `session=${dispatchSession}`,
        level: 'info',
        source: 'feishu_channel',
        kind: 'feishu_dispatch',
        sessionKey: dispatchSession,
      };
    }

    if (lowered.includes('started streaming')) {
      // 优先展示从飞书查到的真实消息文本
      const desc = enrichedMessage
        ? trimTextLocal(enrichedMessage, 120)
        : `cardId=${cardId || '-'} · messageId=${messageId || '-'}`;

      return {
        title: '飞书流式开始',
        desc,
        level: 'info',
        source: 'feishu_channel',
        kind: 'feishu_stream_start',
        cardId: cardId || undefined,
        messageId: messageId || undefined,
      };
    }

    if (lowered.includes('closed streaming')) {
      return {
        title: '飞书流式结束',
        desc: `cardId=${cardId || '-'}`,
        level: 'info',
        source: 'feishu_channel',
        kind: 'feishu_stream_end',
        cardId: cardId || undefined,
      };
    }

    if (lowered.includes('dispatch complete')) {
      const normalizedQueuedFinal = queuedFinal ? queuedFinal.toLowerCase() : '';
      const queuedFinalBool = normalizedQueuedFinal === 'true'
        ? true
        : normalizedQueuedFinal === 'false'
          ? false
          : undefined;
      const repliesNum = replies && /^\d+$/.test(replies) ? Number(replies) : undefined;

      return {
        title: '飞书下发完成',
        desc: `queuedFinal=${queuedFinal || '-'} · replies=${replies || '-'}`,
        level: 'info',
        source: 'feishu_channel',
        kind: 'feishu_dispatch_complete',
        queuedFinal: queuedFinalBool,
        replies: repliesNum,
      };
    }

    return defaultEvent;
  }

  private extractGatewayResponseMethod(line: string): string {
    const match = line.match(/res\s*✓\s*([a-zA-Z0-9_.:-]+)/);
    return match?.[1]?.trim() || '';
  }

  private extractDuration(line: string): string {
    const match = line.match(/(\d+ms)\b/);
    return match?.[1] || '';
  }

  private extractAfterResMark(line: string): string {
    const match = line.match(/res\s*✓\s*(.+)$/);
    return match?.[1]?.trim() || '';
  }

  private cleanLogPayload(text: string): string {
    if (!text) return '';

    let cleaned = text;

    // 如果整段文本是结构化日志 JSON 元数据，尝试从中提取有价值内容
    const isMetadataBlob = /^\s*\{"\s*(runtime|subsystem|hostname|name|_meta|level|time)"/.test(cleaned);
    if (isMetadataBlob) {
      // 尝试从嵌套的 message/msg/text 字段提取真实内容
      try {
        const parsed = JSON.parse(cleaned);
        const useful = parsed.message || parsed.msg || parsed.text || parsed.content;
        if (typeof useful === 'string' && useful.trim()) {
          return useful.trim();
        }
      } catch {
        // 不是合法 JSON，继续用截断策略
      }
      return '';
    }

    // 截断常见的 metadata 边界标记
    const markers = [
      '","_meta"', '"_meta":', ',"_meta":',
      '","time"', ',"time":',
      '","runtime"', ',"runtime":',
      '","hostname"', ',"hostname":',
      '","name":"{"subsystem"',
      ',"par',
    ];
    for (const marker of markers) {
      const idx = cleaned.indexOf(marker);
      if (idx >= 0) {
        cleaned = cleaned.slice(0, idx);
      }
    }

    return cleaned
      .replace(/\\"/g, '"')
      .replace(/^"+|"+$/g, '')
      .trim();
  }

  private extractKvValue(line: string, key: string): string {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = line.match(new RegExp(`${escapedKey}=([^,\\s]+)`));
    const raw = match?.[1]?.trim() || '';
    return raw.replace(/^[("']+/, '').replace(/[)"']+$/, '').trim();
  }

  private extractMessageInGroupText(line: string): string {
    const match = line.match(/message in group [^:]+:\s*(.+)$/i);
    return match?.[1]?.trim() || '';
  }

  private extractDispatchSession(line: string): string {
    const match = line.match(/dispatching to agent \(session=([^)]+)\)/i);
    return match?.[1]?.trim() || '';
  }

  private looksLikeOpenclawActionLine(line: string): boolean {
    const lowered = line.toLowerCase();
    if (lowered.includes('gateway/ws') || lowered.includes('gateway/channels/feishu')) {
      return false;
    }

    return lowered.includes('[tools]')
      || lowered.includes('"subsystem":"tools')
      || lowered.includes('"subsystem":"agent')
      || lowered.includes('tool call')
      || lowered.includes('tool result')
      || lowered.includes('executing tool');
  }

  private async fetchFeishuRecentMessagesForExecuting(sinceTs?: number): Promise<FeishuMessageBrief[]> {
    if (!this.feishuClient.isConfigured() || !this.feishuChatId) {
      return [];
    }

    const messages = await this.feishuClient.listRecentMessages({
      chatId: this.feishuChatId,
      limit: 120,
    });

    if (!sinceTs) {
      return messages;
    }

    return messages.filter((message) => this.normalizeTimestamp(message.createTime) >= sinceTs);
  }

  private async enrichFeishuMessageMapFromLogLines(
    logsResult: Record<string, unknown>,
    messageMap: Map<string, string>,
  ): Promise<void> {
    if (!this.feishuClient.isConfigured()) {
      return;
    }

    const lines = Array.isArray((logsResult as { lines?: unknown[] }).lines)
      ? ((logsResult as { lines?: unknown[] }).lines as unknown[])
      : [];
    const messageIds = new Set<string>();

    for (const line of lines) {
      if (typeof line !== 'string' || !line.includes('gateway/channels/feishu')) continue;
      const messageId = this.extractKvValue(line, 'messageId');
      if (messageId) {
        messageIds.add(messageId);
      }
    }

    const missingIds = Array.from(messageIds).filter((id) => !messageMap.has(id)).slice(0, 10);
    if (missingIds.length === 0) {
      return;
    }

    await Promise.all(missingIds.map(async (messageId) => {
      const detail = await this.feishuClient.getMessageById(messageId).catch(() => null);
      if (!detail || !detail.text) {
        return;
      }
      messageMap.set(messageId, detail.text);
    }));
  }

  private async resolveScopeStartTs(options: ViewOptions): Promise<number | undefined> {
    const explicitSinceTs = this.normalizeTimestamp(options.sinceTs);
    if (explicitSinceTs > 0) {
      return explicitSinceTs;
    }

    if (options.scope !== 'latest_turn') {
      return undefined;
    }

    if (!this.feishuClient.isConfigured() || !this.feishuChatId) {
      return undefined;
    }

    const messages = await this.feishuClient.listRecentMessages({
      chatId: this.feishuChatId,
      limit: 120,
    });

    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      if (this.isBotMessage(message)) continue;

      const ts = this.normalizeTimestamp(message.createTime);
      if (ts > 0) {
        return ts;
      }
    }

    return undefined;
  }

  private isBotMessage(message: FeishuMessageBrief): boolean {
    if (message.senderType === 'app') {
      return true;
    }

    if (this.feishuBotOpenId && message.senderOpenId && message.senderOpenId === this.feishuBotOpenId) {
      return true;
    }

    return false;
  }

  private parseLogLine(line: string): {
    ts?: number;
    title?: string;
    desc?: string;
    level: 'info' | 'warn' | 'error';
  } {
    try {
      const json = JSON.parse(line) as Record<string, unknown>;
      const recordType = this.pickString(json.type).toLowerCase();
      if (recordType === 'log') {
        const message = this.pickString(json.message);
        const raw = this.pickString(json.raw);
        const tagged = this.extractTaggedMessage(message || raw);
        const desc = this.buildStructuredDescription(this.pickString(tagged.message, message, raw), '', line);
        const level = this.normalizeLogLevel(this.pickString(json.level), desc);
        const ts = this.parseTimestamp(json.time || json.ts || json.timestamp);

        return {
          ts,
          title: tagged.tag ? `${tagged.tag} 执行中` : (desc.slice(0, 24) || '执行日志'),
          desc,
          level,
        };
      }

      const meta = this.asRecord(json._meta);
      const headText = this.pickString(json[0], json.name);
      const header = this.parseJsonRecord(headText);
      const detailsRaw = json[1];
      const details = this.asRecord(detailsRaw);
      const detailsText = typeof detailsRaw === 'string' ? detailsRaw.trim() : '';
      const taggedHead = this.extractTaggedMessage(headText);
      const taggedDetails = this.extractTaggedMessage(detailsText);

      const subsystem = this.pickString(
        this.getRecordString(header, 'subsystem'),
        this.getRecordString(meta, 'subsystem'),
        this.getRecordString(meta, 'module'),
        this.extractSubsystemFromName(this.pickString(json.name)),
        taggedHead.tag,
        taggedDetails.tag,
      );

      const authReason = this.getRecordString(details, 'authReason');
      const reasonCandidate = this.pickString(
        this.getRecordString(details, 'reason'),
        this.getRecordString(details, 'cause'),
        this.pickString(json[2], json.message, json.msg),
        taggedDetails.message,
        taggedHead.message,
        detailsText,
        headText,
      );
      const reason = this.pickString(this.extractTaggedMessage(reasonCandidate).message, reasonCandidate);
      const desc = this.buildStructuredDescription(reason, authReason, line);

      const title = subsystem
        ? `${subsystem} 执行中`
        : desc.slice(0, 24);

      const level = this.normalizeLogLevel(this.pickString(
        this.getRecordString(meta, 'logLevelName'),
        this.getRecordString(meta, 'level'),
        json.level,
      ), desc);

      if (authReason && level === 'info') {
        return {
          ts: this.parseTimestamp(
            json.ts
            || json.timestamp
            || json.time
            || this.getRecordString(meta, 'date'),
          ),
          title,
          desc,
          level: 'warn',
        };
      }

      const ts = this.parseTimestamp(
        json.ts
        || json.timestamp
        || json.time
        || this.getRecordString(meta, 'date'),
      );

      return {
        ts,
        title,
        desc,
        level,
      };
    } catch {
      const tagged = this.extractTaggedMessage(line);
      const desc = this.pickString(tagged.message, line);
      const level = this.normalizeLogLevel('', desc);

      return {
        desc,
        title: tagged.tag ? `${tagged.tag} 执行中` : line.slice(0, 24),
        level,
      };
    }
  }

  private extractTaggedMessage(text: string): { tag: string; message: string } {
    if (!text) {
      return { tag: '', message: '' };
    }

    const match = text.match(/^\s*\[([^\]]+)\]\s*(.*)$/);
    if (!match) {
      return { tag: '', message: text.trim() };
    }

    return {
      tag: match[1].trim(),
      message: match[2].trim(),
    };
  }

  private normalizeLogLevel(rawLevel: string, message: string): 'info' | 'warn' | 'error' {
    const levelText = rawLevel.toLowerCase();
    if (levelText.includes('error')) return 'error';
    if (levelText.includes('warn')) return 'warn';

    const lowered = message.toLowerCase();
    if (
      lowered.includes('error')
      || lowered.includes('failed')
      || lowered.includes('exception')
      || lowered.includes('enoent')
      || lowered.includes('denied')
    ) {
      return 'error';
    }

    if (
      lowered.includes('warn')
      || lowered.includes('timeout')
      || lowered.includes('unauthorized')
    ) {
      return 'warn';
    }

    return 'info';
  }

  private isGatewayAuthNoise(line: string): boolean {
    if (!line) return false;

    const lowered = line.toLowerCase();
    if (!(lowered.includes('token_missing') || lowered.includes('unauthorized'))) {
      return false;
    }

    try {
      const json = JSON.parse(line) as Record<string, unknown>;
      const meta = this.asRecord(json._meta);
      const subsystem = this.pickString(
        this.getRecordString(this.parseJsonRecord(this.pickString(json[0], json.name)), 'subsystem'),
        this.getRecordString(meta, 'subsystem'),
        this.extractSubsystemFromName(this.pickString(json.name)),
      ).toLowerCase();

      if (subsystem.includes('gateway/ws')) {
        return true;
      }

      const detail = json[1];
      if (typeof detail === 'string' && /reason=token_missing|unauthorized/i.test(detail)) {
        return true;
      }

      if (detail && typeof detail === 'object') {
        const record = detail as Record<string, unknown>;
        const authReason = this.pickString(record.authReason).toLowerCase();
        const reason = this.pickString(record.reason, record.cause).toLowerCase();
        return authReason.includes('token_missing') || reason.includes('unauthorized');
      }

      return false;
    } catch {
      return lowered.includes('gateway/ws') && (lowered.includes('token_missing') || lowered.includes('unauthorized'));
    }
  }

  private isGatewayTelemetryNoise(line: string, strict: boolean): boolean {
    if (!line) return false;

    const normalized = line.toLowerCase();
    const baselineNoise = [
      'device pairing auto-approved',
      'webchat connected',
      'webchat disconnected',
      '⇄ res ✓ skills.status',
      '⇄ res ✓ channels.status',
      '⇄ res ✓ sessions.usage',
    ];

    const hasBaselineNoise = baselineNoise.some((keyword) => normalized.includes(keyword));
    if (hasBaselineNoise) {
      return true;
    }

    if (!strict) {
      return false;
    }

    if (!normalized.includes('gateway/ws')) {
      return false;
    }

    const strictNoise = [
      'connect.challenge',
      'conn=',
      'remote=',
      'client=',
    ];

    return strictNoise.some((keyword) => normalized.includes(keyword))
      && !normalized.includes('error')
      && !normalized.includes('failed');
  }

  private isInfrastructureChannelNoise(line: string, strict: boolean): boolean {
    if (!line || !strict) return false;

    const lowered = line.toLowerCase();
    const patterns = [
      'axioserror',
      'depth_zero_self_signed_cert',
      'self-signed certificate',
      'enotfound open.feishu.cn',
      'unable to connect to the server',
      'client network socket disconnected before secure tls connection was established',
      'tenant_access_token/internal',
    ];

    const likelyChannelError = patterns.some((pattern) => lowered.includes(pattern));
    if (!likelyChannelError) {
      return false;
    }

    try {
      const json = JSON.parse(line) as Record<string, unknown>;
      const meta = this.asRecord(json._meta);
      const name = this.getRecordString(meta, 'name').toLowerCase();
      const head = this.pickString(json[0]).toLowerCase();

      return name.includes('clawdbot')
        || head.includes('[error]')
        || head.includes('[info]: [ \'ws\', \'unable to connect');
    } catch {
      return true;
    }
  }

  private parseTimestamp(raw: unknown): number | undefined {
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
      return raw > 1e12 ? raw : raw * 1000;
    }

    if (typeof raw === 'string' && raw.trim()) {
      if (/^\d+$/.test(raw.trim())) {
        const numeric = Number(raw.trim());
        if (Number.isFinite(numeric) && numeric > 0) {
          return numeric > 1e12 ? numeric : numeric * 1000;
        }
      }

      const parsed = Date.parse(raw);
      if (!Number.isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }

    return undefined;
  }

  private normalizeTimestamp(raw: unknown): number {
    const parsed = this.parseTimestamp(raw);
    return parsed && Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  private buildStructuredDescription(reason: string, authReason: string, fallback: string): string {
    if (authReason === 'token_missing') {
      return '网关鉴权失败：缺少 gateway token';
    }

    if (authReason === 'token_mismatch') {
      return '网关鉴权失败：gateway token 不匹配';
    }

    if (reason) {
      return reason;
    }

    return fallback;
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : null;
  }

  private parseJsonRecord(text: string): Record<string, unknown> | null {
    if (!text) return null;
    try {
      const parsed = JSON.parse(text);
      return this.asRecord(parsed);
    } catch {
      return null;
    }
  }

  private getRecordString(record: Record<string, unknown> | null, key: string): string {
    if (!record) return '';
    const value = record[key];
    return typeof value === 'string' ? value.trim() : '';
  }

  private extractSubsystemFromName(name: string): string {
    if (!name) return '';
    const parsed = this.parseJsonRecord(name);
    if (!parsed) return '';
    return this.getRecordString(parsed, 'subsystem');
  }

  private mapFeishuArtifacts(messages: FeishuMessageBrief[]): CompletedArtifact[] {
    const extracted = this.feishuClient.extractArtifacts(messages);
    return extracted.map((artifact: FeishuArtifact) => {
      // 生成代理下载 URL，让前端能直接下载
      let url = artifact.url;
      if (artifact.messageId && artifact.type === 'file') {
        const parsed = this.parseArtifactFileKey(artifact.url);
        if (parsed.fileKey) {
          url = `/api/openclaw-view/file/${encodeURIComponent(artifact.messageId)}/${encodeURIComponent(parsed.fileKey)}?name=${encodeURIComponent(artifact.name)}`;
        }
      }

      return {
        id: artifact.id,
        name: artifact.name,
        type: artifact.type,
        url,
        source: 'feishu' as const,
      };
    });
  }

  /** 从飞书的 resource URL 中提取 fileKey */
  private parseArtifactFileKey(rawUrl: string): { fileKey: string } {
    // URL 格式: .../messages/{messageId}/resources/{fileKey}?type=file
    const match = rawUrl.match(/\/resources\/([^?/]+)/);
    return { fileKey: match?.[1] || '' };
  }

  private extractOpenclawArtifactsFromMessages(messages: ThinkingMessage[]): CompletedArtifact[] {
    const artifacts: CompletedArtifact[] = [];

    for (const message of messages) {
      const links = this.extractHttpLinks(message.content);
      for (const link of links) {
        artifacts.push({
          id: `openclaw-link-${message.id}-${hashString(link)}`,
          name: 'OpenClaw 产物链接',
          type: 'link',
          url: link,
          source: 'openclaw',
        });
      }
    }

    return artifacts;
  }

  private mergeArtifacts(artifacts: CompletedArtifact[]): CompletedArtifact[] {
    const deduped = new Map<string, CompletedArtifact>();

    for (const artifact of artifacts) {
      if (!artifact.url) continue;
      const key = `${artifact.type}::${artifact.url}`;
      if (deduped.has(key)) continue;
      deduped.set(key, artifact);
    }

    return Array.from(deduped.values()).slice(0, 20);
  }

  private extractMessageText(content: unknown): string {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      const textSegments = content
        .map((item) => {
          if (!item || typeof item !== 'object') return '';
          const record = item as Record<string, unknown>;
          return typeof record.text === 'string' ? record.text : '';
        })
        .filter(Boolean);
      return textSegments.join('\n').trim();
    }

    if (content && typeof content === 'object') {
      const messageText = this.pickString(
        (content as Record<string, unknown>).text,
        (content as Record<string, unknown>).message,
      );
      return messageText;
    }

    return '';
  }

  private extractTimestamp(message: OpenClawChatMessage): number {
    const ts = Number(
      message.timestamp
      || message.ts
      || message.createdAt
      || message.createTime
      || message.time
      || 0,
    );

    return Number.isFinite(ts) && ts > 0 ? ts : Date.now();
  }

  private extractHttpLinks(text: string): string[] {
    if (!text) return [];
    const matches = text.match(/https?:\/\/[^\s)]+/g);
    return matches ? Array.from(new Set(matches)) : [];
  }

  private pickString(...values: unknown[]): string {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }

      if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
      }
    }

    return '';
  }

  private normalizeErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message || String(error);
    }
    return String(error || '');
  }

  private translateGatewayError(message: string): string {
    const lowered = message.toLowerCase();
    if (lowered.includes('pairing required')) {
      return 'OpenClaw 网关要求设备配对，请先在网关侧批准当前客户端设备。';
    }

    if (lowered.includes('econnrefused')) {
      return 'OpenClaw 网关连接被拒绝，请检查 OPENCLAW_GATEWAY_URL 与端口映射。';
    }

    if (lowered.includes('unauthorized') || lowered.includes('token')) {
      return 'OpenClaw 网关鉴权失败，请检查 OPENCLAW_GATEWAY_TOKEN。';
    }

    if (lowered.includes('timeout')) {
      return 'OpenClaw 网关连接超时，请确认网关服务可达。';
    }

    return message;
  }
}

function hashString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

function trimTextLocal(text: string, length: number): string {
  if (!text) return '';
  if (text.length <= length) return text;
  return `${text.slice(0, Math.max(0, length - 1))}…`;
}
