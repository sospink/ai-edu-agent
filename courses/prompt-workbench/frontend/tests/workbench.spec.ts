import { expect, test, type Page } from "@playwright/test";
import type { Draft, Experiment } from "../src/types";
import { newPrompt } from "../src/types";

// 仅测试使用契约夹具；应用运行时不包含模拟响应或回退模型。
const input = "校园云盘无法上传PDF，页面显示503。";
const valid = {
  valid: true,
  parsed: {
    service: "校园云盘",
    symptom: "上传失败",
    evidence: ["页面显示503"],
    missing_fields: ["时间"],
  },
  issues: [],
  checks: [{ name: "evidence 引用原文", passed: true }],
};
function record(id: string): Experiment {
  return {
    id,
    createdAt: "2026-11-24T10:00:00Z",
    source: "live",
    requestId: `test-request-${id}`,
    model: "course-model",
    latencyMs: 650,
    prompt: { ...newPrompt(), input },
    response: JSON.stringify(valid.parsed),
    validation: valid,
    usage: { total_tokens: 120 },
  };
}

async function setup(
  page: Page,
  options: { configured?: boolean; error?: boolean; slowRun?: boolean } = {},
) {
  let drafts: Draft[] = [];
  let experiments = [record("a"), record("b")];
  const calls: {
    path: string;
    method: string;
    body: Record<string, unknown> | null;
    headers: Record<string, string>;
  }[] = [];
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.split("/api/")[1];
    const method = request.method();
    const body = request.postDataJSON();
    calls.push({ path, method, body, headers: request.headers() });
    const send = (value: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(value),
      });
    if (options.error) return send({ detail: "实验访问未授权" }, 401);
    if (path === "health") return send({ status: "ok", version: "1.0.0" });
    if (path === "config")
      return send({
        configured: options.configured ?? true,
        model: "course-model",
        capabilities: { temperature: false, topP: false, maxTokens: true },
        maxOutputTokens: 4096,
      });
    if (path === "samples")
      return send([
        {
          id: "sample",
          title:
            request.headers()["x-locale"] === "en-US"
              ? "Campus cloud drive upload failure"
              : "校园云盘上传失败",
          input,
          description: "保留原始引用",
        },
      ]);
    if (path === "drafts" && method === "GET") return send(drafts);
    if (path === "drafts" && method === "POST") {
      const draft = {
        ...body,
        id: body.id || "draft-1",
        updatedAt: new Date().toISOString(),
      } as Draft;
      drafts = [draft, ...drafts.filter((d) => d.id !== draft.id)];
      return send(draft);
    }
    if (path.startsWith("drafts/") && method === "DELETE") {
      drafts = [];
      return send({ deleted: true });
    }
    if (path === "experiments") return send(experiments);
    if (path.startsWith("experiments/")) {
      const id = path.split("/")[1];
      if (method === "DELETE") {
        experiments = experiments.filter((e) => e.id !== id);
        return send({ deleted: true });
      }
      return send(experiments.find((e) => e.id === id));
    }
    if (path === "run") {
      if (options.slowRun) {
        await new Promise((resolve) => setTimeout(resolve, 1800));
        return route.abort().catch(() => {});
      }
      const next = { ...record("new-run"), prompt: body };
      experiments.unshift(next as Experiment);
      return send(next);
    }
    if (path === "validate")
      return send(
        body.text === "{bad"
          ? {
              valid: false,
              parsed: null,
              issues: [{ path: "$", message: "JSON 格式错误" }],
              checks: [{ name: "JSON", passed: false }],
            }
          : valid,
      );
    if (path === "export")
      return route.fulfill({
        contentType: "application/zip",
        body: Buffer.from("PK-test-fixture"),
      });
    return send({ detail: "未找到" }, 404);
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "刷新", exact: true }),
  ).toBeEnabled();
  return calls;
}

test("草稿增改删、未保存保护、运行、校验与导出", async ({ page }) => {
  const calls = await setup(page);
  await page.getByRole("button", { name: /校园云盘上传失败/ }).click();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("草稿已保存")).toBeVisible();
  await page.getByLabel("草稿名称").fill("修订草稿");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  expect(
    calls.filter((c) => c.path === "drafts" && c.method === "POST").at(-1)?.body
      ?.id,
  ).toBe("draft-1");
  await page.getByLabel("任务指令").fill("修订的任务");
  await page.getByRole("button", { name: "新建草稿", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("尚未保存");
  await page.getByRole("button", { name: "取消", exact: true }).last().click();
  await expect(page.getByLabel("任务指令")).toHaveValue("修订的任务");
  await page.getByRole("button", { name: "运行", exact: true }).click();
  await expect(page.getByLabel("响应原文")).toHaveValue(
    JSON.stringify(valid.parsed),
  );
  await page.getByLabel("响应原文").fill("{bad");
  await page.getByRole("button", { name: "校验 JSON", exact: true }).click();
  await expect(page.getByText("JSON 格式错误")).toBeVisible();
  expect(calls.find((c) => c.path === "validate")?.body?.input).toBe(input);
  await page.getByRole("button", { name: "导出", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "确认", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("prompt-workbench.zip");
  await page.getByRole("button", { name: "删除草稿 修订草稿" }).click();
  await page.getByRole("button", { name: "确认", exact: true }).click();
  await expect(page.getByText("暂无匹配草稿")).toBeVisible();
  for (const call of calls) {
    expect(call.headers["x-locale"]).toBe("zh-CN");
    expect(call.headers["accept-language"]).toBe("zh-CN");
  }
});

test("语言切换仅刷新本地化资料，保留编辑和选择，导出携带新语言", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("i18nextLng", "en"));
  const calls = await setup(page);
  expect(calls.every((call) => call.headers["x-locale"] === "zh-CN")).toBe(
    true,
  );
  await page.getByRole("button", { name: /校园云盘上传失败/ }).click();
  await page.getByLabel("任务指令", { exact: true }).fill("保留我的未保存指令");
  await page.getByLabel("草稿名称").fill("未保存实验");
  await page.getByLabel("选择对比 a", { exact: true }).check();
  await page
    .getByRole("button", { name: /校园云盘无法上传PDF/ })
    .first()
    .click();
  await page.getByLabel("响应原文", { exact: true }).fill("{local edit");
  const start = calls.length;
  await page.getByRole("button", { name: "切换为英文", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Campus cloud drive upload failure/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Refresh", exact: true }),
  ).toBeEnabled();
  expect(
    calls
      .slice(start)
      .map((call) => call.path)
      .sort(),
  ).toEqual(["config", "samples"]);
  await expect(page.getByLabel("Draft name")).toHaveValue("未保存实验");
  await expect(page.getByLabel("Instruction", { exact: true })).toHaveValue(
    "保留我的未保存指令",
  );
  await expect(page.getByLabel("Incident input", { exact: true })).toHaveValue(
    input,
  );
  await expect(page.getByLabel("Raw response")).toHaveValue(
    "{local edit",
  );
  await expect(
    page.getByLabel("Select for comparison a", { exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await download;
  for (const call of calls.slice(start)) {
    expect(call.headers["x-locale"]).toBe("en-US");
    expect(call.headers["accept-language"]).toBe("en-US");
  }
  expect(
    await page.evaluate(() => localStorage.getItem("workbench-language")),
  ).toBe("en");
  const reloadStart = calls.length;
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Refresh", exact: true }),
  ).toBeEnabled();
  expect(
    calls
      .slice(reloadStart)
      .every((call) => call.headers["x-locale"] === "en-US"),
  ).toBe(true);
});

test("快速切换丢弃旧语言响应，本地化失败可刷新重试", async ({ page }) => {
  await setup(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/samples", async (route) => {
    if (route.request().headers()["x-locale"] !== "en-US")
      return route.fallback();
    await pending;
    await route
      .fulfill({
        json: [
          {
            id: "old",
            title: "Obsolete English sample",
            input,
            description: "",
          },
        ],
      })
      .catch(() => {});
  });
  const englishRequest = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/samples") &&
      request.headers()["x-locale"] === "en-US",
  );
  await page.getByRole("button", { name: "切换为英文", exact: true }).click();
  await englishRequest;
  await page
    .getByRole("button", { name: "Switch to Chinese", exact: true })
    .click();
  release();
  await expect(
    page.getByRole("button", { name: "刷新", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: /校园云盘上传失败/ }),
  ).toBeVisible();
  await expect(page.getByText("Obsolete English sample")).toHaveCount(0);
  await page.route("**/api/config", (route) =>
    route.fulfill({
      status: 503,
      json: { detail: "Configuration unavailable" },
    }),
  );
  await page.getByRole("button", { name: "切换为英文", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Unable to refresh localized data",
  );
  await expect(
    page.getByRole("button", { name: "Refresh", exact: true }),
  ).toBeEnabled();
  await page.unroute("**/api/config");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Refresh", exact: true }),
  ).toBeEnabled();
  await expect(page.getByText("Unable to load workspace")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("历史详情、双记录对照、删除及搜索", async ({ page }) => {
  await setup(page);
  await page.getByLabel("选择对比 a", { exact: true }).check();
  await page.getByLabel("选择对比 b", { exact: true }).check();
  await page.getByRole("button", { name: "对比 2/2" }).click();
  await expect(page.getByRole("dialog")).toContainText("test-request-a");
  await expect(page.getByRole("dialog")).toContainText("test-request-b");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: /校园云盘无法上传PDF/ })
    .first()
    .click();
  await expect(
    page.getByText("Request · test-request-a", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "删除记录 a", exact: true }).click();
  await page.getByRole("button", { name: "确认", exact: true }).click();
  await expect(page.getByLabel("选择对比 a", { exact: true })).toHaveCount(0);
  await expect(page.getByText("等待第一次实验")).toBeVisible();
  await page.getByLabel("搜索资料").fill("没有这样的记录");
  await expect(page.getByText("暂无匹配运行记录")).toBeVisible();
});

test("取消中止请求且不显示成功记录", async ({ page }) => {
  await setup(page, { slowRun: true });
  await page.getByRole("button", { name: /校园云盘上传失败/ }).click();
  await page.getByRole("button", { name: "运行", exact: true }).click();
  await expect(page.getByText("正在运行", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByText("请求已取消")).toBeVisible();
  await expect(page.getByLabel("选择对比 new-run")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "运行", exact: true }),
  ).toBeEnabled();
});

test("参数边界、语言切换和移动端无横向溢出", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.getByRole("button", { name: "参数设置", exact: true }).click();
  await page.getByLabel("最大输出 Token").fill("5000");
  await expect(
    page.getByRole("button", { name: "完成", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("最大输出 Token").fill("512");
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await page.getByRole("button", { name: "切换为英文", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Prompt Workbench" }),
  ).toBeVisible();
  await expect(page.getByLabel("Draft name")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: ".artifacts/mobile.png", fullPage: true });
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("未配置与未授权状态不会提供可运行假入口", async ({ page }) => {
  await setup(page, { configured: false });
  await page.getByRole("button", { name: /校园云盘上传失败/ }).click();
  await expect(
    page.getByRole("button", { name: "运行", exact: true }),
  ).toBeDisabled();
  await page.unroute("**/api/**");
  await setup(page, { error: true });
  await expect(page.getByRole("alert")).toContainText("未授权");
  await expect(page.getByRole("button", { name: "重试连接" })).toBeEnabled();
});

test("嵌套 Lab 路径保留相对 API，桌面布局无溢出", async ({ page }) => {
  const calls = await setup(page);
  await page.goto("/lab/session/");
  await expect(
    page.getByRole("button", { name: /校园云盘上传失败/ }),
  ).toBeVisible();
  const requested = page.waitForRequest("**/lab/session/api/run");
  await page.getByRole("button", { name: /校园云盘上传失败/ }).click();
  await page.getByRole("button", { name: "运行", exact: true }).click();
  await requested;
  await expect(page.getByLabel("响应原文")).toBeVisible();
  expect(calls.some((c) => c.path === "run")).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: ".artifacts/desktop.png", fullPage: true });
});

test("运行失败保留当前编辑并提供真实错误", async ({ page }) => {
  await setup(page);
  await page.route("**/api/run", (route) =>
    route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ detail: "模型上游暂不可用" }),
    }),
  );
  await page.getByRole("button", { name: /校园云盘上传失败/ }).click();
  await page.getByRole("button", { name: "运行", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("模型上游暂不可用");
  await expect(page.getByLabel("原始报障")).toHaveValue(input);
  await expect(page.getByLabel("响应原文")).toHaveCount(0);
});
