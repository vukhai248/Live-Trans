import type { FlowBlockProps } from './types';

/**
 * Component overlay cho trang gốc: render các span trong suốt phủ lên canvas gốc
 * để bắt sự kiện hover chuột từng câu và đồng bộ highlight hai chiều với bản dịch.
 */
export function FlowBlock({
  b,
  block,
  scale,
  hoveredSentenceId,
  onHoverSentence,
}: FlowBlockProps) {
  const targetBlock = b || block;
  if (!targetBlock) return null;

  const [bx, by, bw, bh] = targetBlock.bbox;
  const left = bx * scale;
  const top = by * scale;
  const width = bw * scale;
  const height = bh * scale;

  const isFormula = targetBlock.isFormula;
  const isHeader = targetBlock.isHeader;
  const isHeading = targetBlock.isHeading;
  const isFootnote = targetBlock.isFootnote;
  const isAlgorithm = targetBlock.isAlgorithm;

  // Cỡ chữ gốc (không co): footnote/algo hơi nhỏ hơn như bản gốc
  const baseFontSize = isFootnote
    ? Math.max(7.2, (targetBlock.fontSize || 7.5) * scale * 0.95)
    : isAlgorithm
      ? Math.max(7.5, (targetBlock.fontSize || 8.5) * scale * 0.92)
      : Math.max(7.2, (targetBlock.fontSize || 9.5) * scale);
  const computedLineHeight = isFootnote ? 1.2 : isAlgorithm ? 1.3 : 1.24;

  const sentenceItems =
    targetBlock.sentences && targetBlock.sentences.length > 0
      ? targetBlock.sentences
      : [{ id: targetBlock.id, text: targetBlock.text }];

  return (
    <div
      data-block-id={targetBlock.id}
      class={`lt-block lt-block-orig ${isFormula ? 'lt-block-formula' : ''} ${
        isHeader ? 'lt-block-header' : ''
      } ${isHeading ? 'lt-block-heading' : ''} ${
        isFootnote ? 'lt-block-footnote' : ''
      } ${isAlgorithm ? 'lt-block-algo' : ''}`}
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        minHeight: isHeader || isFootnote ? undefined : `${Math.round(height)}px`,
        fontSize: `${baseFontSize}px`,
        lineHeight: computedLineHeight,
        fontWeight: isHeading ? 700 : (targetBlock as any).bold ? 650 : 400,
        textAlign: isFormula
          ? 'center'
          : isHeading || isHeader || isFootnote || isAlgorithm
            ? 'left'
            : 'justify',
        overflow: 'visible',
        opacity: isFormula ? 0 : 1,
        pointerEvents: isFormula ? 'none' : 'auto',
        background: 'transparent',
        zIndex: 10,
      }}
    >
      {isFormula ? (
        <span style={{ opacity: 0 }}>{targetBlock.text}</span>
      ) : (
        sentenceItems.map((s) => {
          const isActive = hoveredSentenceId === s.id;
          return (
            <span
              key={s.id}
              data-sentence-id={s.id}
              class={`lt-sentence ${isActive ? 'lt-sentence-active' : ''}`}
              onMouseEnter={() => onHoverSentence?.(s.id)}
              onMouseLeave={() => onHoverSentence?.(null)}
            >
              <span style={{ opacity: 0 }}>{s.text} </span>
            </span>
          );
        })
      )}
    </div>
  );
}
