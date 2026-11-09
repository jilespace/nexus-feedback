/** 命令行参数解析与帮助文本。 */
export function parseArgs(argv) {
  const options = {
    baseAdmin: 'http://localhost:8080',
    baseBoard: 'http://localhost:8082',
    baseApi: 'http://localhost:3000',
    baseSubmit: 'http://localhost:8081',
    chromePort: 9222,
    help: false,
  };
  const keyMap = {
    'base-admin': 'baseAdmin',
    'base-board': 'baseBoard',
    'base-api': 'baseApi',
    'base-submit': 'baseSubmit',
    'chrome-port': 'chromePort',
  };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    const match = arg.match(/^--([a-z-]+)=(.*)$/);
    if (!match) throw new Error(`未知参数: ${arg}（使用 --help 查看用法）`);
    const optionKey = keyMap[match[1]];
    if (!optionKey) throw new Error(`未知参数: ${arg}（使用 --help 查看用法）`);
    const value = String(match[2] ?? '')
      .trim()
      .replace(/\/+$/, '');
    if (!value) throw new Error(`参数 --${match[1]} 需要一个值`);
    options[optionKey] = optionKey === 'chromePort' ? Number(value) : value;
  }
  if (Number.isNaN(options.chromePort)) throw new Error('--chrome-port 需要数字');
  return options;
}

export const USAGE = `Nexus Feedback 端到端冒烟测试

用法:
  pnpm smoke
  node scripts/smoke.mjs [参数]

参数:
  --base-admin=<url>   管理后台地址（默认 http://localhost:8080）
  --base-board=<url>   公开看板地址（默认 http://localhost:8082）
  --base-api=<url>     API 地址（默认 http://localhost:3000）
  --base-submit=<url>  公开提交页地址（默认 http://localhost:8081）
  --chrome-port=<port> Chrome CDP 端口（默认 9222，不可用时自动启动 headless Chrome）
  --help               显示本帮助

输出: 每项 PASS / FAIL / SKIP，截图存 .tools/shots/smoke/；存在 FAIL 时退出码为 1。`;
