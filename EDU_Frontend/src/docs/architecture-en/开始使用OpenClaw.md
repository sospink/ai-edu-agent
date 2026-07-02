# Using OpenClaw

OpenClaw is an independent project practice flow in Agent EDU Lab. It lets students observe a real Agent workflow from receiving a task, reasoning, executing tools, and delivering artifacts. It is not a sub-feature of Classic Lab and does not create a K8S Lab session through `/lab`.

## Entry Requirement

The project must have the `OpenClaw` tag. Project details detect this tag and route students to `/openclaw/*`.

## Recommended Entry

1. Open `/projects`.
2. Select a project tagged `OpenClaw`.
3. Enter the OpenClaw scenario from project details.
4. The page moves through idle / thinking / executing / completed phases.

Directly opening `/openclaw` should show guidance instead of reusing a shared default session.

## Screenshot Walkthrough

### Step 1: Open Projects

Click **Projects** in the top navigation to enter the project practice library.

![Projects navigation](https://p.ipic.vip/8mulwm.png)

### Step 2: Browse Project Cards

Use search and tags to find the OpenClaw project. OpenClaw routing is based on the `OpenClaw` project tag, not the title or slug.

![Project list](https://p.ipic.vip/puqiba.png)

![OpenClaw project card](https://p.ipic.vip/qf0zme.png)

### Step 3: Enter the OpenClaw Workspace

OpenClaw is an independent project scenario flow. It does not create a Classic Lab K8S session through `/lab`.

![OpenClaw workspace](https://p.ipic.vip/c0ztci.png)

### Step 4: Select a Scenario

In the idle phase, choose a work scenario and click **Start Work**.

![Scenario selection](https://p.ipic.vip/wy79gt.png)

### Step 5: Send or Improve the Prompt

The thinking phase shows the chat area and prompt enhancement panel.

![Thinking layout](https://p.ipic.vip/fnvpzt.png)

Agent replies are delivered through the OpenClaw Gateway / Feishu-linked channel and rendered as streaming Markdown.

![Agent reply](https://p.ipic.vip/60cu5f.png)

The prompt engine can optimize your instruction before sending it to the Agent.

![Prompt engine](https://p.ipic.vip/30owov.png)

### Step 6: Observe Execution

The executing phase shows event logs, tool calls, decisions, and current task progress.

![Execution timeline](https://p.ipic.vip/n3spxm.png)

Agent replies and detailed outputs can be expanded in the timeline.

![Execution reply collapsed](https://p.ipic.vip/0e6zga.png)

![Execution reply expanded](https://p.ipic.vip/qck2yl.png)

### Step 7: Review Artifacts

The completed phase shows final metrics, generated files, and the full execution timeline.

![Completed view](https://p.ipic.vip/8tizri.png)

![Artifact list](https://p.ipic.vip/xuglnm.png)

![Execution recap](https://p.ipic.vip/fvysdn.png)

## Session Rule

The Go backend `openclaw-view` domain derives controlled session keys from projects and units:

```text
project:<projectId>[:unit:<unitId>]
```

The frontend should not forge `agent:*` session keys.

## Four Phase Views

| Phase | Description |
| --- | --- |
| Idle | Waiting for a task or guiding student input |
| Thinking | Agent is analyzing and planning |
| Executing | Agent is calling tools, generating files, or executing operations |
| Completed | Shows final messages, artifacts, metrics, and delivery results |

## Backend APIs

OpenClaw pages mainly use:

- `GET /api/openclaw-view/:sessionId/phase`
- `GET /api/openclaw-view/:sessionId/thinking`
- `GET /api/openclaw-view/:sessionId/executing`
- `GET /api/openclaw-view/:sessionId/completed`
- `GET /api/openclaw-view/file/:messageId/:fileKey`
- `POST /api/openclaw-view/chat/send`

These APIs require authentication and authorization.

## Integration Health

Admin and backend health checks cover:

- OpenClaw Gateway URL and token.
- OpenClaw device identity.
- Feishu configuration.
- Gateway pairing state.

Common endpoints:

- `/api/integrations/openclaw/health`
- `/api/integrations/feishu/health`
- `/api/admin/integrations/health`

## Difference from Classic Lab

| Item | Classic Lab | OpenClaw |
| --- | --- | --- |
| Entry | `/lab` | `/openclaw/*` |
| Runtime | K8S Pod / Service | OpenClaw Gateway / Feishu |
| Resources | Lessons, normal projects, assignments | OpenClaw-tagged projects |
| Terminal | WebSocket + K8S exec | Agent events and artifact views |
| Quotas | Governed by M6 Classic Lab quotas | First version only includes health observation |
