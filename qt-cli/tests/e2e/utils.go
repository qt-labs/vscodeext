// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package e2e

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func RunQtcli(t *testing.T, checker func(string), args ...string) {
	t.Helper()

	cwd, err := os.Getwd()
	if err != nil {
		t.Fatal("cannot determine current workding directory")
	}

	qtcliPath := filepath.Join(cwd, "..", "qtcli")
	tempDir, err := os.MkdirTemp(cwd, "qtcli-e2e-")
	if err != nil {
		t.Fatal("cannot make temporal directory to run a test")
	}

	defer os.RemoveAll(tempDir)
	cmd := exec.Command(qtcliPath, args...)
	cmd.Dir = tempDir

	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Errorf("qtcli command failed: %v", err)
		t.Errorf("- dir: %v", cmd.Dir)
		t.Errorf("- cmd: %v", cmd.String())
		t.Fatalf("- out: %v", string(out))
	}

	checker(tempDir)
}

func CheckFileExists(t *testing.T, fullPath string) {
	t.Helper()
	s, err := os.Stat(fullPath)
	if err != nil {
		t.Fatal(err)
	}

	if s.IsDir() {
		t.Fatalf("found a directory instead of a file: %v", fullPath)
	}

	if s.Size() == 0 {
		t.Fatalf("found but has no content: %v", fullPath)
	}
}

func CheckDirExists(t *testing.T, fullPath string) {
	t.Helper()
	s, err := os.Stat(fullPath)
	if err != nil {
		t.Fatal(err)
	}

	if !s.IsDir() {
		t.Fatalf("found a file instead of a directory: %v", fullPath)
	}
}

func CheckDirHasFiles(t *testing.T, dir string, files []string) {
	t.Helper()
	CheckDirExists(t, dir)

	for _, file := range files {
		CheckFileExists(t, filepath.Join(dir, file))
	}
}
