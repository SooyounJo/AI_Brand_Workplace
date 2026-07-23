import AmbientCanvas from "./AmbientCanvas";
import LeftRail from "./LeftRail";
import SideRail from "./SideRail";
import { useRouter } from "next/router";

export default function Layout({ children }) {
  const router = useRouter();
  const isWorkspace = router.pathname.startsWith("/board");

  if (isWorkspace) {
    return <div className="site-shell site-shell--workspace">{children}</div>;
  }

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
