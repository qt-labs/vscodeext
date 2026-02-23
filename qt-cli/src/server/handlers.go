// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package server

import (
	"os"
	"qtcli/common/rest"
	"qtcli/common/texts"
	"qtcli/common/utils"
	"time"

	"github.com/gin-gonic/gin"
)

func GetReady(c *gin.Context) {
	rest.ReplyStatus(c, "ready")
}

func PostHeartbeat(c *gin.Context) {
	rest.ReplyStatus(c, "ok")
}

func DeleteServer(c *gin.Context) {
	rest.ReplyStatus(c, texts.ServerClosing)

	go func() {
		time.Sleep(1 * time.Second)
		utils.SendSigTermOrKill(os.Getpid())
	}()
}
