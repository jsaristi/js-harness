# tk

A small task tracker for the command line. Tasks live in one JSON file, so they are easy to back
up, diff and carry between machines.

## Install

```sh
npm install --global .
```

tk needs Node 22 or newer and has no other dependencies.

## Usage

```sh
tk add "Buy milk"      # add a task
tk list                # show the open tasks
tk done 1              # mark task 1 as done
tk remove 1            # delete task 1
tk export              # print the tasks as JSON
tk help                # list the commands
tk help <command>      # the details of one command
```

The tasks are kept in `.tk/tasks.json` in the current directory; set `TK_STORE` to use another
file.

## Commands

| Command | What it does |
| --- | --- |
| `add` | Add a task |
| `done` | Mark a task as done |
| `export` | Write the tasks as JSON or CSV |
| `list` | List the open tasks |
| `remove` | Remove a task |

Every command is described in [docs/COMMANDS.md](docs/COMMANDS.md). Bash completion for the
commands is in `completions/tk.bash`; source it from your `.bashrc`.

## Contributing

Before adding or changing a command, read [CONTRIBUTING.md](CONTRIBUTING.md). The tests run with
`npm test`.
