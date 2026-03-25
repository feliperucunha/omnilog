# Background jobs (evolution path)

Today, Geeklogs runs **in-process** work: subscription expiry on a timer ([`cron.ts`](../../apps/api/src/routes/cron.ts)), badge/milestone seeding on API startup.

## When traffic grows

1. **Keep cron-style jobs** for idempotent, low-frequency tasks (e.g. daily subscription sweep) as long as a single API instance is acceptable.
2. **Add a queue** (e.g. BullMQ + Redis, or a managed worker on your host) when you need:
   - reliable retries for email digests or large exports
   - fair scheduling under load
   - decoupling from HTTP request lifecycle
3. **Move heavy exports or imports** off the request thread first; they are the usual first bottleneck.

## Horizontal scaling

Once you run **multiple API instances**, in-process `setInterval` runs on every instance. Either:

- run the job on **one** designated worker process, or
- use **advisory locks** / a queue consumer so only one worker executes each tick.

Document your chosen approach in the deploy runbook when you add a second instance.
