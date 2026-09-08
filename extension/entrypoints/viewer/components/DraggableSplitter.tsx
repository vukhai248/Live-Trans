import type { DraggableSplitterProps } from './types';

export function DraggableSplitter({
  splitRatio = 0.5,
  isDragging = false,
  onMouseDown,
  onReset5050,
  onPointerDown,
  onSplitRatioChange,
}: DraggableSplitterProps) {
  const handlePointerDown = (e: PointerEvent) => {
    if (onPointerDown) {
      onPointerDown(e);
      return;
    }
    if (onMouseDown) {
      onMouseDown(e as any);
    }

    e.preventDefault();
    document.body.classList.add('lt-resizing');
    const target = e.currentTarget as Element;
    try {
      (target as any).setPointerCapture?.(e.pointerId);
    } catch {}

    let currentRatio = splitRatio;
    let rafId = 0;

    const onPointerMove = (ev: PointerEvent) => {
      const workspace = target.parentElement;
      if (!workspace) return;
      const rect = workspace.getBoundingClientRect();
      const rawRatio = (ev.clientX - rect.left) / rect.width;
      const clamped = Math.max(0.2, Math.min(0.8, rawRatio));
      currentRatio = clamped;

      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const leftPane = workspace.querySelector('.lt-pane-left, .lt-left-pane') as HTMLElement | null;
        const rightPane = workspace.querySelector('.lt-pane-right, .lt-right-pane') as HTMLElement | null;
        if (leftPane) leftPane.style.width = `${clamped * 100}%`;
        if (rightPane) rightPane.style.width = `${(1 - clamped) * 100}%`;
      });
    };

    const onPointerUp = (ev: PointerEvent) => {
      document.body.classList.remove('lt-resizing');
      if (rafId) cancelAnimationFrame(rafId);
      try {
        (target as any).releasePointerCapture?.(ev.pointerId);
      } catch {}
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      if (onSplitRatioChange) {
        onSplitRatioChange(currentRatio);
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <div
      class={`lt-splitter ${isDragging ? 'dragging' : ''}`}
      title="Kéo sang trái/phải để mở rộng không gian đọc bản dịch (khắc phục dãn nở văn bản)"
      onPointerDown={handlePointerDown}
      onDblClick={onReset5050}
    >
      <div class="lt-splitter-bar" />
    </div>
  );
}
