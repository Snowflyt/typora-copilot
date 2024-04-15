import * as path from "@modules/path";

import type { Completion, CopilotClient } from "./client";
import type { Position } from "./types/lsp";

/*************************
 * CompletionTaskManager *
 *************************/
/**
 * Options for {@link CompletionTaskManager}.
 */
export interface CompletionTaskManagerOptions {
  workspaceFolder: string;
  activeFilePathname: string;
}

/**
 * Task ID used in {@link CompletionTaskManager}.
 */
export type TaskID = number & {
  readonly __tag: unique symbol;
};

/**
 * A manager for GitHub Copilot completion tasks.
 */
export type CompletionTaskManager = ReturnType<typeof createCompletionTaskManager>;

/**
 * Create a {@link CompletionTaskManager}.
 * @param copilot A GitHub Copilot client.
 * @param options Options for the manager.
 * @returns
 */
export const createCompletionTaskManager = (
  copilot: CopilotClient,
  options: CompletionTaskManagerOptions,
) => {
  let { activeFilePathname: _activeFilePathname, workspaceFolder: _workspaceFolder } = options;

  let _latestTaskId = 0 as TaskID;

  interface TaskState {
    readonly timestamp: number;
    cancelled: boolean;
  }
  const taskStates = new Map<TaskID, TaskState>();

  const _isAllCancelled = () => [...taskStates.values()].every((state) => state.cancelled);

  /***********
   * Methods *
   ***********/
  const _startOne = ({
    onCompletion,
    position,
  }: {
    onCompletion?: (completion: Completion) => void;
    position: Position;
  }): TaskID => {
    const taskId = ++_latestTaskId as TaskID;
    const state: TaskState = {
      timestamp: Date.now(),
      cancelled: false,
    };
    taskStates.set(taskId, state);

    copilot.status = "InProgress";

    void copilot.request
      .getCompletions({
        position,
        path: _activeFilePathname,
        relativePath:
          _workspaceFolder ?
            path.relative(_workspaceFolder, _activeFilePathname)
          : _activeFilePathname,
      })
      .then(({ cancellationReason, completions }): void => {
        taskStates.delete(taskId);

        if (_isAllCancelled()) copilot.status = "Normal";

        if (state.cancelled) {
          copilot.notification.notifyRejected({ uuids: completions.map((c) => c.uuid) });
          return;
        }

        if (cancellationReason || completions.length === 0) return;

        // Reject other completions if exists
        if (completions.length > 1)
          copilot.notification.notifyRejected({ uuids: completions.slice(1).map((c) => c.uuid) });

        onCompletion?.(completions[0]!);
      })
      .catch(() => {
        taskStates.delete(taskId);
        if (_isAllCancelled()) copilot.status = "Normal";
      });

    return taskId;
  };

  const _cancelOne = (taskId: TaskID) => {
    const state = taskStates.get(taskId);
    if (!state) return;

    state.cancelled = true;

    if (_isAllCancelled()) copilot.status = "Normal";
  };
  const _cancelAll = () => {
    for (const state of taskStates.values()) state.cancelled = true;
    copilot.status = "Normal";
  };

  return {
    get activeFilePathname() {
      return _activeFilePathname;
    },
    set activeFilePathname(value: string) {
      _activeFilePathname = value;
    },
    get workspaceFolder() {
      return _workspaceFolder;
    },
    set workspaceFolder(value: string) {
      _workspaceFolder = value;
    },

    get isAllCancelled() {
      return _isAllCancelled();
    },

    startOne: _startOne,

    cancelOne: _cancelOne,
    cancelAll: _cancelAll,
  };
};
