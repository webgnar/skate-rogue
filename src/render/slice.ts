// Time slicing for work spread over frames (the next floor's scenery, StreetView.tick). A long job is a generator
// that checks sliceDone() in its loops and yields when this frame's slice is spent; the frame's runner opens a slice
// with sliceStart(ms) and steps the job until it's done or the slice is. Run outside a slice (a sync build, the
// editors, tests) sliceDone() is always true, so the job just yields and the caller's run() carries straight on.
let start = 0;
let budget = -1;

export const SLICE = {
  ms: 4, // a frame's share for building the next floor: a 60 fps frame is 16.7 ms
};

export function sliceStart(ms = SLICE.ms): void {
  start = performance.now();
  budget = ms;
}

export function sliceEnd(): void {
  budget = -1;
}

export function sliceDone(): boolean {
  return budget < 0 || performance.now() - start >= budget;
}

// run a generator to its end
export function run<T>(job: Generator<void, T>): T {
  for (;;) {
    const step = job.next();
    if (step.done) return step.value;
  }
}
