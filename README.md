# 考勤汇总仪表盘

把每月考勤 Excel 导入 Supabase，在浏览器里生成跨月考勤趋势。前端部署在 GitHub Pages，数据只对管理员账号开放。

## 功能

- **月度导入**：拖入一个或多个月度考勤表，浏览器本地解析后原子写入 Supabase；同一月份重复导入会覆盖旧数据。
- **五组趋势**：
  - 迟到次数（迟到 + 严重迟到）
  - 缺卡（缺卡次数、补卡人数、考勤异常天数）
  - 假期分类（年假、调休、病假、事假、丧假、育儿假）
  - 加班时长（含 3 个月移动平均）
  - 出勤率（实际打卡天数 / 应出勤天数）
- **筛选与个人视图**：按部门筛选、按姓名搜索；点击员工可查看个人逐月趋势。
- **月度汇总表**：全部指标一屏查看，支持导出 CSV。
- **数据管理**：查看已导入月份、来源文件、导入时间，按月份删除。
- **深浅色主题**、响应式布局与键盘可访问的弹窗。

## 统计口径

| 指标 | 口径 |
|---|---|
| 应出勤天数 | 明细表中「班次」非空且不包含「休息」的日期数 |
| 实际打卡天数 | 应出勤日期中，任一打卡/入会/退会/参会时长字段非空的日期数 |
| 出勤率 | `实际打卡天数 / 应出勤天数`，分母为 0 时显示「—」 |
| 缺卡次数 | 「汇总」表缺卡列之和 |
| 补卡人数 | 「上级邮件/证明」以 `Y` 开头的员工人数 |
| 考勤异常 | 「汇总」表考勤异常（天）列之和 |
| 假期 | 「汇总」表中「加班」之后的第一次出现的假期列，后续余额区忽略 |

说明：

- 出勤率严格按实际打卡，不把请假算作出勤。
- 1、2 月按部门分表，3 月起按「有年假 / 无年假」分表，6 月起增加线上远程小表；解析器按表头动态识别，不依赖固定列号。
- 姓名会经 opencc 繁转简并应用别名（如 `Yvonne Lai` → `赖淑贤`）；部门会按跨月改名归组（见 `src/lib/normalize.ts`）。

## 技术架构

```
Vite + React 19 + TypeScript + ECharts
        │  登录态 / 查询 / RPC
        ▼
Supabase Postgres + Auth + RLS
        ▲
SheetJS 在浏览器解析 xlsx（Node 校验脚本共用同一解析器）
```

- 图表：ECharts 6（按需注册组件）
- Excel：SheetJS `xlsx`
- 数据表：`attendance_periods`、`attendance_records`、`app_admins`
- 写入只通过 security definer RPC：`import_attendance`、`delete_attendance_period`
- 读取由 RLS + `is_admin()` 限制为管理员

## 本地开发

```bash
npm install
cp .env.example .env.local   # 填入 Supabase URL 与 anon key
npm run dev
```

本地页面需要可用的 Supabase 项目和已登记的管理员账号；未配置时会显示配置说明页。

## Supabase 初始化

1. 创建项目（建议 `ap-southeast-1`），记录 project ref、数据库密码。
2. 登录并关联：

   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```

3. 复制初始化配置并填写 **service_role** 与管理员邮箱、强密码：

   ```bash
   cp .env.setup.example .env.setup
   ```

4. 创建管理员并登记到 `app_admins`：

   ```bash
   npm run bootstrap:admin
   ```

5. 在 Supabase 控制台关闭邮箱自助注册（Authentication → Sign In / Providers → Email → 关闭 Enable sign-ups）。
6. 把 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY` 写入 `.env.local`。

> `.env.setup` 含 service_role 与管理员密码，已在 `.gitignore` 中忽略；不要提交、不要部署到前端。

## 导入历史数据

```bash
npm run validate -- "/path/to/考勤汇总文件夹"  # 先本地校验解析结果
npm run seed -- "/path/to/考勤汇总文件夹"      # 再逐月原子入库
```

- 当前 9 个月样例数据解析结果为 **9 个月 / 686 条员工记录**。
- `validate` 会把员工行合计与每月「汇总」第 1 行合计逐项比对；7、8 月缺卡列的已知公式漏行会标为「已知公式漏行」。
- `seed` 优先使用 service_role；没有 service_role 时会用 `VITE_SUPABASE_ANON_KEY` + 管理员账号登录后调用 RPC。

## 导入新月份（如 10 月）

1. 用管理员账号登录线上仪表盘。
2. 点击「导入考勤表」，拖入 10 月 xlsx。
3. 检查预览中的月份、员工数、警告；文件名无法识别时可手动选择 `YYYY-MM`。
4. 确认导入。若该月已存在会标注「将覆盖」，导入为原子操作，不会留下半套数据。
5. 仪表盘自动刷新，趋势图出现第 10 个点。

## 部署到 GitHub Pages

1. 创建公开仓库并推送本仓库（真实 xlsx 与 `.env*` 已被忽略）。
2. 在仓库 Settings → Secrets and variables → Actions 添加：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**。
4. 推送到 `main` 触发 `.github/workflows/deploy.yml`；工作流会运行测试、构建并部署。
5. 访问 `https://<用户名>.github.io/<仓库名>/`。

构建时 `BASE_PATH` 自动设为 `/<仓库名>/`；本地构建默认为 `/`。

## 常用脚本

| 命令 | 作用 |
|---|---|
| `npm run dev` | 本地开发 |
| `npm run build` | 类型检查 + 生产构建 |
| `npm test` | Vitest：两种 Excel 格式、重复表头、周期过滤、繁简/别名、超大 dimension |
| `npm run lint` | Oxlint |
| `npm run validate -- <文件夹>` | 解析真实文件并与汇总行合计比对 |
| `npm run seed -- <文件夹>` | 初始/批量导入 |
| `npm run bootstrap:admin` | 创建管理员并写入 `app_admins` |

## 数据与安全

- GitHub 仓库公开的是代码，不包含考勤数据或密钥；`*.xlsx`、`.env*` 均在忽略列表。
- 前端只持有 anon key（设计上可公开）。未登录或非管理员无法读取业务表。
- 业务表开启 RLS，只有 `app_admins` 中的用户可以 select；写入仅通过 RPC，RPC 内再次校验管理员。
- service_role 只用于本机一次性初始化与 seed，绝不进入前端或 Actions secrets。
- Supabase 免费项目建议只保留一个管理员账号，关闭注册。

## 已知数据问题

- **1 月表混入 3 条 2025-11-26 ~ 28 的记录**：解析器会忽略统计周期外的日期，并在导入预览中提示。
- **7、8 月「汇总」第 1 行缺卡 SUM 范围漏行**：以员工行合计为准，导入预览会提示差异。
- **个别员工当月没有明细记录**（如 5 月王佩佩、7–9 月姚明辰）：出勤率留空，不按 0% 计入公司合计。
- **8 月表格 dimension 被格式撑到百万行**：读取时限制 5000 行，仍按有效行解析。
- 若未来出现新的姓名别名或部门改名，在 `src/lib/normalize.ts` 的映射表中补一行即可。

## 目录结构

```
src/
  components/          登录、仪表盘、图表、导入弹窗、数据管理
  hooks/               会话数据加载、主题
  lib/
    parseAttendance.ts Excel 解析（浏览器与 Node 共用）
    normalize.ts       姓名/部门/月份归一化
    aggregate.ts       月度与员工聚合
    chartOptions.ts    ECharts 配置
    supabase.ts        前端 Supabase 客户端
scripts/
  validate.ts          9 个月解析校验
  seed.ts              批量导入
  bootstrap-admin.ts   管理员初始化
supabase/migrations/   表结构、RLS、导入 RPC
.github/workflows/     GitHub Pages 部署
```
