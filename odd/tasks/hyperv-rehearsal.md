# hyperv-rehearsal

Locator: `odd/tasks/hyperv-rehearsal.md` · Branch: none yet (written on `claude/jh301-next-unit-docs`, documents only)
· Session: JH 301, unit 3 of the lead's brief `brief-301-plans-ready.md` · Test runner: `node --test`

## State
Written 2026-11-22 by JH 301, documents only, nothing installed or downloaded; its refutation only read the machine
and changed nothing. Owed first: this document's double review (`rule:double-review`), whose Codex reader is held
until the weekly reset of 2026-11-23 23:45; nothing is built or installed before it. Next: his decisions under `## Ask me
before`, through the lead (card 6 of `return-decisions-2026-11-22.md`: "El ensayo en Hyper-V: instala algo en tu
máquina"). Open: all of T1 to T4; T1's step list is drafted under `## DRAFT: T1 steps` (2026-11-23), unreviewed.

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

## DRAFT: T1 steps
Written 2026-11-23 by a docs writer for the lead, before his five answers under `## Ask me before` and before this
document's double review; nothing here was run, and every Hyper-V or in-VM command is `[a]`, not tried. T1 stays
unticked until both reviews read it. "He" is Sebastián's hands; "host session" is a Claude session on his machine;
"VM session" is Claude inside the VM, which starts only after step 16 reads the backup hook absent, so every in-VM
step before it is his, in a terminal. "Goes with
the VM" means T4's deletion undoes it. `<backup-repo>` stands for his private memory backup repository; no name from
his config is written here.

1. Read D:'s free space and stop under 5 GB (Constraints). Host session:
   `powershell -NoProfile -Command "[math]::Round((Get-PSDrive D).Free/1GB,1)"`. Undo: none, it reads.
2. Name the expected engram observation before the run (check 2 of `## Done when`): one observation id and a search
   term that finds it, read from the host's engram and written in `## Log`, named by its title or a distinctive
   phrase, with its id only a hint, since an id may change through export and import [a]. Host session:
   `engram search "<term>"` [a]. Undo: delete the Log line.
3. Turn Hyper-V on (decision 1), administrator PowerShell, then restart. He:
   `Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -All`. Undo (decision 4 chooses whether it
   runs in T4): `Disable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All` and a restart; WSL2's own
   platform (`VirtualMachinePlatform`) is a separate feature and stays.
4. Download the image (decision 2). He, from Microsoft's evaluation centre, into a folder on D: such as
   `D:\hyperv-rehearsal\`. Decision 2 changes this step: an LTSC 2021 evaluation image if one is offered [?], else a
   Windows 11 Enterprise evaluation, which needs a generation 2 VM with Secure Boot and a virtual TPM (step 5) and
   whose minimum disk (64 GB [a]) is above decision 3's proposed 60 GB cap, so a Windows 11 answer raises the cap.
   Undo: delete the ISO.
5. Create the VM (decision 3), administrator PowerShell. He, or the host session if he runs it elevated [a]:
   `New-VM -Name js-rehearsal -Generation 2 -MemoryStartupBytes 8GB -NewVHDPath D:\hyperv-rehearsal\js-rehearsal.vhdx
   -NewVHDSizeBytes 60GB -SwitchName "Default Switch"`, then `Set-VMProcessor js-rehearsal -Count 4`,
   `Add-VMDvdDrive js-rehearsal -Path <iso>`, and for Windows 11 `Set-VMKeyProtector js-rehearsal -NewLocalKeyProtector;
   Enable-VMTPM js-rehearsal`. Decision 3 changes the memory, processors and size; a `-NewVHDPath` on D: keeps the disk
   off C:. Undo: `Remove-VM js-rehearsal -Force` and delete `js-rehearsal.vhdx` (T4).
6. Expose nested virtualization while the VM is off, since WSL2 inside it needs it [a]. He or host session:
   `Set-VMProcessor js-rehearsal -ExposeVirtualizationExtensions $true`. Undo: goes with the VM.
7. Install Windows from the ISO (`Start-VM js-rehearsal`, then `vmconnect localhost js-rehearsal`), with a local
   account and no Microsoft sign-in. He. Undo: goes with the VM.
8. winget. He, in the VM: `winget --version`. Decision 2 changes this step: Windows 11 ships it; LTSC 2021 may not
   ship the App Installer [?], and then he installs `Microsoft.DesktopAppInstaller` from its GitHub release (an
   msixbundle with its dependencies) [a]. Undo: goes with the VM.
9. WSL2. He, in the VM, administrator: `wsl --install --no-distribution`, then a restart, then `wsl --status`. A
   failure here is the nested-virtualization gap (step 6) and is logged as a gap, not worked around. Undo: goes with
   the VM.
10. Node, git and gh. He, in the VM: `winget install OpenJS.NodeJS.LTS Git.Git GitHub.cli`, then a new terminal and
    `node -v && git --version && gh --version`. The reinstall list names Node through nvm; the rehearsal logs which it
    used. Undo: goes with the VM.
11. Sign in to GitHub (decision 5), first, as the protocol's step 5 says. He, in the VM: `gh auth login`, pasting a
    read-only fine-grained token for `<backup-repo>` (yes to the token), or his usual browser sign-in (the other
    answer); then `gh auth setup-git`, so git can clone a private repository with that sign-in [a]. Undo:
    `gh auth logout`, and he revokes the token on GitHub (T4).
12. Claude. He, in the VM: Claude Desktop (or Claude Code) by its installer, and his own Claude sign-in, starting no
    session yet; no credentials file is copied (Constraints). Undo: goes with the VM; he signs the VM out of his
    Claude account's devices if it lists them.
13. js-harness. He, in a VM terminal: `npm i -g --allow-git=all github:jsaristi/js-harness && js-harness install`
    (`README.md`, "Install"). Undo: `js-harness uninstall`, or goes with the VM.
14. engram, the step `js-harness stack` names as the user's own: engram's own install, then
    `engram setup claude-code`. He, in a VM terminal [a]. Undo: goes with the VM.
15. Remove the backup hook (Constraints), under both answers of decision 5: required with his usual sign-in, a second
    guard with the token. He, in the VM: delete the `Stop` entry whose command is `js-harness backup --hook || exit 0`
    (`bin/lib/hook-entries.mjs:135`) from `~/.claude/settings.json` with an editor. Undo: goes with the VM.
16. Check the hook absent before any session. He: `(Select-String -Path $HOME\.claude\settings.json -Pattern
    "backup --hook").Count` in PowerShell, or `grep -c "backup --hook" ~/.claude/settings.json` in Git Bash, reads 0.
    The VM session starts only after this; it is told to push nothing, and each clone below gets
    `git remote set-url --push origin no-push` [a], so even his usual sign-in cannot push by mistake. Undo: none.
17. Clone the private backup repository once, outside `~/.js-harness`. VM session:
    `git clone https://github.com/<backup-repo>.git C:\rehearsal\backup`, then read its `RESTORE.md`, which
    `backup init` wrote there (`bin/backup.mjs:1036`). Undo: goes with the VM.
18. Clone each bundled repository as `RESTORE.md`'s step 3 says, into the path it had (`D:\js-harness` among them),
    since the Claude memory folder is named after that path. A fresh VM has only C:, so decision 3 adds here: either
    step 5 also attaches a second dynamic VHDX from the host's D: as the VM's D: (`Add-VMHardDiskDrive`) [a], or the
    clone goes to `C:\js-harness` and step 19 adds `--map D:\js-harness=C:\js-harness`. VM session. Undo: goes with
    the VM.
19. Restore. VM session: `js-harness backup restore --from C:\rehearsal\backup`, with step 18's `--map` when it
    chose C:. Undo: goes with the VM; it writes the VM's home only, and never over a live file.
20. Check 3: `js-harness backup verify --from C:\rehearsal\backup`. VM session. Undo: none, it restores into a scratch
    home it removes.
21. Check 1: `js-harness doctor` exits 0. VM session. Undo: none, it reads.
22. Check 2: an engram search for step 2's term returns step 2's observation, matched by its title or phrase. VM
    session: `engram search "<term>"` [a]. Undo: none.
23. Check 4: a new session started in the restored `D:\js-harness` clone reads its roadmap (`docs/ROADMAP.md`) and
    names its next unit. He starts it; it answers. Undo: none.
24. Write `- Rehearsal result:` in `## Log` with each check's output and every gap. The VM pushes nothing, so he
    copies the outputs out (the VM's clipboard through `vmconnect`, or a text file he copies to the host) and the
    host session writes the line. Undo: git.
25. T4: `Stop-VM js-rehearsal -TurnOff; Remove-VM js-rehearsal -Force`, delete the VHDX files and the ISO, read D:'s
    free space back (step 1's command), revoke the token, and run step 3's undo only if decision 4 says off. He for
    the elevated parts. Undo: none, it is the undo.

## Log
- L1 (2026-11-22, JH 301, the lead's brief as written): "The next roadmap units (`js-harness progress`,
  `docs/ROADMAP.md`): for the next 2-3 units with no feature document yet, write `odd/tasks/<feature>.md` with its
  task contract and `## Depth pass` ... docs only, so Codex day starts with builds ready."
- L2: the roadmap is left untouched because open PRs 888, 934 and 935 edit `docs/ROADMAP.md`; the lead links this
  document from the box when it lands.
- L3 (2026-11-23, a docs writer for the lead, on his line 16936 of session 0cdab702 at 06:06:12Z, "avanza el harness y
  las tareas p3endientes solo"): `## DRAFT: T1 steps` written, 25 steps, before his five answers and the double
  review; nothing run, T1 unticked until Codex reads it after the 2026-11-23 23:45 reset.
