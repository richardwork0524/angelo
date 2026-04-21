/**
 * hierarchy-rules.ts — single source of truth for parent→child entity type mapping.
 * Phase 3 of Angelo Dashboard Revamp.
 */

export type EntityType =
  | 'company'
  | 'department'
  | 'app'
  | 'module'
  | 'feature'
  | 'game'
  | 'shell'
  | 'meta'
  | 'mission'
  | 'website';

/** The allowed child type for each parent entity type. 'task' means insert into angelo_tasks. null means no children. */
export const CHILD_TYPE_FOR_PARENT: Record<EntityType, EntityType | 'task' | null> = {
  company:    'department',
  department: 'mission',
  app:        'module',
  module:     'feature',
  feature:    'mission',
  game:       'mission',
  website:    'mission',
  meta:       'mission',
  mission:    'task',
  shell:      null,
};

/** Button label shown in entity detail for creating a child. */
export const CHILD_LABEL_FOR_PARENT: Record<EntityType, string> = {
  company:    'Add Department',
  department: 'Add Mission',
  app:        'Add Module',
  module:     'Add Feature',
  feature:    'Add Mission',
  game:       'Add Mission',
  website:    'Add Mission',
  meta:       'Add Mission',
  mission:    'Add Task',
  shell:      '',
};

/**
 * Validate whether childType is a valid child of parentType.
 * 'task' is valid for mission parents.
 */
export function isValidChild(
  parentType: EntityType,
  childType: EntityType | 'task'
): boolean {
  return CHILD_TYPE_FOR_PARENT[parentType] === childType;
}
