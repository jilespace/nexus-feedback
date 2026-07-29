import { createApp } from './app.js';
import { env } from './config/index.js';
import { startDigestJob } from './jobs/digest.js';

const app = createApp();

if (env.NODE_ENV !== 'test') {
  startDigestJob();
}

app.listen(env.PORT, () => {
  console.log(JSON.stringify({
    level: 'info',
    msg: `Server listening on port ${env.PORT}`,
    ts: new Date().toISOString(),
  }));
});
