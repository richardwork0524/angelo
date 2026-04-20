'use client';

interface EntityDropTargetProps {
  entityKey: string;
  displayName: string;
  isArchived: boolean;
  isDragActive: boolean;
  onDrop: (entityKey: string) => void;
  children: React.ReactNode;
}

/**
 * Wraps an entity list item as a drop target for session re-attribution.
 * Only activates when isDragActive (a session is being dragged).
 * Archived entities dim and block the drop.
 */
export function EntityDropTarget({
  entityKey,
  displayName,
  isArchived,
  isDragActive,
  onDrop,
  children,
}: EntityDropTargetProps) {
  const handleDragOver = (e: React.DragEvent) => {
    if (!isDragActive) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = isArchived ? 'none' : 'move';
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!isDragActive || isArchived) return;
    e.preventDefault();
    onDrop(entityKey);
  };

  if (!isDragActive) return <>{children}</>;

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      title={isArchived ? `${displayName} is archived — cannot re-assign` : `Drop to re-assign to ${displayName}`}
      style={{
        position: 'relative',
        opacity: isArchived ? 0.35 : 1,
        cursor: isArchived ? 'not-allowed' : 'copy',
        transition: 'opacity 100ms',
      }}
    >
      {children}
      {/* Drop target overlay badge */}
      {!isArchived && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            border: '2px solid var(--primary)',
            borderRadius: 'inherit',
            background: 'var(--primary-dim)',
            boxShadow: '0 0 16px rgba(10,132,255,0.2)',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: 8,
            zIndex: 1,
          }}
        >
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '.05em',
              color: 'var(--primary-2)',
              background: 'var(--primary-dim)',
              padding: '2px 6px',
              borderRadius: 999,
              border: '1px solid rgba(10,132,255,0.4)',
            }}
          >
            Drop to re-assign
          </span>
        </div>
      )}
    </div>
  );
}
