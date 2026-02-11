const cheerio = require('cheerio');
const fetch = require('node-fetch');
const ical = require('ical-generator').default;
const fs = require('fs');
const path = require('path');

// 当前年份和上一年的 URL
const URLS = [
    'https://holidays-calendar.net/calendar_zh_cn/vietnam_zh_cn.html',
    'https://holidays-calendar.net/2025/calendar_zh_cn/vietnam_zh_cn.html',
];

/**
 * 从中文日期字符串解析出 { month, day }
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

    $('.hol-item').each((_, item) => {
        const dateText = $(item).find('.hol-date').text().trim();
        const name = $(item).find('.hol-name').text().trim();
        const note = $(item).find('.hol-info').text().trim();

        if (!dateText || !name) return;

        // 日期范围 (如 "2月14日–2月22日" 或 "9月1日–2日")
        const rangeMatch = dateText.match(/(\d+)月(\d+)日[–\-~](?:(\d+)月)?(\d+)日/);
        if (rangeMatch) {
            const sm = parseInt(rangeMatch[1]);
            const sd = parseInt(rangeMatch[2]);
            const em = rangeMatch[3] ? parseInt(rangeMatch[3]) : sm;
            const ed = parseInt(rangeMatch[4]);

            const startDate = new Date(year, sm - 1, sd);
            const endDate = new Date(year, em - 1, ed);
            endDate.setDate(endDate.getDate() + 1);

            holidays.push({ name, startDate, endDate, note, year });
            return;
        }

        // 单日日期
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
        calendar.createEvent({
            start: h.startDate,
            end: h.endDate,
            allDay: true,
            summary: `🇻🇳 ${h.name}`,
            description: h.note || '',
        });
    }

    return calendar.toString();
}

async function main() {
    console.log(`[开始] 生成越南节假日 iCal 文件... ${new Date().toISOString()}`);

    const allHolidays = [];
    for (const url of URLS) {
        try {
            const holidays = await scrapeHolidaysFromUrl(url);
            allHolidays.push(...holidays);
        } catch (err) {
            console.error(`[错误] 抓取失败: ${url}`, err.message);
        }
    }

    if (allHolidays.length === 0) {
        console.error('[错误] 未抓取到任何节假日数据');
        process.exit(1);
    }

    const icalContent = generateIcal(allHolidays);

    // 输出到 docs/ 目录（GitHub Pages 默认目录）
    const outputDir = path.join(__dirname, 'docs');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputFile = path.join(outputDir, 'vietnam-holidays.ics');
    fs.writeFileSync(outputFile, icalContent, 'utf-8');

    // 生成一个简单的首页
    const indexHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🇻🇳 越南法定节假日 iCal 订阅</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); color: #e0e0e0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: rgba(255,255,255,0.08); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.12); border-radius: 20px; padding: 48px; max-width: 520px; width: 90%; text-align: center; }
    h1 { font-size: 28px; margin-bottom: 8px; }
    .flag { font-size: 48px; margin-bottom: 16px; display: block; }
    .subtitle { color: #aaa; margin-bottom: 32px; font-size: 14px; }
    .subscribe-btn { display: inline-block; background: linear-gradient(135deg, #e94560, #c23152); color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-size: 16px; font-weight: 600; transition: transform 0.2s, box-shadow 0.2s; }
    .subscribe-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(233,69,96,0.3); }
    .info { margin-top: 24px; font-size: 13px; color: #888; line-height: 1.8; }
    .info a { color: #e94560; text-decoration: none; }
    .update-time { margin-top: 16px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="card">
    <span class="flag">🇻🇳</span>
    <h1>越南法定节假日</h1>
    <p class="subtitle">iCal 日历订阅</p>
    <a class="subscribe-btn" href="vietnam-holidays.ics">📅 下载 / 订阅日历</a>
    <div class="info">
      <p>共 ${allHolidays.length} 个节假日 (${[...new Set(allHolidays.map(h => h.year))].join(', ')} 年)</p>
      <p>数据来源: <a href="https://holidays-calendar.net/calendar_zh_cn/vietnam_zh_cn.html" target="_blank">holidays-calendar.net</a></p>
      <p>每周自动更新</p>
    </div>
    <p class="update-time">上次更新: ${new Date().toISOString().split('T')[0]}</p>
  </div>
</body>
</html>`;

    fs.writeFileSync(path.join(outputDir, 'index.html'), indexHtml, 'utf-8');

    console.log(`[完成] 已生成 ${allHolidays.length} 个节假日到 ${outputFile}`);
    console.log(`[完成] 首页已生成到 ${path.join(outputDir, 'index.html')}`);
}

main();
