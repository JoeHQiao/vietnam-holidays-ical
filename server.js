const express = require('express');
const cheerio = require('cheerio');
const fetch = require('node-fetch');
const ical = require('ical-generator').default;
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 8080;

// 当前年份和上一年的 URL
const URLS = [
    'https://holidays-calendar.net/calendar_zh_cn/vietnam_zh_cn.html',
    'https://holidays-calendar.net/2025/calendar_zh_cn/vietnam_zh_cn.html',
];

// 内存中缓存的 iCal 内容
let cachedIcalContent = null;
let lastUpdateTime = null;

/**
 * 从中文日期字符串解析出 { month, day }
 * 如 "1月1日" => { month: 1, day: 1 }
 */
function parseChineseDate(dateStr) {
    const match = dateStr.match(/(\d+)月(\d+)日/);
    if (!match) return null;
    return { month: parseInt(match[1]), day: parseInt(match[2]) };
}

/**
 * 从页面 URL 推断年份
 */
function getYearFromUrl(url) {
    const match = url.match(/\/(\d{4})\//);
    if (match) return parseInt(match[1]);
    // 默认页面是当前年份（2026）
    return new Date().getFullYear();
}

/**
 * 抓取并解析单个页面的节假日数据
 */
async function scrapeHolidaysFromUrl(url) {
    const year = getYearFromUrl(url);
    console.log(`[抓取] 开始抓取 ${year} 年数据: ${url}`);

    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; VietnamHolidayBot/1.0)',
            'Accept-Language': 'zh-CN,zh;q=0.9',
        },
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const holidays = [];

    // 解析页面中的节假日（使用 div.details > span.hol-item 结构）
    $('.hol-item').each((_, item) => {
        const dateText = $(item).find('.hol-date').text().trim();
        const name = $(item).find('.hol-name').text().trim();
        const note = $(item).find('.hol-info').text().trim();

        if (!dateText || !name) return;

        // 检查是否是日期范围 (如 "2月14日–2月22日" 或 "9月1日–2日")
        const rangeMatch = dateText.match(/(\d+)月(\d+)日[–\-~](?:(\d+)月)?(\d+)日/);
        if (rangeMatch) {
            const sm = parseInt(rangeMatch[1]);
            const sd = parseInt(rangeMatch[2]);
            const em = rangeMatch[3] ? parseInt(rangeMatch[3]) : sm;
            const ed = parseInt(rangeMatch[4]);

            const startDate = new Date(year, sm - 1, sd);
            const endDate = new Date(year, em - 1, ed);
            // iCal 全天事件: endDate 需要 +1 天
            endDate.setDate(endDate.getDate() + 1);

            holidays.push({ name, startDate, endDate, note, year });
            return;
        }

        // 单日日期，如 "1月1日" 或 "4月26日 (27日补假)"
        const mainDate = parseChineseDate(dateText);
        if (!mainDate) return;

        const startDate = new Date(year, mainDate.month - 1, mainDate.day);
        const endDate = new Date(year, mainDate.month - 1, mainDate.day + 1);

        holidays.push({ name, startDate, endDate, note, year });
    });

    console.log(`[抓取] ${year} 年共解析到 ${holidays.length} 个节假日`);
    return holidays;
}

/**
 * 抓取所有年份的节假日
 */
async function scrapeAllHolidays() {
    const allHolidays = [];
    for (const url of URLS) {
        try {
            const holidays = await scrapeHolidaysFromUrl(url);
            allHolidays.push(...holidays);
        } catch (err) {
            console.error(`[错误] 抓取失败: ${url}`, err.message);
        }
    }
    return allHolidays;
}

/**
 * 生成 iCal 内容
 */
function generateIcal(holidays) {
    const calendar = ical({
        name: '越南法定节假日',
        description: '越南法定节假日日历 - 数据来源: holidays-calendar.net',
        timezone: 'Asia/Ho_Chi_Minh',
        prodId: { company: 'vietnam-holidays', product: 'ical-feed' },
        url: 'https://holidays-calendar.net/calendar_zh_cn/vietnam_zh_cn.html',
    });

    for (const h of holidays) {
        const event = calendar.createEvent({
            start: h.startDate,
            end: h.endDate,
            allDay: true,
            summary: `🇻🇳 ${h.name}`,
            description: h.note || '',
            url: 'https://holidays-calendar.net/calendar_zh_cn/vietnam_zh_cn.html',
        });
    }

    return calendar.toString();
}

/**
 * 执行抓取并更新缓存
 */
async function updateHolidays() {
    try {
        console.log(`[更新] 开始更新节假日数据... ${new Date().toISOString()}`);
        const holidays = await scrapeAllHolidays();
        if (holidays.length > 0) {
            cachedIcalContent = generateIcal(holidays);
            lastUpdateTime = new Date().toISOString();
            console.log(`[更新] 成功! 共 ${holidays.length} 个节假日，更新时间: ${lastUpdateTime}`);
        } else {
            console.warn('[更新] 未抓取到任何节假日数据，保留旧缓存');
        }
    } catch (err) {
        console.error('[更新] 更新失败:', err.message);
    }
}

// ========== HTTP 路由 ==========

// iCal 订阅端点
app.get('/vietnam-holidays.ics', (req, res) => {
    if (!cachedIcalContent) {
        return res.status(503).send('日历数据尚未就绪，请稍后再试');
    }
    res.set({
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="vietnam-holidays.ics"',
        'Cache-Control': 'public, max-age=3600',
    });
    res.send(cachedIcalContent);
});

// 健康检查
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        lastUpdate: lastUpdateTime,
        hasData: !!cachedIcalContent,
    });
});

// 根路径提示
app.get('/', (req, res) => {
    res.send(`
    <h1>🇻🇳 越南法定节假日 iCal 订阅</h1>
    <p>订阅链接: <a href="/vietnam-holidays.ics">/vietnam-holidays.ics</a></p>
    <p>上次更新: ${lastUpdateTime || '尚未更新'}</p>
    <p>数据来源: <a href="https://holidays-calendar.net/calendar_zh_cn/vietnam_zh_cn.html">holidays-calendar.net</a></p>
    <p>每周自动抓取更新一次</p>
  `);
});

// 手动触发更新（可选）
app.post('/update', async (req, res) => {
    await updateHolidays();
    res.json({ status: 'updated', lastUpdate: lastUpdateTime });
});

// ========== 启动 ==========

app.listen(PORT, async () => {
    console.log(`[服务] 越南节假日 iCal 服务已启动，端口: ${PORT}`);

    // 启动时立即抓取一次
    await updateHolidays();

    // 每周一凌晨 3 点（越南时间 UTC+7）自动抓取
    cron.schedule('0 3 * * 1', () => {
        console.log('[定时] 开始每周定时更新...');
        updateHolidays();
    }, {
        timezone: 'Asia/Ho_Chi_Minh',
    });

    console.log('[定时] 已设置每周一凌晨 3:00 (UTC+7) 自动更新');
});
