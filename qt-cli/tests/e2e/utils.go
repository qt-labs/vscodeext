// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package e2e

import (
	"bytes"
	"crypto/sha256"
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

func CheckFileExists(t *testing.T, fullPath string) bool {
	t.Helper()
	s, err := os.Stat(fullPath)
	if err != nil {
		t.Fatal(err)
		return false
	}

	if s.IsDir() {
		t.Fatalf("found a directory instead of a file: %v", fullPath)
		return false
	}

	if s.Size() == 0 {
		t.Fatalf("found but has no content: %v", fullPath)
		return false
	}

	return true
}

func CheckDirExists(t *testing.T, fullPath string) bool {
	t.Helper()
	s, err := os.Stat(fullPath)
	if err != nil {
		t.Fatal(err)
		return false
	}

	if !s.IsDir() {
		t.Fatalf("found a file instead of a directory: %v", fullPath)
		return false
	}

	return true
}

func CheckDirHasFiles(t *testing.T, dir string, files []string) bool {
	t.Helper()
	if !CheckDirExists(t, dir) {
		return false
	}

	for _, file := range files {
		if !CheckFileExists(t, filepath.Join(dir, file)) {
			return false
		}
	}

	return true
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

func CheckFilesEqual(t *testing.T, file1 string, file2 string) bool {
	t.Helper()

	t.Logf("comparing %s, %s", file1, file2)

	content1, err1 := os.ReadFile(file1)
	content2, err2 := os.ReadFile(file2)
	if err1 != nil || err2 != nil {
		t.Fatalf("failed to read files: %v, %v", err1, err2)
		return false
	}

	if !bytes.Equal(content1, content2) {
		t.Logf("files differ: '%s' vs '%s'", file1, file2)
		return false
	}

	return true
}

// helpers
func hashDirectory(root string) ([]byte, error) {
	h := sha256.New()

	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.IsDir() {
			return nil
		}

		relPath, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}

		h.Write([]byte(relPath))
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}

		h.Write(data)
		return nil
	})

	if err != nil {
		return nil, err
	}

	return h.Sum(nil), nil
}
