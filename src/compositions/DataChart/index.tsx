import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";

// Zod schema: enables Claude Code / Remotion Studio to render with dynamic props.
// You can drive this from a JSON file, an API, or a database.
export const dataChartSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  bars: z.array(
    z.object({
      label: z.string(),
      value: z.number(),
      color: z.string(),
    })
  ),
  brandColor: z.string().default("#CCFF00"),
});

export type DataChartProps = z.infer<typeof dataChartSchema>;

export const DataChart: React.FC<DataChartProps> = ({
  title,
  subtitle,
  bars,
  brandColor,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Title entrance spring
  const titleProgress = spring({
    frame,
    fps,
    config: { damping: 200, mass: 0.5 },
  });

  const maxValue = Math.max(...bars.map((b) => b.value));

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0a",
        color: "white",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: 80,
      }}
    >
      {/* Title */}
      <div
        style={{
          opacity: titleProgress,
          transform: `translateY(${interpolate(titleProgress, [0, 1], [20, 0])}px)`,
        }}
      >
        <h1 style={{ fontSize: 72, fontWeight: 800, margin: 0 }}>{title}</h1>
        <p style={{ fontSize: 28, color: "#888", marginTop: 8 }}>{subtitle}</p>
      </div>

      {/* Bars — staggered entrance, one every 10 frames after frame 30 */}
      <div
        style={{
          display: "flex",
          gap: 40,
          alignItems: "flex-end",
          height: 400,
          marginTop: 80,
        }}
      >
        {bars.map((bar, i) => {
          const startFrame = 30 + i * 10;
          const barProgress = spring({
            frame: frame - startFrame,
            fps,
            config: { damping: 100, mass: 1 },
          });
          const height = (bar.value / maxValue) * 400 * barProgress;

          return (
            <Sequence key={bar.label} from={startFrame}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                  flex: 1,
                }}
              >
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 700,
                    color: brandColor,
                    opacity: barProgress,
                  }}
                >
                  {bar.value}
                </div>
                <div
                  style={{
                    width: "100%",
                    height,
                    backgroundColor: bar.color,
                    borderRadius: "8px 8px 0 0",
                  }}
                />
                <div style={{ fontSize: 24, color: "#ccc" }}>{bar.label}</div>
              </div>
            </Sequence>
          );
        })}
      </div>

      {/* Fade-out on last 15 frames */}
      <AbsoluteFill
        style={{
          backgroundColor: "#0a0a0a",
          opacity: interpolate(
            frame,
            [durationInFrames - 15, durationInFrames],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          ),
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
