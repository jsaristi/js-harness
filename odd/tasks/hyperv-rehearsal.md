# hyperv-rehearsal

Locator: `odd/tasks/hyperv-rehearsal.md` · Branch: none yet (written on `claude/jh301-next-unit-docs`, documents only)
· Session: JH 301, unit 3 of the lead's brief `brief-301-plans-ready.md` · Test runner: `node --test`

## State
Written 2026-11-22 by JH 301, documents only, nothing installed or downloaded. Next: his decisions under `## Ask me
before`, through the lead (card 6 of `return-decisions-2026-11-22.md`: "El ensayo en Hyper-V: instala algo en tu
máquina"). Open: all of T1 to T4.

## Goal
Prove, in a fresh Windows VM on his machine, that the backup and the reinstall protocol bring back a working harness
from nothing: the stack installed, engram answering from the restored export, and a project's state readable, without
touching the live backup.

## Why
The last open box of the roadmap's "Memory that survives the machine": "A from-zero rehearsal in a Hyper-V VM, the
proof (Windows Sandbox cannot run WSL2 or winget)". Every part was proven alone on a scratch home (restore from both
copies, `backup ready`, the readable fallback, the transcripts), never all of them from an empty Windows. His words,
2026-10-19, quoted in the roadmap: "si por alguna razon despues de la limpiezas que le hago al computador se llegan a
borrar las memorias o me toca que reinstalar el sistema operativo voy a perder todo".

## Done when
- `grep -q "^- Rehearsal result:" odd/tasks/hyperv-rehearsal.md` exits 0 (red until T3 writes that Log line)
- `js-harness contract check odd/tasks/hyperv-rehearsal.md` exits 0
- `npm run check` exits 0
- In the VM, with the result written in `## Log`: `js-harness doctor` exits 0; an engram search returns an
  observation the export holds (named before the run); `js-harness backup verify` passes; a session started in the
  restored `D:\js-harness` clone reads its roadmap
- After the run the VM and its disk are deleted and his host's Hyper-V state is what he chose to keep

## In scope / Out of scope
- In: a Hyper-V VM on his machine; the private backup repositories read (cloned) from inside it; this document.
- Out: any `backup run`, `backup run --adopt` or push from the VM — because `--adopt` takes over the backup for the
  machine that runs it (`js-harness backup --help`), and a rehearsal must leave the live backup his host's; his real
  home; the later items the roadmap holds behind this one (a per-project import, pinned versions), built only if the
  rehearsal shows the need.

## Constraints
- Nothing from the VM writes to his GitHub repositories — because the live backup is his host's. A promise is not
  enough: `js-harness install` registers `backup --hook` on Stop, which starts `backup run` detached whenever a
  backup is due (`bin/backup.mjs:90`), so a session in the VM could push with nobody typing it. The VM either signs
  in with a read-only credential (decision 5) or the hook is removed from the VM's settings right after install and
  checked absent before the first session.
- Credentials the VM needs (a GitHub sign-in to clone the private repositories, a Claude sign-in) are typed by him in
  the VM — because sign-ins are his, and a copied credentials file once killed his login
  (`odd/tasks/f8-s0-baseline.md:36-39`).
- The VM's disk sits on D:, dynamic, and is deleted after — because C: has 30 GB free.
- The run reads D:'s free space before it starts and stops under 5 GB — because D: has 42 GB and the VM grows into it.

## Ask me before
1. Turning on Hyper-V: a Windows feature, administrator rights and a restart of his machine. His hands only.
2. Which Windows, and downloading it: his host is Windows 10 IoT Enterprise LTSC 2021, and the closest proof is the
   same edition (an LTSC evaluation image, if Microsoft still offers one [?]); a Windows 11 Enterprise evaluation
   (about 5 to 6 GB [e], 90 days, no licence) proves a reinstall onto a newer Windows instead.
3. The VM's size: proposed 8 GB of memory of his 19.7 GB, 4 virtual processors, a dynamic disk on D: capped at 60 GB.
4. Whether Hyper-V stays on after the run or is turned off again.
5. The VM's GitHub access: a read-only fine-grained token for the backup repositories, made and typed by him, or his
   usual sign-in with the backup hook removed in the VM (Constraints).

## Depth pass
- 1. Method: a disaster-recovery test is only a proof when it starts from an empty machine and uses only what the
  recovery plan says survives (the off-machine copies and the written protocol); the standard is a restore drill with
  a named expected record, read back, and no write to the live backup. The smallest change: one VM, one run, the
  protocol followed as written, its gaps logged, no new code unless a gap needs it.
- 2. Raw material:
  - `docs/ROADMAP.md:271`, "Memory that survives the machine": the open box; the boxes above it already proven.
  - `odd/tasks/backup-ready.md:59` (L5): the reinstall protocol's origin and the Hyper-V line, and why Windows
    Sandbox cannot do it (no WSL2, no winget).
  - "Before a reinstall" (`bin/lib/lead-protocols.mjs:18`): the protocol the rehearsal follows.
  - `js-harness backup --help`: `restore`, `verify`, and `run --adopt` (the first run after a reinstall, which takes
    over the backup, so out of scope here).
  - The machine, read 2026-11-22 with PowerShell, read-only: `HypervisorPresent` True (WSL2's platform); `Get-VM`
    not found, so the Hyper-V feature and its tools are not on; processor Intel Core i5-1035G1 (Hyper-V offers
    nested virtualization on Intel, which WSL2 in the VM needs [a], not tried); 19.7 GB of memory; free space C: 30
    GB, D: 42 GB.
- 3. The bar:
  spec 1: `js-harness doctor`: none today in a VM, new behaviour (with the other three checks of `## Done when`).
- 4. Refutation: the cheapest thing that could show the rehearsal cannot run here is the machine. Run 2026-11-22:
  `powershell -NoProfile -Command "(Get-CimInstance Win32_ComputerSystem).HypervisorPresent; [bool](Get-Command Get-VM -ErrorAction SilentlyContinue); (Get-CimInstance Win32_Processor).Name"`:
  True, False, Intel Core i5-1035G1; free space by `Get-PSDrive`: C: 30 GB, D: 42 GB. The same first run read
  `(Get-CimInstance Win32_Processor).VirtualizationFirmwareEnabled` False, which points the other way; it is
  read as masked by the running hypervisor [a], since `systeminfo` lists a `Hyper-V Virtual Ethernet Adapter`
  (`vEthernet`, WSL2's) and Windows reports a firmware flag as off once a hypervisor holds the processor. So the
  Hyper-V feature and its tools are off but the platform runs; Intel is nestable; D: holds a dynamic disk of a fresh Windows, its updates, WSL2 and the stack
  (about 30 to 40 GB [e]) only if little else grows there, so the run reads D:'s free space first and stops under
  5 GB (a constraint of T1, below).
  Verdict: supports
- 5. Request: on his yes to the five decisions, a session writes the step list (T1), he turns Hyper-V on and signs in
  where the VM needs him (T2), a session drives the rehearsal by the protocol as written, logging every gap, with no
  write to the live backup (T3), and the VM is deleted (T4).
  Adds: none

## Specs
1. The roadmap's box, as written there: "A from-zero rehearsal in a Hyper-V VM, the proof (Windows Sandbox cannot run
   WSL2 or winget)."

## Tasks
- [ ] T1 (kind: design) the step list: creating the VM, Windows, winget, WSL2, node, git, Claude, `js-harness install`,
  the clone of the private repositories, `backup restore`, the four checks; each step's command, who runs it and its
  undo — spec 1; inline; this document
- [ ] T2 (kind: verify) his steps: Hyper-V on, the image downloaded, his sign-ins in the VM; on his yes — spec 1; his
  hands
- [ ] T3 (kind: verify) the rehearsal by T1's list, the gaps logged here, nothing pushed from the VM — spec 1; inline;
  this document's Log
- [ ] T4 (kind: verify) the VM and its disk deleted, D:'s free space read back, Hyper-V left as he chose — spec 1;
  inline

## Log
- L1 (2026-11-22, JH 301, the lead's brief as written): "The next roadmap units (`js-harness progress`,
  `docs/ROADMAP.md`): for the next 2-3 units with no feature document yet, write `odd/tasks/<feature>.md` with its
  task contract and `## Depth pass` ... docs only, so Codex day starts with builds ready."
- L2: the roadmap is left untouched because open PRs 888, 934 and 935 edit `docs/ROADMAP.md`; the lead links this
  document from the box when it lands.
