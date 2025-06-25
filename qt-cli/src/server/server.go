// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package server

import (
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"qtcli/server/handlers"
	"qtcli/util"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

type Options struct {
	UseTcp  bool
	TcpPort string
}

var pidFile = getPidFilePath()

func init() {
	gin.SetMode(gin.ReleaseMode)
}

func getNetListener(o Options) (net.Listener, error) {
	if o.UseTcp {
		if o.TcpPort == "" {
			o.TcpPort = "8080"
		}

		return net.Listen("tcp", ":"+o.TcpPort)
	}

	return getLocalIpcListener()
}

func Start(o Options) {
	ensurePrevRunStopped(pidFile)

	listener, err := getNetListener(o)
	if err != nil {
		logrus.Fatalf("Cannot open listener: %v", err)
	}

	defer listener.Close()
	server := &http.Server{
		Handler: createApiHandler(),
	}

	go func() {
		savePidToFile(os.Getpid(), pidFile)
		logrus.Infof("Starting server at %s", listener.Addr().String())
		if err := server.Serve(listener); err != nil {
			logrus.Fatalf("Server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logrus.Info("Shutting down server...")
	os.Remove(pidFile)

	if err := server.Close(); err != nil {
		logrus.Fatalf("Server close error: %v", err)
	}

	logrus.Info("Server stopped")
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
		AllowMethods:     []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		MaxAge:           12 * time.Hour,
		AllowCredentials: true,
		AllowOriginFunc: func(origin string) bool {
			return strings.HasPrefix(origin, "vscode-webview://")
		},
	}))

	v1 := r.Group("/v1")

	// read presets or details of the specific preset
	v1.GET("/presets", handlers.GetPresetsByNameOrType)
	v1.GET("/presets/:id", handlers.GetPresetById)

	// manage custom presets
	v1.POST("/presets", handlers.PostCustomPreset)
	v1.PATCH("/presets/:id", handlers.PatchCustomPresetById)
	v1.DELETE("/presets/:id", handlers.DeleteCustomPresetById)

	// create item (project or file) & validation
	v1.POST("/items", handlers.PostItems)
	v1.POST("/items/validate", handlers.PostItemsValidate)

	// others
	v1.GET("/ready", handlers.GetReady)
	v1.DELETE("/server", handlers.DeleteServer)

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
