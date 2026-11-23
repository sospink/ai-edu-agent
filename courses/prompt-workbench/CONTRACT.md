# 提示词工作台实施契约

一门双语课程、两个小节：01 理论资料阅读；02 完整提示词工作台实训（含分步 Agent 手册）。不沿用截图布局。业务为校园云服务报障结构化，默认中文并提供英文切换。

实施时长：理论45分钟、实训105分钟。当前平台默认Lab120分钟，预留15分钟导出与提交；实际以会话倒计时为准。课时枚举：理论TEXT=4，标准实训LAB=1。

案例前端在 frontend/（React TypeScript Vite），课程后端在 backend/（FastAPI）。主服务端口 8000，生产提供 frontend/dist；前端使用相对 API URL `./api/...` 以兼容平台 Lab 子路径代理，无 BrowserRouter。学生项目路径 /workspace/prompt-workbench。

所有课程 API 使用普通 JSON（不是平台 success/data 包装）；失败为 HTTP 非 2xx 和 {"detail":"message"}。

## API

- GET api/health -> {status:"ok",version:"1.0.0"}
- GET api/config -> {configured:boolean,model:string,capabilities:{temperature:false,topP:false,maxTokens:true},maxOutputTokens:4096}
- GET api/samples -> [{id,title,input,description}]，至少三个脱敏云报障样例。
- GET api/drafts -> [{id,name,instruction,context,input,outputRequirements,maxTokens,updatedAt}]
- POST api/drafts -> 保存同结构草稿（id 可选），返回保存对象。
- DELETE api/drafts/{id} -> {deleted:true}
- POST api/run -> 请求 {instruction,context,input,outputRequirements,maxTokens:4096,draftId?:string}；返回完整 Experiment。
- GET api/experiments -> Experiment[]（最新优先），最多返回 100 条。
- GET api/experiments/{id} -> Experiment。
- DELETE api/experiments/{id} -> {deleted:true}
- POST api/validate -> {text:string,input:string}；返回 Validation。
- GET api/export -> ZIP 下载（源码白名单、草稿、实验、报告、人工复核说明；不含凭证、依赖、运行配置）。

Experiment={id:string,createdAt:string,source:"live",requestId:string,model:string,latencyMs:number,prompt:{instruction,context,input,outputRequirements,maxTokens},response:string,validation:Validation,usage:{prompt_tokens?:number,completion_tokens?:number,total_tokens?:number}|null}
Validation={valid:boolean,parsed:object|null,issues:[{path:string,message:string}],checks:[{name:string,passed:boolean}]}
输出 Schema：service:string,symptom:string,evidence:string[],missing_fields:string[]，禁止多余字段。evidence 每项必须是原始输入的直接引用；service/symptom 不强行字符串相等，检查不能为空且由人工复核语义。只做可验证的事实证据检查，不宣称证明所有事实正确。

## 后端模型连接

读取 EDU_MODEL_BASE_URL（例如 http://42.240.132.79:8080/api/course-model/v1），EDU_MODEL_TOKEN（仅当前 Lab 的受限短时凭证）、EDU_MODEL_NAME（模型别名 course-model）。不能保存或回传这些变量。GET /models 可获取实际 model 名称；POST /chat/completions 兼容 OpenAI，请求超时 90 秒，保留真实失败，不生成假响应。gateway 返回 X-Request-ID，用作真实请求来源。浏览器取消应尽可能取消上游调用，不能写成功记录。

## 工作台交互

顶部运行/保存/导出、左侧样例/草稿/历史、中间提示词编辑、右侧结果/JSON/校验，独立双记录对照视图；参数收进设置抽屉。具备 loading/empty/error/disabled/成功反馈、删除确认、取消请求、编辑状态保护、中英文与窄屏。使用 lucide 图标。没有密钥输入框，不重复平台的 Desktop/Terminal 导航。

## 项目边界

学生可以编辑本项目的前后端、Schema、测试和复核说明。平台鉴权、供应商凭证与其他学生的工作区不属于课程项目。修改后运行测试；模型可用性与真实实验结果应独立验证，不以离线测试替代。
