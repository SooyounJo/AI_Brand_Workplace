import AmbientCanvas from "./AmbientCanvas";
import LeftRail from "./LeftRail";
import SideRail from "./SideRail";

export default function Layout({ children }) {
  return (
    <div className="site-shell">
      <LeftRail />
      <div className="hero-stage">
        <AmbientCanvas />
        <div className="site-content">{children}</div>
      </div>
      <SideRail />
    </div>
  );
}
