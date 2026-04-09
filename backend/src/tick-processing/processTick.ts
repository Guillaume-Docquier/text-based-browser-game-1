let tick = 1

export function processTick(): void {
  // eslint-disable-next-line -- testing 1-2 1-2
  console.log("processing tick...", { tick: tick })
  if (tick++ >= 5) {
    throw new Error("ouch!")
  }
}
