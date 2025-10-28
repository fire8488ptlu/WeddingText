import React, { useEffect, useMemo, useRef, useState } from "react";

export default function BlessingWave({ breakEvery, waveSize }) {
  const [blessings, setBlessings] = useState([""]);
  const stageRef = useRef(null);

  const WAVE_INTERVAL = 4000;
  const BURST_TIME = 1400;
  const MIN_LIFE = 6000;
  const MAX_LIFE = 10000;
  const MAX_LIVE = 120;

  const COLORS = ["#FFE66F", "#FFF0AC", "#FFDCB9"];

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/input.json", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load input.json");
        const data = await res.json();
        const arr = Array.isArray(data)
          ? data.map((d) => String(d?.answer_text ?? "").trim()).filter(Boolean)
          : [];
        if (alive) setBlessings(arr.length ? arr : ["(無資料)"]);
      } catch (e) {
        console.error(e);
        if (alive) setBlessings(["Error: 無法載入祝福資料"]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const splitGraphemes = (text) => {
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      const seg = new Intl.Segmenter("zh-Hant", { granularity: "grapheme" });
      return Array.from(seg.segment(text), (s) => s.segment);
    }
    return Array.from(text);
  };

  const wrapIntoNodes = (text, limit) => {
    const g = splitGraphemes(text);
    const nodes = [];
    for (let i = 0; i < g.length; i += limit) {
      nodes.push(
        <span key={`seg-${i}`}>{g.slice(i, i + limit).join("")}</span>
      );
      if (i + limit < g.length) nodes.push(<br key={`br-${i}`} />);
    }
    return nodes;
  };

  const rand = (min, max) => Math.random() * (max - min) + min;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const [items, setItems] = useState([]);
  const idRef = useRef(0);
  const cleanupTimers = useRef([]);
  useEffect(() => () => cleanupTimers.current.forEach(clearTimeout), []);

  const spawnOne = () => {
    const stage = stageRef.current;
    if (!stage) return;

    setItems((prev) => {
      const next = [...prev];
      if (next.length >= MAX_LIVE) next.shift();

      const text = pick(blessings);
      const rect = stage.getBoundingClientRect();
      const startX = rand(50, rect.width - 100);
      const startY = rand(50, rect.height - 50);
      const driftX = rand(-rect.width * 0.05, rect.width * 0.05);
      const driftY = rand(rect.height * 0.12, rect.height * 0.25);
      const scale = rand(0.95, 1.08);
      const rot = rand(-6, 6);

      const color = pick(COLORS);

      const len = splitGraphemes(text).length;
      let fontEm = 1.6;
      if (len > 100) fontEm = 0.9;
      else if (len > 60) fontEm = 1.1;
      else if (len > 30) fontEm = 1.3;

      const life = rand(MIN_LIFE, MAX_LIFE);
      const id = idRef.current++;

      next.push({
        id,
        textNodes: wrapIntoNodes(text, breakEvery),
        style: {
          "--x": `${startX}px`,
          "--y": `${startY}px`,
          "--dx": `${driftX}px`,
          "--dy": `${driftY}px`,
          "--s": scale,
          "--r": `${rot}deg`,
          color,
          fontSize: `${fontEm}em`,
          animationDuration: `${life}ms`,
          animationDelay: `${Math.floor(rand(0, 250))}ms`,
        },
      });

      const t = setTimeout(() => {
        setItems((cur) => cur.filter((it) => it.id !== id));
      }, life + 220);
      cleanupTimers.current.push(t);

      return next;
    });
  };

  const spawnWave = () => {
    const start = performance.now();
    let spawned = 0;
    const step = (now) => {
      const t = Math.min(1, (now - start) / BURST_TIME);
      const want = Math.floor(waveSize * (1 - Math.pow(1 - t, 1.7)));
      while (spawned < want) {
        spawnOne();
        spawned++;
      }
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  useEffect(() => {
    for (let i = 0; i < 10; i++) spawnOne();
    const int = setInterval(spawnWave, WAVE_INTERVAL);
    spawnWave();
    return () => clearInterval(int);
  }, [blessings, breakEvery, waveSize]);

  const GlobalStyle = useMemo(
    () => (
      <style>{`
      .stage {
        width: 82vw;
        aspect-ratio: 16/9;
        background: rgba(0, 0, 0, 0.65);
        border-radius: 22px;
        border: 2px solid #222;
        position: relative;
        overflow: hidden;
        box-shadow: 0 0 50px rgba(255,255,255,0.08);
      }
      .lineItem {
        position: absolute;
        pointer-events: none;
        max-width: 45%;
        white-space: normal;
        word-break: break-word;
        line-height: 1.5em;
        text-align: center;
        opacity: 0;
        filter: drop-shadow(0 0 8px currentColor);
        animation-name: floatFade;
        animation-timing-function: ease-in-out;
        animation-fill-mode: forwards;
        transform: translate(var(--x), var(--y)) scale(var(--s)) rotate(var(--r));
      }
      @keyframes floatFade {
        0%   { opacity: 0; }
        12%  { opacity: 1; }
        85%  { opacity: 1; }
        100% { opacity: 0; transform: translate(calc(var(--x) + var(--dx)), calc(var(--y) - var(--dy))) scale(var(--s)) rotate(var(--r)); }
      }
    `}</style>
    ),
    []
  );

  return (
    <div
      style={{
        height: "100vh",
        margin: 0,
        background: "radial-gradient(circle at center, #000 20%, #020202 80%)",
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        fontFamily:
          'system-ui, -apple-system, "Noto Sans TC", Segoe UI, Roboto, sans-serif',
      }}
    >
      {GlobalStyle}
      <div ref={stageRef} className="stage">
        {items.map((it) => (
          <div key={it.id} className="lineItem" style={it.style}>
            {it.textNodes}
          </div>
        ))}
      </div>
    </div>
  );
}
