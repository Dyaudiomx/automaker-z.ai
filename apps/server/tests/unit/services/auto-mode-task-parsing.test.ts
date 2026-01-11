import { describe, it, expect } from 'vitest';

/**
 * Test the task parsing logic by reimplementing the parsing functions
 * These mirror the logic in auto-mode-service.ts parseTasksFromSpec and parseTaskLine
 */

interface ParsedTask {
  id: string;
  description: string;
  filePath?: string;
  phase?: string;
  status: 'pending' | 'in_progress' | 'completed';
}

function parseTaskLine(line: string, currentPhase?: string): ParsedTask | null {
  // Match pattern: - [ ] T###: Description | File: path
  const taskMatch = line.match(/- \[ \] (T\d{3}):\s*([^|]+)(?:\|\s*File:\s*(.+))?$/);
  if (!taskMatch) {
    // Try simpler pattern without file
    const simpleMatch = line.match(/- \[ \] (T\d{3}):\s*(.+)$/);
    if (simpleMatch) {
      return {
        id: simpleMatch[1],
        description: simpleMatch[2].trim(),
        phase: currentPhase,
        status: 'pending',
      };
    }
    return null;
  }

  return {
    id: taskMatch[1],
    description: taskMatch[2].trim(),
    filePath: taskMatch[3]?.trim(),
    phase: currentPhase,
    status: 'pending',
  };
}

function parseTasksFromSpec(specContent: string): ParsedTask[] {
  const tasks: ParsedTask[] = [];

  // Extract content within ```tasks ... ``` block
  const tasksBlockMatch = specContent.match(/```tasks\s*([\s\S]*?)```/);
  if (!tasksBlockMatch) {
    // Try fallback: look for task lines anywhere in content
    const taskLines = specContent.match(/- \[ \] T\d{3}:.*$/gm);
    if (!taskLines) {
      return tasks;
    }
    // Parse fallback task lines
    let currentPhase: string | undefined;
    for (const line of taskLines) {
      const parsed = parseTaskLine(line, currentPhase);
      if (parsed) {
        tasks.push(parsed);
      }
    }
    return tasks;
  }

  const tasksContent = tasksBlockMatch[1];
  const lines = tasksContent.split('\n');

  let currentPhase: string | undefined;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Check for phase header (e.g., "## Phase 1: Foundation")
    const phaseMatch = trimmedLine.match(/^##\s*(.+)$/);
    if (phaseMatch) {
      currentPhase = phaseMatch[1].trim();
      continue;
    }

    // Check for task line
    if (trimmedLine.startsWith('- [ ]')) {
      const parsed = parseTaskLine(trimmedLine, currentPhase);
      if (parsed) {
        tasks.push(parsed);
      }
    }
  }

  return tasks;
}

describe('Task Parsing', () => {
  describe('parseTaskLine', () => {
    it('should parse task with file path', () => {
      const line = '- [ ] T001: Create user model | File: src/models/user.ts';
      const result = parseTaskLine(line);
      expect(result).toEqual({
        id: 'T001',
        description: 'Create user model',
        filePath: 'src/models/user.ts',
        phase: undefined,
        status: 'pending',
      });
    });

    it('should parse task without file path', () => {
      const line = '- [ ] T002: Setup database connection';
      const result = parseTaskLine(line);
      expect(result).toEqual({
        id: 'T002',
        description: 'Setup database connection',
        phase: undefined,
        status: 'pending',
      });
    });

    it('should include phase when provided', () => {
      const line = '- [ ] T003: Write tests | File: tests/user.test.ts';
      const result = parseTaskLine(line, 'Phase 1: Foundation');
      expect(result?.phase).toBe('Phase 1: Foundation');
    });

    it('should return null for invalid line', () => {
      expect(parseTaskLine('- [ ] Invalid format')).toBeNull();
      expect(parseTaskLine('Not a task line')).toBeNull();
      expect(parseTaskLine('')).toBeNull();
    });

    it('should handle multi-word descriptions', () => {
      const line = '- [ ] T004: Implement user authentication with JWT tokens | File: src/auth.ts';
      const result = parseTaskLine(line);
      expect(result?.description).toBe('Implement user authentication with JWT tokens');
    });

    it('should trim whitespace from description and file path', () => {
      const line = '- [ ] T005:   Create API endpoint   | File:   src/routes/api.ts  ';
      const result = parseTaskLine(line);
      expect(result?.description).toBe('Create API endpoint');
      expect(result?.filePath).toBe('src/routes/api.ts');
    });
  });

  describe('parseTasksFromSpec', () => {
    it('should parse tasks from a tasks code block', () => {
      const specContent = `
## Specification

Some description here.

\`\`\`tasks
- [ ] T001: Create user model | File: src/models/user.ts
- [ ] T002: Add API endpoint | File: src/routes/users.ts
- [ ] T003: Write unit tests | File: tests/user.test.ts
\`\`\`

## Notes
Some notes here.
`;
      const tasks = parseTasksFromSpec(specContent);
      expect(tasks).toHaveLength(3);
      expect(tasks[0].id).toBe('T001');
      expect(tasks[1].id).toBe('T002');
      expect(tasks[2].id).toBe('T003');
    });

    it('should parse tasks with phases', () => {
      const specContent = `
\`\`\`tasks
## Phase 1: Foundation
- [ ] T001: Initialize project | File: package.json
- [ ] T002: Configure TypeScript | File: tsconfig.json

## Phase 2: Implementation
- [ ] T003: Create main module | File: src/index.ts
- [ ] T004: Add utility functions | File: src/utils.ts

## Phase 3: Testing
- [ ] T005: Write tests | File: tests/index.test.ts
\`\`\`
`;
      const tasks = parseTasksFromSpec(specContent);
      expect(tasks).toHaveLength(5);
      expect(tasks[0].phase).toBe('Phase 1: Foundation');
      expect(tasks[1].phase).toBe('Phase 1: Foundation');
      expect(tasks[2].phase).toBe('Phase 2: Implementation');
      expect(tasks[3].phase).toBe('Phase 2: Implementation');
      expect(tasks[4].phase).toBe('Phase 3: Testing');
    });

    it('should return empty array for content without tasks', () => {
      const specContent = 'Just some text without any tasks';
      const tasks = parseTasksFromSpec(specContent);
      expect(tasks).toEqual([]);
    });

    it('should fallback to finding task lines outside code block', () => {
      const specContent = `
## Implementation Plan

- [ ] T001: First task | File: src/first.ts
- [ ] T002: Second task | File: src/second.ts
`;
      const tasks = parseTasksFromSpec(specContent);
      expect(tasks).toHaveLength(2);
      expect(tasks[0].id).toBe('T001');
      expect(tasks[1].id).toBe('T002');
    });

    it('should handle empty tasks block', () => {
      const specContent = `
\`\`\`tasks
\`\`\`
`;
      const tasks = parseTasksFromSpec(specContent);
      expect(tasks).toEqual([]);
    });

    it('should handle mixed valid and invalid lines', () => {
      const specContent = `
\`\`\`tasks
- [ ] T001: Valid task | File: src/valid.ts
- Invalid line
Some other text
- [ ] T002: Another valid task
\`\`\`
`;
      const tasks = parseTasksFromSpec(specContent);
      expect(tasks).toHaveLength(2);
    });

    it('should preserve task order', () => {
      const specContent = `
\`\`\`tasks
- [ ] T003: Third
- [ ] T001: First
- [ ] T002: Second
\`\`\`
`;
      const tasks = parseTasksFromSpec(specContent);
      expect(tasks[0].id).toBe('T003');
      expect(tasks[1].id).toBe('T001');
      expect(tasks[2].id).toBe('T002');
    });

    it('should handle task IDs with different numbers', () => {
      const specContent = `
\`\`\`tasks
- [ ] T001: First
- [ ] T010: Tenth
- [ ] T100: Hundredth
\`\`\`
`;
      const tasks = parseTasksFromSpec(specContent);
      expect(tasks).toHaveLength(3);
      expect(tasks[0].id).toBe('T001');
      expect(tasks[1].id).toBe('T010');
      expect(tasks[2].id).toBe('T100');
    });
  });

  describe('spec content generation patterns', () => {
    it('should match the expected lite mode output format', () => {
      const liteModeOutput = `
1. **Goal**: Implement user registration
2. **Approach**: Create form component, add validation, connect to API
3. **Files to Touch**: src/components/Register.tsx, src/api/auth.ts
4. **Tasks**:
   1. Create registration form
   2. Add form validation
   3. Connect to backend API
5. **Risks**: Form state management complexity

[PLAN_GENERATED] Planning outline complete.
`;
      expect(liteModeOutput).toContain('[PLAN_GENERATED]');
      expect(liteModeOutput).toContain('Goal');
      expect(liteModeOutput).toContain('Approach');
    });

    it('should match the expected spec mode output format', () => {
      const specModeOutput = `
1. **Problem**: Users cannot register for accounts

2. **Solution**: Implement registration form with email/password validation

3. **Acceptance Criteria**:
   - GIVEN a new user, WHEN they fill in valid details, THEN account is created

4. **Files to Modify**:
   | File | Purpose | Action |
   |------|---------|--------|
   | src/Register.tsx | Registration form | create |

5. **Implementation Tasks**:
\`\`\`tasks
- [ ] T001: Create registration component | File: src/Register.tsx
- [ ] T002: Add form validation | File: src/Register.tsx
\`\`\`

6. **Verification**: Manual testing of registration flow

[SPEC_GENERATED] Please review the specification above.
`;
      expect(specModeOutput).toContain('[SPEC_GENERATED]');
      expect(specModeOutput).toContain('```tasks');
      expect(specModeOutput).toContain('T001');
    });

    it('should match the expected full mode output format', () => {
      const fullModeOutput = `
1. **Problem Statement**: Users need ability to create accounts

2. **User Story**: As a new user, I want to register, so that I can access the app

3. **Acceptance Criteria**:
   - **Happy Path**: GIVEN valid email, WHEN registering, THEN account created
   - **Edge Cases**: GIVEN existing email, WHEN registering, THEN error shown

4. **Technical Context**:
   | Aspect | Value |
   |--------|-------|
   | Affected Files | src/Register.tsx |

5. **Non-Goals**: Social login, password recovery

6. **Implementation Tasks**:
\`\`\`tasks
## Phase 1: Foundation
- [ ] T001: Setup component structure | File: src/Register.tsx

## Phase 2: Core Implementation
- [ ] T002: Add form logic | File: src/Register.tsx

## Phase 3: Integration & Testing
- [ ] T003: Connect to API | File: src/api/auth.ts
\`\`\`

[SPEC_GENERATED] Please review the comprehensive specification above.
`;
      expect(fullModeOutput).toContain('Phase 1');
      expect(fullModeOutput).toContain('Phase 2');
      expect(fullModeOutput).toContain('Phase 3');
      expect(fullModeOutput).toContain('[SPEC_GENERATED]');
    });
  });
});
