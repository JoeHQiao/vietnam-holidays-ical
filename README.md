# 🇻🇳 越南法定节假日 iCal 订阅服务 (自动更新)

[![更新越南节假日](https://github.com/JoeHQiao/vietnam-holidays-ical/actions/workflows/update-holidays.yml/badge.svg)](https://github.com/JoeHQiao/vietnam-holidays-ical/actions/workflows/update-holidays.yml)

一个简单、免维护的越南法定节假日 iCal 日历订阅服务。数据每周自动从 [holidays-calendar.net](https://holidays-calendar.net/calendar_zh_cn/vietnam_zh_cn.html) 抓取更新。

**👉 [在线预览首页](https://joehqiao.github.io/vietnam-holidays-ical/)**

## 📅 订阅链接

复制下方链接，添加到您的日历应用中：

```
https://joehqiao.github.io/vietnam-holidays-ical/vietnam-holidays.ics
```

### 如何使用？

| 平台 | 操作方法 |
| :--- | :--- |
| **iPhone / iPad / Mac** | 打开日历 App → `文件` → `新建日历订阅...` → 粘贴链接 |
| **Google Calendar** | 设置 → `添加日历` → `通过网址` → 粘贴链接 |
| **Outlook** | 日历界面 → `添加日历` → `从互联网订阅` → 粘贴链接 |

## ℹ️ 数据说明

- **数据来源**：[holidays-calendar.net](https://holidays-calendar.net/calendar_zh_cn/vietnam_zh_cn.html)
- **包含内容**：越南所有法定节假日（元旦、春节、雄王纪念日、南方解放日、劳动节、国庆节等）
- **覆盖年份**：当前年份及下一年（例如：2025, 2026）
- **更新频率**：GitHub Actions **每周一 (UTC+7 10:00)** 自动运行抓取脚本更新数据

## 🛠️ 项目结构

本项目使用纯静态文件 + GitHub Actions 实现，无需服务器维护。

- `generate.js`: Node.js 脚本，负责抓取网页、解析数据并生成 `.ics` 和 `index.html`
- `.github/workflows/update-holidays.yml`: GitHub Actions 配置，每周定时运行 `generate.js` 并将结果推送到 `docs/` 目录
- `docs/`: 存放生成的静态文件，由 GitHub Pages 对外服务

## 📝 由于越南春节等假期根据农历变动，且具体调休安排由政府每年发布，本订阅会自动保持最新。
