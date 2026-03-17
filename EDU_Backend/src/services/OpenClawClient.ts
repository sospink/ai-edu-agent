import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import WebSocket from 'ws';
import nacl from 'tweetnacl';
import { logger } from '../utils/logger';

interface GatewayEventMessage {
  type: 'event';
  event: string;
  seq?: number;
  payload?: Record<string, unknown>;
}

interface GatewayResponseMessage {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: {
    message?: string;
  };
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
}

interface OpenClawDeviceIdentity {
  deviceId: string;
  publicKeyBase64: string;
  privateKeySeedBase64: string;
}

interface OpenClawConnectionContext {
  ws: WebSocket;
  pending: Map<string, PendingRequest>;
  connectNonce: string | null;
  connectSent: boolean;
  connected: boolean;
}

const DEFAULT_CONNECT_TIMEOUT_MS = 12000;
const DEFAULT_REQUEST_TIMEOUT_MS = 15000;
const DEFAULT_RETRY_TIMES = 1;
const DEFAULT_GATEWAY_URL = 'http://127.0.0.1:18789';
const DEFAULT_DEVICE_IDENTITY_PATH = path.join(process.cwd(), '.openclaw-device-identity.json');

export class OpenClawClient {
  private readonly gatewayUrl: string;
  private readonly gatewayToken: string;
  private readonly gatewayPassword: string;
  private readonly connectTimeoutMs: number;
  private readonly requestTimeoutMs: number;
  private readonly retryTimes: number;
  private readonly clientId: string;
  private readonly clientVersion: string;
  private readonly clientMode: string;
  private readonly role: string;
  private readonly scopes: string[];
  private readonly deviceIdentityPath: string;
  private readonly warningThrottleMap = new Map<string, number>();

  private deviceIdentity: OpenClawDeviceIdentity | null = null;

  constructor() {
    const localGateway = this.readLocalGatewayConfig();
    this.gatewayUrl = (process.env.OPENCLAW_GATEWAY_URL || localGateway.gatewayUrl || DEFAULT_GATEWAY_URL).trim();
    this.gatewayToken = (process.env.OPENCLAW_GATEWAY_TOKEN || localGateway.gatewayToken || '').trim();
    this.gatewayPassword = (process.env.OPENCLAW_GATEWAY_PASSWORD || localGateway.gatewayPassword || '').trim();
    this.connectTimeoutMs = Number(process.env.OPENCLAW_CONNECT_TIMEOUT_MS || DEFAULT_CONNECT_TIMEOUT_MS);
    this.requestTimeoutMs = Number(process.env.OPENCLAW_REQUEST_TIMEOUT_MS || DEFAULT_REQUEST_TIMEOUT_MS);
    this.retryTimes = Number(process.env.OPENCLAW_RETRY_TIMES || DEFAULT_RETRY_TIMES);
    this.clientId = (process.env.OPENCLAW_CLIENT_ID || 'gateway-client').trim();
    this.clientVersion = (process.env.OPENCLAW_CLIENT_VERSION || 'ai-edu-agent').trim();
    this.clientMode = (process.env.OPENCLAW_CLIENT_MODE || 'backend').trim();
    this.role = (process.env.OPENCLAW_CLIENT_ROLE || 'operator').trim();
    this.scopes = (process.env.OPENCLAW_CLIENT_SCOPES || 'operator.admin,operator.approvals,operator.pairing')
      .split(',')
      .map((scope) => scope.trim())
      .filter(Boolean);
    this.deviceIdentityPath = (process.env.OPENCLAW_DEVICE_IDENTITY_PATH || DEFAULT_DEVICE_IDENTITY_PATH).trim();
  }

  private readLocalGatewayConfig(): {
    gatewayUrl: string;
    gatewayToken: string;
    gatewayPassword: string;
  } {
    const empty = {
      gatewayUrl: '',
      gatewayToken: '',
      gatewayPassword: '',
    };

    try {
      const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
      if (!fs.existsSync(configPath)) {
        return empty;
      }

      const content = fs.readFileSync(configPath, 'utf8');
      const parsed = JSON.parse(content) as Record<string, unknown>;

      const token = this.getNestedString(parsed, ['gateway', 'auth', 'token']);
      const password = this.getNestedString(parsed, ['gateway', 'auth', 'password']);
      const remoteUrl = this.getNestedString(parsed, ['gateway', 'remote', 'url']);

      const bind = this.getNestedString(parsed, ['gateway', 'bind']);
      const portRaw = this.getNestedString(parsed, ['gateway', 'port']);
      const port = Number(portRaw);

      let localUrl = '';
      if (bind && Number.isFinite(port) && port > 0) {
        const host = bind === '0.0.0.0' ? '127.0.0.1' : bind;
        localUrl = `http://${host}:${port}`;
      }

      return {
        gatewayUrl: remoteUrl || localUrl,
        gatewayToken: token,
        gatewayPassword: password,
      };
    } catch (error) {
      logger.warn(`[OpenClawClient] failed to read local gateway config: ${String(error)}`);
      return empty;
    }
  }

  isConfigured(): boolean {
    return Boolean(this.gatewayUrl);
  }

  async getHealth(): Promise<Record<string, unknown>> {
    if (!this.isConfigured()) {
      throw new Error('OPENCLAW_GATEWAY_URL 未配置');
    }

    return this.withConnection(async (ctx) => {
      const status = await this.requestRaw<Record<string, unknown>>(ctx, 'status', {});
      const sessions = await this.requestRaw<Record<string, unknown>>(ctx, 'sessions.list', {
        includeGlobal: true,
        includeUnknown: true,
        limit: 5,
      });

      return {
        status,
        sessionsCount: Array.isArray((sessions as { sessions?: unknown[] }).sessions)
          ? (sessions as { sessions?: unknown[] }).sessions?.length || 0
          : 0,
      };
    });
  }

  async listSessions(limit = 120): Promise<Record<string, unknown>> {
    return this.invoke<Record<string, unknown>>('sessions.list', {
      includeGlobal: true,
      includeUnknown: true,
      limit,
    });
  }

  async getChatHistory(sessionKey: string, limit = 200): Promise<Record<string, unknown>> {
    return this.invoke<Record<string, unknown>>('chat.history', {
      sessionKey,
      limit,
    });
  }

  async getSkillsStatus(): Promise<Record<string, unknown>> {
    return this.invoke<Record<string, unknown>>('skills.status', {});
  }

  /**
   * 通过 OpenClaw 网关 WebSocket RPC 发送用户指令消息。
   * 网关会将其作为用户输入处理，Bot 会在飞书群里回复。
   */
  async sendChatMessage(sessionKey: string, text: string): Promise<Record<string, unknown>> {
    return this.invoke<Record<string, unknown>>('chat.send', {
      sessionKey,
      message: text.trim(),
      deliver: false,
      idempotencyKey: crypto.randomUUID(),
    });
  }

  async tailLogs(options?: {
    cursor?: number;
    limit?: number;
    maxBytes?: number;
  }): Promise<Record<string, unknown>> {
    const limit = options?.limit ?? 200;
    const maxBytes = options?.maxBytes ?? 250000;
    const cursor = options?.cursor;

    const first = await this.invoke<Record<string, unknown>>('logs.tail', {
      cursor,
      limit,
      maxBytes,
    });

    const shouldCompensate = Boolean(cursor !== undefined && (first as { reset?: boolean }).reset);
    if (!shouldCompensate) {
      return first;
    }

    return this.invoke<Record<string, unknown>>('logs.tail', {
      limit,
      maxBytes,
    });
  }

  private async invoke<T>(method: string, params: Record<string, unknown>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.retryTimes; attempt += 1) {
      try {
        return await this.withConnection(async (ctx) => this.requestRaw<T>(ctx, method, params));
      } catch (error) {
        lastError = error;
        const normalizedError = this.normalizeError(error);
        const message = normalizedError.message.toLowerCase();
        const isPairingRequired = message.includes('pairing required');
        const isLastAttempt = attempt >= this.retryTimes;

        if (isPairingRequired && !isLastAttempt) {
          continue;
        }

        if (isPairingRequired) {
          this.logThrottledWarning(
            `pairing-required:${method}`,
            `[OpenClawClient] request failed method=${method} attempt=${attempt + 1}: ${normalizedError.message}`,
          );
          continue;
        }

        logger.warn(`[OpenClawClient] request failed method=${method} attempt=${attempt + 1}: ${normalizedError.message}`);
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private async withConnection<T>(handler: (ctx: OpenClawConnectionContext) => Promise<T>): Promise<T> {
    if (!this.gatewayUrl) {
      throw new Error('OPENCLAW_GATEWAY_URL 为空');
    }

    const wsUrl = this.resolveWebSocketUrl(this.gatewayUrl);
    const ws = new WebSocket(wsUrl);
    const ctx: OpenClawConnectionContext = {
      ws,
      pending: new Map<string, PendingRequest>(),
      connectNonce: null,
      connectSent: false,
      connected: false,
    };

    await this.awaitConnection(ctx);

    try {
      return await handler(ctx);
    } finally {
      this.cleanupConnection(ctx);
    }
  }

  private async awaitConnection(ctx: OpenClawConnectionContext): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let fallbackTimer: NodeJS.Timeout | null = null;

      const settleReject = (error: Error) => {
        if (settled) return;
        settled = true;
        if (fallbackTimer) clearTimeout(fallbackTimer);
        reject(error);
      };

      const settleResolve = () => {
        if (settled) return;
        settled = true;
        if (fallbackTimer) clearTimeout(fallbackTimer);
        resolve();
      };

      const timeout = setTimeout(() => {
        settleReject(new Error('OpenClaw 网关连接超时'));
      }, this.connectTimeoutMs);

      const finishAndCleanup = (fn: () => void) => {
        clearTimeout(timeout);
        fn();
      };

      ctx.ws.on('open', () => {
        fallbackTimer = setTimeout(() => {
          this.sendConnect(ctx).then(() => finishAndCleanup(settleResolve)).catch((error) => {
            finishAndCleanup(() => settleReject(this.normalizeError(error)));
          });
        }, 600);
      });

      ctx.ws.on('message', (data) => {
        const message = this.parseGatewayMessage(data);
        if (!message) return;

        if (message.type === 'event') {
          const eventMessage = message as GatewayEventMessage;
          if (eventMessage.event === 'connect.challenge') {
            const nonce = eventMessage.payload && typeof eventMessage.payload.nonce === 'string'
              ? eventMessage.payload.nonce
              : null;
            ctx.connectNonce = nonce;
            this.sendConnect(ctx)
              .then(() => finishAndCleanup(settleResolve))
              .catch((error) => finishAndCleanup(() => settleReject(this.normalizeError(error))));
            return;
          }
          return;
        }

        if (message.type === 'res') {
          const responseMessage = message as GatewayResponseMessage;
          const pending = ctx.pending.get(responseMessage.id);
          if (!pending) return;

          clearTimeout(pending.timer);
          ctx.pending.delete(responseMessage.id);

          if (responseMessage.ok) {
            pending.resolve(responseMessage.payload);
            return;
          }

          pending.reject(new Error(responseMessage.error?.message || 'OpenClaw request failed'));
        }
      });

      ctx.ws.on('close', (code, reasonBuffer) => {
        const reason = String(reasonBuffer || '');
        this.rejectAllPending(ctx, new Error(`OpenClaw gateway closed (${code}): ${reason}`));
        if (!ctx.connected) {
          finishAndCleanup(() => settleReject(new Error(`OpenClaw 连接被关闭 (${code}): ${reason}`)));
        }
      });

      ctx.ws.on('error', (error) => {
        if (!ctx.connected) {
          finishAndCleanup(() => settleReject(this.normalizeError(error)));
        }
      });
    });
  }

  private parseGatewayMessage(data: WebSocket.RawData): GatewayEventMessage | GatewayResponseMessage | null {
    try {
      const text = typeof data === 'string' ? data : data.toString();
      const parsed = JSON.parse(text) as GatewayEventMessage | GatewayResponseMessage;
      if (parsed && (parsed.type === 'event' || parsed.type === 'res')) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  private async sendConnect(ctx: OpenClawConnectionContext): Promise<void> {
    if (ctx.connectSent) return;

    ctx.connectSent = true;

    const device = this.getOrCreateDeviceIdentity();
    const signedAt = Date.now();
    const token = this.gatewayToken || null;

    const canonicalPayload = this.buildCanonicalAuthPayload({
      deviceId: device.deviceId,
      clientId: this.clientId,
      clientMode: this.clientMode,
      role: this.role,
      scopes: this.scopes,
      signedAtMs: signedAt,
      token,
      nonce: ctx.connectNonce || undefined,
    });

    const signature = this.signPayload(device.privateKeySeedBase64, canonicalPayload);

    const params: Record<string, unknown> = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: this.clientId,
        version: this.clientVersion,
        platform: process.platform,
        mode: this.clientMode,
        instanceId: crypto.randomUUID(),
      },
      role: this.role,
      scopes: this.scopes,
      device: {
        id: device.deviceId,
        publicKey: device.publicKeyBase64,
        signature,
        signedAt,
        nonce: ctx.connectNonce || undefined,
      },
      caps: [],
      auth: this.gatewayToken || this.gatewayPassword
        ? {
            token: this.gatewayToken || undefined,
            password: this.gatewayPassword || undefined,
          }
        : undefined,
      userAgent: 'ai-edu-agent-backend',
      locale: 'zh-CN',
    };

    await this.requestRaw(ctx, 'connect', params, this.connectTimeoutMs);
    ctx.connected = true;
  }

  private requestRaw<T>(
    ctx: OpenClawConnectionContext,
    method: string,
    params: Record<string, unknown>,
    timeoutMs = this.requestTimeoutMs,
  ): Promise<T> {
    if (ctx.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('OpenClaw gateway not connected'));
    }

    const id = crypto.randomUUID();

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        ctx.pending.delete(id);
        reject(new Error(`OpenClaw request timeout: ${method}`));
      }, timeoutMs);

      ctx.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });

      ctx.ws.send(JSON.stringify({
        type: 'req',
        id,
        method,
        params,
      }));
    });
  }

  private rejectAllPending(ctx: OpenClawConnectionContext, error: Error): void {
    for (const [requestId, pending] of ctx.pending.entries()) {
      clearTimeout(pending.timer);
      pending.reject(error);
      ctx.pending.delete(requestId);
    }
  }

  private cleanupConnection(ctx: OpenClawConnectionContext): void {
    this.rejectAllPending(ctx, new Error('OpenClaw request cancelled'));
    try {
      if (ctx.ws.readyState === WebSocket.OPEN || ctx.ws.readyState === WebSocket.CONNECTING) {
        ctx.ws.close();
      }
    } catch {
      // ignore cleanup errors
    }
  }

  private resolveWebSocketUrl(rawUrl: string): string {
    const normalized = rawUrl.trim();

    if (!normalized) {
      throw new Error('OPENCLAW_GATEWAY_URL 未配置');
    }

    if (normalized.startsWith('ws://') || normalized.startsWith('wss://')) {
      return normalized;
    }

    if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
      const parsed = new URL(normalized);
      parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
      return parsed.toString();
    }

    return `ws://${normalized}`;
  }

  private getOrCreateDeviceIdentity(): OpenClawDeviceIdentity {
    if (this.deviceIdentity) {
      return this.deviceIdentity;
    }

    const persisted = this.readDeviceIdentityFromDisk();
    if (persisted) {
      this.deviceIdentity = persisted;
      return persisted;
    }

    const seed = crypto.randomBytes(32);
    const keyPair = nacl.sign.keyPair.fromSeed(seed);
    const deviceId = crypto.createHash('sha256').update(Buffer.from(keyPair.publicKey)).digest('hex');

    const createdIdentity: OpenClawDeviceIdentity = {
      deviceId,
      publicKeyBase64: Buffer.from(keyPair.publicKey).toString('base64'),
      privateKeySeedBase64: seed.toString('base64'),
    };
    this.deviceIdentity = createdIdentity;
    this.writeDeviceIdentityToDisk(createdIdentity);

    return createdIdentity;
  }

  private signPayload(privateSeedBase64: string, plainText: string): string {
    const seed = Buffer.from(privateSeedBase64, 'base64');
    const keyPair = nacl.sign.keyPair.fromSeed(new Uint8Array(seed));
    const signature = nacl.sign.detached(Buffer.from(plainText, 'utf8'), keyPair.secretKey);
    return Buffer.from(signature).toString('base64');
  }

  private buildCanonicalAuthPayload(payload: {
    version?: 'v1' | 'v2';
    deviceId: string;
    clientId: string;
    clientMode: string;
    role: string;
    scopes: string[];
    signedAtMs: number;
    token: string | null;
    nonce?: string;
  }): string {
    const version = payload.version ?? (payload.nonce ? 'v2' : 'v1');
    const scopes = payload.scopes.join(',');
    const token = payload.token || '';

    const segments = [
      version,
      payload.deviceId,
      payload.clientId,
      payload.clientMode,
      payload.role,
      scopes,
      String(payload.signedAtMs),
      token,
    ];

    if (version === 'v2') {
      segments.push(payload.nonce || '');
    }

    return segments.join('|');
  }

  private normalizeError(error: unknown): Error {
    if (error instanceof Error) return error;
    return new Error(String(error));
  }

  private getNestedString(obj: Record<string, unknown>, pathList: string[]): string {
    let current: unknown = obj;
    for (const key of pathList) {
      if (!current || typeof current !== 'object') {
        return '';
      }
      current = (current as Record<string, unknown>)[key];
    }

    return typeof current === 'string' ? current.trim() : '';
  }

  private readDeviceIdentityFromDisk(): OpenClawDeviceIdentity | null {
    try {
      if (!this.deviceIdentityPath || !fs.existsSync(this.deviceIdentityPath)) {
        return null;
      }

      const content = fs.readFileSync(this.deviceIdentityPath, 'utf8');
      const parsed = JSON.parse(content) as Record<string, unknown>;
      const deviceId = typeof parsed.deviceId === 'string' ? parsed.deviceId.trim() : '';
      const publicKeyBase64 = typeof parsed.publicKeyBase64 === 'string' ? parsed.publicKeyBase64.trim() : '';
      const privateKeySeedBase64 = typeof parsed.privateKeySeedBase64 === 'string' ? parsed.privateKeySeedBase64.trim() : '';

      if (!deviceId || !publicKeyBase64 || !privateKeySeedBase64) {
        return null;
      }

      const seed = Buffer.from(privateKeySeedBase64, 'base64');
      if (seed.length !== 32) {
        return null;
      }

      return {
        deviceId,
        publicKeyBase64,
        privateKeySeedBase64,
      };
    } catch (error) {
      logger.warn(`[OpenClawClient] failed to read device identity file: ${String(error)}`);
      return null;
    }
  }

  private writeDeviceIdentityToDisk(identity: OpenClawDeviceIdentity): void {
    try {
      if (!this.deviceIdentityPath) {
        return;
      }

      const dir = path.dirname(this.deviceIdentityPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.deviceIdentityPath, JSON.stringify(identity, null, 2), 'utf8');
    } catch (error) {
      logger.warn(`[OpenClawClient] failed to persist device identity file: ${String(error)}`);
    }
  }

  private logThrottledWarning(key: string, message: string, intervalMs = 60000): void {
    const now = Date.now();
    const lastLoggedAt = this.warningThrottleMap.get(key) || 0;
    if (now - lastLoggedAt < intervalMs) {
      return;
    }

    this.warningThrottleMap.set(key, now);
    logger.warn(message);
  }
}
