import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFlashModel } from '@/lib/ai/gemini'

export const maxDuration = 30

// ── Chinese zodiac ────────────────────────────────────────────
const CHINESE_ZODIAC = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪']
function getChineseZodiac(year: number): string {
  return CHINESE_ZODIAC[(year - 1900) % 12]!
}

// ── Western zodiac ────────────────────────────────────────────
function getWesternZodiac(month: number, day: number): string {
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return '白羊座 ♈'
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return '金牛座 ♉'
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return '双子座 ♊'
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return '巨蟹座 ♋'
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return '狮子座 ♌'
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return '处女座 ♍'
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return '天秤座 ♎'
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return '天蝎座 ♏'
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return '射手座 ♐'
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return '摩羯座 ♑'
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return '水瓶座 ♒'
  return '双鱼座 ♓'
}

// ── Numerology life path ──────────────────────────────────────
function getLifePath(dob: string): number {
  const digits = dob.replace(/-/g, '').split('').map(Number)
  let sum = digits.reduce((a, b) => a + b, 0)
  while (sum > 9 && sum !== 11 && sum !== 22 && sum !== 33) {
    sum = String(sum).split('').map(Number).reduce((a, b) => a + b, 0)
  }
  return sum
}

// ── Current age ───────────────────────────────────────────────
function calcAge(dob: string): number {
  const d = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - d.getFullYear()
  const m = today.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--
  return age
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, date_of_birth')
    .eq('id', user.id)
    .single()

  const dob = (profile as { date_of_birth?: string | null } | null)?.date_of_birth
  const name = profile?.full_name ?? '用户'

  if (!dob) {
    return NextResponse.json({
      error: '请先在「设置 → 个人资料」填写出生日期才能查看财运分析。',
      needDob: true,
    })
  }

  const dobDate = new Date(dob)
  const birthYear = dobDate.getFullYear()
  const birthMonth = dobDate.getMonth() + 1
  const birthDay = dobDate.getDate()

  const chineseZodiac = getChineseZodiac(birthYear)
  const westernZodiac = getWesternZodiac(birthMonth, birthDay)
  const lifePath = getLifePath(dob)
  const age = calcAge(dob)
  const currentYear = new Date().getFullYear()

  const prompt = `你是一位精通中西方命理的马来西亚财务命运分析师，结合生肖、星座、数字命理，给出有趣且有参考价值的财运分析。

用户资料：
- 姓名：${name}
- 年龄：${age} 岁
- 出生日期：${dob}
- 生肖：${chineseZodiac}年（${birthYear}年）
- 西方星座：${westernZodiac}
- 数字命理生命路径数：${lifePath}
- 当前年份：${currentYear}年（${getChineseZodiac(currentYear)}年）

请用简体中文写一份约500字的财运分析报告，包括以下几个部分，每部分用清晰标题分隔：

🔮 **${currentYear}年整体财运总评**（评分1-10，简短总结）

🐉 **生肖财运**：${chineseZodiac}年生的人今年财运特点，需要注意的机会和风险

⭐ **星座财运**：${westernZodiac}今年在金钱、投资、职业上的能量走势

🔢 **数字命理**：生命路径数 ${lifePath} 的财务启示，今年的幸运数字、颜色

💰 **今年财运建议**：3条具体的马来西亚本地化理财建议（结合EPF、股票、房产等）

⚠️ **财运注意事项**：今年需要避免的财务陷阱或时机

结尾加一句激励语。语气要有趣、接地气，带一点马来西亚华人文化味道。`

  try {
    const model = await getFlashModel()
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'text/plain', temperature: 0.9 },
    })
    const analysis = result.response.text().trim()
    return NextResponse.json({
      success: true,
      analysis,
      meta: { chineseZodiac, westernZodiac, lifePath, age, currentYear },
    })
  } catch (err) {
    console.error('[fortune]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
