#!/usr/bin/env node
/**
 * Nexus Feedback 端到端冒烟测试（入口，仅负责编排）。
 *
 * 模块：scripts/smoke/{config,util,report,cli,chrome,lifecycle}.mjs 与 checks/*.mjs
 * 用法：pnpm smoke [--base-admin=...] [--base-board=...] [--base-submit=...] [--base-api=...] [--chrome-port=9222]
 * 退出码：0 = 全部 PASS/SKIP；1 = 存在 FAIL。
 */
import { parseArgs, USAGE } from './smoke/cli.mjs';
import { DEMO_PROJECT_ID } from './smoke/config.mjs';
import { CdpClient, PageSession, chromeCommand, registerExitCleanup } from './smoke/chrome.mjs';
import { cleanup } from './smoke/lifecycle.mjs';
import { failedCount, printReport, pushFailure, startedAt } from './smoke/report.mjs';
import { checkApi, checkApiContract } from './smoke/checks/api.mjs';
import { checkPublicPages } from './smoke/checks/public.mjs';
import { checkWidget } from './smoke/checks/widget.mjs';
import { checkAdmin } from './smoke/checks/admin.mjs';
import { checkI18nSwitch } from './smoke/checks/i18n.mjs';
import { checkWriteFlows } from './smoke/checks/write.mjs';
import { checkCsvImport } from './smoke/checks/csv.mjs';
import { checkChangelogLink } from './smoke/checks/changelog.mjs';
import { checkDnd } from './smoke/checks/dnd.mjs';
import { checkPublicSubscription } from './smoke/checks/subscribe.mjs';
import { checkProjectMute } from './smoke/checks/muted-projects.mjs';
import { checkA11yAdmin, checkA11yPublic } from './smoke/checks/a11y.mjs';
import { checkMobile } from './smoke/checks/mobile.mjs';
import { checkNotificationTypeFilter } from './smoke/checks/notification-types.mjs';
import { checkBoardSubscriptionUi } from './smoke/checks/board-subscription.mjs';
import { checkRoadmapPage, checkChangelogPage, checkUnsubscribeInvalidToken } from './smoke/checks/board-inner-pages.mjs';

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(USAGE);
    return 0;
  }

  console.log('Nexus Feedback 端到端冒烟测试');
  console.log(
    `admin=${options.baseAdmin}  board=${options.baseBoard}  submit=${options.baseSubmit}  api=${options.baseApi}`,
  );

  const context = { detailUrl: null, auth: null, projectId: DEMO_PROJECT_ID, widgetProcess: null };
  let page = null;

  try {
    const webSocketDebuggerUrl = await chromeCommand.ensure(options.chromePort);
    const client = await CdpClient.connect(webSocketDebuggerUrl);
    chromeCommand.client = client;
    page = new PageSession(client);
    await page.init();

    await checkApi(options);
    await checkPublicPages(page, options, context);
    await checkWidget(page, options, context);
    await checkAdmin(page, options, context);
    await checkI18nSwitch(page, options, context);
    await checkWriteFlows(page, options, context);
    await checkApiContract(options, context);
    await checkCsvImport(options, context);
    await checkChangelogLink(options, context);
    await checkDnd(options, context);
    await checkPublicSubscription(options, context);
    await checkProjectMute(options, context);
    await checkA11yAdmin(page, options, context);
    await checkA11yPublic(page, options);
    await checkMobile(page, options, context);
    await checkNotificationTypeFilter(options, context);
    await checkBoardSubscriptionUi(page, options);
    await checkRoadmapPage(page, options);
    await checkChangelogPage(page, options);
    await checkUnsubscribeInvalidToken(page, options);
  } catch (error) {
    pushFailure('环境初始化', error);
  } finally {
    await cleanup(page, context);
  }

  printReport(Date.now() - startedAt);
  return failedCount() > 0 ? 1 : 0;
}

main()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error) => {
    console.error('冒烟脚本崩溃:', error);
    process.exitCode = 1;
  });

registerExitCleanup();
