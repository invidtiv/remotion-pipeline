import React from 'react';
import { StructuredScript } from '../StructuredScript';
import type { StructuredScriptProps } from '../StructuredScript';

export const compositionProps: StructuredScriptProps = {
  title: "Module 01 — Introduction to Deep Learning and TensorFlow",
  width: 1920,
  height: 1080,
  fps: 30,
  scenes: [
    { kind: "title", durationSec: 4, props: { title: "Introduction to Deep Learning", subtitle: "Module 01 · TensorFlow Course" } },
    { kind: "bullets", durationSec: 8, props: { items: ["What deep learning actually is", "Why it dominated ML over the last decade", "Three anchors: representations, chain rule, SGD"] } },
    { kind: "title", durationSec: 3, props: { title: "From hand-crafted to learned features", subtitle: "SIFT · HOG · MFCCs → end-to-end networks" } },
    { kind: "bullets", durationSec: 8, props: { items: ["A deep net is a stack of differentiable functions", "Power comes from composition, not a single clever layer", "Training = minimize a scalar loss by gradient descent", "Gradients flow backward through the chain rule"] } },
    { kind: "title", durationSec: 3, props: { title: "Why now?", subtitle: "GPUs · data · better initialization" } },
    { kind: "bullets", durationSec: 7, props: { items: ["ImageNet 2012 — AlexNet halved top-5 error", "GPU compute unlocked billion-parameter training", "ReLU, batch norm, residual links stabilized depth", "Open source frameworks made it accessible"] } },
    { kind: "title", durationSec: 3, props: { title: "TensorFlow, Keras, and eager execution", subtitle: "One stack, three levels of abstraction" } },
    { kind: "bullets", durationSec: 8, props: { items: ["tf.Tensor — dense multi-dimensional arrays on CPU/GPU", "tf.function — traces Python into a compiled graph", "Keras — the high-level model API most courses teach", "GradientTape — manual differentiation for custom loops"] } },
    { kind: "title", durationSec: 3, props: { title: "Gradient descent in 30 seconds", subtitle: "The engine behind every training run" } },
    { kind: "bullets", durationSec: 9, props: { items: ["Pick a loss — measures how wrong the model is", "Compute ∂loss/∂parameters — the gradient", "Step parameters against the gradient: θ ← θ − η·∇loss", "Repeat on mini-batches until loss plateaus", "Everything else is variance reduction on this core loop"] } },
    { kind: "title", durationSec: 3, props: { title: "Course roadmap", subtitle: "10 modules · 152 hands-on labs" } },
    { kind: "bullets", durationSec: 9, props: { items: ["Fundamentals → CNNs → Advanced Training", "Segmentation → Detection → GANs", "NLP → Time Series → Production Deployment", "Every module has theory, labs, and a quiz", "Progress tracked locally — your data never leaves the device"] } },
    { kind: "cta", durationSec: 4, props: { text: "Start the hands-on labs →" } },
  ],
};

export const Generated1776465157203: React.FC<StructuredScriptProps> = (props) => {
  return <StructuredScript {...props} />;
};
