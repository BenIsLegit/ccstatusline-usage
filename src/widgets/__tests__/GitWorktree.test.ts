import { execSync } from 'child_process';
import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
    type Mock
} from 'vitest';

import type {
    RenderContext,
    WidgetItem
} from '../../types';
import { GitWorktreeWidget } from '../GitWorktree';

vi.mock('child_process', () => ({ execSync: vi.fn() }));

const mockedExecSync = execSync as Mock;

function render(rawValue = false, isPreview = false) {
    const widget = new GitWorktreeWidget();
    const context: RenderContext = { isPreview };
    const item: WidgetItem = {
        id: 'git-worktree',
        type: 'git-worktree',
        rawValue
    };

    return widget.render(item, context);
}

describe('GitWorktreeWidget', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render preview', () => {
        const isPreview = true;
        const rawValue = false;

        expect(render(rawValue, isPreview)).toBe('𖠰 main');
    });

    it('should render preview with raw value', () => {
        const isPreview = true;
        const rawValue = true;

        expect(render(rawValue, isPreview)).toBe('main');
    });

    it('should render with worktree', () => {
        mockedExecSync.mockReturnValue('/some/path/.git/worktrees/some-worktree');

        expect(render()).toBe('𖠰 some-worktree');
    });

    it('should render with nested worktree', () => {
        mockedExecSync.mockReturnValue('/some/path/.git/worktrees/some-dir/some-worktree');

        expect(render()).toBe('𖠰 some-dir/some-worktree');
    });

    it('should render with no worktree', () => {
        mockedExecSync.mockReturnValue('.git');

        expect(render()).toBe('𖠰 main');
    });

    it('should render with no git', () => {
        mockedExecSync.mockImplementation(() => { throw new Error('No git'); });

        expect(render()).toBe('𖠰 no git');
    });

    it('should render with invalid git dir', () => {
        mockedExecSync.mockReturnValue('');

        expect(render()).toBe('𖠰 no git');
    });
});