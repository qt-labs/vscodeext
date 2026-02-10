// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"qtcli/common/rest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func init() {
	gin.SetMode(gin.ReleaseMode)
}

func TestHandler_DeleteServer(t *testing.T) {
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)

	DeleteServer(ctx)
	ensureHttpCode(t, w, http.StatusOK)
	ensureResponseType[rest.StatusResponse](t, w)
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
