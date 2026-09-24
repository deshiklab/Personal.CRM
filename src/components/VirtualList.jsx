/* Lightweight windowed list — no extra deps.
 * Renders only the rows near the scrollport so 5k contacts stay snappy. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * @param {object} props
 * @param {any[]} props.items
 * @param {number} [props.rowHeight=64] fixed row height in px
 * @param {number} [props.overscan=8] extra rows above/below
 * @param {(item:any, index:number) => React.ReactNode} props.renderRow
 * @param {string} [props.className]
 * @param {number} [props.maxHeight] optional px cap; default fills parent
 * @param {string} [props.ariaLabel]
 * @param {'listbox'|'list'|'table'} [props.role]
 */
export default function VirtualList({
  items = [],
  rowHeight = 64,
  overscan = 8,
  renderRow,
  className = '',
  maxHeight,
  ariaLabel = 'List',
  role = 'list',
  style,
  getKey,
}) {
  const scrollerRef = useRef(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewH, setViewH] = useState(480)

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const measure = () => setViewH(el.clientHeight || 480)
    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(el)
    window.addEventListener('resize', measure)
    return () => { ro?.disconnect(); window.removeEventListener('resize', measure) }
  }, [])

  const onScroll = useCallback((e) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  const total = items.length
  const totalH = total * rowHeight
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
  const visible = Math.ceil(viewH / rowHeight) + overscan * 2
  const end = Math.min(total, start + visible)
  const offsetY = start * rowHeight

  const slice = useMemo(() => items.slice(start, end), [items, start, end])

  /* fallback: tiny lists skip virtualisation overhead */
  if (total <= 40) {
    return (
      <div
        ref={scrollerRef}
        className={className}
        role={role}
        aria-label={ariaLabel}
        style={{ maxHeight, overflow: maxHeight ? 'auto' : undefined, ...style }}
      >
        {items.map((item, i) => (
          <div key={getKey ? getKey(item, i) : (item?.id ?? i)} role={role === 'list' ? 'listitem' : undefined}
            style={{ minHeight: rowHeight }}>
            {renderRow(item, i)}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      ref={scrollerRef}
      className={className}
      role={role}
      aria-label={ariaLabel}
      aria-rowcount={role === 'table' ? total : undefined}
      onScroll={onScroll}
      style={{
        maxHeight: maxHeight || '100%',
        overflow: 'auto',
        position: 'relative',
        WebkitOverflowScrolling: 'touch',
        ...style,
      }}
    >
      <div style={{ height: totalH, position: 'relative' }} aria-hidden={false}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${offsetY}px)` }}>
          {slice.map((item, j) => {
            const i = start + j
            return (
              <div
                key={getKey ? getKey(item, i) : (item?.id ?? i)}
                role={role === 'list' ? 'listitem' : undefined}
                aria-rowindex={role === 'table' ? i + 1 : undefined}
                style={{ height: rowHeight, boxSizing: 'border-box' }}
              >
                {renderRow(item, i)}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
