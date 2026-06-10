import { NextRequest, NextResponse } from 'next/server'
import { getFlashModel } from '@/lib/ai/gemini'

export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const { base64, mimeType } = await request.json()
    if (!base64) return NextResponse.json({ error: 'No image' }, { status: 400 })

    const model = await getFlashModel()
    const result = await model.generateContent([
      {
        inlineData: {
          data: base64,
          mimeType: mimeType ?? 'image/jpeg',
        },
      },
      `你是马来西亚收据分析助手。请分析这张收据/账单，用中文输出以下内容：

**商家名称：** [商家名]
**日期：** [日期，格式 YYYY-MM-DD，没有就写未知]
**总金额：** RM [总额]
**付款方式：** [现金/信用卡/电子钱包/未知]

**消费明细：**
- [商品/服务名] × [数量] = RM [小计]
（列出所有项目）

**分类建议：** [如：餐饮、超市/杂货、购物、娱乐等]

**AI 点评：** [1-2句话，简短评价这笔消费是否合理，马来西亚口语风格]

如果图片不是收据或无法识别，请直接说「无法识别此图片，请确保上传清晰的收据照片」。
直接输出内容，不要 JSON，不要代码块。`,
    ])

    const analysis = result.response.text().trim()
    return NextResponse.json({ analysis }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    console.error('[analyze-receipt]', err)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
