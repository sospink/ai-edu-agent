import * as lark from '@larksuiteoapi/node-sdk';

export interface FeishuMessageBrief {
  messageId: string;
  msgType: string;
  senderType: string;
  senderOpenId?: string;
  createTime: number;
  text: string;
  rawContent?: string;
  raw: Record<string, unknown>;
}

export interface FeishuArtifact {
  id: string;
  name: string;
  type: 'file' | 'image' | 'audio' | 'link';
  url: string;
  messageId: string;
}

export class FeishuClient {
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly domainValue: string;
  private readonly domain: lark.Domain | string;
  private readonly client: lark.Client | null;

  constructor() {
    this.appId = (process.env.FEISHU_APP_ID || '').trim();
    this.appSecret = (process.env.FEISHU_APP_SECRET || '').trim();
    this.domainValue = (process.env.FEISHU_DOMAIN || '').trim();
    this.domain = this.resolveDomain(this.domainValue);

    this.client = this.appId && this.appSecret
      ? new lark.Client({
          appId: this.appId,
          appSecret: this.appSecret,
          appType: lark.AppType.SelfBuild,
          domain: this.domain,
        })
      : null;
  }

  isConfigured(): boolean {
    return Boolean(this.client);
  }

  async getHealth(): Promise<Record<string, unknown>> {
    const sdk = this.requireClient();
    const response = await sdk.auth.v3.tenantAccessToken.internal({
      data: {
        app_id: this.appId,
        app_secret: this.appSecret,
      },
    });
    const data = this.unwrapResponse<Record<string, unknown>>(response);

    return {
      appId: this.mask(this.appId),
      domain: this.getDomainBaseUrl(),
      expiresIn: Number((data as { expire?: unknown }).expire || 0),
    };
  }

  async listRecentBotReplies(options: {
    chatId: string;
    limit: number;
    botOpenId?: string;
  }): Promise<FeishuMessageBrief[]> {
    const messages = await this.listRecentMessages({
      chatId: options.chatId,
      limit: Math.max(options.limit, 20),
    });

    const maxLimit = Math.max(1, Math.min(options.limit, 80));
    return messages
      .filter((message) => this.isBotReply(message, options.botOpenId))
      .slice(-maxLimit);
  }

  async listRecentMessages(options: {
    chatId: string;
    limit: number;
  }): Promise<FeishuMessageBrief[]> {
    const sdk = this.requireClient();

    const maxLimit = Math.max(1, Math.min(options.limit, 120));
    const collected: FeishuMessageBrief[] = [];
    let pageToken = '';
    let pageCount = 0;

    while (collected.length < maxLimit && pageCount < 5) {
      const response = await sdk.im.v1.message.list({
        params: {
          container_id_type: 'chat',
          container_id: options.chatId,
          sort_type: 'ByCreateTimeDesc',
          page_size: 20,
          page_token: pageToken || undefined,
        },
      });

      const data = this.unwrapResponse<Record<string, unknown>>(response);
      const items = Array.isArray((data as { items?: unknown[] }).items)
        ? ((data as { items?: unknown[] }).items as Array<Record<string, unknown>>)
        : [];

      const pageMessages = items.map((item) => this.toMessageBrief(item));

      collected.push(...pageMessages);

      pageToken = typeof (data as { page_token?: unknown }).page_token === 'string'
        ? String((data as { page_token?: unknown }).page_token)
        : '';

      const hasMore = Boolean((data as { has_more?: unknown }).has_more);
      if (!hasMore || !pageToken) break;
      pageCount += 1;
    }

    return collected
      .sort((a, b) => a.createTime - b.createTime)
      .slice(-maxLimit);
  }

  async getMessageById(messageId: string): Promise<FeishuMessageBrief | null> {
    const sdk = this.requireClient();
    const trimmedId = messageId.trim();
    if (!trimmedId) {
      return null;
    }

    const response = await sdk.im.v1.message.get({
      path: {
        message_id: trimmedId,
      },
    });

    const data = this.unwrapResponse<Record<string, unknown>>(response);
    const items = Array.isArray((data as { items?: unknown[] }).items)
      ? ((data as { items?: unknown[] }).items as Array<Record<string, unknown>>)
      : [];

    if (items.length === 0) {
      return null;
    }

    return this.toMessageBrief(items[0]);
  }

  async sendMessageToChat(chatId: string, text: string): Promise<{ messageId: string }> {
    const sdk = this.requireClient();
    const response = await sdk.im.v1.message.create({
      params: {
        receive_id_type: 'chat_id',
      },
      data: {
        receive_id: chatId.trim(),
        msg_type: 'text',
        content: JSON.stringify({ text: text.trim() }),
      },
    });

    const data = this.unwrapResponse<Record<string, unknown>>(response);
    const messageId = this.getNestedString(data as Record<string, unknown>, ['message_id']) || '';
    return { messageId };
  }

  extractArtifacts(messages: FeishuMessageBrief[]): FeishuArtifact[] {
    const artifacts: FeishuArtifact[] = [];

    for (const message of messages) {
      const parsed = this.parseMessageContent(message.rawContent || '');
      if (!parsed || typeof parsed !== 'object') continue;

      if (message.msgType === 'file') {
        const fileKey = this.getNestedString(parsed, ['file_key']);
        if (!fileKey) continue;

        artifacts.push({
          id: `feishu-file-${message.messageId}-${fileKey}`,
          name: this.getNestedString(parsed, ['file_name']) || '飞书文件',
          type: 'file',
          url: this.buildMessageResourceUrl(message.messageId, fileKey, 'file'),
          messageId: message.messageId,
        });
        continue;
      }

      if (message.msgType === 'image') {
        const imageKey = this.getNestedString(parsed, ['image_key']);
        if (!imageKey) continue;

        artifacts.push({
          id: `feishu-image-${message.messageId}-${imageKey}`,
          name: '飞书图片',
          type: 'image',
          url: this.buildMessageResourceUrl(message.messageId, imageKey, 'image'),
          messageId: message.messageId,
        });
        continue;
      }

      if (message.msgType === 'audio') {
        const fileKey = this.getNestedString(parsed, ['file_key']);
        if (!fileKey) continue;

        artifacts.push({
          id: `feishu-audio-${message.messageId}-${fileKey}`,
          name: '飞书语音',
          type: 'audio',
          url: this.buildMessageResourceUrl(message.messageId, fileKey, 'audio'),
          messageId: message.messageId,
        });
      }
    }

    return artifacts;
  }

  async getMessageResource(messageId: string, fileKey: string, type = 'file'): Promise<{ data: Buffer; contentType: string }> {
    const sdk = this.requireClient();
    const response = await sdk.im.v1.messageResource.get({
      path: {
        message_id: messageId.trim(),
        file_key: fileKey.trim(),
      },
      params: {
        type,
      },
    });

    // SDK 返回的是 Readable stream 或 Buffer
    const responseData = response as unknown as Record<string, unknown>;
    const stream = responseData.data ?? responseData;

    if (Buffer.isBuffer(stream)) {
      return { data: stream, contentType: 'application/octet-stream' };
    }

    // 如果是 Readable stream，收集成 Buffer
    if (stream && typeof (stream as NodeJS.ReadableStream).pipe === 'function') {
      const chunks: Buffer[] = [];
      for await (const chunk of stream as AsyncIterable<Buffer>) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return { data: Buffer.concat(chunks), contentType: 'application/octet-stream' };
    }

    throw new Error('无法读取飞书文件资源');
  }

  private toMessageBrief(raw: Record<string, unknown>): FeishuMessageBrief {
    const messageId = this.getNestedString(raw, ['message_id']) || cryptoRandomId();
    const msgType = this.getNestedString(raw, ['msg_type']) || 'text';
    const senderType = this.getNestedString(raw, ['sender', 'sender_type']) || '';
    const senderOpenId = this.getNestedString(raw, ['sender', 'sender_id', 'open_id']);

    const createTimeRaw = this.getNestedString(raw, ['create_time']) || '0';
    const createTime = Number(createTimeRaw);

    const content = this.getNestedString(raw, ['body', 'content']) || '';
    const text = this.extractTextByType(msgType, content);

    return {
      messageId,
      msgType,
      senderType,
      senderOpenId,
      createTime: Number.isFinite(createTime) ? createTime : Date.now(),
      text,
      rawContent: content,
      raw,
    };
  }

  private isBotReply(message: FeishuMessageBrief, botOpenId?: string): boolean {
    if (message.senderType === 'app') {
      return true;
    }

    if (botOpenId && message.senderOpenId && message.senderOpenId === botOpenId) {
      return true;
    }

    return false;
  }

  private extractTextByType(msgType: string, content: string): string {
    const parsed = this.parseMessageContent(content);

    if (msgType === 'text') {
      const text = this.getNestedString(parsed, ['text']);
      return text || '';
    }

    if (msgType === 'post') {
      const postText = this.extractPostText(parsed);
      return postText || '[富文本消息]';
    }

    if (msgType === 'file') {
      return `[文件] ${this.getNestedString(parsed, ['file_name']) || '未命名文件'}`;
    }

    if (msgType === 'image') {
      return '[图片消息]';
    }

    if (msgType === 'audio') {
      return '[语音消息]';
    }

    if (msgType === 'interactive') {
      const interactiveText = this.extractInteractiveText(parsed);
      // 飞书 API 对 interactive 卡片返回的 body.content 是降级占位文本，需过滤
      if (!interactiveText || interactiveText.includes('请升级至最新版本客户端')) {
        return '[卡片消息]';
      }
      return interactiveText;
    }

    return content || `[${msgType}]`;
  }

  private parseMessageContent(content: string): Record<string, unknown> | null {
    if (!content) return null;

    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object') return parsed;
      return null;
    } catch {
      return null;
    }
  }

  private extractPostText(post: Record<string, unknown> | null): string {
    if (!post) return '';

    const directContent = (post as { content?: unknown }).content;
    const zhCn = post.zh_cn;
    const enUs = post.en_us;
    const localeContent = zhCn && typeof zhCn === 'object'
      ? (zhCn as { content?: unknown }).content
      : enUs && typeof enUs === 'object'
        ? (enUs as { content?: unknown }).content
        : undefined;
    const content = Array.isArray(directContent)
      ? directContent
      : Array.isArray(localeContent)
        ? localeContent
        : null;
    if (!content) return '';

    const lineTexts: string[] = [];

    for (const line of content) {
      if (!Array.isArray(line)) continue;
      const parts: string[] = [];
      for (const item of line) {
        if (!item || typeof item !== 'object') continue;
        const text = this.getNestedString(item as Record<string, unknown>, ['text']);
        if (text) parts.push(text);
      }
      if (parts.length > 0) {
        lineTexts.push(parts.join(' '));
      }
    }

    // 用双换行分隔，让 Markdown 渲染器识别为独立段落
    return lineTexts.join('\n\n').trim();
  }

  /** 公共方法：将飞书卡片 JSON 解析为 Markdown */
  parseCardToMarkdown(card: Record<string, unknown> | null): string {
    return this.extractInteractiveText(card);
  }

  private extractInteractiveText(card: Record<string, unknown> | null): string {
    if (!card) return '';

    const lines: string[] = [];

    // 提取 header 标题
    const header = card.header as Record<string, unknown> | undefined;
    if (header) {
      const title = header.title as Record<string, unknown> | undefined;
      if (title) {
        const titleContent = (title.content as string) || (title.text as string) || '';
        if (titleContent.trim()) {
          lines.push(`## ${titleContent.trim()}`);
          lines.push('');
        }
      }
    }

    // 解析 elements
    const elements = card.elements as unknown[] | undefined;
    if (Array.isArray(elements)) {
      for (const el of elements) {
        const block = this.parseCardElement(el as Record<string, unknown>);
        if (block) {
          lines.push(block);
          lines.push('');
        }
      }
    }

    const result = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    // 限制长度避免超长卡片
    return result.length > 2000 ? result.slice(0, 2000) + '\n\n...(内容过长已截断)' : result;
  }

  private parseCardElement(el: Record<string, unknown> | null): string {
    if (!el || typeof el !== 'object') return '';
    const tag = el.tag as string;

    if (tag === 'div' || tag === 'markdown') {
      return this.extractCardText(el);
    }

    if (tag === 'column_set') {
      const columns = el.columns as unknown[] | undefined;
      if (!Array.isArray(columns)) return '';
      const parts: string[] = [];
      for (const col of columns) {
        const colObj = col as Record<string, unknown>;
        const colElements = colObj.elements as unknown[] | undefined;
        if (Array.isArray(colElements)) {
          for (const child of colElements) {
            const text = this.parseCardElement(child as Record<string, unknown>);
            if (text) parts.push(text);
          }
        }
      }
      return parts.join('\n\n');
    }

    if (tag === 'table') {
      return this.parseCardTable(el);
    }

    if (tag === 'hr') {
      return '---';
    }

    if (tag === 'action') {
      const actions = el.actions as unknown[] | undefined;
      if (!Array.isArray(actions)) return '';
      const buttons: string[] = [];
      for (const action of actions) {
        const aObj = action as Record<string, unknown>;
        const text = aObj.text as Record<string, unknown> | undefined;
        const content = text?.content as string || text?.text as string || '';
        if (content.trim()) buttons.push(`[${content.trim()}]`);
      }
      return buttons.join(' ');
    }

    if (tag === 'note') {
      const noteElements = el.elements as unknown[] | undefined;
      if (!Array.isArray(noteElements)) return '';
      const texts: string[] = [];
      for (const ne of noteElements) {
        const neObj = ne as Record<string, unknown>;
        const content = (neObj.content as string) || (neObj.text as string) || '';
        if (content.trim()) texts.push(content.trim());
      }
      return texts.length > 0 ? `> ${texts.join(' ')}` : '';
    }

    // fallback: 尝试提取 text/content
    return this.extractCardText(el);
  }

  private extractCardText(el: Record<string, unknown>): string {
    // 直接 content 字段（lark_md / plain_text）
    const textObj = el.text as Record<string, unknown> | string | undefined;
    if (typeof textObj === 'string') return textObj.trim();

    if (textObj && typeof textObj === 'object') {
      const content = (textObj.content as string) || (textObj.text as string) || '';
      return content.trim();
    }

    const directContent = el.content as string | undefined;
    if (typeof directContent === 'string') return directContent.trim();

    return '';
  }

  private parseCardTable(el: Record<string, unknown>): string {
    const columns = el.columns as Array<Record<string, unknown>> | undefined;
    const rows = el.rows as Array<Record<string, unknown>> | undefined;

    if (!Array.isArray(columns) || !Array.isArray(rows) || columns.length === 0) return '';

    // 表头
    const headers = columns.map(col => {
      const name = (col.name as string) || (col.display_name as string) || '';
      return name.trim() || '—';
    });
    const dataKeys = columns.map(col => (col.data_key as string) || (col.name as string) || '');

    const headerRow = `| ${headers.join(' | ')} |`;
    const separator = `| ${headers.map(() => '---').join(' | ')} |`;

    const dataRows = rows.slice(0, 20).map(row => {
      const cells = dataKeys.map(key => {
        const val = key ? (row[key] ?? '') : '';
        return String(val).trim();
      });
      return `| ${cells.join(' | ')} |`;
    });

    return [headerRow, separator, ...dataRows].join('\n');
  }

  private buildMessageResourceUrl(messageId: string, fileKey: string, type: string): string {
    const base = this.getDomainBaseUrl();
    const encodedMessageId = encodeURIComponent(messageId);
    const encodedFileKey = encodeURIComponent(fileKey);
    const encodedType = encodeURIComponent(type);
    return `${base}/open-apis/im/v1/messages/${encodedMessageId}/resources/${encodedFileKey}?type=${encodedType}`;
  }

  private unwrapResponse<T>(response: unknown): T {
    const body = (response as { data?: unknown })?.data ?? response;

    if (!body || typeof body !== 'object') {
      throw new Error('Feishu 响应格式异常');
    }

    const bodyRecord = body as Record<string, unknown>;
    const code = Number(bodyRecord.code ?? 0);

    if (Number.isFinite(code) && code !== 0) {
      const message = typeof bodyRecord.msg === 'string' ? bodyRecord.msg : 'Feishu API 请求失败';
      throw new Error(`${message} (code=${code})`);
    }

    return (bodyRecord.data ?? bodyRecord) as T;
  }

  private requireClient(): lark.Client {
    if (!this.client) {
      throw new Error('Feishu 配置缺失，请设置 FEISHU_APP_ID / FEISHU_APP_SECRET');
    }
    return this.client;
  }

  private resolveDomain(domainValue: string): lark.Domain | string {
    const normalized = domainValue.trim().toLowerCase();
    if (!normalized) return lark.Domain.Feishu;

    if (normalized === 'feishu' || normalized === 'open.feishu.cn') {
      return lark.Domain.Feishu;
    }

    if (normalized === 'lark' || normalized === 'larksuite' || normalized === 'open.larksuite.com') {
      return lark.Domain.Lark;
    }

    if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
      return domainValue;
    }

    return `https://${domainValue}`;
  }

  private getDomainBaseUrl(): string {
    if (typeof this.domain === 'string') {
      if (this.domain.startsWith('http://') || this.domain.startsWith('https://')) {
        return this.domain.replace(/\/$/, '');
      }
      return `https://${this.domain.replace(/\/$/, '')}`;
    }

    return this.domain === lark.Domain.Lark
      ? 'https://open.larksuite.com'
      : 'https://open.feishu.cn';
  }

  private getNestedString(target: unknown, path: string[]): string | undefined {
    let current: unknown = target;

    for (const key of path) {
      if (!current || typeof current !== 'object' || !(key in (current as Record<string, unknown>))) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[key];
    }

    return typeof current === 'string' ? current : undefined;
  }

  private mask(value: string): string {
    if (!value) return '';
    if (value.length <= 8) return `${value.slice(0, 2)}***${value.slice(-2)}`;
    return `${value.slice(0, 4)}***${value.slice(-4)}`;
  }
}

function cryptoRandomId(): string {
  return `msg-${Math.random().toString(16).slice(2)}-${Date.now()}`;
}
