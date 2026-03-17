import React, { useEffect, useRef, useState } from 'react';

interface Props {
  isRecording: boolean;
  stream?: MediaStream | null;
}

export const AudioWaveform: React.FC<Props> = ({ isRecording, stream }) => {
  const [levels, setLevels] = useState<number[]>(Array(24).fill(0.1));
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const historyRef = useRef<number[]>([]);

  useEffect(() => {
    if (!isRecording || !stream) {
      setLevels(Array(24).fill(0).map(() => 0.05 + Math.random() * 0.1));
      historyRef.current = [];
      return;
    }
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioCtxRef.current = ctx;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.3;
    analyserRef.current = analyser;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.fftSize);

    const update = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) { const n = (data[i] - 128) / 128; sum += n * n; }
      const rms = Math.sqrt(sum / data.length);
      const level = Math.max(0.15, Math.min(1, rms * 4));
      historyRef.current.unshift(level);
      if (historyRef.current.length > 12) historyRef.current.pop();
      const newLevels = Array(24).fill(0.1);
      const center = 12;
      for (let i = 0; i < historyRef.current.length; i++) {
        if (center - 1 - i >= 0) newLevels[center - 1 - i] = historyRef.current[i];
        if (center + i < 24) newLevels[center + i] = historyRef.current[i];
      }
      setLevels(newLevels);
      animationRef.current = requestAnimationFrame(update);
    };
    update();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, [isRecording, stream]);

  return (
    <div className="flex items-center justify-center gap-[3px] h-8 flex-1 px-2">
      {levels.map((l, i) => (
        <div key={i} className="bg-slate-400 rounded-full transition-all duration-75" style={{ width: 3, height: Math.max(4, l * 28) }} />
      ))}
    </div>
  );
};
