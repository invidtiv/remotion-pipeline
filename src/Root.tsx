import React from "react";
import { Composition } from "remotion";
import { DataChart, dataChartSchema, DataChartProps } from "./compositions/DataChart";
import { StructuredScript, structuredScriptSchema, StructuredScriptProps } from "./compositions/StructuredScript";

// Default props — used in the Studio preview and as fallback for CLI renders.
// Override via --props='{"title":"..."}' or --props=./data.json on the command line.
const defaultDataChartProps: DataChartProps = {
  title: "Q4 2026 Revenue",
  subtitle: "By product line, in millions USD",
  bars: [
    { label: "Platform", value: 42, color: "#4f46e5" },
    { label: "Services", value: 28, color: "#06b6d4" },
    { label: "Enterprise", value: 67, color: "#ec4899" },
    { label: "SMB", value: 19, color: "#f59e0b" },
  ],
  brandColor: "#CCFF00",
};

const defaultStructuredProps: StructuredScriptProps = {
  title: "Default Script",
  width: 1080,
  height: 1920,
  fps: 30,
  scenes: [
    { kind: "title", durationSec: 3, props: { title: "Hello", subtitle: "World" } },
    { kind: "bullets", durationSec: 4, props: { items: ["Fast", "Simple", "Local"] } },
    { kind: "cta", durationSec: 3, props: { text: "go.example" } },
  ],
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DataChart"
        component={DataChart}
        durationInFrames={180}
        fps={30}
        width={1920}
        height={1080}
        schema={dataChartSchema}
        defaultProps={defaultDataChartProps}
        calculateMetadata={({ props }) => ({
          durationInFrames: 60 + props.bars.length * 10 + 30,
          props,
        })}
      />

      <Composition
        id="StructuredScript"
        component={StructuredScript}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        schema={structuredScriptSchema}
        defaultProps={defaultStructuredProps}
        calculateMetadata={({ props }) => ({
          durationInFrames: Math.max(1, Math.round(props.scenes.reduce((a, s) => a + s.durationSec, 0) * props.fps)),
          props,
          fps: props.fps,
          width: props.width,
          height: props.height,
        })}
      />
    </>
  );
};
