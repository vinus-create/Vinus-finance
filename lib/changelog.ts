export interface ChangelogEntry {
  version: string      // e.g. "1.003"
  date: string         // YYYY-MM-DD
  title: string
  changes: string[]
}

export const APP_VERSION = '1.013'

export const CHANGELOG: ChangelogEntry[] = [
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
