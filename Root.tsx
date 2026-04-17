import React from "react";
import { Composition, getInputProps } from "remotion";
import { DataChart, dataChartSchema, DataChartProps } from "./compositions/DataChart";

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

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DataChart"
        component={DataChart}
        durationInFrames={180} // 6 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
        schema={dataChartSchema}
        defaultProps={defaultDataChartProps}
        // Dynamic metadata: lets you compute duration from props at render time.
        // e.g. 60 frames of title + 10 frames per bar + 30 frames of hold.
        calculateMetadata={({ props }) => ({
          durationInFrames: 60 + props.bars.length * 10 + 30,
          props,
        })}
      />

      {/* Add more compositions here as you build them out */}
      {/* <Composition id="ProductDemo" component={ProductDemo} ... /> */}
    </>
  );
};
