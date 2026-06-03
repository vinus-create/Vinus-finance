export interface ChangelogEntry {
  version: string      // e.g. "1.003"
  date: string         // YYYY-MM-DD
  title: string
  changes: string[]
}

export const APP_VERSION = '1.028'

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.028',
    date: '2026-06-03',
    title: '类别调整',
    changes: [
      '🗑️ 删除「马来餐厅」类别（旧交易保留历史显示）',
      '🍽️ 「餐厅」→「吃」',
      '☕ 「咖啡饮料」→「喝」',
      '🛍️ Shopee + Lazada 合并为「网购」（Lazada 保留为历史别名）',
      '🏡 新增「家用」类别',
      '🛋️ 新增「家具」类别',
    ],
  },
  {
    version: '1.027',
    date: '2026-06-03',
    title: '还款后自动推进账单提醒',
    changes: [
      '🔔 点击「还款」后，对应账单提醒自动推进到下一期（不再标记为已完成）',
      '🔍 匹配提醒方式：linked_loan_id 或标题含贷款名称（兼容手动创建的提醒）',
      '📅 每月提醒 → 下次日期 +1 个月；每年提醒 → +12 个月；一次性提醒 → 标记完成',
    ],
  },
  {
    version: '1.026',
    date: '2026-06-03',
    title: '投资组合升级：黄金/ETF/基金/加密货币',
    changes: [
      '🔄 「股票」模块更名为「投资」，支持 6 种资产类型',
      '📈 股票：KLSE(.KL) / 美股 / 港股(.HK)',
      '🔵 ETF：SPY / QQQ / MyETF',
      '🟡 黄金：GC=F（期货）/ XAUUSD=X / GLD ETF',
      '₿ 加密货币：BTC-USD / ETH-USD 等（Yahoo Finance 实时价）',
      '📊 基金/ASB：手动 NAV 录入，无实时价格',
      '🏷️ 每张持仓卡片显示资产类型 badge + 正确货币符号',
      '⚠️ 需在 Supabase 执行：ALTER TABLE stock_holdings ADD COLUMN IF NOT EXISTS asset_type TEXT DEFAULT \'stock\';',
    ],
  },
  {
    version: '1.025',
    date: '2026-06-03',
    title: '4 大功能升级',
    changes: [
      '🏦 贷款添加/编辑：新增「添加至账单提醒」和「添加至月度预算」开关',
      '📊 月度预算：每行新增「编辑」「删除」按钮',
      '📋 LHDN 税务：新增「缴税记录」tab，支持 PCB（12 月）和 CP500（6 期）录入',
      '⚙️ Menu 自定义排序：点「⚙️ 自定义排序」用 ↑↓ 调整 Menu 项目顺序，自动保存',
      '⚠️ CP500/PCB 需在 Supabase 建表：CREATE TABLE tax_payments ...',
    ],
  },
  {
    version: '1.024',
    date: '2026-06-03',
    title: '每月账单页面',
    changes: [
      '🧾 新增「每月账单」页面（Menu 第一位）',
      '➕ 可添加固定账单：TNB、Unifi、水费、Maintenance 等，带快选预设',
      '✏️ 可编辑 / 删除已有账单',
      '🔔 开关「添加至账单提醒」：自动创建每月提醒，到期前 3 天通知',
      '📊 开关「添加至月度预算」：自动更新当月该类别预算金额',
      '📅 账单按到期日排序，标记「⚡ X 天后到期」',
      '⚠️ 需在 Supabase SQL Editor 建表：CREATE TABLE monthly_bills ...',
    ],
  },
  {
    version: '1.023',
    date: '2026-06-03',
    title: '修复还款日期计算',
    changes: [
      '📅 下次还款日改用贷款原定日期推算（不再用付款当天日期），月份固定在同一天',
      '🔧 修复 advanceMonths 月末溢出：Jan 31 + 1 月 → Feb 28（不再跑到 Mar 3）',
    ],
  },
  {
    version: '1.022',
    date: '2026-06-03',
    title: '还款时选择户口',
    changes: [
      '🏦 贷款还款页面：新增户口选择器，显示各户口余额',
      '💳 还款记录 account_name 使用所选户口（不再写死 Cash）',
      '💰 还款后自动从所选户口余额扣除还款金额',
    ],
  },
  {
    version: '1.021',
    date: '2026-06-03',
    title: '内部转账支持',
    changes: [
      '↔️ 新增「转账」tab：直接录入自己户口之间的转账（From → To + 金额 + 日期）',
      '🚫 内部转账不再计入收入/支出统计，只更新两个户口余额',
      '🏦 TransactionPreview：选 Transfer 类型时显示 From / To 两个账户选择',
      '🔧 保存逻辑：transfer 类型正确执行 from_balance -= amount, to_balance += amount',
    ],
  },
  {
    version: '1.020',
    date: '2026-06-03',
    title: '户口表单字段更新',
    changes: [
      '✏️ 编辑户口表单："后4位数字（选填）" → "户口号码（选填）"（支持完整户口号）',
    ],
  },
  {
    version: '1.019',
    date: '2026-06-03',
    title: 'Menu 点击后自动关闭 + 路由优化',
    changes: [
      '🔧 点击 Menu 里任何菜单项后，底部抽屉自动关闭',
      '⚡ proxy.ts middleware 改用 getSession()（只读 cookie），替代 getUser()（需网络请求），减少约 40ms 延迟',
    ],
  },
  {
    version: '1.017',
    date: '2026-06-02',
    title: '修复 Telegram 语音/图片无响应',
    changes: [
      '🐛 根本原因：确认按钮 callback_data 超过 Telegram 64 字节限制，导致消息发送失败',
      '⚡ Vercel 函数超时上调至 60 秒（默认 10 秒会杀掉慢的语音处理）',
      '🗜️ 紧凑编码：type=1字符, 日期=MM-DD, 名字截断 12 字符',
      '🛡️ 兜底机制：如果按钮消息发送失败，直接保存交易并通知用户',
      '🔁 回调点击后立即响应"正在保存..."，按钮不再卡住',
    ],
  },
  {
    version: '1.016',
    date: '2026-06-01',
    title: '优化语音处理速度',
    changes: [
      '⚡ 文件下载超时限制 10 秒，防止卡死',
      '⚡ Gemini 重试间隔从 1s/2s 缩短为 500ms/1s',
    ],
  },
  {
    version: '1.015',
    date: '2026-06-01',
    title: '恢复使用 flash-lite 模型',
    changes: [
      '⚡ 语音和图片识别恢复使用 gemini-2.5-flash-lite（更快、更省费用）',
      '📝 保留改进后的语音提示词（金额规则、马来西亚食品词汇）',
    ],
  },
  {
    version: '1.014',
    date: '2026-06-01',
    title: '语音/图片识别升级至 Gemini Flash 标准版',
    changes: [
      '🧠 语音和图片识别改用 gemini-2.5-flash（标准版），比 flash-lite 更准确',
      '📝 语音提示词强化金额识别：lima=RM5 而非 RM500，食物价格区间 RM3-30',
      '🗣️ 新增常见马来西亚食品词汇：da chang 大肠、tau foo fa 豆腐花等',
      '🌡️ 语音/图片模型温度从 0.1 调整至 0.2（对模糊语音更宽容）',
    ],
  },
  {
    version: '1.013',
    date: '2026-06-01',
    title: 'Telegram 确认按钮：防止语音/图片误识别',
    changes: [
      '✅ 语音和图片解析后不立即保存，先显示 [✅ Save] [❌ Discard] 确认按钮',
      '📝 文字输入仍然直接保存（文字准确率高）',
      '🔍 确认消息显示完整解析结果：名称、金额、日期、账户、类别',
      '⚡ Telegram Webhook 新增 callback_query 事件处理',
    ],
  },
  {
    version: '1.012',
    date: '2026-05-31',
    title: 'Telegram 机器人：/link 命令 + 图片/语音修复',
    changes: [
      '🔗 新增 /link 邮箱 命令：无需打开 App，直接在 Telegram 绑定账号',
      '📸 图片识别修复：明确使用 image/jpeg MIME 类型（Telegram 图片统一为 JPEG）',
      '🎤 语音识别修复：明确使用 audio/ogg MIME 类型（Telegram 语音消息为 OGG Opus）',
      '🛡️ 增加 try/catch 错误捕获，图片/语音处理失败时返回友好提示',
    ],
  },
  {
    version: '1.011',
    date: '2026-05-31',
    title: '修复 Telegram/WhatsApp 机器人用户识别失败',
    changes: [
      '🔧 Webhook 改用管理员客户端（service role）查询 profiles 表——匿名请求被 RLS 阻止导致无法识别用户，这就是"账号未绑定"错误的根本原因',
    ],
  },
  {
    version: '1.010',
    date: '2026-05-31',
    title: 'Telegram 机器人（替换 WhatsApp）',
    changes: [
      '🤖 新增 Telegram 机器人：文字/图片/语音记账，/undo /report /help 命令',
      '⚙️ 设置页面新增 Telegram ID 绑定入口',
      '🔧 中间件白名单新增 /api/telegram 路径',
      '🗑️ WhatsApp 保留但不再主推（Meta 验证门槛太高）',
    ],
  },
  {
    version: '1.009',
    date: '2026-05-31',
    title: '修复 WhatsApp Webhook 验证失败',
    changes: [
      '🔧 将 /api/whatsapp 路径加入中间件白名单，解决 Meta 验证时被重定向到登录页的问题',
    ],
  },
  {
    version: '1.008',
    date: '2026-05-31',
    title: 'WhatsApp 机器人升级',
    changes: [
      '💬 WhatsApp 机器人功能完善：UNDO（10分钟内撤销）、REPORT（7天摘要）、HELP 命令',
      '🎤 支持 WhatsApp 语音消息记账（直接发送语音，AI 转录并解析）',
      '📸 支持发送收据图片到 WhatsApp 自动识别并记录',
    ],
  },
  {
    version: '1.007',
    date: '2026-05-31',
    title: '搜索 + CSV导出 + 资料编辑 + 修复',
    changes: [
      '🔍 交易搜索：在交易页面按商家名/描述搜索',
      '⬇ CSV 导出：交易页面右上角可按月导出 CSV 文件',
      '👤 资料编辑：设置页面可修改姓名和 WhatsApp 手机号码',
      '🔧 编辑交易表单：修复所有硬编码中文字符串，改为多语言支持',
      '🛡️ 稳健查询：即使 ledger 数据库列尚未添加，交易记录也能正常显示',
    ],
  },
  {
    version: '1.006',
    date: '2026-05-31',
    title: '修复构建错误（TypeScript）',
    changes: [
      '🔧 修复 TypeScript 类型推断错误导致 Vercel 构建失败（投资解析器 filter 参数缺少类型标注）',
    ],
  },
  {
    version: '1.005',
    date: '2026-05-31',
    title: '修复净资产计算（不含贷款）',
    changes: [
      '🔧 净资产（户口页面）不再计入贷款与债务金额——贷款已在"贷款与债务"页面单独追踪',
      '💡 总负债仅反映余额为负数的户口（如信用卡透支），不含房贷、车贷等',
    ],
  },
  {
    version: '1.004',
    date: '2026-05-31',
    title: '商业模式 + AI 分析 + 投资同步 + WhatsApp',
    changes: [
      '🏪 个人/商业账本切换：每笔交易可标记 Personal 或 Business，仪表盘显示业务营业额、支出、净利润及利润率',
      '🤖 AI 消费分析（Roast My Spending）：Gemini 分析过去 7 天消费，用幽默 Manglish 风格生成个人化报告，可分享',
      '📈 投资对账单同步：上传 Moomoo/AHAM/EPF/Rakuten PDF，自动解析交易并更新持股（加权平均成本）',
      '💬 WhatsApp 机器人：发送文字或收据照片给 WhatsApp 号码，自动记账并回复确认',
      '🔧 修复预算页面 UTC+8 时区偏移导致月份范围错误',
      '🔧 修复提醒页面今日/逾期判断 UTC+8 偏移问题',
      '🔧 修复 AI 解析器回退日期和 AI 提示词使用马来西亚时区',
      '⚡ 编辑交易后使用 router.refresh() 替换 window.location.reload()，消除页面闪烁',
      '🔁 Gemini AI 调用加入自动重试（指数退避，最多 2 次），减少偶发超时失败',
      '🗂️ 快速添加增加第 5 个标签：📈 投资（上传经纪商/基金 PDF）',
      '📋 交易列表新增 Personal/Business 筛选标签',
    ],
  },
  {
    version: '1.003',
    date: '2026-05-30',
    title: '通知 + 语音 + UI 优化',
    changes: [
      '🔔 新增 App 推送通知（Web Push）和邮件提醒',
      '🎤 语音识别升级：直接发音频给 Gemini AI，支持 Rojak 混合语言（中文+马来文+英文）、各种口音（马来、华人、印度）',
      '🗓️ 修复每月提醒日期计算错误（UTC+8 时区偏移）',
      '🔘 统一所有模块的添加按钮样式（绿色长方形圆角，固定底部）',
      '🌐 预算类别名称支持多语言翻译',
      '🏦 银行对账单 PDF 导入时自动识别并关联户口',
      '📋 添加 Changelog 页面（就是这里！）',
    ],
  },
  {
    version: '1.002',
    date: '2026-05-29',
    title: '户口 & 股票模块',
    changes: [
      '🏦 全新户口（Accounts）模块：追踪银行、电子钱包、投资、信用卡等户口',
      '📊 净资产总览：资产 vs 负债实时计算',
      '📈 股票组合追踪：Yahoo Finance 实时股价、未实现盈亏',
      '👀 自选股关注列表：设定目标价格，接近时提醒',
      '📋 交易记录历史',
      '🗂️ 底部导航重组：预算移至"更多"，户口成为主导航',
    ],
  },
  {
    version: '1.001',
    date: '2026-05-28',
    title: '多语言 & 动画',
    changes: [
      '🌍 支持三语言切换：中文、English、Bahasa Malaysia',
      '🗣️ 语音识别根据语言自动切换识别语言',
      '📄 PDF 银行对账单批量导入交易记录',
      '🎉 保存交易时显示庆祝动画（💰🎊✨）',
      '📭 空状态页面添加浮动 emoji 动画',
      '🏷️ 交易类别名称支持多语言',
    ],
  },
  {
    version: '1.000',
    date: '2026-05-27',
    title: '初始发布',
    changes: [
      '💸 AI 智能交易记录：文字、语音、收据拍照、PDF 导入',
      '📊 仪表盘：月度收支概览、趋势图表',
      '🏷️ 37 个马来西亚本地消费类别',
      '📅 月度预算管理：设定并追踪各类别消费上限',
      '🏦 贷款与债务追踪：减息法、固定利率、伊斯兰融资',
      '🔔 账单提醒：每日/每周/每月/每年循环提醒',
      '🧾 马来西亚所得税减免追踪（LHDN）',
      '🌙 深色模式支持',
      '📱 PWA：可安装到手机主屏幕',
    ],
  },
]
