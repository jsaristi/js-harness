# Hosting a Next.js platform — research of 2026-10-23

Sebastián asked for this research to be kept in the harness for a large platform he plans to build
(2026-10-23: "guardame esta informacion en el harnes por que creo que lo voy a utilizar con una
plataforma que voy a hacer que es bastante grande y completa"). It holds three studies made that
day by research agents (Opus, high effort) and checked in part by the lead. Every price was read on
2026-10-23 from the page cited; prices change, so re-read them before buying. Users are assumed to be
in Colombia.

## 1. Latency from Bogotá

One snapshot, server to server, WonderNetwork (https://wondernetwork.com/pings/Bogota), 2026-10-23.
Home ISPs will differ; ping from the users' own connection before deciding.

| Destination | Ping |
|---|---|
| Medellín | 6 ms |
| Miami | 59 ms |
| Santiago | 68 ms |
| New York | 72 ms |
| Atlanta | 73 ms |
| Washington | 79 ms |
| São Paulo | 112 ms |
| Mexico City | 113 ms |
| Portland | 132 ms |

A Latin American datacenter is not closer to Colombia than US East: São Paulo and Mexico City are
about twice as far as Miami.

## 2. Dokploy and Cloudflare

- Dokploy cannot run on Cloudflare: Workers have no Docker, and Cloudflare Containers (GA 2026-04-13)
  has no public ports, an ephemeral disk and no uptime guarantee. Dokploy cannot deploy to Workers or
  Pages either. Run Dokploy on a VPS with Cloudflare in front.
- In front of Dokploy: Full (Strict) with a Cloudflare Origin CA certificate and Dokploy's
  certificate set to None, never Flexible; or a Tunnel (a cloudflared app pointed at
  `dokploy-traefik:80`, HTTPS off in Dokploy). R2 for backups and uploads.
- Cloudflare limits: 100 MB uploads on the free plan; a 125 s read timeout (error 524).
- Known Dokploy issues: #4949 (Let's Encrypt stays after switching to Origin CA); #5248 (the real
  client IP needs Traefik `trustedIPs`); #3446 (a 1450-byte private network MTU broke Swarm with 504s
  until the network MTU field was added); #3375 (Swarm overlay breaks over Tailscale relays); #3516
  (database backups fail when the database runs on a Swarm worker).
- Dokploy needs "at least 2GB of RAM and 30GB of disk space"
  (https://docs.dokploy.com/docs/core/installation). It recommends scaling vertically first; a cluster
  requires a container registry (https://docs.dokploy.com/docs/core/cluster); a build server builds
  Applications, not Compose (https://docs.dokploy.com/docs/core/remote-servers/build-server).

## 3. Study A — a large platform that scales (self-hosted, Dokploy or plain Docker)

Scenario: SSR and API routes, Postgres, uploads, sessions; sudden growth possible. Growth path:
(1) Cloudflare cache in front; (2) a bigger VPS; (3) Next.js replicas and more Swarm nodes on a
private network, builds off the serving node; (4) Postgres on its own server or managed, PgBouncer,
Redis for sessions and a shared Next.js `cacheHandler`, uploads to S3/R2.

### Weighted matrix (scores 1–5)

Weights: latency to Colombia 0.20; the stage-4 stack in one region (free VPC, load balancer, managed
Postgres, managed Valkey, object storage) 0.20; price and egress 0.20; elasticity (hourly billing,
resize up and down, API) 0.15; Swarm fit (private network MTU, UDP) 0.10; trust (SLA, support,
account risk) 0.15.

| Provider | Latency | Stack | Price | Elasticity | Swarm | Trust | Total |
|---|---|---|---|---|---|---|---|
| Akamai/Linode (Miami) | 5 | 4 | 4.5 | 5 | 4 | 4 | **4.45** |
| DigitalOcean (NYC3) | 4 | 5 | 4 | 4.5 | 4 | 4 | **4.28** |
| Vultr (Miami) | 5 | 4.5 | 4 | 3 | 3.5 | 3.5 | 4.03 |
| AWS Lightsail / EC2 | 4 | 3.5 | 3 | 2 | 4 | 4.5 | 3.48 |
| OVHcloud (Vint Hill) | 4 | 3 | 3.5 | 3 | 4 | 3 | 3.40 |
| Contabo (New York) | 4 | 1.5 | 5 | 1.5 | 3 | 2 | 2.93 |
| Hetzner (Ashburn) | 4 | 2 | 1.5 | 3 | 3 | 3 | 2.70 |
| Hostinger VPS | 4 | 1 | 4 | 1 | 1.5 | 3 | 2.55 |

### Evidence per provider

- **Akamai/Linode.** Miami is a core region with VPC, NodeBalancers, Managed Databases and
  Kubernetes; Object Storage is not listed there (`api.linode.com/v4/regions`). Shared 2 / 4 / 8 / 16
  GB: $12 / $24 / $48 / $96 a month, hourly ($0.018/h for 2 GB), with 2 / 4 / 5 / 8 TB of transfer;
  overage $0.005/GB, pooled across the account (`/v4/linode/types`, `/v4/network-transfer/prices`).
  Backups $2.50 (2 GB), $5 (4 GB). Managed Postgres 4 GB $63 for one node, $147 for three
  (`/v4/databases/types`); NodeBalancer $10. Resizes up and down, with a warm option
  (https://techdocs.akamai.com/cloud-computing/docs/resize-a-compute-instance). SLA 99.99%
  (https://akamai.com/legal/sla-compute). Managed Valkey only in limited availability since
  2026-08-18. São Paulo costs 40% more but carries the full stack.
- **DigitalOcean.** No Latin American region; NYC3 has Droplets, VPC, load balancers, Spaces,
  Postgres and Valkey (https://docs.digitalocean.com/platform/regional-availability/). Droplets 4 / 8
  / 16 GB $24 / $48 / $96 with 4 / 5 / 6 TB, per-second billing since 2026-01-01
  (https://www.digitalocean.com/pricing/droplets); overage $0.01/GiB pooled. Managed Postgres 4 GB
  $60.90, Valkey 1 GB $15 (https://www.digitalocean.com/pricing/managed-databases). A CPU and RAM
  resize can be reversed; a disk resize cannot.
- **Vultr.** Miami, Mexico City, Santiago, São Paulo; no Bogotá. High Performance 4 / 8 / 16 GB $24 /
  $48 / $96 (16 GB has 8 vCPU), 5 / 6 / 8 TB; overage $0.01/GB; load balancer $10; Postgres and Valkey
  from $18 (https://www.vultr.com/pricing/). São Paulo costs 50% more and lists no load balancer
  (`api.vultr.com/v2/plans` `location_cost`). No Object Storage in Miami. **Resizing down is not
  supported** (https://docs.vultr.com/products/compute/cloud-compute/management/resize-instance).
- **Lightsail.** $24 / $44 / $84 for 4 / 8 / 16 GB; São Paulo gets half the transfer; overage $0.09/GB
  (Virginia), $0.15/GB (São Paulo); upsizing goes through a snapshot and never down
  (https://aws.amazon.com/lightsail/pricing/).
- **Hetzner.** Since 2026-06-15 new US orders cost much more: CPX31 (4 vCPU, 8 GB) $73.49
  (https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/). No managed DB.
- **Hostinger VPS.** São Paulo, Boston, Phoenix. KVM 2 (8 GB) $8.79 intro and $14.99 at renewal,
  prepaid for 24 months (https://www.hostinger.com/vps-hosting). No managed DB or load balancer; no
  evidence of private networking. Monthly price without prepay not verified.
- **Contabo.** Cheapest, but its rate assumes a long term, and it has no managed DB or load balancer.

### Pick per stage

1. Cloudflare in front: cache `/_next/static`, `/_next/image` and public assets; bypass on session
   cookies; uploads on R2 ($0.015 per GB-month, no egress fee).
2. Akamai Miami, 4 → 8 → 16 GB; keep the disk small enough to fit the smaller plan to downsize.
3. More Linodes in Miami on a VPC; overlay MTU = underlay − 50, checked with a don't-fragment ping;
   builds in GitHub Actions pushed to GHCR.
4. Akamai Managed PostgreSQL with PgBouncer as a service; never Postgres on a Swarm worker (#3516);
   Valkey on a small Linode until Akamai's leaves limited availability; uploads on R2.

DigitalOcean wins instead when every managed piece must be generally available in one datacenter
today, or when users are mostly in the US. Vultr wins for users spread over Mexico and Chile. For
users in Brazil, Akamai São Paulo.

### Monthly bills (traffic assumed: stage 2 about 2 TB, stage 4 about 10 TB of egress)

| Setup | Akamai Miami | DigitalOcean NYC3 | Vercel Pro |
|---|---|---|---|
| Stage 2: one 8 GB node | ≈ $58 | ≈ $57.60 | ≈ $200–270 |
| Stage 4: 3 × 8 GB, HA Postgres, Valkey, LB, R2 | ≈ $330 | ≈ $298 | ≈ $1,600–2,250 |

Vercel charges all the transfer it serves ($0.15/GB in `iad1`, $0.22/GB in `gru1`), which is why it
grows fastest. Fly.io lands around $450–650 at stage 4.

### How traffic was counted

Traffic is egress: bytes leaving the server. Estimate it as the weight of one visit times visits per
month (an assumed 2 MB × 1,000,000 visits = 2 TB). With Cloudflare in front, cached bytes never reach
the server (an assumed ~80% for static assets and images), and uploads served from R2 cost no egress,
so the server's share is a fraction of the total.

## 4. Study B — a small internal tool (2–15 users, monthly billing, no ops)

Weights: monthly cost including the database and backups 0.25; ops burden 0.20; Next.js support
0.15; data safety 0.15; reliability 0.10; protection from surprise bills 0.10; latency 0.05.

| Option | Total | Monthly |
|---|---|---|
| **DigitalOcean App Platform + Managed Postgres** | **4.35** | ≈ $20.15 |
| Render Hobby (Starter app + small Postgres) | 4.25 | ≈ $15.25 |
| Railway Hobby + Neon Launch | 4.20 | ≈ $7–9 |
| Railway Pro | 4.10 | $20 flat |
| Vercel Pro + Neon Launch | 4.10 | ≈ $23.50 |
| Netlify Personal + Neon | 4.00 | ≈ $11 |
| Cloudflare Workers Paid + Neon | 3.95 | ≈ $5–8 |
| Lightsail | 3.80 | $22 |
| Linode 2 GB VPS | 3.55 | $14.50 |
| Koyeb Pro | 3.55 | $29+ |
| Fly.io + Managed Postgres | 3.05 | $42+ |

- **Pick: DigitalOcean.** App $5 (1 vCPU, 512 MiB, 50 GiB transfer,
  https://www.digitalocean.com/pricing/app-platform) and Managed Postgres $15.15 with daily backups and
  7-day point-in-time restore (https://docs.digitalocean.com/products/databases/postgresql/details/features/).
  Flat prices, deploys from git with rollbacks, Next.js as a plain Node app.
- **Render** saves about $5 with a 3-day restore window (https://render.com/docs/postgresql-backups);
  its 2026 plan change cut Hobby's included bandwidth to 5 GB.
- **Vercel Pro** is $20 per deploying seat with free Viewer seats; Vercel Authentication protects
  deployments for free. Vercel Hobby is excluded: "the Hobby plan restricts users to non-commercial,
  personal use only" (https://vercel.com/docs/plans/hobby).
- Railway was ranked lower for its incident of 2026-02-11, when an anti-fraud update stopped real
  workloads (https://blog.railway.com/p/incident-report-february-11-2026).
- Cloudflare Workers Paid is $5 minimum with 10M requests and 30M CPU ms; the free plan allows 10 ms of
  CPU per request (https://developers.cloudflare.com/workers/platform/limits/). Cloudflare recommends
  vinext, in beta, for Next.js.
- Keep the app private for free with Cloudflare Access (free under 50 users).

## 5. Study C — DigitalOcean App Platform in detail

Read by the lead on 2026-10-23 from DigitalOcean's pages. Study B's pick, and a candidate for the
platform projects the harness may set up later (Sebastián, 2026-10-23: "nos sirve para cuando se haga
un proyecto plataforma para el harnes").

App instances (https://www.digitalocean.com/pricing/app-platform):

| Plan | vCPU | RAM | Transfer | Monthly | Several containers |
|---|---|---|---|---|---|
| Shared (Fixed) | 1 | 512 MiB | 50 GiB | $5 | No: "a fixed CPU will limit you to one container instance only" |
| Shared (Fixed) | 1 | 1 GiB | 100 GiB | $10 | No |
| Shared | 1 | 1 GiB | 150 GiB | $12 | Yes |
| Shared | 1 | 2 GiB | 200 GiB | $25 | Yes |
| Shared | 2 | 4 GiB | 250 GiB | $50 | Yes |

- Extra transfer $0.02/GiB; a dedicated egress IP $25 a month per app; a development database $7
  (512 MiB); static sites free (3 apps).
- Builds run apart from the instance: "8 CPU cores, 15 GiB of memory, and 24 GiB of disk space to each
  build", and "Builds time out after 1 hour" (https://docs.digitalocean.com/products/app-platform/details/limits/).
  A Next.js build does not need a bigger plan.
- Limits from the same page: the local disk is ephemeral and capped at 4 GiB, and "App Platform does
  not support volumes" (uploads go to Spaces or R2); uploads time out after 600 seconds; at most 250
  containers per app, 100 with request-based autoscaling; cron jobs do not start by themselves; HTTP is
  redirected to HTTPS but no HSTS header is set (set it in the app).
- Regions: NYC, AMS, SFO, SGP, LON, FRA, TOR, BLR, SYD, ATL, RIC, MKC, MEM
  (https://docs.digitalocean.com/products/app-platform/details/availability/).

Managed PostgreSQL (https://www.digitalocean.com/pricing/managed-databases,
https://docs.digitalocean.com/products/databases/postgresql/details/limits/):

- Smallest plan $15.15: 1 GiB RAM, 1 vCPU, 10–30 GiB storage; 22 backend connections; PgBouncer pools
  supported ("21 PgBouncer pools and up to 1,000 connections, depending on the plan size").
- Daily backups and point-in-time restore "within the previous seven days"
  (https://docs.digitalocean.com/products/databases/postgresql/details/features/); whether they are in
  the $15.15 is not stated there.
- In Atlanta (ATL1) Postgres has "Limited availability: Only some plans are available"; App Platform
  and Spaces are available there (https://docs.digitalocean.com/platform/regional-availability/). If the
  plan is missing in Atlanta, New York is 72 ms from Bogotá.
- For a large platform: "Starting November 30, 2026 for all accounts (October 15, 2026 for new
  accounts), new clusters can't use plans above 4 GiB RAM or add standby or read-only nodes" on the
  Standard Edition. High availability then needs the Advanced Edition, whose price was not read.
- Managed Valkey from $15 (1 GiB).

Bills for the small internal tool: $5 app + $15.15 Postgres = $20.15 a month; with the 1 GiB fixed
instance, $25.15. Start at 512 MiB, watch memory the first week, and move up only if it alerts.

## 6. Not verified, and contradictions

- Not verified: Akamai's backup prices above 4 GB, whether its VPC is free, its Bogotá distributed
  region; DigitalOcean's VPC MTU, load balancer price, whether Postgres backups are in the $15.15 and
  whether Managed Postgres is offered in Atlanta; Hostinger's monthly price without prepay and private
  networking; commercial use on Render Hobby, Railway Hobby, Netlify Personal and Neon Free; whether
  512 MB of RAM fits the app. No independent hardware benchmark was found; "quality" here means
  managed services, SLA and flexibility, not measured speed.
- Contradictions: Vultr's FAQ claims uniform global prices, its API shows São Paulo at +50%; Hetzner's
  repricing date differs across sources (the official page says 2026-06-15); Vultr's "100%" SLA pays
  tiered credits claimed by ticket; Railway Pro seats differ between its pricing page and docs.
