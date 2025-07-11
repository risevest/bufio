import { BufIO } from "./bufio";

export function simulateJobProducer<T>(
  bufio: BufIO<T, any>,
  generator: () => T,
  count: number,
  interval: number
) {
  let sent = 0;
  const timer = setInterval(() => {
    const job = generator();
    console.log(`[Producer] Push job:`, job);
    bufio.push(job);
    sent++;
    if (sent >= count) clearInterval(timer);
  }, interval);
}
