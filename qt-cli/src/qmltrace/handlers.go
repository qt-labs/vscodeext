// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package qmltrace

import (
	"fmt"
	"qtcli/common/rest"
	"strings"

	"github.com/gin-gonic/gin"
)

// get
type GetFlameGraphResponse struct {
	Root     FlameGraphNode     `json:"root"`
	Metadata FlameGraphMetadata `json:"metadata"`
}

func GetFlameGraph(c *gin.Context) {
	kind := c.DefaultQuery("kind", FlameGraphKindTime)
	features := c.DefaultQuery("features", includeAllEventFeatures)

	graph := CreateFlameGraph(
		kind,
		buildFeatureSet(features),
		GetCurrentTrace(),
	)

	rest.ReplyGet(c, GetFlameGraphResponse{
		Root:     *graph.root,
		Metadata: *graph.metadata,
	})
}

// put
type PutLoadRequest struct {
	FilePath string `json:"filePath" binding:"required"`
}

type PutLoadResponse struct {
	FilePath  string `json:"filePath"`
	Version   string `json:"version"`
	StartTime int64  `json:"startTime"`
	EndTime   int64  `json:"endTime"`
	Events    int    `json:"events"`
	Samples   int    `json:"samples"`
}

func PutLoadTraceFile(c *gin.Context) {
	var req PutLoadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		rest.ReplyErrorMsg(c, err.Error())
		return
	}

	err := LoadProfileTrace(req.FilePath)
	if err != nil {
		msg := fmt.Sprintf("%s (file = '%s')", err.Error(), req.FilePath)
		rest.ReplyErrorMsg(c, msg)
		return
	}

	current := GetCurrentTrace()

	rest.ReplyPut(c, PutLoadResponse{
		FilePath:  req.FilePath,
		Version:   current.metadata.version,
		StartTime: current.metadata.startTime,
		EndTime:   current.metadata.endTime,
		Events:    len(current.events),
		Samples:   len(current.samples),
	})
}

// helpers
func buildFeatureSet(param string) EventFeatures {
	parsed := strings.Split(param, ",")

	if len(parsed) == 1 && parsed[0] == includeAllEventFeatures {
		all := EventFeatures{}
		for _, f := range allEventFeatures {
			all[f] = struct{}{}
		}

		return all
	}

	all := EventFeatures{
		// must include memoryallocation type always
		EventFeatureMemoryAllocation: {},
	}

	for _, cat := range parsed {
		v := findEventFeatureByName(cat)
		if v != EventFeatureUndefined {
			all[v] = struct{}{}
		}
	}

	return all
}
