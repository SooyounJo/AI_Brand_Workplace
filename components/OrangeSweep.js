import { useMemo } from "react";
import { useAppUI } from "@/context/AppUI";

const PILL_COUNT = 8;

export default function OrangeSweep() {
  const { boardLoading } = useAppUI();
  const pills = useMemo(
    () =>
      Array.from({ length: PILL_COUNT }, (_, i) => ({
        id: i,
        deg: i * (360 / PILL_COUNT),
      })),
    []
  );

  return (
    <div
      className={`orange-sweep${boardLoading ? " is-active" : ""}`}
      aria-hidden={!boardLoading}
      aria-busy={boardLoading}
      aria-label={boardLoading ? "Loading" : undefined}
      role={boardLoading ? "status" : undefined}
    >
      <div className="orange-sweep__base" />
      <div className="orange-sweep__glow" aria-hidden="true" />
      <div className="orange-sweep__grid" aria-hidden="true" />

      <div className="orange-sweep__swirl" aria-hidden="true">
        {pills.map((pill) => (
          <div
            key={pill.id}
            className="orange-sweep__arm"
            style={{ ["--arm-rot"]: `${pill.deg}deg` }}
          >
            <div className="orange-sweep__pill">
              <span className="orange-sweep__pill-body" />
              <span className="orange-sweep__pill-dot" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
