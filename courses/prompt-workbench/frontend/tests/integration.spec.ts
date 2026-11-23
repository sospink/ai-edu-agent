import { expect, test } from "@playwright/test";

test("真实 FastAPI：样例、草稿生命周期、证据校验与导出", async ({
  page,
  request,
}) => {
  test.skip(process.env.LIVE_BACKEND !== "1", "需要本地 8000 端口的课程后端");
  const health = await request.get("/api/health");
  expect((await health.json()).status).toBe("ok");
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "刷新", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: /校园云盘上传失败/ }).click();
  const name = `前端集成验证-${Date.now()}`;
  await page.getByLabel("草稿名称").fill(name);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("草稿已保存")).toBeVisible();
  await page
    .getByLabel("任务指令", { exact: true })
    .fill("按原文抽取，不推断原因。");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("button", { name: "新建草稿", exact: true }).click();
  await page
    .getByRole("button", { name: new RegExp(name) })
    .filter({ has: page.locator("strong") })
    .click();
  await expect(page.getByLabel("任务指令", { exact: true })).toHaveValue(
    "按原文抽取，不推断原因。",
  );
  await page.getByRole("button", { name: "切换为英文", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Campus cloud drive upload failure/ }),
  ).toBeVisible();
  await expect(page.getByLabel("Instruction", { exact: true })).toHaveValue(
    "按原文抽取，不推断原因。",
  );
  await expect(page.getByLabel("Draft name")).toHaveValue(name);
  await page
    .getByRole("button", { name: "Switch to Chinese", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /校园云盘上传失败/ }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "刷新", exact: true }),
  ).toBeEnabled();
  const validation = await request.post("/api/validate", {
    data: {
      input: "校园云盘报错503。",
      text: JSON.stringify({
        service: "校园云盘",
        symptom: "报错",
        evidence: ["503"],
        missing_fields: ["时间"],
      }),
    },
  });
  expect((await validation.json()).valid).toBe(true);
  const invalid = await request.post("/api/validate", {
    data: {
      input: "校园云盘报错503。",
      text: JSON.stringify({
        service: "校园云盘",
        symptom: "报错",
        evidence: ["服务器磁盘已满"],
        missing_fields: [],
      }),
    },
  });
  expect((await invalid.json()).valid).toBe(false);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出", exact: true }).click();
  const exported = await download;
  expect(exported.suggestedFilename()).toBe("prompt-workbench.zip");
  await exported.saveAs(".artifacts/integration-export.zip");
  await page.getByRole("button", { name: `删除草稿 ${name}` }).click();
  await page.getByRole("button", { name: "确认", exact: true }).click();
  await expect(
    page.getByRole("button", { name: `删除草稿 ${name}` }),
  ).toHaveCount(0);
});
