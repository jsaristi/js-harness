# bash completion for tk: source this file from your .bashrc
_tk() {
  local commands="add done help list remove"
  local current="${COMP_WORDS[COMP_CWORD]}"
  if [ "$COMP_CWORD" -eq 1 ]; then
    COMPREPLY=($(compgen -W "$commands" -- "$current"))
  elif [ "${COMP_WORDS[1]}" = "list" ]; then
    COMPREPLY=($(compgen -W "--all" -- "$current"))
  elif [ "${COMP_WORDS[1]}" = "help" ]; then
    COMPREPLY=($(compgen -W "$commands" -- "$current"))
  fi
}
complete -F _tk tk
