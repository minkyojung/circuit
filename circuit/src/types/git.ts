/**
 * Git Type Definitions
 */

export type FileStatus = 'M' | 'A' | 'D' | 'R' | '?';

export interface GitFileChange {
  path: string;
  status: FileStatus;
}

export interface GitStatus {
  currentBranch: string;
  remoteBranch: string;
  ahead: number;
  behind: number;
  staged: GitFileChange[];
  unstaged: GitFileChange[];
  untracked: GitFileChange[];
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  parents: string[];
  message: string;
  author: string;
  email: string;
  date: string;
  refs: string[];
}

/**
 * Git reference (branch, tag, etc.)
 */
export interface GitRef {
  hash: string;
  ref: string;
  type: 'branch' | 'tag' | 'remote';
  name: string;
}

/**
 * Branch entity - first-class object in Branch-First architecture
 */
export interface GitBranch {
  // Identity
  name: string;                    // "main", "feature/new-ui"
  ref: string;                     // "refs/heads/main"
  head: string;                    // HEAD commit hash

  // Lineage
  baseCommit: string | null;       // 분기 시작점 (첫 커밋의 parent)
  baseBranch: string | null;       // 어떤 브랜치에서 분기했는지

  // Ownership
  exclusiveCommits: Set<string>;   // 이 브랜치만의 고유 커밋들
  allCommits: Set<string>;         // 이 브랜치에 속한 모든 커밋 (조상 포함)

  // Lifecycle
  createdAt: string | null;        // 첫 커밋 hash
  mergedAt: string | null;         // 머지된 커밋 hash (null이면 active)
  mergedInto: string | null;       // 어디로 merge되었는지
  isActive: boolean;               // 현재 활성 상태

  // Visual properties
  lane: number;                    // 할당된 lane (브랜치 전체 고정)
  color: string;                   // 브랜치 색상 (전체 일관)

  // Hierarchy
  childBranches: string[];         // 이 브랜치에서 분기한 자식들
}

/**
 * Enriched commit with branch context
 */
export interface EnrichedCommit extends GitCommit {
  // Branch membership
  belongsToBranches: string[];     // 이 커밋이 속한 모든 브랜치
  primaryBranch: string;           // 렌더링에 사용할 주 브랜치

  // Visual (브랜치로부터 상속)
  lane: number;                    // primaryBranch.lane
  color: string;                   // primaryBranch.color

  // Branch markers
  isBranchHead: boolean;           // 이 커밋이 브랜치의 HEAD인지
  isBranchStart: boolean;          // 이 커밋이 브랜치의 시작점인지

  // Merge info
  isMergeCommit: boolean;
  mergedBranches: string[];        // 이 커밋으로 merge된 브랜치들
}

/**
 * Merge point for rendering
 */
export interface MergePoint {
  mergeCommit: string;             // 머지 커밋 hash
  mergedBranch: string;            // merge된 브랜치명
  targetBranch: string;            // merge 대상 브랜치명
  sourceLane: number;
  targetLane: number;
}

/**
 * Complete branch graph structure
 */
export interface BranchGraph {
  branches: Map<string, GitBranch>;           // name → branch
  commits: Map<string, EnrichedCommit>;       // hash → commit
  commitToBranches: Map<string, Set<string>>; // hash → branch names

  // Topological order
  branchOrder: string[];                      // 토폴로지 순서 (렌더링용)

  // Merge tracking
  mergePoints: MergePoint[];
}
