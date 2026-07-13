package websocket

import (
	"strings"
	"testing"
)

func TestBuildExecCommandDefaultTerminalUsesTmux(t *testing.T) {
	command := buildExecCommand("shell", "", "attach", "terminal-main")
	if len(command) != 3 || command[0] != "/bin/bash" || command[1] != "-lc" {
		t.Fatalf("unexpected shell command: %#v", command)
	}

	run := command[2]
	for _, expected := range []string{
		"export TERM=xterm-256color COLORTERM=truecolor",
		"tmux has-session -t edu_terminal_main",
		"tmux attach-session -t edu_terminal_main",
		"tmux new-session -s edu_terminal_main",
		"exec bash -l",
	} {
		if !strings.Contains(run, expected) {
			t.Errorf("default terminal command missing %q: %s", expected, run)
		}
	}
}

func TestBuildExecCommandDefaultTerminalRestartKillsOldSession(t *testing.T) {
	command := buildExecCommand("shell", "", "restart", "terminal-main")
	if !strings.Contains(command[2], "tmux kill-session -t edu_terminal_main") {
		t.Fatalf("restart command does not clean the previous tmux session: %s", command[2])
	}
}

func TestBuildExecCommandOpenCodeUsesColorTerminal(t *testing.T) {
	command := buildExecCommand("exec", "opencode", "attach", "opencode")
	run := command[2]
	if !strings.Contains(run, "export TERM=xterm-256color COLORTERM=truecolor") {
		t.Fatalf("opencode command does not use a color-capable terminal: %s", run)
	}
	if !strings.Contains(run, "opencode; exec bash") {
		t.Fatalf("opencode command does not preserve a fallback shell: %s", run)
	}
}
