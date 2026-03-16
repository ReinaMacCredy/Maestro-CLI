Thanks for the detailed request. Webhook notifications on task completion is a clean, well-scoped idea. Let me work through a few things to make sure I build the right design.

You've already covered a lot of ground, so let me acknowledge what I've captured so far:

- **Trigger**: task completion (via `task-finish` flow)
- **Method**: HTTP POST only
- **Payload**: task ID, status, duration, feature name
- **Reliability**: retries with exponential backoff
- **Config location**: `.maestro/config.json`

That's a solid starting point. A couple of questions before I sketch approaches.

---

**First -- how is this handled today?**

I checked the codebase and there's no existing webhook, notification, or callback mechanism anywhere in maestro. So this is greenfield. But I want to confirm: are you currently doing anything manual to track task completions externally? For example, polling `maestro status`, watching log output, or running a wrapper script? Understanding the current workaround (if any) will help me decide whether the webhook should be fire-and-forget or whether delivery guarantees actually matter.

Options:

- (a) Nothing today -- I just want this for future integrations (Slack, dashboards, CI triggers, etc.)
- (b) Manual workaround -- I'm polling status or watching output and want to automate that
- (c) Specific integration in mind -- I already know what will consume these webhooks

---

**Second -- what's the smallest version that would be useful?**

Your request already sounds fairly scoped, but I want to push on one thing: retries with exponential backoff adds meaningful complexity (retry state tracking, max attempts, backoff ceiling, what happens if maestro exits mid-retry). Before I commit to that in the MVP, would any of these simpler starting points be enough?

- (a) Fire-and-forget -- POST once, log success/failure, move on. Add retries later.
- (b) Simple retry -- retry up to 3 times with fixed 1s/2s/4s delays, inline (blocks task-finish briefly)
- (c) Full exponential backoff -- configurable max retries, base delay, backoff multiplier, jitter

I'd recommend starting with (b) -- it covers the 90% case (transient network blip) without needing background retry queues or persistent retry state. Option (c) is where you'd go if the webhook consumer is unreliable or if delivery guarantees are critical. But that's a bigger lift for an MVP.

What do you think on both of those?
