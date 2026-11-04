'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

import { niceMax, shortDate } from './chartScale'

export type InsightPoint = { key: string; values: Record<string, number>; previous?: Record<string, number> }
export type InsightMetric = { key: string; label: string; kind: 'money' | 'count' }

const HEIGHT = 260
const PAD = { top: 16, right: 16, bottom: 30, left: 62 }

const money = (n: number) => `Rs ${Math.round(n).toLocaleString('en-PK')}`
const compact = (n: number) => (n >= 1_000_000 ? `Rs ${(n / 1_000_000).toFixed(1)}M` : n >= 10_000 ? `Rs ${Math.round(n / 1000)}k` : money(n))
const count = (n: number) => Math.round(n).toLocaleString('en-PK')

/**
 * Line chart measured in real pixels, so its text stays the same size at any width. Hover, touch or
 * use the arrow keys to read a day. With several metrics, tabs switch between them.
 */
export function InsightChart({ label, points, metrics, previousLabel }: { label: string; points: InsightPoint[]; metrics: InsightMetric[]; previousLabel?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(760)
  const [metricKey, setMetricKey] = useState(metrics[0].key)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    if (!box.current) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)))
    observer.observe(box.current)
    return () => observer.disconnect()
  }, [])

  const metric = metrics.find((m) => m.key === metricKey) ?? metrics[0]
  const current = points.map((p) => p.values[metric.key] ?? 0)
  const prior = points.some((p) => p.previous) ? points.map((p) => p.previous?.[metric.key] ?? 0) : null
  const max = niceMax(Math.max(...current, ...(prior ?? []), 0))
  const axis = metric.kind === 'money' ? compact : count
  const exact = metric.kind === 'money' ? money : count

  const innerW = width - PAD.left - PAD.right
  const innerH = HEIGHT - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (points.length > 1 ? (i / (points.length - 1)) * innerW : innerW / 2)
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH
  const path = (values: number[]) => values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')

  const every = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(innerW / 90))))
  const total = current.reduce((sum, v) => sum + v, 0)
  const empty = total === 0 && !prior?.some((v) => v > 0)

  const pick = (clientX: number, svg: SVGSVGElement) => {
    const scale = width / svg.getBoundingClientRect().width
    const px = (clientX - svg.getBoundingClientRect().left) * scale
    const index = points.length > 1 ? Math.round(((px - PAD.left) / innerW) * (points.length - 1)) : 0
    setHover(Math.min(points.length - 1, Math.max(0, index)))
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const step = e.key === 'ArrowRight' ? 1 : -1
    setHover((h) => Math.min(points.length - 1, Math.max(0, (h ?? (step > 0 ? -1 : points.length)) + step)))
  }

  const tip = hover === null ? null : points[hover]
  const tipLeft = hover === null ? 0 : Math.min(width - 180, Math.max(0, x(hover) + (x(hover) > width / 2 ? -188 : 12)))

  return (
    <div className="coco-chart">
      {metrics.length > 1 && (
        <div className="coco-tabs" role="tablist" aria-label="Chart metric">
          {metrics.map((m) => (
            <button key={m.key} type="button" role="tab" aria-selected={m.key === metric.key} className={m.key === metric.key ? 'is-active' : ''} onClick={() => setMetricKey(m.key)}>
              {m.label}
            </button>
          ))}
        </div>
      )}
      <div ref={box} className="coco-chart__plot">
        <svg
          viewBox={`0 0 ${width} ${HEIGHT}`}
          width="100%"
          height={HEIGHT}
          role="img"
          aria-label={label}
          tabIndex={0}
          onKeyDown={onKey}
          onBlur={() => setHover(null)}
          onPointerMove={(e) => pick(e.clientX, e.currentTarget)}
          onPointerDown={(e) => pick(e.clientX, e.currentTarget)}
          onPointerLeave={() => setHover(null)}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <g key={f}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(max * f)} y2={y(max * f)} className="coco-chart__grid" />
              <text x={PAD.left - 10} y={y(max * f) + 4} textAnchor="end" className="coco-chart__axis">
                {axis(max * f)}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            i % every === 0 ? (
              <text key={p.key} x={x(i)} y={HEIGHT - 8} textAnchor="middle" className="coco-chart__axis">
                {shortDate(p.key)}
              </text>
            ) : null,
          )}
          {points.length > 1 && <path d={`${path(current)} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} className="coco-chart__area" />}
          {prior && prior.length > 1 && <path d={path(prior)} className="coco-chart__prior" />}
          <path d={path(current)} className="coco-chart__line" />
          {points.length === 1 && <circle cx={x(0)} cy={y(current[0])} r={4} className="coco-chart__point" />}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} className="coco-chart__cursor" />
              {prior && <circle cx={x(hover)} cy={y(prior[hover])} r={3.5} className="coco-chart__prior-point" />}
              <circle cx={x(hover)} cy={y(current[hover])} r={5} className="coco-chart__point" />
            </g>
          )}
        </svg>
        {empty && <p className="coco-chart__empty">No {metric.label.toLowerCase()} in this period yet</p>}
        {tip && hover !== null && (
          <div className="coco-chart__tip" style={{ left: tipLeft }} role="status">
            <span>{shortDate(tip.key)}</span>
            <strong>{exact(current[hover])}</strong>
            {prior && (
              <small>
                {previousLabel ?? 'Previous'}: {exact(prior[hover])}
              </small>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
