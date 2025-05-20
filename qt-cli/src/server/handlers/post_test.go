// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"qtcli/util"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func init() {
	gin.SetMode(gin.ReleaseMode)
}

func TestHandler_PostItems(t *testing.T) {
	cases := []struct {
		presetName   string
		name         string
		expectedCode int
	}{
		{"@types/qml", "myqml", http.StatusCreated},
		{"@projects/cpp/console", "myapp", http.StatusCreated},

		{"@types/qml", "", http.StatusBadRequest},
		{"@types/qml", " ", http.StatusBadRequest},
		{"@types/qml", "myqml*", http.StatusBadRequest},

		{"@projects/cpp/console", "", http.StatusBadRequest},
		{"@projects/cpp/console", " ", http.StatusBadRequest},
		{"@projects/cpp/console", ".", http.StatusBadRequest},
		{"@projects/cpp/console", "sub/myapp", http.StatusBadRequest},
		{"@projects/cpp/console", "myapp&", http.StatusBadRequest},

		{"badpreset", "myapp", http.StatusBadRequest},
	}

	for _, tc := range cases {
		testname := fmt.Sprintf("|%s|%s|%d|", tc.presetName, tc.name, tc.expectedCode)
		t.Run(testname, func(t *testing.T) {
			req := NewItemRequest{
				Name:       tc.name,
				WorkingDir: createTempDir(t),
				PresetId:   util.CreatePresetUniqueId(tc.presetName),
			}

			defer os.RemoveAll(req.WorkingDir)
			testNewItem(t, req, tc.expectedCode)
		})
	}
}

func TestHandler_PostItems_Error_On_ExistingItem(t *testing.T) {
	cases := []struct {
		presetName        string
		name              string
		expectedFileOrDir string
	}{
		{"@types/qml", "myqml", "myqml.qml"},
		{"@projects/cpp/console", "myapp", "myapp/"},
	}

	tempDir := createTempDir(t)
	defer os.RemoveAll(tempDir)

	for _, tc := range cases {
		testname := fmt.Sprintf("|%s|%s|", tc.presetName, tc.name)
		t.Run(testname, func(t *testing.T) {
			if strings.HasSuffix(tc.expectedFileOrDir, "/") {
				os.Mkdir(filepath.Join(tempDir, tc.expectedFileOrDir), 0755)
			} else {
				os.Create(filepath.Join(tempDir, tc.expectedFileOrDir))
			}

			req := NewItemRequest{
				Name:       tc.name,
				WorkingDir: tempDir,
				PresetId:   util.CreatePresetUniqueId(tc.presetName),
			}

			testNewItem(t, req, http.StatusBadRequest)
		})
	}
}

// helpers
func testNewItem(t *testing.T, req NewItemRequest, expectedCode int) {
	bodyBytes, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("failed to marshal request body: %v", err)
	}

	w := httptest.NewRecorder()
	body := bytes.NewReader(bodyBytes)
	ctx, _ := gin.CreateTestContext(w)
	ctx.Request = httptest.NewRequest("POST", "/dont-care", body)

	PostItems(ctx)

	ensureHttpCode(t, w, expectedCode)
	if expectedCode >= 200 && expectedCode < 300 {
		res := ensureResponseType[NewItemResponse](t, w)
		require.Equal(t, filepath.ToSlash(req.WorkingDir), res.WorkingDir)
		require.NotEmpty(t, res.Files)
	}
}

func createTempDir(t *testing.T) string {
	tmpDir, err := os.MkdirTemp("", "qtcli-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	return tmpDir
}
