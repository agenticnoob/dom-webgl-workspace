import React from "react";
import {
  PerspectiveTimeline,
  type PerspectiveTimelineEntry,
} from "../recipes/perspective-timeline";

const entries = [
  {
    id: "release",
    label: "06 / Release",
    meta: "TypeScript · React · WebGL",
    body: "把完成的作品交给使用者。一个清楚的入口，一份完整的说明，以及可以回到过去查看的记录。\nShip the work, then listen to what people do with it.",
  },
  {
    id: "verify",
    label: "05 / Verify",
    meta: "Keyboard · Touch · Reduced motion",
    body: "在真实浏览器里走完一遍：向前、回退、停下、再次开始。让每种输入方式都能抵达同样完整的内容。",
  },
  {
    id: "refine",
    label: "04 / Refine",
    meta: "Typography · Timing · Contrast",
    body: "缩减不必要的运动，给文字留出空间。每一次调整都应该让作品更容易读懂，而不只是更醒目。",
  },
  {
    id: "build",
    label: "03 / Build",
    meta: "DOM · Perspective · Light",
    body: "日期和事件沿同一条路径经过，左右内容始终配对。滚动快慢改变中心物体的推进感，停止后缓缓恢复。",
  },
  {
    id: "prototype",
    label: "02 / Prototype",
    meta: "Sketches · Geometry · Experiments",
    body: "从一个可逆的小实验开始。保持内容顺序，尝试不同长度的文本，再决定哪些行为值得保留。\nA prototype makes an idea available for inspection.",
  },
  {
    id: "begin",
    label: "01 / Begin",
    meta: "Notes · Questions · Curiosity",
    body: "先写下一个值得探索的问题。每一步留下记录，让后来的人能够理解当时的选择，也能继续走下去。",
  },
] satisfies readonly PerspectiveTimelineEntry[];
const labels = {
  read: "阅读完整时间线",
  resume: "返回透视演示",
  empty: "还没有记录。",
};

export default function PerspectiveTimelineDemo() {
  return (
    <PerspectiveTimeline
      id="example.timeline"
      title="A record in motion"
      description="滚动穿过记录 · 停下观察阻尼与边缘光 · 向上滚动原路返回"
      entries={entries}
      labels={labels}
    />
  );
}
