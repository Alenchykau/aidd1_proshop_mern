#!/usr/bin/env python3
"""
simulate_wf2.py — log generator with sine-wave error rate.

Пишет события success/error в logs.json. error_rate меняется по синусоиде
с конфигурируемым периодом, чтобы WF2 (scheduled trigger n8n) видел переход
через threshold туда и обратно — фича автоматически выключается и
включается.

Usage:
    python simulate_wf2.py
    python simulate_wf2.py --duration 1800 --period 300
    python simulate_wf2.py --duration 600 --period 120 --rps 5
"""

import argparse
import json
import math
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


def sine_error_rate(t: float, period: float, amplitude: float, baseline: float) -> float:
    """Returns instantaneous error_rate at time t.

    error_rate(t) = clamp(baseline + amplitude * sin(2pi * t / period), 0, 1)
    """
    raw = baseline + amplitude * math.sin(2 * math.pi * t / period)
    return max(0.0, min(1.0, raw))


def run(
    output_path: Path,
    feature_id: str,
    duration: float,
    rps: float,
    period: float,
    amplitude: float,
    baseline: float,
) -> None:
    """Runs the log generator until duration expires."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if not output_path.exists():
        output_path.write_text("[]", encoding="utf-8")

    start = time.time()
    interval = 1.0 / rps
    last_print = -10.0

    while time.time() - start < duration:
        t = time.time() - start
        rate = sine_error_rate(t, period, amplitude, baseline)
        status = "error" if random.random() < rate else "success"

        event = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "feature_id": feature_id,
            "status": status,
            "error_rate_now": round(rate, 3),
        }

        try:
            existing = json.loads(output_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, FileNotFoundError):
            existing = []

        existing.append(event)
        # Keep file bounded so disk doesn't blow up on long runs.
        if len(existing) > 10_000:
            existing = existing[-10_000:]
        output_path.write_text(json.dumps(existing, ensure_ascii=False), encoding="utf-8")

        # Print one heartbeat every ~5 seconds so stdout isn't spammed.
        if t - last_print >= 5:
            print(f"t={int(t):>4}s  rate={rate:>5.1%}  status={status}  events={len(existing)}", flush=True)
            last_print = t

        time.sleep(interval)


def main() -> None:
    p = argparse.ArgumentParser(description="WF2 log generator (sine error rate)")
    p.add_argument(
        "--output",
        default=str(Path(__file__).resolve().parent / "logs.json"),
        help="Path to logs.json (default: homework/M5/logs.json next to this script)",
    )
    p.add_argument("--feature-id", default="search_v2")
    p.add_argument("--duration", type=float, default=1800, help="Run for N seconds (default: 1800 = 30 min)")
    p.add_argument("--rps", type=float, default=5, help="Events per second (default: 5)")
    p.add_argument("--period", type=float, default=300, help="Sine period in seconds (default: 300 = 5 min)")
    p.add_argument("--amplitude", type=float, default=0.10, help="Sine amplitude (default: 0.10)")
    p.add_argument("--baseline", type=float, default=0.05, help="Sine baseline error_rate (default: 0.05)")
    args = p.parse_args()

    output_path = Path(args.output).resolve()

    lo = max(0, args.baseline - args.amplitude)
    hi = min(1, args.baseline + args.amplitude)

    print(f"simulate_wf2.py")
    print(f"  duration:  {args.duration}s")
    print(f"  rps:       {args.rps}")
    print(f"  period:    {args.period}s  (half-cycle = {args.period / 2:.0f}s)")
    print(f"  sine:      baseline={args.baseline:.1%}, amplitude={args.amplitude:.1%}")
    print(f"  rate band: [{lo:.1%}; {hi:.1%}]")
    print(f"  thresholds (WF2): deactivate >5%, re-enable <1%")
    print(f"  output:    {output_path}")
    print(f"  feature:   {args.feature_id}")
    print("---", flush=True)

    try:
        run(
            output_path=output_path,
            feature_id=args.feature_id,
            duration=args.duration,
            rps=args.rps,
            period=args.period,
            amplitude=args.amplitude,
            baseline=args.baseline,
        )
    except KeyboardInterrupt:
        print("\nInterrupted by user.", file=sys.stderr)


if __name__ == "__main__":
    main()
