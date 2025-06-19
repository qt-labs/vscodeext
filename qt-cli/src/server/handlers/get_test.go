// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"qtcli/util"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func init() {
	gin.SetMode(gin.ReleaseMode)
}

func TestHandler_GetPresets(t *testing.T) {
	queries := []string{
		"",
		"?type=file",
		"?type=project",
	}

	for _, query := range queries {
		testname := fmt.Sprintf("|%s|", query)
		t.Run(testname, func(t *testing.T) {
			w := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(w)
			ctx.Request = httptest.NewRequest("GET", "/dont-care"+query, nil)

			GetPresetsByNameOrType(ctx)
			ensureHttpCode(t, w, http.StatusOK)
			ensureResponseType[PresetsResponse](t, w)
		})
	}
}
func TestHandler_GetPresetById(t *testing.T) {
	cases := []struct {
		name         string
		expectedCode int
	}{
		{"@projects/cpp/console", http.StatusOK},
		{"@projects/cpp/qtquick", http.StatusOK},
		{"@projects/cpp/qwidget", http.StatusOK},
		{"@cpp/class", http.StatusOK},
		{"@types/qml", http.StatusOK},
		{"@types/qrc", http.StatusOK},
		{"@types/ui", http.StatusOK},

		{"@invalid/bar", http.StatusBadRequest},
	}

	for _, tc := range cases {
		id := util.CreatePresetUniqueId(tc.name)
		testname := fmt.Sprintf("|%s|%v|", tc.name, tc.expectedCode)

		t.Run(testname, func(t *testing.T) {
			w := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(w)
			ctx.Request = httptest.NewRequest("GET", "/dont-care", nil)
			ctx.Params = gin.Params{{Key: "id", Value: id}}

			GetPresetById(ctx)
			ensureHttpCode(t, w, tc.expectedCode)

			if tc.expectedCode >= 200 && tc.expectedCode < 300 {
				ensureResponseType[PresetDetailResponse](t, w)
			} else if tc.expectedCode >= 400 && tc.expectedCode < 500 {
				ensureResponseType[ErrorResponse](t, w)
			}
		})
	}
}

// helpers
func ensureHttpCode(t *testing.T, w *httptest.ResponseRecorder, expected int) {
	require.Equal(t, expected, w.Code,
		fmt.Sprintf("HTTP status code: body = %s", w.Body.String()))
}

func ensureResponseType[T any](t *testing.T, w *httptest.ResponseRecorder) T {
	var parsed T
	err := json.Unmarshal(w.Body.Bytes(), &parsed)
	require.NoError(t, err, fmt.Sprintf("JSON parsing: body = %s", w.Body.String()))

	return parsed
}
