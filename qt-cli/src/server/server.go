// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package server

import (
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"qtcli/util"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

var addr = ":8080"
var pidFile = getPidFilePath()

func Start() {
	handler := createApiHandler()
	server := &http.Server{
		Addr:    addr,
		Handler: handler,
	}

	go func() {
		ensurePrevRunStopped(pidFile)
		savePidToFile(os.Getpid(), pidFile)

		logrus.Infof("Starting server on %s", addr)
		if err := server.ListenAndServe(); err != nil {
			logrus.Fatalf("Server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logrus.Info("Shutting down server...")
	if err := server.Close(); err != nil {
		logrus.Fatalf("Server close error: %v", err)
	}

	logrus.Info("Server stopped")
	os.Remove(pidFile)
}

func Stop() {
	pid, err := getActivePid(pidFile)
	if err == nil {
		util.SendSigTermOrKill(pid)
	}
}

func createApiHandler() *gin.Engine {
	gin.SetMode(gin.ReleaseMode)

	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowMethods:     []string{"GET", "POST", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		MaxAge:           12 * time.Hour,
		AllowCredentials: true,
		AllowOriginFunc: func(origin string) bool {
			return strings.HasPrefix(origin, "vscode-webview://")
		},
	}))

	v1 := r.Group("/v1")

	v1.GET("/presets", GetPresets)
	v1.GET("/presets/files", GetFilePresets)
	v1.GET("/presets/projects", GetProjectPresets)
	v1.POST("/files", CreateNewFileOrProject)
	v1.POST("/projects", CreateNewFileOrProject)
	v1.DELETE("/server", Shutdown)

	return r
}

func ensurePrevRunStopped(filePath string) {
	pid, err := getActivePid(filePath)
	if err == nil {
		util.SendSigTermOrKill(pid)
		time.Sleep(1 * time.Second)
	}
}

func savePidToFile(pid int, filePath string) {
	dir, _ := filepath.Split(filePath)
	err := os.MkdirAll(dir, 0755)
	if err != nil {
		logrus.Fatalf("failed to create directory: %v\n", err)
	}

	err = os.WriteFile(filePath, []byte(fmt.Sprintf("%d", pid)), 0644)
	if err != nil {
		logrus.Fatalf("failed to write pid file: %v", err)
	}

	logrus.Info("pid file created at:", filePath)
}

func getActivePid(filePath string) (int, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return 0, err
	}

	return strconv.Atoi(string(data))
}

func getPidFilePath() string {
	if runtime.GOOS == "windows" {
		return os.Getenv("LOCALAPPDATA") + "\\qtcli\\qtcli-server.pid"
	}

	return "/tmp/qtcli/qtcli-server.pid"
}
