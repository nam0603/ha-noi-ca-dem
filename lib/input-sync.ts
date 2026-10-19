import {
  INPUT_HISTORY_FRAMES,
  INPUT_HISTORY_SECONDS,
  type Game,
  type Input,
  type InputFrame,
} from './game';

const edges = (input: Input) => !!(input.grab || input.mask || input.ping);
const withoutEdges = (input: Input): Input => ({
  ...input,
  grab: false,
  mask: false,
  ping: false,
});
const same = (a: Input, b: Input) =>
  Object.keys(a).length === Object.keys(b).length &&
  (Object.keys(a) as (keyof Input)[]).every((key) => a[key] === b[key]);

/** Local samples only; positions, inventory and work results always come from the server. */
export function createInputHistory(now: number) {
  let last = now;
  let frames: InputFrame[] = [];
  const clear = (at: number) => {
    frames = [];
    last = at;
  };
  return {
    clear,
    sample(input: Input, at: number, active: boolean) {
      const dt = Math.max(0, (at - last) / 1000);
      last = at;
      if (!active || dt > INPUT_HISTORY_SECONDS) {
        clear(at);
        return;
      }
      if (dt < 1e-6 && !edges(input)) return;
      const continuous = withoutEdges(input);
      if (dt >= 1e-6) {
        const previous = frames[frames.length - 1];
        if (
          previous &&
          !edges(previous.input) &&
          same(previous.input, continuous)
        )
          previous.dt += dt;
        else frames.push({ input: continuous, dt });
      }
      // Button presses are observed now, at the end of the sampled interval.
      // Prefix trimming must not mistake a fresh press for older held input.
      if (edges(input)) frames.push({ input: { ...input }, dt: 0 });
      let excess = Math.max(
        0,
        frames.reduce((sum, frame) => sum + frame.dt, 0) -
          INPUT_HISTORY_SECONDS,
      );
      while (frames.length && excess > 1e-6) {
        const first = frames[0];
        if (first.dt <= excess + 1e-6) {
          excess -= first.dt;
          frames.shift();
        } else {
          first.dt -= excess;
          first.input = withoutEdges(first.input);
          excess = 0;
        }
      }
      if (frames.length > INPUT_HISTORY_FRAMES)
        frames.splice(0, frames.length - INPUT_HISTORY_FRAMES);
    },
    take() {
      const ready = frames;
      frames = [];
      return ready;
    },
  };
}

export function nextInputSequence(game: Game, id: string, current: number) {
  const acknowledged = game.players.find((player) => player.id === id)?.seq;
  return Math.max(
    Number.isSafeInteger(current) && current >= 0 ? current : 0,
    Number.isSafeInteger(acknowledged) ? acknowledged! + 1 : 0,
  );
}
