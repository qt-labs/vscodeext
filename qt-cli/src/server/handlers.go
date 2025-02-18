// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package server

import (
	"net/http"
	"os"
	"qtcli/common"
	"qtcli/generator"
	"qtcli/runner"
	"qtcli/util"
	"time"

	"github.com/gin-gonic/gin"
)

func GetPresets(c *gin.Context) {
	sendPresets(c, runner.Presets.Any.GetAll())
}

func GetFilePresets(c *gin.Context) {
	sendPresets(c, runner.Presets.Any.FindByType(common.TargetTypeFile))
}

func GetProjectPresets(c *gin.Context) {
	sendPresets(c, runner.Presets.Any.FindByType(common.TargetTypeProject))
}

func CreateNewFileOrProject(c *gin.Context) {
	var req ReqPostFileOrProject

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	preset, err := runner.Presets.Any.FindByName(req.Preset)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	output, err := generator.NewGenerator(req.Name).
		Env(runner.GeneratorEnv).
		Preset(preset).
		Render()

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, ResNew{
		Message: "File created successfully",
		Files:   output.GetOutputFilePaths(),
		Input:   req,
	})
}

func Shutdown(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Server shutting down..."})

	go func() {
		time.Sleep(1 * time.Second)
		util.SendSigTermOrKill(os.Getpid())
	}()
}

// helpers
func sendPresets(c *gin.Context, presets []common.PresetData) {
	res := []ResGetPreset{}

	for _, p := range presets {
		res = append(res, ResGetPreset{
			Type:        p.GetTypeName(),
			Name:        p.GetName(),
			Description: p.GetDescription(),
			TemplateDir: p.GetTemplateDir(),
			Options:     p.GetOptions(),
		})
	}

	c.JSON(http.StatusOK, res)
}
