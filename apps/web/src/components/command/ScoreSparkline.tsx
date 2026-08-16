// apps/web/src/components/command/ScoreSparkline.tsx
"use client"

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

export function ScoreSparkline({
  data,
}: {
  data: Array<{ t: string; score: number }>
}) {
  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="t" hide />
          <YAxis domain={[0, 100]} width={28} />
          <Tooltip />
          <Line type="monotone" dataKey="score" stroke="#fbbf24" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
