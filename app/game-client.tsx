'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Leaf,
  CloudRain,
  Wind,
  Users,
  ArrowUpRight,
  Volume2,
  VolumeX,
  HelpCircle,
  Copy,
  Check,
  Play,
  LogOut,
  Clock,
  Trash2,
  Shield,
  ChevronRight,
  X,
  RotateCcw,
  MapPin,
  Settings as SettingsIcon,
  Maximize,
  MousePointer2,
  Eye,
  Map as MapIcon,
  Hand,
  MoveDown,
} from 'lucide-react';
import {
  newGame,
  joinGame,
  startGame,
  tickWorld,
  movePlayer,
  contextHint,
  taskAt,
  waterDepth,
  rainy,
  onboardingHint,
  zoneRemaining,
  zoneGoal,
  COLORS,
  BUILDINGS,
  DEPOTS,
  CART_CAPACITY,
  type Game,
  type Season,
  type Pace,
  type Tool,
  type Input,
} from '@/lib/game';
import type { Look, Settings } from '@/lib/scene3d';
import { createInputHistory, nextInputSequence } from '@/lib/input-sync';
import { clampViewPitch } from '@/lib/view-controls';
const choices = [
  {
    id: 'mixed' as Season,
    title: 'Một ca Hà Nội',
    desc: 'Lá thu, rồi mưa bất chợt.',
    icon: Wind,
  },
  {
    id: 'autumn' as Season,
    title: 'Mùa lá rụng',
    desc: 'Phố vàng lá, thơm hoa sữa.',
    icon: Leaf,
  },
  {
    id: 'rain' as Season,
    title: 'Sau cơn mưa',
    desc: 'Lội nước, tìm đường thoát.',
    icon: CloudRain,
  },
];
type Mode = 'menu' | 'solo' | 'online';
type Panel = 'none' | 'pause' | 'help' | 'settings';
const coarsePointer = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(pointer: coarse)').matches;
const initialSettings: Settings = {
  quality: 'high',
  view: 'third',
  sensitivity: 1,
  motion: false,
  fov: 76,
};
export default function GameClient() {
  const [game, setGame] = useState<Game>(() => newGame()),
    [mode, setMode] = useState<Mode>('menu'),
    [season, setSeason] = useState<Season>('mixed'),
    [pace, setPace] = useState<Pace>('relaxed'),
    [name, setName] = useState('Nam'),
    [code, setCode] = useState('');
  const [ready, setReady] = useState(false),
    [graphicsError, setGraphicsError] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [panel, setPanel] = useState<Panel>('none'),
    [locked, setLocked] = useState(false),
    [fallback, setFallback] = useState(false),
    [touchUI, setTouchUI] = useState(false),
    [map, setMap] = useState(false),
    [copied, setCopied] = useState(false),
    [settings, setSettings] = useState<Settings>(initialSettings),
    [sound, setSound] = useState(true),
    [fps, setFps] = useState(0),
    [ping, setPing] = useState(0),
    [netFailures, setNetFailures] = useState(0);
  const [feedback, setFeedback] = useState(''),
    [saved, setSaved] = useState(false);
  const root = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    gref = useRef(game),
    mref = useRef<Mode>('menu'),
    pref = useRef<Panel>('none'),
    sref = useRef(settings),
    keys = useRef(new Set<string>()),
    look = useRef<Look>({ yaw: -Math.PI / 2, pitch: -0.05 });
  const toolRef = useRef<Tool>('broom'),
    session = useRef({ id: '', token: '', seq: 0, revision: -1 }),
    lockRef = useRef(false),
    fallbackRef = useRef(false),
    pending = useRef({ mask: false, grab: false, ping: false }),
    mouse = useRef({ work: false, drag: false, x: 0, y: 0 }),
    touch = useRef({ x: 0, y: 0, work: false, crouch: false }),
    generation = useRef(0),
    audio = useRef<AudioContext | null>(null),
    soundRef = useRef(true),
    ambience = useRef<GainNode | null>(null),
    lastSound = useRef(0),
    heardAction = useRef(0);
  const inputHistory = useRef<ReturnType<typeof createInputHistory> | null>(
    null,
  );
  function update(g: Game) {
    if (g.round > gref.current.round) {
      toolRef.current = 'broom';
      heardAction.current = 0;
      pending.current = { mask: false, grab: false, ping: false };
      keys.current.clear();
      inputHistory.current?.clear(performance.now());
      look.current = { yaw: -Math.PI / 2, pitch: -0.05 };
    }
    gref.current = g;
    setGame({ ...g });
  }
  function changeMode(m: Mode) {
    inputHistory.current?.clear(performance.now());
    mref.current = m;
    setMode(m);
  }
  function showPanel(p: Panel) {
    inputHistory.current?.clear(performance.now());
    pref.current = p;
    setPanel(p);
    keys.current.clear();
    pending.current = { mask: false, grab: false, ping: false };
    mouse.current.work = false;
    touch.current.work = false;
    if (p !== 'none' && document.pointerLockElement) document.exitPointerLock();
  }
  function input(consume = false): Input {
    const k = keys.current;
    const active =
      (lockRef.current || fallbackRef.current) && pref.current === 'none';
    if (!active)
      return {
        x: 0,
        y: 0,
        work: false,
        sprint: false,
        mask: false,
        grab: false,
        ping: false,
        crouch: false,
        tool: toolRef.current,
        yaw: look.current.yaw,
        pitch: look.current.pitch,
      };
    const f =
      (k.has('w') || k.has('arrowup') ? 1 : 0) -
      (k.has('s') || k.has('arrowdown') ? 1 : 0) -
      touch.current.y;
    const side =
      (k.has('d') || k.has('arrowright') ? 1 : 0) -
      (k.has('a') || k.has('arrowleft') ? 1 : 0) +
      touch.current.x;
    const yaw = look.current.yaw;
    const crouch = k.has('c') || touch.current.crouch;
    const v = {
      x: Math.cos(yaw) * side - Math.sin(yaw) * f,
      y: -Math.sin(yaw) * side - Math.cos(yaw) * f,
      work:
        mouse.current.work || touch.current.work || k.has('e') || k.has(' '),
      sprint: k.has('shift'),
      mask: pending.current.mask,
      grab: pending.current.grab,
      ping: pending.current.ping,
      tool: toolRef.current,
      crouch,
      yaw,
      pitch: crouch ? Math.min(look.current.pitch, -0.6) : look.current.pitch,
    };
    if (consume) pending.current = { mask: false, grab: false, ping: false };
    return v;
  }
  function unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }
  function initAudio() {
    if (!soundRef.current) return;
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume();
      if (!ambience.current) {
        const a = audio.current,
          buffer = a.createBuffer(1, a.sampleRate * 2, a.sampleRate),
          data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const source = a.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        const filter = a.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 850;
        const gain = a.createGain();
        gain.gain.value = 0;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(a.destination);
        source.start();
        ambience.current = gain;
      }
    } catch {}
  }
  function noise(wet: boolean) {
    if (!soundRef.current || !audio.current) return;
    const a = audio.current;
    const buffer = a.createBuffer(1, a.sampleRate * 0.1, a.sampleRate);
    const arr = buffer.getChannelData(0);
    for (let i = 0; i < arr.length; i++)
      arr[i] = (Math.random() * 2 - 1) * (1 - i / arr.length);
    const src = a.createBufferSource();
    src.buffer = buffer;
    const filter = a.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = wet ? 400 : 1300;
    const gain = a.createGain();
    gain.gain.value = wet ? 0.08 : 0.035;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(a.destination);
    src.start();
  }
  async function capture() {
    showPanel('none');
    initAudio();
    if (coarsePointer()) {
      fallbackRef.current = true;
      setFallback(true);
      return;
    }
    try {
      if (!canvas.current?.requestPointerLock) throw new Error('unavailable');
      await canvas.current.requestPointerLock();
    } catch {
      fallbackRef.current = true;
      setFallback(true);
      setError(
        'Trình duyệt chưa khóa được chuột. Giữ chuột phải và kéo để nhìn; chuột trái để quét.',
      );
    }
  }
  async function api(action: string, extra: Record<string, unknown> = {}) {
    const s = session.current,
      gen = generation.current;
    const res = await fetch('/api/game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(6000),
      body: JSON.stringify({
        action,
        id: s.id,
        token: s.token,
        code: gref.current.code,
        round: gref.current.round,
        name,
        ...extra,
      }),
    });
    const data = (await res.json()) as {
      game: Game;
      revision?: number;
      error?: string;
    };
    if (gen !== generation.current) return gref.current;
    if (!res.ok) {
      if (res.status === 409 && data.game?.round > gref.current.round) {
        s.revision = data.revision ?? s.revision;
        return data.game;
      }
      throw new Error(data.error || 'Kết nối phòng gặp lỗi.');
    }
    if (typeof data.revision === 'number' && data.revision < s.revision)
      return gref.current;
    s.revision = data.revision ?? 0;
    s.seq = nextInputSequence(data.game, s.id, s.seq);
    return data.game;
  }
  function actionSound(kind: string) {
    if (!soundRef.current || !audio.current) return;
    const a = audio.current,
      osc = a.createOscillator(),
      gain = a.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(
      kind === 'scoop'
        ? 270
        : kind === 'dump'
          ? 150
          : kind === 'deliver'
            ? 540
            : 350,
      a.currentTime,
    );
    osc.frequency.exponentialRampToValueAtTime(
      kind === 'deliver' ? 820 : 90,
      a.currentTime + 0.14,
    );
    gain.gain.setValueAtTime(0.035, a.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(a.destination);
    osc.start();
    osc.stop(a.currentTime + 0.2);
  }

  useEffect(() => {
    setTouchUI(coarsePointer());
    session.current.id = crypto.randomUUID();
    session.current.token = crypto.randomUUID();
    try {
      setName(localStorage.getItem('ca-dem-name') || 'Nam');
      const saved = JSON.parse(
        localStorage.getItem('ca-dem-settings') || 'null',
      );
      if (saved) {
        const valid: Settings = {
          quality: saved.quality === 'low' ? 'low' : 'high',
          view: saved.view === 'first' ? 'first' : 'third',
          sensitivity: Math.max(
            0.3,
            Math.min(2, Number(saved.sensitivity) || 1),
          ),
          motion: saved.motion === true,
          fov: Math.max(65, Math.min(95, Number(saved.fov) || 76)),
        };
        sref.current = valid;
        setSettings(valid);
      }
    } catch {}
    const q = new URLSearchParams(location.search).get('room');
    if (q) setCode(q.slice(0, 6).toUpperCase());
  }, []);
  useEffect(() => {
    let stopped = false,
      af = 0;
    let scene:
      | ReturnType<(typeof import('@/lib/scene3d'))['createFirstPersonScene']>
      | undefined;
    let last = performance.now(),
      ui = last,
      frameStart = last,
      count = 0;
    import('@/lib/scene3d')
      .then(({ createFirstPersonScene }) => {
        if (stopped || !canvas.current) return;
        try {
          scene = createFirstPersonScene(canvas.current, sref.current);
          setGraphicsError('');
          setReady(true);
        } catch (e) {
          console.error('Khởi tạo cảnh 3D thất bại:', e);
          setGraphicsError(
            'Không khởi tạo được đồ họa 3D. Hãy bật tăng tốc phần cứng và mở bằng Chrome/Edge trên máy tính.',
          );
          return;
        }
        function frame(t: number) {
          if (stopped || !scene) return;
          const dt = Math.min(0.35, Math.max(0, (t - last) / 1000));
          last = t;
          const g = gref.current;
          const p = g.players.find((p) => p.id === session.current.id);
          const inp = input(mref.current === 'solo');
          const active =
            (lockRef.current || fallbackRef.current) && pref.current === 'none';
          if (
            mref.current === 'solo' &&
            p &&
            active &&
            g.status === 'playing'
          ) {
            let budget = dt,
              first = true;
            while (budget > 1e-6) {
              const step = Math.min(0.05, budget);
              tickWorld(g, g.lastTick + step * 1000);
              movePlayer(
                g,
                p,
                first ? inp : { ...inp, grab: false, mask: false, ping: false },
                step,
              );
              budget -= step;
              first = false;
            }
          }
          if (p) {
            p.pitch = inp.pitch ?? p.pitch;
            p.crouched = !!inp.crouch;
            /* View orientation is immediate while authoritative positions arrive online. */ if (
              mref.current === 'online'
            )
              p.face = Math.atan2(
                -Math.cos(look.current.yaw),
                -Math.sin(look.current.yaw),
              );
          }
          if (ambience.current && audio.current)
            ambience.current.gain.setTargetAtTime(
              soundRef.current &&
                active &&
                mref.current !== 'menu' &&
                g.status === 'playing'
                ? rainy(g)
                  ? 0.018
                  : 0.0015
                : 0,
              audio.current.currentTime,
              0.3,
            );
          const task = p ? taskAt(g, p) : null;
          scene.render(
            g,
            session.current.id,
            {
              yaw: look.current.yaw,
              pitch:
                sref.current.view === 'first' && inp.crouch
                  ? Math.min(look.current.pitch, -0.6)
                  : look.current.pitch,
            },
            t,
            {
              menu: mref.current === 'menu' || g.status === 'lobby',
              moving: !!(inp.x || inp.y) && active,
              task,
              settings: sref.current,
              active,
            },
          );
          if (p && p.actionSeq !== heardAction.current) {
            heardAction.current = p.actionSeq;
            if (
              active &&
              g.time - p.actionAt < 0.6 &&
              p.action &&
              p.action !== 'sweep' &&
              t - lastSound.current > 180
            ) {
              actionSound(p.action);
              lastSound.current = t;
            }
          }
          if (
            p &&
            active &&
            g.status === 'playing' &&
            t - lastSound.current > 350 &&
            ((p.working && task) || inp.x || inp.y)
          ) {
            noise(waterDepth(g, p) > 0.1);
            lastSound.current = t;
          }
          if (
            (g.status === 'won' || g.status === 'lost') &&
            document.pointerLockElement
          )
            document.exitPointerLock();
          if (t - ui > 100) {
            setGame({ ...g });
            ui = t;
          }
          count++;
          if (t - frameStart > 1000) {
            setFps(Math.round((count * 1000) / (t - frameStart)));
            count = 0;
            frameStart = t;
          }
          af = requestAnimationFrame(frame);
        }
        af = requestAnimationFrame(frame);
      })
      .catch(() =>
        setGraphicsError(
          'Chưa tải được bộ dựng 3D. Hãy tải lại trang khi mạng ổn định.',
        ),
      );
    return () => {
      stopped = true;
      cancelAnimationFrame(af);
      scene?.dispose();
      void audio.current?.close();
      audio.current = null;
      ambience.current = null;
    };
  }, []);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(
          (e.target as HTMLElement)?.tagName,
        )
      )
        return;
      const k = e.key.toLowerCase();
      if (mref.current === 'menu') return;
      if (k === 'escape') {
        if (pref.current === 'none') showPanel('pause');
        return;
      }
      if (k === 'h') {
        showPanel(pref.current === 'help' ? 'none' : 'help');
        return;
      }
      if (k === '1') toolRef.current = 'broom';
      if (k === '2') toolRef.current = 'scoop';
      if (k === 'm' && !e.repeat) {
        setMap((m) => !m);
        return;
      }
      if (pref.current !== 'none') return;
      if (k === 'v' && !e.repeat) {
        e.preventDefault();
        setOption({ view: sref.current.view === 'third' ? 'first' : 'third' });
        return;
      }
      if (
        [
          ' ',
          'arrowup',
          'arrowdown',
          'arrowleft',
          'arrowright',
          'c',
          'e',
          'q',
          'f',
        ].includes(k)
      )
        e.preventDefault();
      keys.current.add(k);
      if (k === 'f' && !e.repeat) pending.current.mask = true;
      if (k === 'q' && !e.repeat) pending.current.grab = true;
      if (k === 'g' && !e.repeat) pending.current.ping = true;
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const clear = () => {
      inputHistory.current?.clear(performance.now());
      keys.current.clear();
      mouse.current.work = false;
      mouse.current.drag = false;
      touch.current = { x: 0, y: 0, work: false, crouch: false };
    };
    const blur = () => {
      clear();
      if (mref.current === 'solo' && gref.current.status === 'playing')
        showPanel('pause');
    };
    const change = () => {
      const was = lockRef.current;
      const on = document.pointerLockElement === canvas.current;
      lockRef.current = on;
      setLocked(on);
      clear();
      if (
        was &&
        !on &&
        pref.current === 'none' &&
        gref.current.status === 'playing'
      ) {
        pref.current = 'pause';
        setPanel('pause');
      }
    };
    const move = (e: MouseEvent) => {
      if (pref.current !== 'none' || mref.current === 'menu') return;
      if (lockRef.current || mouse.current.drag) {
        const dx = lockRef.current ? e.movementX : e.clientX - mouse.current.x;
        const dy = lockRef.current ? e.movementY : e.clientY - mouse.current.y;
        look.current.yaw -= dx * 0.002 * sref.current.sensitivity;
        look.current.yaw = Math.atan2(
          Math.sin(look.current.yaw),
          Math.cos(look.current.yaw),
        );
        look.current.pitch = clampViewPitch(
          look.current.pitch - dy * 0.002 * sref.current.sensitivity,
          sref.current.view,
        );
      }
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
    };
    const mouseup = () => {
      mouse.current.work = false;
      mouse.current.drag = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', mouseup);
    window.addEventListener('blur', blur);
    const lockError = () => {
      fallbackRef.current = true;
      setFallback(true);
      if (!coarsePointer())
        setError('Dùng chuột phải và kéo để nhìn, chuột trái để quét.');
    };
    document.addEventListener('pointerlockerror', lockError);
    document.addEventListener('pointerlockchange', change);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', mouseup);
      window.removeEventListener('blur', blur);
      document.removeEventListener('pointerlockchange', change);
      document.removeEventListener('pointerlockerror', lockError);
    };
  }, []);
  useEffect(() => {
    if (mode !== 'online') return;
    let active = true,
      timer: ReturnType<typeof setTimeout>,
      failures = 0;
    const history = createInputHistory(performance.now());
    inputHistory.current = history;
    let sampledRound = gref.current.round;
    const sample = () => {
      const now = performance.now();
      if (sampledRound !== gref.current.round) {
        history.clear(now);
        sampledRound = gref.current.round;
      }
      const captured =
        gref.current.status === 'playing' &&
        pref.current === 'none' &&
        (lockRef.current || fallbackRef.current);
      history.sample(input(captured), now, captured);
    };
    const sampler = setInterval(sample, 50);
    async function sync() {
      const t = performance.now();
      try {
        const playing = gref.current.status === 'playing';
        sample();
        const inp = input(false);
        const sampled = history.take();
        const frames = sampled.length
          ? sampled
          : [
              {
                input: {
                  ...inp,
                  x: 0,
                  y: 0,
                  work: false,
                  grab: false,
                  mask: false,
                  ping: false,
                },
                dt: 0,
              },
            ];
        const g = await api(
          playing ? 'input' : 'poll',
          playing ? { input: inp, frames, seq: session.current.seq++ } : {},
        );
        if (active) {
          update(g);
          setPing(Math.round(performance.now() - t));
          failures = 0;
          setNetFailures(0);
          setError('');
        }
      } catch (e) {
        if (active) {
          failures++;
          setNetFailures(failures);
          keys.current.clear();
          mouse.current.work = false;
          touch.current.work = false;
          pending.current = { mask: false, grab: false, ping: false };
          history.clear(performance.now());
          setError(e instanceof Error ? e.message : 'Mất kết nối phòng chơi.');
        }
      }
      if (active)
        timer = setTimeout(
          sync,
          failures
            ? Math.min(1500, 90 + failures * 250)
            : Math.max(0, 90 - (performance.now() - t)),
        );
    }
    void sync();
    return () => {
      active = false;
      clearTimeout(timer);
      clearInterval(sampler);
      if (inputHistory.current === history) inputHistory.current = null;
    };
  }, [mode]);

  function solo() {
    generation.current++;
    heardAction.current = 0;
    setNetFailures(0);
    toolRef.current = 'broom';
    const g = newGame(season, Date.now(), pace);
    g.round = gref.current.round;
    joinGame(g, session.current.id, name, Date.now());
    startGame(g, session.current.id, Date.now());
    update(g);
    changeMode('solo');
    look.current = { yaw: -Math.PI / 2, pitch: -0.05 };
    setError('');
    setSaved(false);
    showPanel('none');
    void capture();
    try {
      localStorage.setItem('ca-dem-name', name);
    } catch {}
  }
  async function online(action: 'create' | 'join') {
    setBusy(true);
    setError('');
    session.current.revision = -1;
    const gen = ++generation.current;
    try {
      const g = await api(action, {
        season,
        pace,
        code: code.trim().toUpperCase(),
      });
      if (gen !== generation.current) return;
      session.current.seq = nextInputSequence(
        g,
        session.current.id,
        session.current.seq,
      );
      update(g);
      changeMode('online');
      look.current = { yaw: -Math.PI / 2, pitch: -0.05 };
      showPanel('none');
      try {
        localStorage.setItem('ca-dem-name', name);
      } catch {}
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không vào được phòng.');
    } finally {
      setBusy(false);
    }
  }
  async function start() {
    toolRef.current = 'broom';
    if (mode === 'solo') {
      solo();
      return;
    }
    setBusy(true);
    try {
      update(await api('start'));
      showPanel('none');
      setSaved(false);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa bắt đầu được.');
    } finally {
      setBusy(false);
    }
  }
  function leave() {
    generation.current++;
    pending.current = { mask: false, grab: false, ping: false };
    fallbackRef.current = false;
    setFallback(false);
    changeMode('menu');
    showPanel('none');
    unlock();
    if (mode === 'online') void api('leave').catch(() => {});
    update(newGame(season));
    keys.current.clear();
    setError('');
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(game.code || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Mã phòng: ' + game.code);
    }
  }
  function setOption(patch: Partial<Settings>) {
    const next = { ...sref.current, ...patch };
    look.current.pitch = clampViewPitch(look.current.pitch, next.view);
    sref.current = next;
    setSettings(next);
    try {
      localStorage.setItem('ca-dem-settings', JSON.stringify(next));
    } catch {}
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.current?.requestFullscreen();
    } catch {
      setError(
        'Trình duyệt chưa cho phép toàn màn hình. M có thể dùng phím F11.',
      );
    }
  }
  function toggleSound() {
    soundRef.current = !sound;
    setSound(!sound);
    if (!sound) initAudio();
  }
  const p = game.players.find((p) => p.id === session.current.id),
    task = p ? taskAt(game, p) : null,
    wet = rainy(game),
    ended = game.status === 'won' || game.status === 'lost',
    playing = mode !== 'menu' && game.status === 'playing',
    remaining = Math.max(0, Math.ceil(game.duration - game.time)),
    depth = p ? waterDepth(game, p) : 0;
  const firstTripHint = p ? onboardingHint(game, p) : null;
  const touchControl = (
    prop: 'x' | 'y' | 'work' | 'crouch',
    value: number | boolean,
  ) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      fallbackRef.current = true;
      setFallback(true);
      Object.assign(touch.current, { [prop]: value });
    },
    onPointerUp: () =>
      Object.assign(touch.current, {
        [prop]: typeof value === 'boolean' ? false : 0,
      }),
    onPointerCancel: () =>
      Object.assign(touch.current, {
        [prop]: typeof value === 'boolean' ? false : 0,
      }),
  });
  return (
    <div
      className={
        'fps-app ' + (playing ? 'in-game ' : '') + (wet ? 'rainy ' : '')
      }
      ref={root}
    >
      <canvas
        ref={canvas}
        className="world-canvas"
        aria-label={
          settings.view === 'third'
            ? 'Phố Hà Nội 3D, góc nhìn thứ ba'
            : 'Phố Hà Nội 3D, góc nhìn thứ nhất'
        }
        onContextMenu={(e) => e.preventDefault()}
        onMouseDown={(e) => {
          if (!playing || pref.current !== 'none') return;
          if (e.button === 2) {
            mouse.current.drag = true;
            mouse.current.x = e.clientX;
            mouse.current.y = e.clientY;
            fallbackRef.current = true;
            setFallback(true);
          } else if (e.button === 0) {
            if (!lockRef.current && !fallbackRef.current) void capture();
            else mouse.current.work = true;
          }
        }}
        onTouchStart={(e) => {
          if (!playing) return;
          mouse.current.x = e.touches[0].clientX;
          mouse.current.y = e.touches[0].clientY;
          fallbackRef.current = true;
          setFallback(true);
        }}
        onTouchMove={(e) => {
          if (!playing) return;
          const t = e.touches[0];
          look.current.yaw -= (t.clientX - mouse.current.x) * 0.005;
          look.current.yaw = Math.atan2(
            Math.sin(look.current.yaw),
            Math.cos(look.current.yaw),
          );
          look.current.pitch = clampViewPitch(
            look.current.pitch - (t.clientY - mouse.current.y) * 0.005,
            sref.current.view,
          );
          mouse.current.x = t.clientX;
          mouse.current.y = t.clientY;
        }}
      />
      <div className="vignette" />
      {depth > 0.1 && playing && <div className="water-vignette" />}
      {p && p.headache > 65 && playing && (
        <div
          className="flower-vignette"
          style={{ opacity: p.headache / 150 }}
        />
      )}
      <header className="game-header">
        <button
          className="wordmark"
          onClick={() => (mode === 'menu' ? null : showPanel('pause'))}
          aria-label="Hà Nội Ca đêm"
        >
          <span className="logo-icon">
            <Leaf size={24} />
          </span>
          <span>
            HÀ NỘI <b>CA ĐÊM</b>
          </span>
          <small>
            {settings.view === 'third' ? 'THIRD PERSON' : 'FIRST PERSON'}
            <br />
            THEO BƯỚC · 06
          </small>
        </button>
        {playing && (
          <div className="shift-clock">
            <Clock size={16} />
            <span>
              {game.pace === 'relaxed'
                ? 'THƯ THẢ'
                : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`}
            </span>
            <i />
            {wet ? <CloudRain size={17} /> : <Leaf size={17} />}
            <small>{wet ? 'MƯA NGẬP' : 'MÙA LÁ RỤNG'}</small>
          </div>
        )}
        <nav className="header-actions">
          <button aria-label="Âm thanh" onClick={toggleSound}>
            {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button aria-label="Cách chơi" onClick={() => showPanel('help')}>
            <HelpCircle size={18} />
          </button>
          <button aria-label="Cài đặt" onClick={() => showPanel('settings')}>
            <SettingsIcon size={18} />
          </button>
          <button aria-label="Toàn màn hình" onClick={fullscreen}>
            <Maximize size={18} />
          </button>
        </nav>
      </header>
      {mode === 'menu' && (
        <div className="menu-layout">
          <section className="welcome">
            <div className="overline">
              <span /> HÀ NỘI, DƯỚI NHỮNG NGỌN ĐÈN
            </div>
            <h1>
              Chậm một chút.
              <br />
              Sạch một góc phố.
            </h1>
            <p>
              Bước xuống đường. Cầm lấy chổi.
              <br />
              Thành phố đang chờ những đôi tay.
            </p>
            <div className="perspective-tag">
              <Eye size={15} /> 3D ·{' '}
              {settings.view === 'third'
                ? 'GÓC NHÌN THỨ BA'
                : 'GÓC NHÌN THỨ NHẤT'}{' '}
              · V ĐỔI GÓC
            </div>
            <div className="chapter-picker">
              {choices.map((c) => (
                <button
                  key={c.id}
                  className={season === c.id ? 'selected' : ''}
                  onClick={() => {
                    setSeason(c.id);
                    update(newGame(c.id, Date.now(), pace));
                  }}
                >
                  <c.icon size={21} />
                  <span>
                    <b>{c.title}</b>
                    <small>{c.desc}</small>
                  </span>
                  <i>{season === c.id ? <Check size={13} /> : null}</i>
                </button>
              ))}
            </div>
            <div className="segmented pace-picker" aria-label="Nhịp chơi">
              <button
                className={pace === 'relaxed' ? 'selected' : ''}
                onClick={() => setPace('relaxed')}
              >
                Thư thả · không giới hạn
              </button>
              <button
                className={pace === 'shift' ? 'selected' : ''}
                onClick={() => setPace('shift')}
              >
                Ca làm · 8 phút
              </button>
            </div>
            <button
              className="primary"
              disabled={!ready || busy}
              onClick={solo}
            >
              <Play size={17} fill="currentColor" />
              {ready ? 'Vào phố · Chơi một mình' : 'Đang dựng khu phố…'}
              <ArrowUpRight size={18} />
            </button>
            <div className="menu-note">
              Quét → Hốt → Chở → Bàn giao <span>•</span>{' '}
              {touchUI ? 'Chạm & vuốt' : 'Chuột & bàn phím'}
            </div>
          </section>
          <aside className="lobby-panel">
            <div className="overline">TỔ VỆ SINH SỐ 01</div>
            <h2>Cùng nhau vào ca.</h2>
            <p>
              Một người đẩy xe. Một người quét lá.
              <br />
              Cả đội giữ phố thông thoáng.
            </p>
            <label htmlFor="name">TÊN TRÊN ÁO</label>
            <input
              id="name"
              maxLength={20}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button
              className="secondary"
              disabled={busy || !ready}
              onClick={() => online('create')}
            >
              <Users size={17} />
              {busy ? 'Đang kết nối…' : 'Tạo phòng · 1–8 người'}
              <ChevronRight size={16} />
            </button>
            <div className="join">
              <input
                aria-label="Mã phòng"
                placeholder="MÃ PHÒNG"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
              <button
                aria-label="Vào phòng"
                disabled={busy || code.length !== 6 || !ready}
                onClick={() => online('join')}
              >
                <ArrowUpRight size={20} />
              </button>
            </div>
            <small className="access-copy">
              Bạn bè cần quyền truy cập bản demo trước khi vào phòng.
            </small>
            <div className="panel-divider" />
            <div className="teaser">
              <Hand size={19} />
              <span>
                Chổi và xẻng, mỗi thứ một việc.
                <br />
                Xe đầy nặng hơn. Phố sạch dần.
              </span>
            </div>
          </aside>
          <div className="location-note">
            <MapPin size={15} />
            <span>
              PHỐ NGUYỄN DU <small>Không gian lấy cảm hứng từ Hà Nội</small>
            </span>
            <b>22:40</b>
          </div>
        </div>
      )}
      {playing && (
        <>
          <div className="objective-card">
            <div className="overline">CA LÀM CỦA CHÚNG MÌNH</div>
            <div className="objective">
              <Trash2 size={17} />
              <span>Rác đã bàn giao</span>
              <b>
                {Math.floor(game.score)}
                <small> / {game.target}</small>
              </b>
            </div>
            <div className="thin-progress">
              <i
                style={{
                  width: Math.min(100, (game.score / game.target) * 100) + '%',
                }}
              />
            </div>
            <div className="zone-list">
              <div>
                KHU SẠCH ·{' '}
                {game.zones.filter((z) => z.completedAt !== null).length}/
                {zoneGoal(game)} cần hoàn thành
              </div>
              {game.zones.map((z) => (
                <div
                  key={z.id}
                  className={z.completedAt !== null ? 'clean' : ''}
                >
                  <span>
                    {z.completedAt !== null ? '✓' : '○'} {z.name}
                  </span>
                  <small>
                    {z.completedAt !== null
                      ? z.cleanUntil > game.time
                        ? `Nghỉ lá ${Math.ceil(z.cleanUntil - game.time)}s`
                        : 'Đã hoàn thành'
                      : `Còn ${Math.ceil(zoneRemaining(game, z))} · đã hốt ${Math.floor(z.picked)}/8+`}
                  </small>
                </div>
              ))}
            </div>
            {game.season !== 'autumn' && (
              <div className="objective">
                <CloudRain size={17} />
                <span>Khơi thông cống</span>
                <b>
                  {game.drains.filter((d) => d.clog <= 0.01).length}
                  <small> / {game.drains.length}</small>
                </b>
              </div>
            )}
            {game.season === 'mixed' && !wet && (
              <div className="weather-alert">
                Mưa tới trong {Math.max(0, Math.ceil(game.rainAt - game.time))}{' '}
                giây
              </div>
            )}
            {mode === 'online' && (
              <button className="room-label" onClick={copy}>
                <Users size={13} />
                {game.players.length}/8 <i />
                PHÒNG {game.code}{' '}
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
            )}
          </div>
          {firstTripHint && (
            <div className="route-guide" aria-label="Chuyến bàn giao đầu tiên">
              <span className={p && p.swept > 0 ? 'done' : ''}>1 · QUÉT</span>
              <i>→</i>
              <span className={p && p.picked > 0 ? 'done' : ''}>2 · HỐT</span>
              <i>→</i>
              <span
                className={
                  game.carts.some((c) => c.stored > 0) || game.score > 0
                    ? 'done'
                    : ''
                }
              >
                3 · ĐỔ XE
              </span>
              <i>→</i>
              <span className={game.score > 0 ? 'done' : ''}>4 · TẬP KẾT</span>
            </div>
          )}
          <div
            className={'reticle ' + (task ? 'targeted' : '')}
            hidden={settings.view === 'third'}
          >
            <i />
          </div>
          {p && (
            <div className="player-status">
              <div className="bag-line">
                <span className="bag-icon">
                  <Trash2 size={20} />
                </span>
                <div>
                  <span>TÚI RÁC ĐÃ HỐT</span>
                  <strong>
                    {Math.ceil(p.bag)} <small>/ 18</small>
                  </strong>
                </div>
                <div className="bag-meter">
                  <i style={{ height: (p.bag / 18) * 100 + '%' }} />
                </div>
              </div>
              <div className="toolbelt">
                <button
                  className={p.tool === 'broom' ? 'selected' : ''}
                  onClick={() => (toolRef.current = 'broom')}
                >
                  <kbd>1</kbd> Chổi
                </button>
                <button
                  className={p.tool === 'scoop' ? 'selected' : ''}
                  onClick={() => (toolRef.current = 'scoop')}
                >
                  <kbd>2</kbd> Xẻng
                </button>
              </div>
              <div className="status-chips">
                {p.crouched && (
                  <span>
                    <MoveDown size={12} />
                    Đang cúi
                  </span>
                )}
                {p.pushing && (
                  <span>
                    <Hand size={12} />
                    Xe{' '}
                    {Math.ceil(
                      game.carts.find((c) => c.id === p.pushing)?.stored ?? 0,
                    )}
                    /{CART_CAPACITY}
                  </span>
                )}
                {depth > 0.1 && (
                  <span>
                    <CloudRain size={12} />
                    Ngập {Math.round(depth * 100)} cm
                  </span>
                )}
                {p.mask > 0 && (
                  <span>
                    <Shield size={12} />
                    Khẩu trang {Math.ceil(p.mask)}s
                  </span>
                )}
                {p.headache > 25 && (
                  <span className="flower-status">
                    Hoa sữa {Math.round(p.headache)}%
                  </span>
                )}
              </div>
              <button
                className="ping-button"
                onClick={() => (pending.current.ping = true)}
              >
                G · Gọi giúp tại đây
              </button>
              <button className="minimap-toggle" onClick={() => setMap(!map)}>
                <MapIcon size={14} />
                {map ? 'Ẩn bản đồ' : 'Xem bản đồ'}
                <kbd>M</kbd>
              </button>
            </div>
          )}
          {p && (
            <div className="interaction">
              <div className="interaction-text">
                {task
                  ? contextHint(game, p)
                  : (firstTripHint ?? contextHint(game, p))}
              </div>
              {task && (
                <div className="action-progress">
                  <i style={{ width: task.progress * 100 + '%' }} />
                </div>
              )}
              {p.action && game.time - p.actionAt < 0.8 && (
                <div className="work-feedback" aria-live="polite">
                  {p.action === 'scoop'
                    ? `+${Math.round(p.actionAmount * 10) / 10} lá vào túi`
                    : p.action === 'dump'
                      ? 'Đang đổ vào xe'
                      : p.action === 'deliver'
                        ? 'Đã bàn giao · cảm ơn bạn'
                        : p.action === 'drain'
                          ? 'Cống thông · nước đang rút'
                          : `Gom ${p.actionAmount} cụm lá`}
                </div>
              )}
              <div className="micro-help">
                <span>V · Đổi góc</span>
                <span>M · Bản đồ</span>
                <span>H · Hướng dẫn</span>
              </div>
            </div>
          )}
          {mode === 'online' && (
            <div
              className={
                'network-status ' + (netFailures ? 'disconnected' : '')
              }
              role="status"
            >
              {netFailures
                ? 'Đang nối lại · xe tự nhả sau 3 giây không nhận input'
                : `${ping} ms · đồng bộ phòng`}
            </div>
          )}
          {game.pings.length > 0 && (
            <div className="team-pings" aria-live="polite">
              {game.pings.map((m) => (
                <div key={m.playerId}>
                  {game.players.find((pl) => pl.id === m.playerId)?.name}:{' '}
                  {m.kind === 'cart'
                    ? 'Xe đầy, cần chở'
                    : m.kind === 'drain'
                      ? 'Cống tắc, cần xẻng'
                      : 'Cần giúp ở dấu vàng'}{' '}
                  · {Math.ceil(m.expiresAt - game.time)}s
                </div>
              ))}
            </div>
          )}
          {map && p && (
            <div className="minimap">
              <div className="overline">
                BẢN ĐỒ KHU PHỐ{' '}
                <button aria-label="Đóng bản đồ" onClick={() => setMap(false)}>
                  <X size={14} />
                </button>
              </div>
              <svg
                viewBox="0 225 1280 575"
                aria-label="Vị trí xe rác, cống và người chơi"
              >
                {BUILDINGS.map((b, i) => (
                  <rect
                    key={i}
                    x={b.x}
                    y={b.y}
                    width={b.w}
                    height={b.h}
                    fill="#6b7967"
                    rx="12"
                  />
                ))}
                {game.drains.map((d, i) => (
                  <g key={i}>
                    <circle
                      cx={d.x}
                      cy={d.y}
                      r={d.clog > 0.01 ? 45 : 20}
                      fill={d.clog > 0.01 ? '#6caab5' : '#b5cc95'}
                      opacity=".75"
                    />
                    <text
                      x={d.x}
                      y={d.y + 8}
                      textAnchor="middle"
                      fill="#f1efdb"
                      fontSize="27"
                    >
                      {i + 1}
                    </text>
                  </g>
                ))}
                {DEPOTS.map((d, i) => (
                  <g key={'depot' + i}>
                    <rect
                      x={d.x - 40}
                      y={d.y - 35}
                      width="80"
                      height="70"
                      fill="none"
                      stroke="#ffdc7d"
                      strokeWidth="7"
                    />
                    <text
                      x={d.x}
                      y={d.y + 10}
                      fontSize="28"
                      textAnchor="middle"
                      fill="#ffdc7d"
                    >
                      T
                    </text>
                  </g>
                ))}
                {game.piles.map((l) => (
                  <circle
                    key={'pile' + l.id}
                    cx={l.x}
                    cy={l.y}
                    r="7"
                    fill="#bd8644"
                  />
                ))}
                {game.carts.map((c) => (
                  <rect
                    key={c.id}
                    x={c.x - 16}
                    y={c.y - 16}
                    width="32"
                    height="32"
                    rx="5"
                    fill="#eac68a"
                  />
                ))}
                {game.pings.map((m) => (
                  <g key={'ping' + m.playerId}>
                    <circle
                      cx={m.x}
                      cy={m.y}
                      r="24"
                      fill="none"
                      stroke="#ffe49b"
                      strokeWidth="8"
                    />
                    <text
                      x={m.x}
                      y={m.y - 30}
                      textAnchor="middle"
                      fill="#ffe49b"
                      fontSize="24"
                    >
                      {game.players.find((pl) => pl.id === m.playerId)?.name}
                    </text>
                  </g>
                ))}
                {game.players.map((pl) => (
                  <g key={pl.id}>
                    <circle
                      cx={pl.x}
                      cy={pl.y}
                      r="16"
                      fill={pl.id === p.id ? '#ffffff' : COLORS[pl.color]}
                    />
                    {pl.id === p.id && (
                      <line
                        x1={pl.x}
                        y1={pl.y}
                        x2={pl.x + Math.cos(pl.face) * 50}
                        y2={pl.y + Math.sin(pl.face) * 50}
                        stroke="#ffffff"
                        strokeWidth="7"
                      />
                    )}
                  </g>
                ))}
              </svg>
              <small>
                ● Bạn & đồng đội <span>■ Xe</span>
                <span>□ Tập kết</span>
                <span>● Cống</span>
              </small>
              <div className="map-zones">
                {game.zones.map((zone) => (
                  <div
                    key={zone.id}
                    className={zone.completedAt !== null ? 'clean' : ''}
                  >
                    <span>
                      {zone.completedAt !== null ? '✓' : '○'} {zone.name}
                    </span>
                    <small>
                      {zone.completedAt !== null
                        ? zone.cleanUntil > game.time
                          ? `Nghỉ lá ${Math.ceil(zone.cleanUntil - game.time)}s`
                          : 'Đã hoàn thành'
                        : `Còn ${Math.ceil(zoneRemaining(game, zone))} · hốt ${Math.floor(zone.picked)}/8+`}
                    </small>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!locked && !fallback && panel === 'none' && !graphicsError && (
            <div className="capture-overlay">
              <div>
                <button className="capture-card" onClick={capture}>
                  <MousePointer2 size={27} />
                  <b>Bấm để bước vào phố</b>
                  <span>Di chuột để nhìn · Esc để thả chuột</span>
                </button>
                <button
                  className="fallback-button"
                  onClick={() => {
                    fallbackRef.current = true;
                    setFallback(true);
                    initAudio();
                  }}
                >
                  Hoặc giữ chuột phải để nhìn
                </button>
              </div>
            </div>
          )}
          <div className="touch-pad">
            <div>
              <button {...touchControl('y', -1)}>↑</button>
              <section>
                <button {...touchControl('x', -1)}>←</button>
                <button {...touchControl('y', 1)}>↓</button>
                <button {...touchControl('x', 1)}>→</button>
              </section>
            </div>
            <div className="touch-actions">
              <button
                onClick={() =>
                  (toolRef.current =
                    toolRef.current === 'broom' ? 'scoop' : 'broom')
                }
              >
                1 / 2
              </button>
              <button onClick={() => (pending.current.mask = true)}>
                KHẨU TRANG
              </button>
              <button onClick={() => (pending.current.ping = true)}>
                GỌI GIÚP
              </button>
              <button
                onClick={() =>
                  setOption({
                    view: sref.current.view === 'third' ? 'first' : 'third',
                  })
                }
              >
                GÓC NHÌN
              </button>
              <button {...touchControl('crouch', true)}>CÚI</button>
              <button onClick={() => (pending.current.grab = true)}>XE</button>
              <button {...touchControl('work', true)}>DỌN</button>
            </div>
          </div>
        </>
      )}
      {mode === 'online' && game.status === 'lobby' && (
        <div className="center-overlay">
          <section className="dialog lobby-dialog">
            <Users size={28} />
            <div className="overline">TẬP HỢP Ở ĐẦU PHỐ</div>
            <h2>Đội mình đủ chưa?</h2>
            <p>Gửi mã phòng cho người đã có quyền mở demo.</p>
            <button className="big-code" onClick={copy}>
              {game.code}
              {copied ? <Check size={19} /> : <Copy size={19} />}
            </button>
            <div className="crew-list">
              {game.players.map((pl) => (
                <div key={pl.id}>
                  <i style={{ background: COLORS[pl.color] }} />
                  <span>
                    {pl.name}
                    {pl.id === session.current.id ? ' (bạn)' : ''}
                  </span>
                  {pl.id === game.host && <small>TỔ TRƯỞNG</small>}
                </div>
              ))}
            </div>
            {game.host === session.current.id ? (
              <button className="primary" onClick={start} disabled={busy}>
                <Play size={17} />
                Bắt đầu ca · {game.players.length}/8 người
              </button>
            ) : (
              <p>Đang chờ tổ trưởng bắt đầu…</p>
            )}
            <button className="text-button" onClick={leave}>
              Rời phòng
            </button>
          </section>
        </div>
      )}
      {ended && (
        <div className="center-overlay">
          <section className="dialog end-dialog">
            <div className="end-symbol">
              {game.status === 'won' ? '✦' : '☕'}
            </div>
            <div className="overline">CA LÀM ĐÃ KHÉP LẠI</div>
            <h2>
              {game.status === 'won'
                ? 'Một góc phố, sạch rồi.'
                : 'Nghỉ tay thôi, đồng đội.'}
            </h2>
            <p>
              {game.status === 'won'
                ? 'Cảm ơn những đôi tay đã giữ phố bình yên.'
                : 'Thử mang xe theo và chia người thông cống ở ca sau nhé.'}
            </p>
            <div className="end-stats">
              <div>
                <b>{Math.floor(game.score)}</b>
                <span>RÁC ĐÃ BÀN GIAO</span>
              </div>
              <div>
                <b>
                  {game.season === 'autumn'
                    ? `${game.zones.filter((z) => z.completedAt !== null).length}/${zoneGoal(game)}`
                    : `${game.drains.filter((d) => d.clog <= 0.01).length}/${game.drains.length}`}
                </b>
                <span>
                  {game.season === 'autumn'
                    ? 'KHU ĐÃ HOÀN THÀNH'
                    : 'CỐNG ĐÃ THÔNG'}
                </span>
              </div>
              <div>
                <b>
                  {Math.floor(game.time / 60)}:
                  {String(Math.floor(game.time % 60)).padStart(2, '0')}
                </b>
                <span>THỜI GIAN</span>
              </div>
            </div>
            <div className="contributions">
              <div className="overline">ĐÓNG GÓP CỦA CẢ ĐỘI</div>
              {game.players.map((pl) => (
                <div key={pl.id}>
                  <strong style={{ color: COLORS[pl.color] }}>{pl.name}</strong>
                  <span>
                    {pl.swept} quét · {Math.round(pl.picked)} hốt ·{' '}
                    {Math.floor(pl.dumped)} đổ xe · {Math.floor(pl.score)} bàn
                    giao · {Math.round(pl.cartDistance)}m đẩy xe ·{' '}
                    {Math.round(pl.cleared * 100)}% cống
                  </span>
                </div>
              ))}
            </div>
            <input
              aria-label="Góp ý sau khi chơi"
              placeholder="Cảm giác quét, cúi và đẩy xe thế nào?"
              value={feedback}
              onChange={(e) => {
                setFeedback(e.target.value);
                setSaved(false);
              }}
            />
            <button
              className="text-button"
              disabled={!feedback.trim()}
              onClick={() => {
                try {
                  const logs = JSON.parse(
                    localStorage.getItem('ca-dem-feedback') || '[]',
                  );
                  logs.push({
                    date: new Date().toISOString(),
                    version: 4,
                    note: feedback,
                    season: game.season,
                    score: game.score,
                  });
                  localStorage.setItem('ca-dem-feedback', JSON.stringify(logs));
                  setSaved(true);
                } catch {
                  setError('Chưa lưu được ghi chú.');
                }
              }}
            >
              {saved ? 'Đã lưu góp ý trên thiết bị' : 'Lưu góp ý trên thiết bị'}
            </button>
            {(mode === 'solo' || game.host === session.current.id) && (
              <button className="primary" onClick={start} disabled={busy}>
                <RotateCcw size={16} />
                Nhận ca mới
              </button>
            )}
            <button className="text-button" onClick={leave}>
              Về đầu phố <ChevronRight size={15} />
            </button>
          </section>
        </div>
      )}
      {panel !== 'none' && (
        <div className="center-overlay">
          <section
            className={'dialog ' + (panel === 'help' ? 'wide' : '')}
            role="dialog"
            aria-modal="true"
            aria-label={
              panel === 'help'
                ? 'Cách chơi'
                : panel === 'settings'
                  ? 'Cài đặt'
                  : 'Tạm nghỉ'
            }
          >
            <button
              className="close-dialog"
              aria-label="Đóng"
              onClick={() => {
                if (playing) showPanel('pause');
                else showPanel('none');
                if (panel === 'pause') showPanel('none');
              }}
            >
              <X size={20} />
            </button>
            {panel === 'pause' ? (
              <>
                <div className="overline">NGHỈ TAY MỘT CHÚT</div>
                <h2>Phố vẫn ở đây.</h2>
                <p>
                  {mode === 'online'
                    ? 'Ca online vẫn tiếp tục khi bạn mở menu.'
                    : 'Ca một mình đang tạm dừng.'}
                </p>
                <button className="primary" onClick={capture}>
                  <Play size={17} />
                  Tiếp tục ca làm
                </button>
                <button
                  className="secondary"
                  onClick={() => showPanel('settings')}
                >
                  <SettingsIcon size={16} />
                  Cài đặt góc nhìn
                </button>
                <button className="secondary" onClick={() => showPanel('help')}>
                  <HelpCircle size={16} />
                  Xem cách chơi
                </button>
                <button className="text-button" onClick={leave}>
                  <LogOut size={15} />
                  Về đầu phố
                </button>
              </>
            ) : panel === 'settings' ? (
              <>
                <div className="overline">CẢM GIÁC CỦA BẠN</div>
                <h2>Nhìn phố theo ý mình.</h2>
                <label className="setting-label">CAMERA · V ĐỔI NHANH</label>
                <div className="segmented" aria-label="Chế độ camera">
                  <button
                    className={settings.view === 'third' ? 'selected' : ''}
                    aria-pressed={settings.view === 'third'}
                    onClick={() => setOption({ view: 'third' })}
                  >
                    Góc nhìn thứ ba
                  </button>
                  <button
                    className={settings.view === 'first' ? 'selected' : ''}
                    aria-pressed={settings.view === 'first'}
                    onClick={() => setOption({ view: 'first' })}
                  >
                    Góc nhìn thứ nhất
                  </button>
                </div>
                <label className="setting-label">
                  ĐỘ NHẠY CHUỘT <b>{settings.sensitivity.toFixed(1)}</b>
                </label>
                <input
                  type="range"
                  min=".3"
                  max="2"
                  step=".1"
                  value={settings.sensitivity}
                  onChange={(e) =>
                    setOption({ sensitivity: Number(e.target.value) })
                  }
                />
                <label className="setting-label">
                  GÓC NHÌN <b>{settings.fov}°</b>
                </label>
                <input
                  type="range"
                  min="65"
                  max="95"
                  step="1"
                  value={settings.fov}
                  onChange={(e) => setOption({ fov: Number(e.target.value) })}
                />
                <label className="setting-label">ĐỒ HỌA</label>
                <div className="segmented">
                  <button
                    className={settings.quality === 'low' ? 'selected' : ''}
                    onClick={() => setOption({ quality: 'low' })}
                  >
                    Nhẹ · Không bóng
                  </button>
                  <button
                    className={settings.quality === 'high' ? 'selected' : ''}
                    onClick={() => setOption({ quality: 'high' })}
                  >
                    Cao · Có bóng
                  </button>
                </div>
                <button
                  className="toggle-row"
                  onClick={() => setOption({ motion: !settings.motion })}
                >
                  <span>
                    Nhún đầu khi di chuyển
                    <small>Mặc định tắt để quan sát ổn định.</small>
                  </span>
                  <i className={settings.motion ? 'on' : ''} />
                </button>
                <button
                  className="primary"
                  onClick={() => (playing ? capture() : showPanel('none'))}
                >
                  Lưu & trở lại <Check size={16} />
                </button>
              </>
            ) : (
              <>
                <div className="overline">SỔ TAY NGƯỜI GIỮ PHỐ</div>
                <h2>Bước xuống phố, rồi bắt đầu.</h2>
                <div className="help-grid">
                  <div>
                    <b>01 · NHÌN & ĐI</b>
                    <p>
                      Mặc định nhìn sau vai nhân vật. V đổi góc thứ nhất/thứ ba.
                      Di chuột để quay hướng nhân vật, WASD để đi, Shift để
                      chạy. Vòng sáng dưới đất chỉ việc trong tầm tay. Nhấn Esc
                      để thả chuột. Nếu không khóa được chuột, giữ chuột phải và
                      kéo để nhìn.
                    </p>
                  </div>
                  <div>
                    <b>02 · CÚI & QUÉT</b>
                    <p>
                      Phím 1 chọn chổi. Nhìn xuống, giữ chuột trái hoặc E để gom
                      lá thành đống; C cúi để quét nhanh hơn. Phím 2 chọn xẻng,
                      giữ E để hốt đống lá vào túi (18 đơn vị). Một nhát gom cả
                      vùng trước chổi, không xuyên vật cản. Lá ướt quét chậm
                      hơn. Mỗi khu cần hốt ít nhất 8 đơn vị và còn tối đa 2 trên
                      đất để hoàn thành; khu sạch nghỉ rụng lá 75 giây.
                    </p>
                  </div>
                  <div>
                    <b>03 · ĐẨY XE RÁC</b>
                    <p>
                      Đứng gần, nhìn về xe rồi nhấn Q để nắm tay cầm. Đi bằng
                      WASD, Q lần nữa để buông. Buông xe, nhìn vào xe và giữ E
                      để đổ túi. Xe chứa 36 đơn vị; càng đầy càng nặng. Đẩy xe
                      vào ô vàng TẬP KẾT (M xem bản đồ), giữ E khi đang nắm xe
                      để bàn giao và tính mục tiêu.
                    </p>
                  </div>
                  <div>
                    <b>04 · LỘI NƯỚC TÌM CỐNG</b>
                    <p>
                      Mưa tới sẽ làm phố ngập và di chuyển chậm. Dùng M xem vị
                      trí cống, nhấn 2 chọn xẻng, nhìn xuống, giữ E để dọn chỗ
                      tắc. G đánh dấu chỗ cần giúp (xe đầy/cống tắc tự nhận diện
                      khi nhìn gần). Tên đồng đội hiện trong cảnh. Đội từ 4
                      người có 6 cống. Nước sẽ rút dần.
                    </p>
                  </div>
                </div>
                <div className="help-note">
                  <Shield size={18} />
                  <p>
                    Vùng hoa sữa làm tăng mức choáng trong game. F đeo khẩu
                    trang 22 giây, hồi sau 30 giây; hoặc bước ra vùng thoáng để
                    hồi phục. Đây là cơ chế hư cấu phục vụ gameplay.
                  </p>
                </div>
                <button
                  className="primary"
                  onClick={() => (playing ? capture() : showPanel('none'))}
                >
                  Rõ rồi, vào phố <Check size={17} />
                </button>
              </>
            )}
          </section>
        </div>
      )}
      {!ready && !graphicsError && (
        <div className="loading-strip">
          <span />
          Đang dựng ánh sáng, hàng cây và khu phố…
        </div>
      )}
      {graphicsError && (
        <div className="graphics-error" role="alert">
          <h2>Chưa mở được khung cảnh 3D</h2>
          <p>{graphicsError}</p>
          <button className="primary" onClick={() => location.reload()}>
            Tải lại
          </button>
        </div>
      )}
      {error && (
        <div className="toast" role="alert">
          <span>{error}</span>
          <button aria-label="Đóng thông báo" onClick={() => setError('')}>
            <X size={16} />
          </button>
        </div>
      )}
      <footer className="game-footer">
        <span>
          {playing
            ? touchUI
              ? 'VUỐT ĐỂ QUAN SÁT'
              : fallback
              ? 'KÉO CHUỘT PHẢI ĐỂ NHÌN'
              : 'DI CHUỘT ĐỂ QUAN SÁT'
            : 'MỖI CHIẾC LÁ, MỘT CHÚT BÌNH YÊN.'}
        </span>
        <span>
          {mode === 'online' ? `${ping} MS · ` : ''}
          {fps} FPS <i /> GÓC PHỐ · PREVIEW 0.7
        </span>
      </footer>
    </div>
  );
}
