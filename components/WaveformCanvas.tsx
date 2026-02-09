import React, { useEffect, useRef } from 'react';

type LiveProps = {
  mode: 'live';
  stream: MediaStream | null;
  className?: string;
};

type StaticProps = {
  mode: 'static';
  audioBlob: Blob | null;
  className?: string;
};

type WaveformCanvasProps = LiveProps | StaticProps;

const BG = '#0b1110';
const GRID = 'rgba(16, 185, 129, 0.1)';
const WAVE = '#34d399';

const WaveformCanvas: React.FC<WaveformCanvasProps> = (props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const ensureCanvasSize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const width = Math.max(1, Math.floor(rect.width * ratio));
    const height = Math.max(1, Math.floor(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return { ctx, width, height };
  };

  const drawBackdrop = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    for (let y = 0; y <= 4; y++) {
      const yy = (height / 4) * y;
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.lineTo(width, yy);
      ctx.stroke();
    }
  };

  useEffect(() => {
    clearCanvas();
  }, []);

  useEffect(() => {
    if (props.mode !== 'live') return;
    if (!props.stream) {
      clearCanvas();
      return;
    }

    const sized = ensureCanvasSize();
    if (!sized) return;

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AudioCtx();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => undefined);
    }
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.65;
    const source = audioCtx.createMediaStreamSource(props.stream);
    const silentGain = audioCtx.createGain();
    silentGain.gain.value = 0;
    source.connect(analyser);
    analyser.connect(silentGain);
    silentGain.connect(audioCtx.destination);

    const buffer = new Uint8Array(analyser.fftSize);
    let rafId = 0;
    let smoothedPeak = 0.02;

    const tick = () => {
      const state = ensureCanvasSize();
      if (!state) return;
      const { ctx, width, height } = state;
      drawBackdrop(ctx, width, height);
      analyser.getByteTimeDomainData(buffer);

      let peak = 0;
      for (let i = 0; i < buffer.length; i++) {
        const amplitude = Math.abs(buffer[i] / 128 - 1);
        if (amplitude > peak) peak = amplitude;
      }
      smoothedPeak = smoothedPeak * 0.85 + peak * 0.15;
      const dynamicGain = Math.min(5, Math.max(1, 0.28 / Math.max(smoothedPeak, 0.01)));

      ctx.strokeStyle = WAVE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const sliceWidth = width / buffer.length;
      let x = 0;
      for (let i = 0; i < buffer.length; i++) {
        const value = buffer[i] / 128 - 1;
        const y = height / 2 + value * height * 0.38 * dynamicGain;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.stroke();
      rafId = window.requestAnimationFrame(tick);
    };

    tick();

    return () => {
      window.cancelAnimationFrame(rafId);
      source.disconnect();
      analyser.disconnect();
      silentGain.disconnect();
      audioCtx.close().catch(() => undefined);
    };
  }, [props.mode, props.mode === 'live' ? props.stream : null]);

  useEffect(() => {
    if (props.mode !== 'static') return;
    if (!props.audioBlob) {
      clearCanvas();
      return;
    }

    let cancelled = false;
    const draw = async () => {
      const sized = ensureCanvasSize();
      if (!sized) return;
      const { ctx, width, height } = sized;
      drawBackdrop(ctx, width, height);

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      try {
        const raw = await props.audioBlob.arrayBuffer();
        if (cancelled) return;
        const decoded = await audioCtx.decodeAudioData(raw.slice(0));
        if (cancelled) return;
        const data = decoded.getChannelData(0);
        const step = Math.max(1, Math.floor(data.length / width));

        ctx.strokeStyle = WAVE;
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x++) {
          const start = x * step;
          const end = Math.min(data.length, start + step);
          let min = 1;
          let max = -1;
          for (let i = start; i < end; i++) {
            const v = data[i];
            if (v < min) min = v;
            if (v > max) max = v;
          }
          const y1 = ((1 + min) / 2) * height;
          const y2 = ((1 + max) / 2) * height;
          ctx.beginPath();
          ctx.moveTo(x, y1);
          ctx.lineTo(x, y2);
          ctx.stroke();
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Waveform decode failed:', err);
        }
      } finally {
        audioCtx.close().catch(() => undefined);
      }
    };

    draw();
    return () => {
      cancelled = true;
    };
  }, [props.mode, props.mode === 'static' ? props.audioBlob : null]);

  return <canvas ref={canvasRef} className={props.className || 'w-full h-20 rounded-xl'} />;
};

export default WaveformCanvas;
