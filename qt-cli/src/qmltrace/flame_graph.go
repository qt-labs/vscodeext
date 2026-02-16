// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package qmltrace

import (
	"fmt"
	"sort"
)

// the string values must match with the frontend.
const (
	FlameGraphKindTime        = "time"
	FlameGraphKindMemory      = "memory"
	FlameGraphKindAllocations = "allocations"
)

// json presentation must match that used in the frontend
type FlameGraphNode struct {
	Key     int `json:"key"`     // to uniquely identify nodes (for frontend)
	EventId int `json:"eventId"` // to group events, -1 for synthetic nodes
	Depth   int `json:"depth"`   // y-positions in the flame graph
	Offset  int `json:"offset"`  // x-positions in the flame graph
	Length  int `json:"length"`  // data length

	// event data
	Label          string       `json:"label"`
	Details        string       `json:"details"`
	Feature        EventFeature `json:"feature"`
	SourceLocation string       `json:"sourceLocation"`

	// metrics
	Calls       int `json:"calls"`
	Duration    int `json:"duration"`
	Amount      int `json:"amount"`
	Allocations int `json:"allocations"`

	// tree structure
	Parent   *FlameGraphNode   `json:"-"`
	Children []*FlameGraphNode `json:"children,omitempty"`
}

// json presentation must match that used in the frontend
type FlameGraphMetadata struct {
	Kind   string               `json:"kind"`
	Height int                  `json:"height"`
	Stats  map[EventFeature]int `json:"stats"`
}

type FlameGraphNodes []*FlameGraphNode

type FlameGraph struct {
	root     *FlameGraphNode
	metadata *FlameGraphMetadata
}

type FlameGraphCreationContext struct {
	kind      string
	features  EventFeatures
	trace     *ProfileTrace
	recentKey int
}

var context FlameGraphCreationContext

func CreateFlameGraph(kind string, features EventFeatures, trace *ProfileTrace) FlameGraph {
	context = FlameGraphCreationContext{
		kind:      kind,
		features:  features,
		trace:     trace,
		recentKey: -1,
	}

	root := buildFlameGraph(trace.samples, trace.events)
	root.Length = findDataLength(root, kind)

	polishRecursively(root, kind)
	tryAddExtraChildToRoot(root, kind)

	return FlameGraph{
		root:     root,
		metadata: createMetadata(root, kind),
	}
}

func buildFlameGraph(sortedSamples []Sample, events map[int]Event) *FlameGraphNode {
	root := &FlameGraphNode{
		Key:      genKey(),
		EventId:  -1,
		Label:    "(root)", // arbitrary choice
		Feature:  EventFeatureRoot,
		Children: FlameGraphNodes{},
	}

	var current *FlameGraphNode = root

	for _, s := range sortedSamples {
		ev := events[s.eventIndex]
		if _, ok := context.features[ev.feature]; !ok {
			continue
		}

		if ev.feature == EventFeatureMemoryAllocation {
			// ev.Amount is negative when the gc is running, and positive otherwise
			if (ev.detailTypeId != DetailMemoryHeapPage) && (s.memoryAmount > 0) {
				for node := current; node != nil; node = node.Parent {
					node.Allocations++
					node.Amount += s.memoryAmount
				}
			}
		}

		if s.kind == SampleKindRangeStart {
			newNode := &FlameGraphNode{
				Key:     genKey(),
				EventId: s.eventIndex,
				Depth:   current.Depth + 1,
				Offset:  0,
				Length:  0,

				Label:          ev.label,
				Details:        ev.details,
				Feature:        ev.feature,
				SourceLocation: stringifySourceLocation(ev.sourceLocation),

				Calls:       1,
				Duration:    s.timeDuration,
				Amount:      0,
				Allocations: 0,

				Parent: current,
			}

			if current == root {
				current.Duration += s.timeDuration
			}

			current.Children = append(current.Children, newNode)
			current = newNode
		}

		if s.kind == SampleKindRangeEnd {
			if current != root {
				current = current.Parent
			}
		}
	}

	return root
}

func polishRecursively(node *FlameGraphNode, kind string) {
	if node == nil {
		return
	}

	children := squashSameEvents(node.Children)
	for _, child := range children {
		child.Length = findDataLength(child, kind)
	}

	prioritize(children)
	packToLeft(children, node.Offset)
	node.Children = children

	// recursively polish each child node
	for _, child := range node.Children {
		polishRecursively(child, kind)
	}
}

func findDataLength(node *FlameGraphNode, kind string) int {
	switch kind {
	case FlameGraphKindTime:
		return node.Duration

	case FlameGraphKindMemory:
		return node.Amount

	case FlameGraphKindAllocations:
		return node.Allocations
	}

	return 0
}

func tryAddExtraChildToRoot(root *FlameGraphNode, kind string) {
	// add an extra child to the root node to account for memory
	// allocated by the root itself
	if root == nil || len(root.Children) == 0 || kind != FlameGraphKindMemory {
		return
	}

	total := 0
	for _, child := range root.Children {
		total += child.Amount
	}

	if total < root.Amount {
		others := &FlameGraphNode{
			Key:     genKey(),
			EventId: -1,
			Depth:   root.Depth + 1,
			Offset:  root.Offset + total,
			Length:  root.Amount - total,
			Label:   "",
			Feature: EventFeatureOthers,
			Amount:  root.Amount - total,
			Parent:  root,
		}

		root.Children = append(root.Children, others)
	}
}

func squashSameEvents(input FlameGraphNodes) FlameGraphNodes {
	if len(input) == 0 {
		return input
	}

	sort.Slice(input, func(i, j int) bool {
		return input[i].EventId < input[j].EventId
	})

	output := FlameGraphNodes{}
	bucket := input[0]

	for _, next := range input[1:] {
		if bucket.EventId == next.EventId {
			bucket.Duration += next.Duration
			bucket.Calls += next.Calls
			bucket.Amount += next.Amount
			bucket.Allocations += next.Allocations
			bucket.Children = append(bucket.Children, next.Children...)
		} else {
			output = append(output, bucket)
			bucket = next
		}
	}

	return append(output, bucket)
}
func prioritize(nodes FlameGraphNodes) {
	sort.Slice(nodes, func(i, j int) bool {
		n1, n2 := nodes[i], nodes[j]
		if n1.Calls != n2.Calls {
			return n1.Calls > n2.Calls
		}

		return n1.Key < n2.Key
	})
}

func packToLeft(nodes FlameGraphNodes, parentStart int) {
	offset := parentStart

	for _, node := range nodes {
		node.Offset = offset
		offset += node.Length
	}
}

func createMetadata(root *FlameGraphNode, kind string) *FlameGraphMetadata {
	if root == nil {
		return &FlameGraphMetadata{}
	}

	featureCounts := map[EventFeature]int{}
	for _, f := range allEventFeatures {
		featureCounts[f] = 0
	}

	var visitChildren func(node *FlameGraphNode) int
	visitChildren = func(node *FlameGraphNode) int {
		if node == nil {
			return -1
		}

		featureCounts[node.Feature] += 1
		maxHeight := -1

		for _, child := range node.Children {
			height := visitChildren(child)
			if maxHeight < height {
				maxHeight = height
			}
		}

		return maxHeight + 1
	}

	return &FlameGraphMetadata{
		Height: visitChildren(root),
		Kind:   kind,
		Stats:  featureCounts,
	}
}

func genKey() int {
	context.recentKey++
	return context.recentKey
}

func stringifySourceLocation(loc EventSourceLocation) string {
	if len(loc.fileName) == 0 {
		return ""
	}

	return fmt.Sprintf("%s#L%d,%d", loc.fileName, loc.line, loc.column)
}
