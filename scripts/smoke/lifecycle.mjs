/** 运行收尾：恢复浏览器状态、关闭临时进程与 CDP 连接。 */
import { setTimeout as sleep } from 'node:timers/promises';
import { chromeCommand } from './chrome.mjs';

export async function cleanup(page, context) {
  // 最终兜底：恢复桌面视口与中文界面（9222 profile 是共享的，其他并行任务也可能改写，
  // 这里至少保证本脚本退出前把自己改动过的 state 复位）。
  if (page) {
    try {
      await Promise.race([
        page.setViewport({ width: 1440, height: 900, mobile: false, deviceScaleFactor: 1 }),
        sleep(1000),
      ]);
    } catch {
      /* ignore */
    }
    try {
      await Promise.race([page.evaluate(`localStorage.setItem('lang', 'zh')`), sleep(1000)]);
    } catch {
      /* ignore */
    }
  }
  if (context.widgetProcess) {
    try {
      context.widgetProcess.kill();
    } catch {
      /* ignore */
    }
  }
  await chromeCommand.stop();
  if (page) await Promise.race([page.close().catch(() => {}), sleep(1500)]);
  page?.client?.close();
}
