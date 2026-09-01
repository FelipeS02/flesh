# Workstation handoff

Transport-only branch. It carries no product code and is never merged into
`main` or any `pr*` branch — it exists so a second machine can restore the
local state that git does not otherwise track.

Re-run the export steps below on the source machine whenever the state moves;
force-push this branch rather than accumulating history.

## Contents

| Path | Source on the origin machine |
| --- | --- |
| `engram/engram-export.json` | `~/.engram/engram.db` (all projects) |
| `pencil/ed824ca8-f10b-4497-a449-9db1727fba69/` | `~/.pencil/documents/<id>/` |

## Restore

### Engram

Import merges into the existing database; it does not replace it.

```sh
engram import .handoff/engram/engram-export.json
engram stats   # confirm the observation count
```

### pen.dev

The document is a directory: a `.pen` file plus its `images/` siblings. Copy
the whole directory or the design loads without its bitmaps.

```sh
cp -R .handoff/pencil/ed824ca8-f10b-4497-a449-9db1727fba69 ~/.pencil/documents/
```

Restart the pen.dev app so it rescans `~/.pencil/documents/`.

## Re-export

```sh
engram export .handoff/engram/engram-export.json
cp -R ~/.pencil/documents/ed824ca8-f10b-4497-a449-9db1727fba69 .handoff/pencil/
```
