// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package e2e

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func RunQtcli(t *testing.T, checker func(string) bool, args ...string) {
	t.Helper()

	cwd, err := os.Getwd()
	if err != nil {
		t.Fatal("cannot determine current workding directory")
	}

	qtcliPath := filepath.Join(cwd, "..", "qtcli")
	tempDir, err := os.MkdirTemp(cwd, "_qtcli-e2e-")
	if err != nil {
		t.Fatal("cannot make temporal directory to run a test")
	}

	checkerSucceeded := false
	defer func() {
		if checkerSucceeded {
			os.RemoveAll(tempDir)
		} else {
			t.Logf("test failed, keeping temp directory: %s", tempDir)
		}
	}()

	cmd := exec.Command(qtcliPath, args...)
	cmd.Dir = tempDir

	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Errorf("qtcli command failed: %v", err)
		t.Errorf("- dir: %v", cmd.Dir)
		t.Errorf("- cmd: %v", cmd.String())
		t.Fatalf("- out: %v", string(out))
	}

	checkerSucceeded = checker(tempDir)
	if !checkerSucceeded {
		t.Errorf("checker failed")
	}
}

func CheckDirsEqual(t *testing.T, dir1, dir2 string) bool {
	t.Helper()

	if _, err := exec.LookPath("diff"); err != nil {
		t.Fatalf("'diff' command not found in PATH: %v", err)
		return false
	}

	cmd := exec.Command("diff", "--color=always", "-r", "-U", "3", dir1, dir2)
	out, err := cmd.CombinedOutput()
	if err == nil {
		return true
	}

	if exitErr, ok := err.(*exec.ExitError); ok {
		code := exitErr.ExitCode()
		if code == 1 {
			t.Logf("diff failed\n%s", string(out))
			return false
		}
		t.Fatalf("diff failed (exit %d): %s", code, string(out))
		return false
	}

	t.Fatalf("failed to run diff: %v", err)
	return false
}
