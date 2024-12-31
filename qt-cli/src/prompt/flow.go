// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package prompt

import "errors"

type PromptFlow struct {
	prompts []Prompt
	results map[string]Result

	currentIndex int
	aborted      bool

	onPromptDone  func(Prompt, Result)
	onPromptError func(Prompt, error)
}

func NewFlow() *PromptFlow {
	flow := PromptFlow{
		prompts: []Prompt{},
		results: map[string]Result{},

		currentIndex: 0,
		aborted:      false,
	}

	flow.onPromptDone = func(p Prompt, r Result) {
		flow.RunDefaultDoneHandler(p, r)
	}

	return &flow
}

func (flow *PromptFlow) IsAborted() bool {
	return flow.aborted
}

func (flow *PromptFlow) Add(prompt Prompt) {
	flow.prompts = append(flow.prompts, prompt)
}

func (flow *PromptFlow) AddPrompts(prompts []Prompt) {
	flow.prompts = append(flow.prompts, prompts...)
}

func (flow *PromptFlow) GetResult(id string) Result {
	return flow.results[id]
}

func (flow *PromptFlow) SaveResult(r Result) {
	id := r.Id

	if len(id) != 0 {
		flow.results[id] = r
	}
}

func (flow *PromptFlow) Abort() {
	flow.aborted = true
}

func (flow *PromptFlow) SetDoneHandler(fn func(Prompt, Result)) {
	flow.onPromptDone = fn
}

func (flow *PromptFlow) RunDefaultDoneHandler(p Prompt, r Result) {
	flow.SaveResult(r)
	flow.currentIndex++
}

func (flow *PromptFlow) Run() error {
	if flow.onPromptDone == nil {
		return errors.New("handler for done event is not registered")
	}

	for {
		if flow.currentIndex >= len(flow.prompts) || flow.aborted {
			break
		}

		prompt := flow.prompts[flow.currentIndex]
		result, err := prompt.Run()
		if err != nil {
			if flow.onPromptError != nil {
				flow.onPromptError(prompt, err)
			}

			return err
		}

		if result.Done {
			last := flow.currentIndex == (len(flow.prompts) - 1)
			flow.onPromptDone(prompt, result)

			if last || flow.aborted {
				break
			}
		} else {
			flow.aborted = true
		}
	}

	return nil
}
